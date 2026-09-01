import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

export const s3Client = new S3Client({
  endpoint: env.NEON_STORAGE_ENDPOINT,
  region: env.NEON_STORAGE_REGION,
  forcePathStyle: true, // Required for S3-compatible endpoints with wildcard SSL certs
  credentials: {
    accessKeyId: env.NEON_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.NEON_STORAGE_SECRET_ACCESS_KEY
  }
});

export const STANDARDIZED_BUCKETS = [
  'question-papers',
  'answer-keys',
  'student-lists',
  'question-lists',
  'resources',
  'backups'
] as const;

export async function checkStorageHealth(): Promise<{ status: string; endpoint: string; region: string; bucketCount: number; verifiedBuckets: string[] }> {
  try {
    const res = await s3Client.send(new ListBucketsCommand({}));
    const existingBuckets = (res.Buckets || []).map((b) => b.Name || '');
    const verifiedBuckets = STANDARDIZED_BUCKETS.filter((b) => existingBuckets.includes(b));

    return {
      status: 'connected',
      endpoint: env.NEON_STORAGE_ENDPOINT,
      region: env.NEON_STORAGE_REGION,
      bucketCount: existingBuckets.length,
      verifiedBuckets
    };
  } catch (err: any) {
    logger.error('Neon Object Storage Health Check Failed:', err.message);
    throw err;
  }
}
