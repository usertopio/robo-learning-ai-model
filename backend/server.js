const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { promisify } = require('util');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'ai-teachstack-secret-key';

// --- Database Setup (Promisified) ---
const db = new sqlite3.Database('./database.sqlite');
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

const initDb = async () => {
    try {
        await dbRun("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)");
        await dbRun("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, nodes TEXT, edges TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
        console.log('✅ Database initialized');
    } catch (err) {
        console.error('❌ DB Init Error:', err.message);
    }
};
initDb();

app.use(cors());
app.use(bodyParser.json());

// --- Global State ---
let globalFlow = { nodes: [], edges: [] };
let globalAiRunning = false;
let globalTargetClasses = '';

// --- Middleware ---
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token || token === 'null') return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Failed to authenticate token' });
        req.userId = decoded.id;
        next();
    });
};

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 8);
        await dbRun("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword]);
        res.status(201).json({ success: true, message: 'Registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Username already exists or DB error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ auth: true, token, user: { id: user.id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Project Routes ---
app.get('/api/projects', authenticate, async (req, res) => {
    try {
        const projects = await dbAll("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC", [req.userId]);
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

app.post('/api/save-flow', authenticate, async (req, res) => {
    try {
        const { name, flow_data, project_id } = req.body;
        const nodesStr = JSON.stringify(flow_data?.nodes || []);
        const edgesStr = JSON.stringify(flow_data?.edges || []);

        if (project_id) {
            await dbRun("UPDATE projects SET name = ?, nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                [name, nodesStr, edgesStr, project_id, req.userId]);
            res.json({ project_id, updated: true });
        } else {
            const result = await dbRun("INSERT INTO projects (user_id, name, nodes, edges) VALUES (?, ?, ?, ?)",
                [req.userId, name || 'Untitled', nodesStr, edgesStr]);
            // Note: In sqlite3 promisified, 'this' context is tricky, but dbRun usually returns result object in some wrappers.
            // For simple sqlite3, we can fetch lastID via a separate query if needed, or use a better wrapper.
            // Here we'll just assume success for now or refactor to better library like 'sqlite' (v5).
            res.json({ success: true, message: 'Project created' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to save project' });
    }
});

app.get('/api/projects/:id/flow', authenticate, async (req, res) => {
    try {
        const row = await dbGet("SELECT * FROM projects WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
        if (!row) return res.status(404).json({ error: 'Project not found' });
        res.json({
            id: row.id,
            name: row.name,
            flow_data: {
                nodes: JSON.parse(row.nodes || '[]'),
                edges: JSON.parse(row.edges || '[]')
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal error' });
    }
});

// --- Training & AI Control ---
app.post('/api/train/start', authenticate, (req, res) => {
    const { mode, hyperparams } = req.body;
    if (!mode?.includes('Training')) {
        return res.status(400).json({ error: 'Please select "Training" mode' });
    }
    
    io.emit('start_training', { mode, hyperparams: hyperparams || {} });
    globalAiRunning = true;
    io.emit('ai_system_sync', { running: true });
    
    res.json({ message: 'Training started' });
});

// --- Socket.IO Handlers ---
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    const syncToClient = () => {
        socket.emit('ai_flow_sync', globalFlow);
        socket.emit('ai_system_sync', { running: globalAiRunning });
        socket.emit('ai_search_sync', globalTargetClasses);
    };

    socket.on('join_robot_room', (robotId) => {
        socket.join(robotId);
        if (robotId === 'WEBCAM_PROCESSED') syncToClient();
    });

    socket.on('flow_topology_update', (data) => {
        globalFlow = data;
        io.emit('ai_flow_sync', data);
    });

    socket.on('ai_system_toggle', (data) => {
        globalAiRunning = data.running;
        io.emit('ai_system_sync', data);
    });

    // Relay handlers
    socket.on('video_frame_from_robot', (data) => socket.to(data.robotId).emit('stream_to_web', data.image));
    socket.on('video_frame_from_webcam', (data) => io.emit('ai_webcam_frame', data));
    socket.on('training_progress', (data) => io.emit('ai_training_progress', data));
    
    socket.on('send_command_to_robot', (data) => {
        console.log(`🤖 Command to ${data.robotId}: ${data.command}`);
        io.to(data.robotId).emit('robot_execute', data);
    });

    socket.on('robot_ping', (data) => {
        io.emit('robot_online', { robotId: data.robotId, ts: Date.now() });
        syncToClient();
    });

    socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
