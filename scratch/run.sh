#!/bin/bash
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/placement/region)
aws configure set default.region $REGION
pkill -f streamlit || true
nohup python3 -m streamlit run app.py --server.address 0.0.0.0 > streamlit.log 2>&1 < /dev/null &
echo "Configured region to $REGION and restarted streamlit"
