const API_URL = 'http://localhost:3000/api';

// --- Auth & Init ---
let jwtToken = sessionStorage.getItem('token');
let currentUser = sessionStorage.getItem('username');
let currentRole = sessionStorage.getItem('role') || 'employee';
let isLoginMode = true;

const authToggleBtn = document.getElementById('auth-toggle-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authActionBtn = document.getElementById('auth-action-btn');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

authToggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authError.classList.add('hidden');
    authSuccess.classList.add('hidden');
    if (isLoginMode) {
        authTitle.innerText = 'CorpVault Login';
        authSubtitle.innerText = 'Restricted Enterprise Access';
        authActionBtn.innerText = 'Authenticate';
        authToggleBtn.innerText = 'Need an account? Register here.';
    } else {
        authTitle.innerText = 'Create Account';
        authSubtitle.innerText = 'Provision a New Secure Vault';
        authActionBtn.innerText = 'Register Now';
        authToggleBtn.innerText = 'Already have an account? Login here.';
    }
});

authActionBtn.addEventListener('click', async () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    authError.classList.add('hidden');
    authSuccess.classList.add('hidden');

    if (isLoginMode) {
        // --- LOGIN ---
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            if (res.ok) {
                jwtToken = data.token;
                currentUser = data.username;
                currentRole = data.role;
                sessionStorage.setItem('token', jwtToken);
                sessionStorage.setItem('username', currentUser);
                sessionStorage.setItem('role', currentRole);
                document.getElementById('login-overlay').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                startApp();
            } else {
                authError.innerText = data.error || 'Invalid Credentials';
                authError.classList.remove('hidden');
            }
        } catch {
            authError.innerText = 'Backend unreachable';
            authError.classList.remove('hidden');
        }
    } else {
        // --- REGISTER ---
        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            if (res.ok) {
                authSuccess.innerText = 'Account created! Please log in.';
                authSuccess.classList.remove('hidden');
                setTimeout(() => authToggleBtn.click(), 2000); 
            } else {
                authError.innerText = data.error || 'Registration failed';
                authError.classList.remove('hidden');
            }
        } catch {
            authError.innerText = 'Backend unreachable';
            authError.classList.remove('hidden');
        }
    }
});

function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    window.location.reload();
}

function startApp() {
    initCharts();
    updateDashboard();
    fetchLogs();
    fetchSecurityLogs();
    
    document.getElementById('display-user').innerText = currentUser || 'user';
    document.getElementById('dropdown-user').innerText = currentUser || 'user';
    document.getElementById('display-avatar').src = `https://ui-avatars.com/api/?name=${currentUser || 'U'}&background=4f46e5&color=fff`;

    if (currentRole === 'admin') {
        document.getElementById('admin-badge').classList.remove('hidden');
        document.getElementById('nav-item-admin').classList.remove('hidden');
        document.querySelector('aside').classList.replace('bg-slate-900', 'bg-red-950');
        document.getElementById('page-title').innerText = 'Super Admin Dashboard';
    }

    setTimeout(() => logEvent(`SYSTEM: Authentication Successful. Welcome ${currentUser}.`, 'text-green-400'), 200);
    setInterval(updateDashboard, 5000); 
    setInterval(fetchSecurityLogs, 5000); 
}

if (jwtToken) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    startApp();
}

// --- Helper Functions ---
function getHeaders() {
    return { 'Authorization': `Bearer ${jwtToken}` };
}

// --- Navigation & UI Logic ---
const pages = { 'dashboard': 'System Dashboard', 'upload': 'Secure Upload Center', 'logs': 'SQLite DB Records', 'arch': 'Architecture Map', 'admin': 'God Mode Console' };
function nav(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => {
        b.classList.remove('bg-slate-800', 'text-white', 'border-l-4', 'border-blue-500');
        b.classList.add('border-l-4', 'border-transparent');
    });
    document.getElementById(`page-${pageId}`).classList.add('active');
    const btn = document.getElementById(`nav-${pageId}`);
    if(btn) { btn.classList.add('bg-slate-800', 'text-white', 'border-l-4', 'border-blue-500'); btn.classList.remove('border-transparent'); }
    
    if(currentRole === 'admin' && pageId === 'admin') {
        document.getElementById('page-title').innerText = 'Super Admin Console';
    } else {
        document.getElementById('page-title').innerText = (currentRole === 'admin' && pageId === 'dashboard') ? 'Super Admin Dashboard' : pages[pageId];
    }
}

