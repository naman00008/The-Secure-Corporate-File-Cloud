# Secure Corporate File Cloud - Deployment Guide

This is your complete multi-VM architecture for your AWS Project!
Here is exactly how to deploy these folders to your 3 EC2 instances:

## VM 3: The Storage Vault (Private Subnet)
1. Launch an Ubuntu EC2 instance in a private subnet.
2. Install Node.js: `sudo apt update && sudo apt install nodejs npm`
3. Copy the **`vm3_vault/`** folder to this instance.
4. Run: `npm install` then `node vault.js`
5. Note this instance's **Private IP address**.
6. **Security Group:** Open Port **4000** and allow traffic *only* from VM 2.

## VM 2: The Processing Node (Private Subnet)
1. Launch an Ubuntu EC2 instance in a private subnet.
2. Install Node.js.
3. Copy the **`vm2_processor/`** folder to this instance.
4. Run: `npm install`
5. Set the VM 3 URL variable to point to VM 3's private IP:
   ```bash
   export VM3_URL="http://[VM_3_PRIVATE_IP]:4000/store"
   ```
6. Run: `node processor.js`
7. Note this instance's **Public IP or Private IP** (depending on how you connect VM 1).
8. **Security Group:** Open Port **3000** and allow traffic *only* from VM 1.

## VM 1: The Web Gateway (Public Subnet)
1. Launch an Ubuntu EC2 instance in a public subnet.
2. Install Nginx: `sudo apt update && sudo apt install nginx`
3. Copy the files inside the **`vm1_frontend/`** folder into `/var/www/html/`.
4. **CRITICAL:** Open `app.js` and change `API_URL` on line 2 to point to the IP of VM 2:
   ```javascript
   const API_URL = 'http://[VM_2_IP]:3000/api';
   ```
5. **Security Group:** Open Port **80** (HTTP) from ANYWHERE (0.0.0.0/0) so you can view the website.

## The Demonstration
Visit the Public IP of VM 1. Upload a file.
Then, log into the terminal of VM 3, and type `cat storage/encrypted_[filename]`.
Show your professor the terminal output: it will be a giant mess of encrypted text, proving that your data is totally secure!
