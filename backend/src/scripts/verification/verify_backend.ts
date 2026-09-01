import http from 'http';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(urlPath: string): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode || 500, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 500, data: body });
        }
      });
    }).on('error', reject);
  });
}

async function verifyBackendFoundation() {
  console.log('==================================================');
  console.log(' COGNIFY PHASE 3A: BACKEND FOUNDATION VERIFICATION');
  console.log('==================================================\n');

  // Dynamic import of server to trigger startup validation and listener
  const { server, gracefulShutdown } = await import('../../server');

  // Allow server time to bind
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('1. VERIFYING SERVER STARTUP & PROCESS HEALTH (GET /api/health)...');
  const healthRes = await makeRequest('/api/health');
  console.log(` Status Code: ${healthRes.statusCode}`);
  console.log(` Response:`, JSON.stringify(healthRes.data, null, 2));

  if (healthRes.statusCode !== 200 || !healthRes.data.success || healthRes.data.data.status !== 'online') {
    throw new Error('Process health check failed');
  }
  console.log(' ✔ GET /api/health: PASSED\n');

  console.log('2. VERIFYING DATABASE CONNECTIVITY (GET /api/health/db)...');
  const dbHealthRes = await makeRequest('/api/health/db');
  console.log(` Status Code: ${dbHealthRes.statusCode}`);
  console.log(` Response:`, JSON.stringify(dbHealthRes.data, null, 2));

  if (dbHealthRes.statusCode !== 200 || !dbHealthRes.data.success || dbHealthRes.data.data.status !== 'connected') {
    throw new Error('Database health check failed');
  }
  console.log(' ✔ GET /api/health/db: PASSED\n');

  console.log('3. VERIFYING OBJECT STORAGE CONNECTIVITY (GET /api/health/storage)...');
  const storageHealthRes = await makeRequest('/api/health/storage');
  console.log(` Status Code: ${storageHealthRes.statusCode}`);
  console.log(` Response:`, JSON.stringify(storageHealthRes.data, null, 2));

  if (storageHealthRes.statusCode !== 200 || !storageHealthRes.data.success || storageHealthRes.data.data.status !== 'connected') {
    throw new Error('Storage health check failed');
  }
  console.log(' ✔ GET /api/health/storage: PASSED\n');

  console.log('4. VERIFYING 404 UNMATCHED ROUTE HANDLING (GET /api/nonexistent)...');
  const notFoundRes = await makeRequest('/api/nonexistent');
  console.log(` Status Code: ${notFoundRes.statusCode}`);
  console.log(` Response:`, JSON.stringify(notFoundRes.data, null, 2));

  if (notFoundRes.statusCode !== 404 || notFoundRes.data.success !== false) {
    throw new Error('404 route handling failed');
  }
  console.log(' ✔ 404 Error Handling: PASSED\n');

  console.log('5. VERIFYING GRACEFUL SHUTDOWN (SIGTERM handling)...');
  await gracefulShutdown('SIGTERM');
  console.log(' ✔ Graceful Shutdown: PASSED\n');

  console.log('==================================================');
  console.log(' ALL PHASE 3A VERIFICATION CHECKS PASSED SUCCESSFULLY');
  console.log('==================================================\n');
}

verifyBackendFoundation().catch((err) => {
  console.error('VERIFICATION_FAILED:', err);
  process.exit(1);
});