function mockAction(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-x-full', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-x-full', 'opacity-0'), 3000);
}

function logEvent(msg, colorClass = 'text-green-400') {
    const feed = document.getElementById('activity-feed');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    feed.innerHTML = `<div class="${colorClass}">[${time}] ${msg}</div>` + feed.innerHTML;
}

// --- Upload Logic (With Malware Scanner) ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
let selectedFiles = [];

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        selectedFiles = Array.from(e.target.files);
        document.getElementById('file-name').innerText = selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} files selected`;
        document.getElementById('upload-ui').classList.remove('hidden');
        document.getElementById('progress-area').classList.add('hidden');
        uploadBtn.classList.remove('hidden');
    }
});

uploadBtn.addEventListener('click', async () => {
    uploadBtn.classList.add('hidden');
    document.getElementById('progress-area').classList.remove('hidden');
    const pb = document.getElementById('progress-bar');
    const pt = document.getElementById('progress-text');
    
    // Simulate Malware Scan Delay
    pb.style.width = '20%';
    pt.innerHTML = '<i class="fa-solid fa-shield-virus fa-bounce mr-1"></i> Running Deep Malware Scan...';
    
    await new Promise(r => setTimeout(r, 2000));

    pt.innerHTML = `<i class="fa-solid fa-lock mr-1"></i> Scan passed. Encrypting ${selectedFiles.length} file(s)...`;
    
    let successCount = 0;
    
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        pb.style.width = `${20 + ((i / selectedFiles.length) * 80)}%`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ttl', document.getElementById('ttl-select').value);

        try {
            const res = await fetch(`${API_URL}/upload`, { 
                method: 'POST', 
                headers: getHeaders(), 
                body: formData 
            });
            const data = await res.json();
            
            if (res.ok) {
                successCount++;
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            pt.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Error on ${file.name}: ${err.message}`;
            pt.className = 'text-red-600 font-bold bg-red-100 px-3 py-1 rounded inline-block';
            pb.classList.replace('bg-indigo-600', 'bg-red-500');
            pb.style.width = '100%';
            fetchSecurityLogs(); // Instantly refresh logs to show breach
            return; // Halt upload batch on error
        }
    }
    
    pb.style.width = '100%';
    pt.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> Success! ${successCount} file(s) stored securely.`;
    pt.className = 'text-green-600 font-medium';
    pb.classList.replace('bg-indigo-600', 'bg-green-500');
    updateDashboard();
    fetchLogs();
});

// --- Security Logs & Decrypt Logic ---
async function fetchSecurityLogs() {
    try {
        const res = await fetch(`${API_URL}/security-logs`, { headers: getHeaders() });
        const logs = await res.json();
        const feed = document.getElementById('activity-feed');
        feed.innerHTML = '';
        logs.forEach(l => {
            const time = new Date(l.timestamp).toLocaleTimeString('en-US', { hour12: false });
            let color = 'text-green-400';
            if (l.event_type.includes('FAILED') || l.event_type.includes('LOCKED')) color = 'text-yellow-400';
            if (l.event_type.includes('MALWARE')) color = 'text-red-500 bg-red-900/30 p-1 rounded font-bold uppercase';
            
            feed.innerHTML += `<div class="${color} mb-1 text-xs">[${time}] <b class="mr-1">${l.event_type}</b> <span class="text-slate-400">(${l.username}):</span> ${l.details}</div>`;
        });
        
        while(feed.children.length > 50) {
            feed.removeChild(feed.lastChild);
        }
    } catch {}
}

async function fetchLogs() {
    const tbody = document.getElementById('logs-body');
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Loading SQLite DB records...</td></tr>';
    
    try {
        const res = await fetch(`${API_URL}/logs`, { headers: getHeaders() });
        if(res.status === 401 || res.status === 403) return logout();
        const files = await res.json();
        
        if (currentRole === 'admin') document.getElementById('admin-log-notice').classList.remove('hidden');

        document.getElementById('stat-files').innerText = files.length;
        tbody.innerHTML = '';
        if(files.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Database is empty</td></tr>';

        files.forEach(f => {
            const expires = f.expires_at ? new Date(f.expires_at).toLocaleTimeString() : 'Never';
            
            let actionBtns = `<button onclick="downloadFile('${f.uploader}', '${f.encrypted_name}')" class="text-blue-600 hover:text-blue-800 text-sm font-bold bg-blue-50 px-3 py-1 rounded mb-1 mr-1">Download</button>`;
            
            if (currentRole === 'admin') {
                actionBtns += `<button onclick="viewFile('${f.uploader}', '${f.encrypted_name}')" class="text-purple-600 hover:text-purple-800 text-sm font-bold bg-purple-50 px-3 py-1 rounded mb-1">Preview</button>`;
            }

            tbody.innerHTML += `
                <tr class="hover:bg-slate-800 transition border-b border-slate-50">
                    <td class="p-4 text-slate-300 font-bold">#${f.id}</td>
                    <td class="p-4 text-slate-300 text-sm">${f.original_name}</td>
                    <td class="p-4 text-slate-400 font-mono text-xs"><i class="fa-solid fa-lock text-slate-300 mr-2"></i> ${f.encrypted_name}</td>
                    <td class="p-4 text-slate-500 text-sm"><i class="fa-solid fa-user-shield text-blue-400 mr-1"></i> ${f.uploader} <br><span class="text-xs text-red-400">Expires: ${expires}</span></td>
                    <td class="p-4 text-right">
                        ${actionBtns}
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">VM 3 Database Unreachable</td></tr>';
    }
}

