const { spawn } = require('child_process');
const path = require('path');

console.clear();
console.log('\x1b[36m%s\x1b[0m', '================================================================================');
console.log('\x1b[1m\x1b[32m%s\x1b[0m', ' 🚀 3-TIER SECURE CORPORATE FILE CLOUD - LOCAL HOST DEPLOYMENT');
console.log('\x1b[36m%s\x1b[0m', '================================================================================');
console.log('\x1b[33m%s\x1b[0m', ' 🌐 [VM 1: Web Frontend Gateway]   ➔ http://localhost:3000 (Interactive Web UI)');
console.log('\x1b[35m%s\x1b[0m', ' 🛡️ [VM 2: Security Processor]     ➔ Port 3000 (AES-256 Crypto & Malware Engine)');
console.log('\x1b[34m%s\x1b[0m', ' 🗄️ [VM 3: Storage Vault & DB]     ➔ Port 4000 (Ciphertext Storage & SQLite DB)');
console.log('\x1b[36m%s\x1b[0m', '================================================================================\n');

// 1. Start VM 3 (Vault) on port 4000
const vault = spawn('node', ['vault.js'], { 
    cwd: path.join(__dirname, 'vm3_vault'), 
    stdio: 'inherit' 
});

// 2. Start VM 2 (Processor & Frontend Gateway) on assigned port
const processor = spawn('node', ['processor.js'], { 
    cwd: path.join(__dirname, 'vm2_processor'), 
    stdio: 'inherit',
    env: { 
        ...process.env, 
        PORT: process.env.PORT || 3000, 
        VM3_URL: 'http://127.0.0.1:4000' 
    }
});

function cleanup() {
    console.log('Shutting down services...');
    vault.kill();
    processor.kill();
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
