const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 8080;

// ====================
// JWT Secret (fail fast)
// ====================
// Must be injected from the environment. Falling back to a hard-coded default
// would mean verifying signatures against a value that is public in this repo,
// i.e. anyone could forge a token. Refuse to start instead of pretending to
// protect the routes. The 32-byte floor matches the Java side, where
// Keys.hmacShaKeyFor() rejects anything shorter than 256 bits.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    '[FATAL] JWT_SECRET is not set. The gateway cannot verify tokens without it — refusing to start.'
  );
  process.exit(1);
}
if (Buffer.byteLength(JWT_SECRET, 'utf8') < 32) {
  console.error(
    '[FATAL] JWT_SECRET must be at least 32 bytes to match the signing key on user-service — refusing to start.'
  );
  process.exit(1);
}

// Trust the first proxy (Nginx Ingress) for X-Forwarded-For headers
app.set('trust proxy', 1);

// Service URLs (Internal K8S DNS)
const USER_SERVICE_URL = `http://${process.env.USER_SERVICE_HOST || 'user-service'}:${process.env.USER_SERVICE_PORT || 3002}`;
const WAFER_BI_URL = `http://${process.env.WAFER_BI_HOST || 'wafer-backend-svc.k8sdemo.svc.cluster.local'}:${process.env.WAFER_BI_PORT || 8000}`;
const AI_MCP_URL = `http://${process.env.AI_MCP_SERVICE_HOST || 'ai-mcp-service'}:${process.env.AI_MCP_SERVICE_PORT || 8001}`;
const LICENSE_SERVICE_URL = `http://${process.env.LICENSE_SERVICE_HOST || 'license-service'}:${process.env.LICENSE_SERVICE_PORT || 8005}`;

// ====================
// Prometheus Metrics
// ====================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ====================
// Middleware
// ====================
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
// Removed express.json() from here because it breaks http-proxy-middleware

// Simple Trace ID Propagation
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || require('crypto').randomBytes(8).toString('hex');
  req.headers['x-trace-id'] = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Increased for demo stability
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Debug Logging for all requests
app.use((req, res, next) => {
  console.log(`[Gateway Incoming] ${req.method} ${req.originalUrl}`);
  next();
});

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.path, status_code: res.statusCode },
      duration
    );
    httpRequestTotal.inc({
      method: req.method,
      route: req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

// ====================
// JWT Authentication Middleware
// ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Pin to the HMAC family: user-service signs with Keys.hmacShaKeyFor(), so
  // anything else (notably 'none' or an asymmetric alg) is an attack, not a client.
  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256', 'HS384', 'HS512'] }, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ====================
// Health Check Endpoints
// ====================
app.get(['/healthz', '/api/healthz'], (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'api-gateway' });
});

app.get(['/readyz', '/api/readyz'], (req, res) => {
  res.status(200).json({ status: 'ready', service: 'api-gateway' });
});

app.get(['/test-gateway', '/api/test-gateway'], (req, res) => {
  res.status(200).json({ 
    message: 'Gateway is reachable',
    receivedPath: req.originalUrl,
    version: '1.0.0-agnostic'
  });
});

// ====================
// System Info & Compatibility API
// ====================
app.get('/api/system/info', async (req, res) => {
  const systemInfo = {
    system_name: "Wafer BI Platform",
    system_version: "1.0.0",
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    services: {
      "api-gateway": {
        version: "1.0.0",
        status: "UP"
      },
      "user-service": {
        version: "1.0.0",
        endpoint: USER_SERVICE_URL,
        status: "UP"
      },
      "wafer-bi": {
        version: "1.0.0",
        endpoint: WAFER_BI_URL,
        status: "UP"
      }
    }
  };

  res.json(systemInfo);
});

// ====================
// Prometheus Metrics Endpoint
// ====================
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ====================
// Service Proxies (Root-mounted for precise path matching)
// ====================


// 1. Auth & Users (Java Service) - Rewrite /api/auth -> /auth
app.use(
  createProxyMiddleware('/api/auth', {
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '/auth' },
    onProxyReq: (proxyReq) => console.log(`[Proxy Auth] -> ${USER_SERVICE_URL}${proxyReq.path}`)
  })
);

// Support direct /auth prefix (as routed by Ingress)
app.use(
  createProxyMiddleware('/auth', {
    target: USER_SERVICE_URL,
    changeOrigin: true,
    // No path rewrite needed for /auth -> /auth
    onProxyReq: (proxyReq) => console.log(`[Proxy Auth Direct] -> ${USER_SERVICE_URL}${proxyReq.path}`)
  })
);

// Auth check for user management (must be a real middleware, not a proxy option)
app.use('/api/users', authenticateToken);
app.use(
  createProxyMiddleware('/api/users', {
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/users' },
    onProxyReq: (proxyReq) => console.log(`[Proxy Users] -> ${USER_SERVICE_URL}${proxyReq.path}`)
  })
);

// 3. AI MCP Service - Rewrite /api/ai -> /api/ai
app.use(
  createProxyMiddleware('/api/ai', {
    target: AI_MCP_URL,
    changeOrigin: true,
    timeout: 600000,      // 10 minutes
    proxyTimeout: 600000, // 10 minutes
    // Keep /api/ai as the service expects it
    onProxyReq: (proxyReq) => console.log(`[Proxy AI] -> ${AI_MCP_URL}${proxyReq.path}`)
  })
);

// 4. License Service - Rewrite /api/license -> /
app.use(
  createProxyMiddleware('/api/license', {
    target: LICENSE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/license': '' },
    onProxyReq: (proxyReq) => console.log(`[Proxy License] -> ${LICENSE_SERVICE_URL}${proxyReq.path}`)
  })
);

// 2. Wafer BI API (Python Service) - Rewrite /api -> /
// This will change /api/meta to /meta which is what Python now expects
app.use(
  createProxyMiddleware('/api', {
    target: WAFER_BI_URL,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    onProxyReq: (proxyReq) => console.log(`[Proxy BI] -> ${WAFER_BI_URL}${proxyReq.path}`)
  })
);

// ====================
// 404 Handler
// ====================
app.use((req, res) => {
  console.log(`[404] No route found for: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found', 
    receivedPath: req.originalUrl,
    method: req.method 
  });
});

// ====================
// Error Handler
// ====================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ====================
// Start Server
// ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`  → Users:    ${USER_SERVICE_URL}`);
  console.log(`  → Wafer BI: ${WAFER_BI_URL}`);
  console.log(`  → AI MCP:   ${AI_MCP_URL}`);
  console.log(`  → License:  ${LICENSE_SERVICE_URL}`);
});