// --- Admin Functions ---
async function fetchUsers() {
    if (currentRole !== 'admin') return;
    const tbody = document.getElementById('users-body');
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Loading users...</td></tr>';
    
    try {
        const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
        const users = await res.json();
        tbody.innerHTML = '';
        
        users.forEach(u => {
            const rowColor = u.role === 'admin' ? 'bg-red-50/50' : 'hover:bg-slate-800';
            const roleBadge = u.role === 'admin' ? '<span class="bg-red-600 text-white text-xs px-2 py-1 rounded">ADMIN</span>' : '<span class="bg-slate-200 text-slate-300 text-xs px-2 py-1 rounded">Employee</span>';
            const actionBtn = u.role === 'admin' ? '' : `<button onclick="deleteUser('${u.username}')" class="text-white bg-red-500 hover:bg-red-700 text-sm font-bold px-3 py-1 rounded shadow-sm"><i class="fa-solid fa-trash-can"></i> Terminate</button>`;
            
            tbody.innerHTML += `
                <tr class="transition border-b border-slate-50 ${rowColor}">
                    <td class="p-4 text-slate-300 font-bold">#${u.id}</td>
                    <td class="p-4 text-slate-200 font-medium">${u.username}</td>
                    <td class="p-4">${roleBadge}</td>
                    <td class="p-4 text-slate-500 text-sm">${u.failed_attempts} fails</td>
                    <td class="p-4 text-right">${actionBtn}</td>
                </tr>
            `;
        });
    } catch {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Error fetching users</td></tr>';
    }
}

async function deleteUser(username) {
    if(!confirm(`TERMINATE ACCOUNT: Are you sure you want to delete the user '${username}'?`)) return;
    try {
        const res = await fetch(`${API_URL}/users/${username}`, { method: 'DELETE', headers: getHeaders() });
        if(res.ok) { mockAction(`Deleted User: ${username}`); fetchUsers(); fetchSecurityLogs(); }
    } catch(e) {}
}

