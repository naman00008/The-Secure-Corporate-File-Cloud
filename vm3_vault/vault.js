const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json({ limit: '50mb' }));

const STORAGE_DIR = path.join(__dirname, 'storage');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

// --- Database Initialization ---
const dbPath = path.join(__dirname, 'vault_logs.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS file_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT,
        encrypted_name TEXT,
        size_kb REAL,
        uploader TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at INTEGER
    )`);
});

// --- The Reaper (Self-Destruct Background Task) ---
setInterval(() => {
    const now = Date.now();
    db.all(`SELECT * FROM file_logs WHERE expires_at IS NOT NULL AND expires_at < ?`, [now], (err, rows) => {
        if (!rows || rows.length === 0) return;
        rows.forEach(row => {
            const filePath = path.join(STORAGE_DIR, row.uploader, row.encrypted_name);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Physically delete
            db.run(`DELETE FROM file_logs WHERE id = ?`, [row.id]); // Wipe record
            console.log(`[REAPER] 💀 Permanently deleted expired file: ${row.encrypted_name}`);
        });
    });
}, 10000); // Check every 10 seconds

// 1. Store File (Encrypted) & Log Metadata
app.post('/store', (req, res) => {
    const { filename, originalName, uploader, data, ttl } = req.body;
    if (!filename || !data) return res.status(400).json({ error: 'Missing data' });

    const safeUploader = uploader || 'unknown_user';
    const userDir = path.join(STORAGE_DIR, safeUploader);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    const filePath = path.join(userDir, filename);
    const fileBuffer = Buffer.from(data, 'base64');
    const sizeKB = (fileBuffer.length / 1024).toFixed(2);
    
    const expiresAt = ttl ? Date.now() + parseInt(ttl) : null;

    fs.writeFile(filePath, fileBuffer, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to write' });
        
        // Log to Database
        db.run(`INSERT INTO file_logs (original_name, encrypted_name, size_kb, uploader, expires_at) VALUES (?, ?, ?, ?, ?)`, 
            [originalName || 'unknown', filename, sizeKB, safeUploader, expiresAt], 
            (dbErr) => {
                if (dbErr) console.error("DB Log Error:", dbErr);
                console.log(`[VM 3 Vault] STORED: ${safeUploader}/${filename}`);
                res.json({ success: true });
        });
    });
});

// 2. List Files (Query Database instead of scanning folder)
app.get('/files', (req, res) => {
    db.all(`SELECT * FROM file_logs ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database query failed' });
        res.json(rows);
    });
});

// 3. Fetch File for Decryption
app.get('/fetch/:uploader/:filename', (req, res) => {
    const filePath = path.join(STORAGE_DIR, req.params.uploader, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    
    const fileBuffer = fs.readFileSync(filePath);
    res.json({ data: fileBuffer.toString('base64') });
});

// 4. System Backup (Disaster Recovery)
app.get('/backup', (req, res) => {
    const backupPath = path.join(__dirname, 'temp_backup.tar.gz');
    // Compress storage folder and sqlite DB using native tar
    const { exec } = require('child_process');
    exec(`tar -czf temp_backup.tar.gz storage vault_logs.db`, { cwd: __dirname }, (error) => {
        if (error) return res.status(500).json({ error: 'Backup generation failed' });
        res.download(backupPath, 'corporate_backup.tar.gz', () => {
            if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); // cleanup
        });
    });
});

// 5. System Health
app.get('/health', (req, res) => {
    let usedMem = (os.totalmem() - os.freemem()) / 1024 / 1024;
    res.json({
        cpuUsage: os.loadavg()[0].toFixed(2),
        freeMem: (os.freemem() / 1024 / 1024).toFixed(0),
        totalMem: (os.totalmem() / 1024 / 1024).toFixed(0),
        usedMem: usedMem.toFixed(0),
        uptime: (os.uptime() / 3600).toFixed(1) + ' hrs',
        platform: os.platform() + ' ' + os.release(),
        nodeVersion: process.version
    });
});

// 6. Delete File & Metadata
app.delete('/file/:uploader/:filename', (req, res) => {
    const { uploader, filename } = req.params;
    const filePath = path.join(STORAGE_DIR, uploader, filename);
    
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.error("File unlink error:", e);
        }
    }
    
    db.run(`DELETE FROM file_logs WHERE encrypted_name = ? AND uploader = ?`, [filename, uploader], function(err) {
        if (err) return res.status(500).json({ error: 'Database delete failed' });
        console.log(`[VM 3 Vault] 🗑️ DELETED: ${uploader}/${filename}`);
        res.json({ success: true, message: 'File deleted from vault and database' });
    });
});

app.listen(4000, '0.0.0.0', () => {
    console.log('VM 3 (Vault) running on port 4000 with SQLite DB attached');
});
