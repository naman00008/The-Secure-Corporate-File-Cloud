# 🖥️ Complete Oracle VirtualBox Local Setup & Demonstration Guide

This guide gives you the exact, step-by-step instructions to set up and demonstrate your **3-Tier Secure Corporate File Cloud** locally inside **Oracle VirtualBox**.

---

## 📌 Architecture in VirtualBox

```
 [ Host Machine (Mac / PC Browser) ]
                 │
                 │ http://192.168.56.101:3000 (or localhost:3000)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│               Oracle VirtualBox (Ubuntu VM)                 │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │   VM 1: Client   │  │ VM 2: Processor  │  │   VM 3:   │  │
│  │ Frontend Gateway │─▶│   AES-256 Crypto │─▶│  Vault    │  │
│  │   (Port 8080)    │  │    (Port 3000)   │  │(Port 4000)│  │
│  └──────────────────┘  └──────────────────┘  └───────────┘  │
│                               │                     │       │
│                               ▼                     ▼       │
│                        [Malware Check]      [SQLite DB &    │
│                        [RBAC & Tokens]       Ciphertext]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Step 1: VirtualBox Network Configuration (Crucial)

To access the cloud app running inside VirtualBox from your Mac/PC browser:

1. Open **Oracle VirtualBox**.
2. Select your Ubuntu Virtual Machine ➔ Click **Settings** (Gear icon) ➔ Go to **Network**.
3. Under **Adapter 1**:
   - Set **Attached to**: `NAT`
   - Click **Advanced** ➔ Click **Port Forwarding**.
   - Click the **`+` (Add)** icon and add these rules:
     | Name | Protocol | Host IP | Host Port | Guest IP | Guest Port |
     | :--- | :--- | :--- | :--- | :--- | :--- |
     | **App** | TCP | `127.0.0.1` | `3000` | *(leave blank)* | `3000` |
     | **Vault** | TCP | `127.0.0.1` | `4000` | *(leave blank)* | `4000` |
     | **SSH** | TCP | `127.0.0.1` | `2222` | *(leave blank)* | `22` |
4. Click **OK**.

---

## ⚙️ Step 2: Run the 1-Command Setup Inside Ubuntu VM

1. Start your Ubuntu VirtualBox VM and open the **Terminal** inside Ubuntu (`Ctrl + Alt + T`).
2. Run this single command:

```bash
curl -sSL https://raw.githubusercontent.com/naman00008/The-Secure-Corporate-File-Cloud/main/ec2-setup.sh | bash
```

*(This automatically installs Node.js, Git, clones your repo, installs dependencies, and boots up all 3 tiers!)*

---

## 🌐 Step 3: Accessing & Showing the App Locally

You can open the application in two ways:
1. **Inside the VirtualBox Ubuntu VM**: Open Firefox inside the VM and go to `http://localhost:3000`
2. **From your Host Mac/PC**: Open Chrome/Safari on your Mac and go to `http://localhost:3000`

---

## 🎯 Step 4: The 5-Minute Examiner Demonstration Script

Follow this sequence during your presentation:

1. **Login with RBAC**:
   - Login as Employee (`john` / `password123`). Show that John can only see his own files.
   - Upload a document. Point out the **Malware Scanner**, **AES-256 cipher generation**, and **Retention TTL**.

2. **Demonstrate File Preview & Delete**:
   - Click **`Preview`**: Show that the file decrypts in-memory in the browser.
   - Click **`Delete`**: Show that the file is purged and logged.

3. **Demonstrate Malware Attack Defense**:
   - Try uploading a file named `virus_test.exe` or `malware.pdf`.
   - Show how the **VM2 Security Gatekeeper** instantly blocks the upload and raises an alert.

4. **Login as Super Admin (`admin` / `admin123`)**:
   - Show **God Mode** view (all files across the organization).
   - Click **Emergency Lockdown**: Lock down all uploads.
   - Show **Live SQLite Security Logs** and export the Audit CSV.
   - Click **Trigger Disaster Recovery Backup** (`.tar.gz`).
