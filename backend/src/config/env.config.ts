import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = [
  'NEON_DATABASE_URL',
  'NEON_STORAGE_ENDPOINT',
  'NEON_STORAGE_REGION',
  'NEON_STORAGE_ACCESS_KEY_ID',
  'NEON_STORAGE_SECRET_ACCESS_KEY'
];

export function validateEnv(): void {
  const missing = requiredEnvVars.filter(
    (key) => !process.env[key] || process.env[key]?.includes('YOUR_')
  );

  if (missing.length > 0) {
    console.error('==================================================');
    console.error(' FATAL ERROR: MISSING ENVIRONMENT CONFIGURATION');
    console.error('==================================================');
    console.error(` The following required variables are missing or set to placeholder in backend/.env:`);
    missing.forEach((varName) => console.error(`   - ${varName}`));
    console.error('\n Please configure backend/.env before starting the server.');
    console.error('==================================================');
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
  NEON_STORAGE_ENDPOINT: process.env.NEON_STORAGE_ENDPOINT || '',
  NEON_STORAGE_REGION: process.env.NEON_STORAGE_REGION || 'us-east-2',
  NEON_STORAGE_ACCESS_KEY_ID: process.env.NEON_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
  NEON_STORAGE_SECRET_ACCESS_KEY: process.env.NEON_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '$2a$12$K1r.N23v/04R44fT4aHwzO3m6f5vK6f11m',
  JWT_SECRET: process.env.JWT_SECRET || 'cognify-jwt-secret-key-2026-super-secure',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h'
};
