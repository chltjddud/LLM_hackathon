#!/bin/bash
sudo apt-get update
sudo apt-get install -y unzip curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
rm -rf shield-web
unzip shield-web.zip
cd shield-web
cp /home/ubuntu/.env.local .env.local 2>/dev/null || true
cp /home/ubuntu/.env .env 2>/dev/null || true
npm install
npm run build
sudo fuser -k 8501/tcp || true
nohup npm run start -- -p 8501 > nextjs.log 2>&1 &
echo "Deployment started on port 8501"
