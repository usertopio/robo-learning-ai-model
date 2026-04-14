const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('✅ Connected to SQLite database (Local Mode).');
        
        db.serialize(() => {
            // 1. Projects Table
            db.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 2. Canvas Flows Table
            db.run(`CREATE TABLE IF NOT EXISTS canvas_flows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                flow_data TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);

            // 3. Datasets Table
            db.run(`CREATE TABLE IF NOT EXISTS datasets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                name TEXT NOT NULL,
                source_type TEXT,
                config_path TEXT,
                classes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);

            // 4. Training Sessions Table
            db.run(`CREATE TABLE IF NOT EXISTS training_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                status TEXT DEFAULT 'pending',
                hyperparameters TEXT,
                start_time DATETIME,
                end_time DATETIME,
                best_map REAL,
                log_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);

            // 5. Models Table
            db.run(`CREATE TABLE IF NOT EXISTS models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                name TEXT NOT NULL,
                format TEXT,
                file_path TEXT NOT NULL,
                accuracy REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE
            )`);

            console.log('🚀 SQLite schema initialized successfully.');
        });
    }
});

db.close();
