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
  max: 100,
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

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, user) => {
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
        status: "Checking..."
      },
      "wafer-bi": {
        version: "1.0.0",
        endpoint: WAFER_BI_URL,
        status: "Checking..."
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
// Service Proxies
// ====================
const USER_SERVICE_URL = `http://${process.env.USER_SERVICE_HOST || 'user-service'}:${process.env.USER_SERVICE_PORT || 3002}`;
const WAFER_BI_URL = `http://${process.env.WAFER_BI_HOST || 'wafer-backend-svc.wafer-bi.svc.cluster.local'}:${process.env.WAFER_BI_PORT || 8000}`;

// Public routes (Auth)
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '/auth' },
    onProxyReq: (proxyReq, req) => {
      // Safely log
      const url = req.url || '';
      console.log(`[Proxy Auth] -> ${USER_SERVICE_URL}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
      console.error('[Proxy Auth Error]', err);
      res.status(502).json({ error: 'User Service unreachable' });
    }
  })
);

// Protected User Management routes
app.use(
  '/api/users',
  authenticateToken,
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/users' },
    onProxyReq: (proxyReq) => {
      console.log(`[Proxy Users] -> ${USER_SERVICE_URL}${proxyReq.path}`);
    }
  })
);

// Wafer BI API (Preserve /api prefix by re-adding it)
app.use(
  '/api',
  createProxyMiddleware({
    target: WAFER_BI_URL,
    changeOrigin: true,
    pathRewrite: (path) => {
      // Re-add /api because Express strips it when using app.use('/api', ...)
      return '/api' + path;
    },
    onProxyReq: (proxyReq) => {
      console.log(`[Proxy BI] -> ${WAFER_BI_URL}${proxyReq.path}`);
    }
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
});