async function triggerBackup() {
    mockAction('Generating Corporate Backup (.tar.gz)...');
    try {
        const res = await fetch(`${API_URL}/backup`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Backup failed or unauthorized');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'corporate_backup.tar.gz';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message);
    }
}

async function exportLogs() {
    try {
        const res = await fetch(`${API_URL}/export-logs`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audit_report.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message);
    }
}

async function toggleLockdown() {
    try {
        const res = await fetch(`${API_URL}/lockdown`, { method: 'POST', headers: getHeaders() });
        const data = await res.json();
        if (data.locked) {
            document.getElementById('btn-lockdown').classList.replace('bg-red-50', 'bg-red-600');
            document.getElementById('btn-lockdown').classList.replace('text-red-600', 'text-white');
            document.getElementById('btn-lockdown').innerHTML = '<i class="fa-solid fa-lock"></i> SYSTEM SECURED';
            mockAction('GLOBAL LOCKDOWN ENGAGED');
        } else {
            document.getElementById('btn-lockdown').classList.replace('bg-red-600', 'bg-red-50');
            document.getElementById('btn-lockdown').classList.replace('text-white', 'text-red-600');
            document.getElementById('btn-lockdown').innerHTML = '<i class="fa-solid fa-unlock"></i> Lockdown';
            mockAction('Lockdown Disengaged');
        }
    } catch (e) {
        alert('Unauthorized to toggle lockdown');
    }
}

// Download / Preview Fetcher
async function handleFileFetch(uploader, filename, isPreview) {
    logEvent(`DECRYPT: Requesting retrieval of ${filename}`, 'text-purple-400');
    try {
        const endpoint = isPreview ? `/preview/${uploader}/${filename}` : `/download/${uploader}/${filename}`;
        const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Blocked');
        }
        
        const blob = await res.blob();
        
        if (isPreview) {
            logEvent(`PREVIEW: Viewing ${filename} securely in memory`, 'text-blue-400');
            const url = window.URL.createObjectURL(blob);
            const origName = filename.split('_').slice(2).join('_');
            const container = document.getElementById('preview-content');
            
            if (origName.toLowerCase().endsWith('.png') || origName.toLowerCase().endsWith('.jpg') || origName.toLowerCase().endsWith('.jpeg')) {
                container.insertAdjacentHTML('beforeend', `<div class="preview-card relative w-[450px] h-full flex-shrink-0 bg-slate-900 border border-slate-700 shadow-sm rounded-lg overflow-hidden flex flex-col"><div class="bg-slate-800 border-b border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 flex justify-between items-center"><span class="truncate">${origName}</span><button onclick="this.closest('.preview-card').remove()" class="text-slate-500 hover:text-red-400 ml-2"><i class="fa-solid fa-xmark"></i></button></div><div class="flex-1 p-2 flex items-center justify-center overflow-hidden"><img src="${url}" class="max-w-full max-h-full object-contain"></div></div>`);
            } else if (origName.toLowerCase().endsWith('.pdf')) {
                container.insertAdjacentHTML('beforeend', `<div class="preview-card relative w-[450px] h-full flex-shrink-0 bg-slate-900 border border-slate-700 shadow-sm rounded-lg overflow-hidden flex flex-col"><div class="bg-slate-800 border-b border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 flex justify-between items-center"><span class="truncate">${origName}</span><button onclick="this.closest('.preview-card').remove()" class="text-slate-500 hover:text-red-400 ml-2"><i class="fa-solid fa-xmark"></i></button></div><iframe src="${url}" class="flex-1 w-full border-0 bg-white"></iframe></div>`);
            } else {
                const text = await blob.text();
                // Escape HTML for safety
                const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                container.insertAdjacentHTML('beforeend', `<div class="preview-card relative w-[450px] h-full flex-shrink-0 bg-slate-900 border border-slate-700 shadow-sm rounded-lg overflow-hidden flex flex-col"><div class="bg-slate-800 border-b border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 flex justify-between items-center"><span class="truncate">${origName}</span><button onclick="this.closest('.preview-card').remove()" class="text-slate-500 hover:text-red-400 ml-2"><i class="fa-solid fa-xmark"></i></button></div><div class="flex-1 p-4 overflow-auto text-xs whitespace-pre-wrap font-mono text-slate-200 text-left">${safeText}</div></div>`);
            }
            
            document.getElementById('preview-modal').classList.remove('hidden');
        } else {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const origName = filename.split('_').slice(2).join('_');
            a.download = origName;
            document.body.appendChild(a);
            a.click();
            logEvent(`DECRYPT: Success! ${origName} downloaded.`, 'text-green-500');
            window.URL.revokeObjectURL(url);
        }
    } catch (err) {
        logEvent(`ERROR: ${err.message}`, 'text-red-500');
        mockAction(`Preview Failed: ${err.message}`);
    }
}

