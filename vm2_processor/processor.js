const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const upload = multer({ dest: 'temp/' });

const VM3_URL = process.env.VM3_URL || 'http://localhost:4000';
const ENCRYPTION_KEY = crypto.createHash('sha256').update('corporate-secret-key-12345').digest('base');
const IV = Buffer.alloc(16, 0);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-jwt-secret';

// --- User Database Initialization (VM 2 Auth Node) ---
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'employee',
        failed_attempts INTEGER DEFAULT 0,
        locked_until INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT,
        username TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

function logSecurityEvent(type, user, details) {
    db.run(`INSERT INTO security_events (event_type, username, details) VALUES (?, ?, ?)`, [type, user, details]);
}

// --- Email Configuration (Ethereal) ---
let transporter;
nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.error('Failed to create a testing account. ' + err.message);
        return;
    }
    transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass
        }
    });
    console.log('Ethereal Email Server Ready. Emails will be logged to console.');
});

// In-memory OTP store: { email: { otp, expires } }
const otpStore = {};

// --- Authentication (JWT & bcrypt) ---


// --- Utilities ---
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp, context) {
    if (!transporter) return;
    const mailOptions = {
        from: '"CorpVault Security" <no-reply@corpvault.com>',
        to: email,
        subject: `Your OTP for ${context}`,
        text: `Your secure code is: ${otp}. Do not share this with anyone.`
    };
    try {
        let info = await transporter.sendMail(mailOptions);
        const url = nodemailer.getTestMessageUrl(info);
        console.log(`[OTP] Sent to ${email}: ${otp}`);
        console.log('Preview URL: %s', url);
        return url;
    } catch(e) {
        console.error('Email failed:', e);
    }
}

// --- Authentication (Real Email 2FA) ---

app.post('/api/send-otp', (req, res) => {
    const { email, context } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    if (context === 'register') {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
            if (user) return res.status(400).json({ error: 'Email already registered' });
            const otp = generateOTP();
            otpStore[email] = { otp, expires: Date.now() + 5 * 60000 };
            sendOTPEmail(email, otp, 'Registration').then(url => {
                res.json({ success: true, message: 'OTP sent', previewUrl: url });
            });
        });
    } else if (context === 'reset') {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
            if (!user) return res.status(404).json({ error: 'Email not found' });
            const otp = generateOTP();
            otpStore[email] = { otp, expires: Date.now() + 5 * 60000 };
            sendOTPEmail(email, otp, 'Password Reset').then(url => {
                res.json({ success: true, message: 'OTP sent', previewUrl: url });
            });
        });
    } else {
        res.status(400).json({ error: 'Invalid context' });
    }
});

