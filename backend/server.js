import express from 'express';
import session from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma, disconnectPrisma } from './prisma/client.js';
import { initializeAdminUsers } from './utils/adminInit.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import companyRoutes from './routes/companies.js';
import applicationRoutes from './routes/applications.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import invitationRoutes from './routes/invitations.js';
import domainRoutes from './routes/domains.js';
import deploymentTokenRoutes from './routes/deploymentTokens.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Determine if we're using HTTPS based on FRONTEND_URL
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const isHttps = frontendUrl.startsWith('https://');

// Extract domain from FRONTEND_URL for cookie domain setting
// e.g., "https://appsec.example.com" -> "appsec.example.com"
// or "http://appsec.local" -> "appsec.local"
let cookieDomain = undefined;
try {
  const url = new URL(frontendUrl);
  cookieDomain = url.hostname;
  // Don't set domain for localhost (causes issues)
  if (cookieDomain === 'localhost' || cookieDomain === '127.0.0.1') {
    cookieDomain = undefined;
  }
} catch (e) {
  // Invalid URL, leave cookieDomain undefined
}

console.log('🔧 Cookie Configuration:');
console.log(`   FRONTEND_URL: ${frontendUrl}`);
console.log(`   HTTPS: ${isHttps}`);
console.log(`   Cookie Domain: ${cookieDomain || 'not set (default)'}`);
console.log(`   Secure Cookies: ${isHttps}`);

// Trust proxy - this allows Express to correctly detect HTTPS from X-Forwarded-Proto header
// This is critical when behind a reverse proxy like Caddy
app.set('trust proxy', true);

// Middleware - CORS configuration
// Allow requests from FRONTEND_URL or dynamically from the request origin
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Extract the origin domain for comparison
    let allowedOrigin = frontendUrl;
    try {
      const frontendUrlObj = new URL(frontendUrl);
      const originUrlObj = new URL(origin);
      
      // Allow if origin matches FRONTEND_URL (same domain)
      if (originUrlObj.hostname === frontendUrlObj.hostname) {
        return callback(null, true);
      }
      
      // Allow if origin is exactly FRONTEND_URL
      if (origin === frontendUrl) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid URL, deny
    }
    
    // Default: allow FRONTEND_URL
    callback(null, allowedOrigin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Session configuration
// Using PrismaSessionStore to store sessions in the database (scalable, survives restarts)
// NOTE: secure is set to false for HTTP. For HTTPS in production, set secure: true
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false, // Don't save session if unmodified (PrismaSessionStore handles this)
  saveUninitialized: false,
  store: new PrismaSessionStore(
    prisma,
    {
      checkPeriod: 2 * 60 * 1000, // Check for expired sessions every 2 minutes
      dbRecordIdIsSessionId: true, // Use session ID as the database record ID
      dbRecordIdFunction: undefined, // Use default ID generation
    }
  ),
  cookie: {
    secure: false, // Set to true for HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // 'lax' works for same-site requests (which this is through Caddy proxy)
  },
};

// Set cookie domain if we have a domain (not localhost)
if (cookieDomain) {
  sessionConfig.cookie.domain = cookieDomain;
}

app.use(session(sessionConfig));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/deployment-tokens', deploymentTokenRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Database connection test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Try a simple query
    const userCount = await prisma.user.count();
    
    res.json({ 
      status: 'success', 
      message: 'Database connection successful',
      userCount 
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// Initialize admin users on startup
initializeAdminUsers().catch(error => {
  console.error('Failed to initialize admin users:', error);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 DB test: http://localhost:${PORT}/api/db-test`);
});