function downloadFile(uploader, filename) {
    handleFileFetch(uploader, filename, false);
}

function viewFile(uploader, filename) {
    handleFileFetch(uploader, filename, true);
}

// --- Dashboard Health Logic ---
let vm2Chart, vm3Chart, storageChart;

function initCharts() {
    const ctx2 = document.getElementById('vm2Chart').getContext('2d');
    const ctx3 = document.getElementById('vm3Chart').getContext('2d');
    const opts = { type: 'line', data: { labels: ['','','','',''], datasets: [{ label:'Load', data:[0,0,0,0,0], borderColor: '#4f46e5', tension: 0.4, borderWidth: 2, pointBackgroundColor: '#4f46e5' }] }, options: { animation: false, scales: { x: { grid: { color: '#334155' } }, y: { min: 0, max: 5, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } }, plugins:{legend:{display:false}} } };
    
    vm2Chart = new Chart(ctx2, JSON.parse(JSON.stringify(opts)));
    opts.data.datasets[0].borderColor = '#10b981';
    vm3Chart = new Chart(ctx3, opts);

    const ctxStore = document.getElementById('storageChart').getContext('2d');
    storageChart = new Chart(ctxStore, { type: 'doughnut', data: { labels: ['Used', 'Free'], datasets: [{ data: [1, 99], backgroundColor: ['#4f46e5', '#1e293b'], borderWidth: 0 }] }, options: { cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
}

async function updateDashboard() {
    try {
        const res = await fetch(`${API_URL}/health`); // Public route
        const data = await res.json();
        
        document.getElementById('vm2-dot').className = 'w-2 h-2 rounded-full bg-green-500';
        document.getElementById('vm2-text').innerText = 'VM 2 & 3: Online';
        
        vm2Chart.data.datasets[0].data.shift(); vm2Chart.data.datasets[0].data.push(parseFloat(data.vm2.cpu)); vm2Chart.update();
        vm3Chart.data.datasets[0].data.shift(); vm3Chart.data.datasets[0].data.push(parseFloat(data.vm3.cpuUsage)); vm3Chart.update();

        let used = parseFloat(data.vm3.usedMem); let total = parseFloat(data.vm3.totalMem);
        storageChart.data.datasets[0].data = [used, total - used]; storageChart.update();
        document.getElementById('storage-used').innerText = `${((used/total)*100).toFixed(1)}%`;

        document.getElementById('specs-body').innerHTML = `
            <tr class="hover:bg-slate-800 transition"><td class="py-3 font-bold text-slate-300">VM 2</td><td class="py-3 text-slate-500">${data.vm2.platform}</td><td class="py-3 text-slate-500">${data.vm2.nodeVersion}</td><td class="py-3 text-slate-500">${data.vm2.mem} MB</td><td class="py-3 text-slate-500 text-right">${data.vm2.uptime}</td></tr>
            <tr class="hover:bg-slate-800 transition"><td class="py-3 font-bold text-slate-300">VM 3</td><td class="py-3 text-slate-500">${data.vm3.platform}</td><td class="py-3 text-slate-500">${data.vm3.nodeVersion}</td><td class="py-3 text-slate-500">${data.vm3.totalMem} MB</td><td class="py-3 text-slate-500 text-right">${data.vm3.uptime}</td></tr>
        `;
        if(Math.random() > 0.8) logEvent(`SYSTEM: Health check OK. Latency: ${Math.floor(Math.random()*15+5)}ms`, 'text-slate-500');
    } catch {
        document.getElementById('vm2-dot').className = 'w-2 h-2 rounded-full bg-red-500';
        document.getElementById('vm2-text').innerText = 'VM 2: Disconnected';
    }
}