app.post('/api/register', (req, res) => {
    const { username, password, email, otp } = req.body;
    if (!username || !password || !email || !otp) return res.status(400).json({ error: 'Missing fields' });
    
    if (username.toLowerCase() === 'admin') {
        return res.status(403).json({ error: 'Admin cannot be registered via UI' });
    }

    const storedOtp = otpStore[email];
    if (!storedOtp || storedOtp.otp !== otp || storedOtp.expires < Date.now()) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Hashing failed' });
        
        db.run(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`, [username, email, hash, 'employee'], function(dbErr) {
            if (dbErr) return res.status(400).json({ error: 'Username or email already exists' });
            delete otpStore[email];
            logSecurityEvent('USER_REGISTERED', username, `Email verified and registered`);
            
            const token = jwt.sign({ user: username, role: 'employee' }, JWT_SECRET, { expiresIn: '2h' });
            res.json({ success: true, token, username, role: 'employee' });
        });
    });
});

app.post('/api/login-step1', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        
        if (user.locked_until > Date.now()) {
            return res.status(403).json({ error: 'Account locked.' });
        }
        
        bcrypt.compare(password, user.password_hash, (bcryptErr, match) => {
            if (match) {
                if (user.role === 'admin') {
                    db.run(`UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?`, [user.id]);
                    const token = jwt.sign({ user: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
                    logSecurityEvent('LOGIN_SUCCESS', username, `Admin logged in (2FA Bypassed)`);
                    return res.json({ success: true, token, username: user.username, role: user.role });
                }
                
                const otp = generateOTP();
                otpStore[user.email] = { otp, expires: Date.now() + 5 * 60000 };
                sendOTPEmail(user.email, otp, 'Secure Login').then(url => {
                    res.json({ requireOtp: true, email: user.email, message: 'OTP sent to registered email', previewUrl: url });
                });
            } else {
                db.run(`UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?`, [user.id]);
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
    });
});

app.post('/api/login-step2', (req, res) => {
    const { username, otp } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid user' });
        
        const storedOtp = otpStore[user.email];
        if (!storedOtp || storedOtp.otp !== otp || storedOtp.expires < Date.now()) {
            logSecurityEvent('LOGIN_FAILED', username, 'Invalid OTP attempt');
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }
        
        delete otpStore[user.email];
        db.run(`UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?`, [user.id]);
        const token = jwt.sign({ user: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
        logSecurityEvent('LOGIN_SUCCESS', username, `Logged in with 2FA`);
        res.json({ success: true, token, username: user.username, role: user.role });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    
    const storedOtp = otpStore[email];
    if (!storedOtp || storedOtp.otp !== otp || storedOtp.expires < Date.now()) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
    }
    
    bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Hashing failed' });
        db.run(`UPDATE users SET password_hash = ? WHERE email = ?`, [hash, email], function(dbErr) {
            delete otpStore[email];
            logSecurityEvent('PASSWORD_RESET', email, `Password reset via OTP`);
            res.json({ success: true, message: 'Password reset successfully' });
        });
    });
});

let SYSTEM_LOCKED = false;

function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided. Access Denied.' });
    
    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized token' });
        req.user = decoded; // { user: 'username', role: 'admin' }
        
        if (SYSTEM_LOCKED && req.user.role !== 'admin') {
            return res.status(423).json({ error: 'SYSTEM SECURED. ALL ACTIONS LOCKED BY ADMIN.' });
        }
        next();
    });
}

// --- API ROUTES ---

// Toggle Lockdown
app.post('/api/lockdown', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    SYSTEM_LOCKED = !SYSTEM_LOCKED;
    const status = SYSTEM_LOCKED ? 'ENGAGED' : 'DISENGAGED';
    logSecurityEvent('SYSTEM_LOCKDOWN', req.user.user, `Global Lockdown ${status}`);
    res.json({ success: true, locked: SYSTEM_LOCKED });
});

// 1. Upload, Malware Scan & Encrypt (Protected)
app.post('/api/upload', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const originalPath = req.file.path;
    const ttl = req.body.ttl; 
    
    // Simulated Malware Scanner
    if (req.file.originalname.toLowerCase().includes('virus')) {
        fs.unlinkSync(originalPath);
        logSecurityEvent('MALWARE_DETECTED', req.user.user, `Attempted to upload malicious file: ${req.file.originalname}`);
        return res.status(406).json({ error: 'Malware Detected! Upload Blocked and Logged.' });
    }

    const encryptedFilename = `enc_${Date.now()}_${req.file.originalname}`;
    const encryptedPath = path.join(TEMP_DIR, encryptedFilename);

    try {
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
        const input = fs.createReadStream(originalPath);
        const output = fs.createWriteStream(encryptedPath);
        
        input.pipe(cipher).pipe(output);

        output.on('finish', async () => {
            try {
                const encryptedData = fs.readFileSync(encryptedPath);
                await axios.post(`${VM3_URL}/store`, {
                    filename: encryptedFilename,
                    originalName: req.file.originalname,
                    uploader: req.user.user,
                    ttl: ttl,
                    data: encryptedData.toString('base64')
                });
                
                fs.unlinkSync(originalPath);
                fs.unlinkSync(encryptedPath);
                res.json({ success: true, filename: encryptedFilename });
            } catch (err) {
                res.status(500).json({ error: 'VM 3 Vault Unreachable.' });
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Encryption failed.' });
    }
});

// Helper for download/preview
async function decryptFromVault(uploader, filename, res, isPreview) {
    try {
        const response = await axios.get(`${VM3_URL}/fetch/${uploader}/${filename}`);
        const encryptedData = Buffer.from(response.data.data, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const origName = filename.split('_').slice(2).join('_');
        
        if (isPreview) {
            // Try to guess mime type
            let mime = 'text/plain';
            if(origName.endsWith('.pdf')) mime = 'application/pdf';
            if(origName.endsWith('.png')) mime = 'image/png';
            if(origName.endsWith('.jpg') || origName.endsWith('.jpeg')) mime = 'image/jpeg';
            
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Disposition', `inline; filename="${origName}"`);
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${origName}"`);
        }
        
        res.send(decrypted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to decrypt file.' });
    }
}

