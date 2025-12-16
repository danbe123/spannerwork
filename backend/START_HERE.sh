#!/bin/bash

# SpannerWork - Complete Setup Commands
# Run these commands one by one

echo "🐳 Step 1: Start Docker Service"
echo "================================"
echo "Run: sudo service docker start"
echo ""
read -p "Press Enter after running the above command..."

echo ""
echo "👤 Step 2: Add your user to docker group"
echo "=========================================="
echo "Run: sudo usermod -aG docker $USER"
echo ""
echo "⚠️  After this, you MUST close this terminal and open a new one!"
echo ""
read -p "Press Enter after running the above command..."

echo ""
echo "✅ Step 3: Verify Docker is working (in NEW terminal)"
echo "====================================================="
echo "Run: docker --version"
echo ""
read -p "Press Enter after verifying Docker works..."

echo ""
echo "🚀 Step 4: Start PostgreSQL and Redis"
echo "======================================"
echo "Run: cd /home/dan/wrench && docker compose up postgres redis -d"
echo ""
read -p "Press Enter after running the above command..."

echo ""
echo "⏳ Step 5: Wait for databases to be ready"
echo "=========================================="
echo "Waiting 10 seconds for databases to initialize..."
sleep 10
echo "✅ Should be ready now!"

echo ""
echo "🗄️  Step 6: Run database migrations"
echo "===================================="
cd /home/dan/wrench/backend
npm run db:migrate

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "To start the backend server:"
echo "  cd /home/dan/wrench/backend"
echo "  npm run dev"
echo ""
echo "Then visit:"
echo "  - Health Check: http://localhost:3000/health"
echo "  - API Info: http://localhost:3000/api/v1"
