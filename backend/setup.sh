#!/bin/bash

# SpannerWork Backend Setup Script
# This script helps you get started with the backend development environment

set -e

echo "🔧 SpannerWork Backend Setup"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not installed${NC}"
    echo "Docker is recommended for local development (PostgreSQL + Redis)"
    echo "You can install it from https://www.docker.com/"
else
    echo -e "${GREEN}✅ Docker version: $(docker --version)${NC}"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "📝 Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env with your configuration${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

echo ""
echo "🐳 Starting Docker services..."
if command -v docker &> /dev/null; then
    cd ..
    docker-compose up postgres redis -d
    cd backend
    echo -e "${GREEN}✅ Docker services started${NC}"
    echo "Waiting for database to be ready..."
    sleep 5
else
    echo -e "${YELLOW}⚠️  Docker not available, skipping...${NC}"
    echo "Please ensure PostgreSQL and Redis are running manually"
fi

echo ""
echo "🗄️  Running database migrations..."
if npm run db:migrate; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${RED}❌ Database migration failed${NC}"
    echo "Please check your DATABASE_URL in .env file"
    exit 1
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env file with your configuration"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Open http://localhost:3000/health to verify"
echo ""
echo "Optional:"
echo "  - Run 'npm run db:seed' to add test data"
echo "  - Run 'npm run db:studio' to open Prisma Studio"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
