# Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

## Initial Setup

### 1. Install Dependencies

Install the latest versions of all packages. See [INSTALL.md](./INSTALL.md) for detailed commands, or run:

```bash
# Frontend dependencies
cd frontend
npm install react react-dom react-router-dom zustand
npm install -D @types/react @types/react-dom @vitejs/plugin-react @tailwindcss/vite tailwindcss vite

# Backend dependencies
cd ../backend
npm install @prisma/client express express-session cors dotenv @prisma/adapter-pg pg
npm install -D prisma
```

### 2. Environment Variables

Copy the example environment files and update with your values:

```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your database credentials

# Frontend environment
cd ../frontend
cp .env.example .env
# Edit .env if you need to change the API URL
```

**Backend `.env` should contain:**
```env
DATABASE_URL=postgresql://appsec:appsec_password@localhost:5432/appsec_catalog
PORT=5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-session-secret-here
```

**Frontend `.env` should contain:**
```env
VITE_API_URL=http://localhost:5000
```

**Root `.env` for docker-compose (optional):**
```env
POSTGRES_USER=appsec
POSTGRES_PASSWORD=appsec_password
POSTGRES_DB=appsec_catalog
POSTGRES_PORT=5432
```

### 3. Start PostgreSQL Database

```bash
# From the root directory
docker-compose up -d postgres
```

This will start PostgreSQL in a Docker container. The database will be available at `localhost:5432`.

### 4. Set Up Database Schema

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations (or push schema)
npm run prisma:migrate
# OR
npm run prisma:push
```

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

## Development Workflow

- **Database**: Run via Docker Compose (`docker-compose up -d postgres`)
- **Backend**: Run via `npm run dev` in the backend directory
- **Frontend**: Run via `npm run dev` in the frontend directory

## Available Endpoints

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Backend Health: http://localhost:5000/health
- Backend DB Test: http://localhost:5000/api/db-test

## Docker Compose

To stop the database:
```bash
docker-compose down
```

To stop and remove volumes (clears database):
```bash
docker-compose down -v
```

