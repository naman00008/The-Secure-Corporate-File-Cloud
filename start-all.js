const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting 3-Tier Enterprise Cloud System on Render...');

// 1. Start VM 3 (Vault) on port 4000
const vault = spawn('node', ['vault.js'], { 
    cwd: path.join(__dirname, 'vm3_vault'), 
    stdio: 'inherit' 
});

// 2. Start VM 2 (Processor & Frontend Gateway) on Render's assigned port
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
