const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

app.get('/', (req, res) => {
    res.send('<h1>✅ Robo Learn AI Backend is Running!</h1>');
});

// ============================================
// API: Projects & Flows (Save/Load Canvas)
// ============================================

// 1. Get all projects
app.get('/api/projects', (req, res) => {
    const sql = `SELECT * FROM projects ORDER BY updated_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Save Canvas (Create project if not exists + Create new Flow version)
app.post('/api/save-flow', (req, res) => {
    const { name, flow_data, project_id } = req.body;
    
    if (!name || !flow_data) return res.status(400).json({ error: 'Name and flow_data are required' });

    db.serialize(() => {
        let finalProjectId = project_id;

        // If no project_id, create a new project
        if (!finalProjectId) {
            const sqlProject = `INSERT INTO projects (name) VALUES (?)`;
            db.run(sqlProject, [name], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                finalProjectId = this.lastID;
                insertFlow(finalProjectId);
            });
        } else {
            insertFlow(finalProjectId);
        }

        function insertFlow(pId) {
            const sqlFlow = `INSERT INTO canvas_flows (project_id, flow_data) VALUES (?, ?)`;
            const dataString = typeof flow_data === 'object' ? JSON.stringify(flow_data) : flow_data;
            db.run(sqlFlow, [pId, dataString], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, project_id: pId, flow_id: this.lastID });
            });
        }
    });
});

// 3. Get latest flow for a project
app.get('/api/projects/:id/flow', (req, res) => {
    const sql = `SELECT * FROM canvas_flows WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`;
    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Flow not found' });
        res.json({ ...row, flow_data: JSON.parse(row.flow_data) });
    });
});

// ============================================
// API: Training Sessions (The AI Bridge)
// ============================================

// 1. Start Training (Trigger Python later)
app.post('/api/train/start', (req, res) => {
    const { project_id, hyperparams } = req.body;
    
    const sql = `INSERT INTO training_sessions (project_id, status, hyperparameters, start_time) VALUES (?, 'training', ?, CURRENT_TIMESTAMP)`;
    const paramsString = JSON.stringify(hyperparams || {});
    
    db.run(sql, [project_id, paramsString], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // MOCK: In Phase 3, you would call:
        // exec(`python train.py --id ${this.lastID} --params '${paramsString}'`);
        
        res.json({ 
            success: true, 
            session_id: this.lastID, 
            message: 'Training session started (Mocking Python execution...)' 
        });
    });
});

// 2. Get training status for a project
app.get('/api/projects/:id/sessions', (req, res) => {
    const sql = `SELECT * FROM training_sessions WHERE project_id = ? ORDER BY start_time DESC`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ============================================
// Delete Project
// ============================================
app.delete('/api/projects/:id', (req, res) => {
    db.run(`DELETE FROM projects WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Deleted project ${req.params.id}` });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
