import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '$2a$12$K1r.N23v/04R44fT4aHwzO3m6f5vK6f11m',
  JWT_SECRET: process.env.JWT_SECRET || 'cognify-default-secret-key-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'cognify-resources',
};