app.get('/api/download/:uploader/:filename', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.user !== req.params.uploader) return res.status(403).json({ error: 'Unauthorized file access' });
    await decryptFromVault(req.params.uploader, req.params.filename, res, false);
});

app.get('/api/preview/:uploader/:filename', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.user !== req.params.uploader) return res.status(403).json({ error: 'Unauthorized file access' });
    await decryptFromVault(req.params.uploader, req.params.filename, res, true);
});

// 3. Get Logs (RBAC Isolated)
app.get('/api/logs', verifyToken, async (req, res) => {
    try {
        const response = await axios.get(`${VM3_URL}/files`);
        const allFiles = response.data;
        
        if (req.user.role === 'admin') {
            res.json(allFiles); // God Mode: Sees all
        } else {
            const userFiles = allFiles.filter(file => file.uploader === req.user.user);
            res.json(userFiles);
        }
    } catch (err) {
        res.status(500).json({ error: 'VM 3 Unreachable' });
    }
});

// 4. Get Security Events Feed
app.get('/api/security-logs', verifyToken, (req, res) => {
    db.all(`SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 20`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// CSV Export
app.get('/api/export-logs', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    db.all(`SELECT * FROM security_events ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).send('Error');
        
        let csv = 'ID,Event_Type,Username,Details,Timestamp\n';
        rows.forEach(r => {
            // wrap in quotes to escape commas
            csv += `"${r.id}","${r.event_type}","${r.username}","${r.details}","${r.timestamp}"\n`;
        });
        
        logSecurityEvent('REPORT_EXPORT', req.user.user, `Exported Audit Report CSV`);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_report.csv"');
        res.send(csv);
    });
});

// System Backup (Proxy to VM3)
app.get('/api/backup', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        logSecurityEvent('SYSTEM_BACKUP', req.user.user, `Triggered Full Disaster Recovery Backup`);
        // Stream the backup file directly to the client
        const response = await axios({
            method: 'get',
            url: `${VM3_URL}/backup`,
            responseType: 'stream'
        });
        res.setHeader('Content-Disposition', 'attachment; filename="corporate_backup.tar.gz"');
        response.data.pipe(res);
    } catch(err) {
        res.status(500).json({ error: 'Backup failed' });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const vm3Health = await axios.get(`${VM3_URL}/health`);
        res.json({
            status: 'online',
            locked: SYSTEM_LOCKED,
            vm2: { 
                cpu: os.loadavg()[0].toFixed(2), 
                mem: (os.freemem() / 1024 / 1024).toFixed(0),
                uptime: (os.uptime() / 3600).toFixed(1) + ' hrs',
                platform: os.platform() + ' ' + os.release(),
                nodeVersion: process.version
            },
            vm3: vm3Health.data
        });
    } catch (err) {
        res.status(500).json({ error: 'VM 3 Offline' });
    }
});

// 5. Admin Console Routes (RBAC)
app.get('/api/users', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT id, username, role, failed_attempts, created_at FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

app.delete('/api/users/:username', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.params.username === 'admin') return res.status(400).json({ error: 'Cannot delete Super Admin' });
    
    db.run(`DELETE FROM users WHERE username = ?`, [req.params.username], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete' });
        logSecurityEvent('USER_DELETED', req.user.user, `Deleted account: ${req.params.username}`);
        res.json({ success: true });
    });
});

app.listen(3000, () => console.log('VM 2 (Processor) running on port 3000 with Backups, Lockdown, Previews'));
