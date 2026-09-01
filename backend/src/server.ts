import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env.config.js';
import { pool } from './db/pool.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HEALTH CHECK ENDPOINT
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
      db_time: dbRes.rows[0].now
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: err.message
    });
  }
});

// GLOBAL ERROR HANDLER
app.use(errorHandler);

const PORT = parseInt(env.PORT, 10) || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Cognify Node.js Express Backend API Engine`);
    console.log(` Running on port: ${PORT}`);
    console.log(` Environment: ${env.NODE_ENV}`);
    console.log(` Neon Connection Pool: Active (Max 20 Connections)`);
    console.log(`==================================================`);
  });
}

export default app;
