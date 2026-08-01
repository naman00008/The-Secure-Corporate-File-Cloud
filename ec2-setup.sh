#!/bin/bash
# ==============================================================================
# AWS EC2 Automated Deployment Script for Secure Corporate File Cloud
# OS: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (AWS EC2 t2.micro / t3.micro Free Tier)
# ==============================================================================

set -e

echo "🚀 [1/5] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

echo "📦 [2/5] Installing Node.js 20.x, Git, and Build Tools..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential sqlite3

echo "⚙️ [3/5] Installing PM2 Process Manager globally..."
sudo npm install -g pm2

echo "📂 [4/5] Cloning repository..."
cd /home/ubuntu
if [ -d "The-Secure-Corporate-File-Cloud" ]; then
    cd The-Secure-Corporate-File-Cloud
    git pull
else
    git clone https://github.com/naman00008/The-Secure-Corporate-File-Cloud.git
    cd The-Secure-Corporate-File-Cloud
fi

echo "📦 [5/5] Installing microservice dependencies..."
cd vm2_processor && npm install && cd ../vm3_vault && npm install
cd ..

echo "🛡️ Starting Secure Corporate File Cloud on PM2..."
pm2 delete secure-cloud || true
pm2 start start-all.js --name "secure-cloud"
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu || true

echo "=============================================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "Your Secure Corporate File Cloud is now running live 24/7 on AWS EC2!"
echo "Access URL: http://$(curl -s http://checkip.amazonaws.com):3000"
echo "=============================================================================="
