import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import healthRoutes from './routes/health.routes';
import apiRoutes from './routes/api.routes';
import adminRoutes from './routes/admin.routes';
import studentRoutes from './routes/student.routes';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

const app = express();

// SECURITY HEADERS (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to prevent breaking Angular dynamic script injection
    crossOriginEmbedderPolicy: false
  })
);

// CUSTOM SECURITY HEADERS
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// RATE LIMITING
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.'
    }
  }
});

// Apply rate limiter to high-risk auth/verification routes
app.use('/api/student/verify', authLimiter);
app.use('/api/admin/auth/login', authLimiter);

// CORS CONFIGURATION
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation: Origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// REQUEST PARSING
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// REQUEST LOGGING MIDDLEWARE
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

import legacyRoutes from './routes/legacy.routes';

// ROUTES
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api', legacyRoutes);
app.use('/api', apiRoutes);

// 404 HANDLER
app.use(notFoundHandler);

// GLOBAL ERROR HANDLER
app.use(errorHandler);

export default app;
