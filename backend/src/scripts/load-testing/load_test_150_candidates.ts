import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import app from '../../app';
import { pool, query } from '../../db/pool';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(
  urlPath: string,
  method: string = 'GET',
  headers: Record<string, string> = {},
  bodyData?: any
): Promise<{ statusCode: number; data: any; durationMs: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${urlPath}`);
    const reqHeaders: Record<string, string> = { ...headers };
    let payload: Buffer | null = null;

    if (bodyData) {
      if (Buffer.isBuffer(bodyData)) {
        payload = bodyData;
      } else if (typeof bodyData === 'object') {
        payload = Buffer.from(JSON.stringify(bodyData));
        reqHeaders['Content-Type'] = 'application/json';
      } else if (typeof bodyData === 'string') {
        payload = Buffer.from(bodyData);
      }
      if (payload) reqHeaders['Content-Length'] = String(payload.length);
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let resBody = '';
      res.on('data', (chunk) => (resBody += chunk));
      res.on('end', () => {
        const durationMs = Date.now() - start;
        try {
          const parsed = JSON.parse(resBody);
          resolve({ statusCode: res.statusCode || 500, data: parsed, durationMs });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 500, data: resBody, durationMs });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function run150CandidateLoadTest() {
  console.log('==================================================');
  console.log(' COGNIFY LOAD TEST: 150 SYNTHETIC CANDIDATE SIMULATION');
  console.log('==================================================\n');

  // SAFETY GUARD: Production Protection Flag
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOAD_TEST !== 'true') {
    console.error(' [SAFETY ABORT] Load test aborted! Running against production requires ALLOW_LOAD_TEST=true environment variable.');
    process.exit(1);
  }

  const server = app.listen(PORT);
  let testId: number | null = null;
  let q1Id: number | null = null;
  let q2Id: number | null = null;

  const TOTAL_STUDENTS = 150;
  const studentRegs: string[] = [];

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    studentRegs.push(`REG_LOADTEST_${i.toString().padStart(3, '0')}`);
  }

  const latencies: number[] = [];
  let errorCount = 0;

  try {
    // 0. PREPARE SYNTHETIC TEST DATA
    console.log('0. PREPARING ISOLATED SYNTHETIC TEST DATA...');
    const studentValues = studentRegs
      .map((r, idx) => `('${r}', '${r}', 'Synthetic Student ${idx + 1}', 1, 'SY')`)
      .join(',\n');

    await query(`
      INSERT INTO students (registration_no, registration_number, name, class_id, class_name)
      VALUES ${studentValues}
      ON CONFLICT (registration_no) DO NOTHING;
    `);

    const tRes = await query(`
      INSERT INTO tests (
        test_number, title, class_id, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status
      ) VALUES ('TEST_LOAD_150', '150 Candidate Load Simulation', 1, '2026-09-01', '10:00 AM', '11:00 AM', 60, 20.0, 'Current', 'Unpublished')
      RETURNING id;
    `);
    testId = tRes.rows[0].id;

    const qRes1 = await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, correct_option, marks)
      VALUES ($1, 1, 'Load Test Question 1?', 'A1', 'B1', 'C1', 'D1', 'A', 'A', 10.0)
      RETURNING id;
    `, [testId]);
    q1Id = qRes1.rows[0].id;

    const qRes2 = await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, correct_option, marks)
      VALUES ($1, 2, 'Load Test Question 2?', 'A2', 'B2', 'C2', 'D2', 'B', 'B', 10.0)
      RETURNING id;
    `, [testId]);
    q2Id = qRes2.rows[0].id;

    console.log(` ✔ 150 Synthetic Candidates & Test ID ${testId} Prepared`);

    // PHASE 1: CANDIDATE VERIFICATION BURST (150 REQUESTS)
    console.log('\nPHASE 1: CANDIDATE VERIFICATION BURST (150 REQUESTS)...');
    const studentTokens: Record<string, string> = {};
    for (const reg of studentRegs) {
      const res = await makeRequest('/api/student/verify', 'POST', {}, { registrationNumber: reg });
      latencies.push(res.durationMs);
      if (res.statusCode === 200 && res.data.data.studentToken) {
        studentTokens[reg] = res.data.data.studentToken;
      } else {
        errorCount++;
      }
    }
    console.log(` ✔ Phase 1 Complete (Success: ${Object.keys(studentTokens).length}/${TOTAL_STUDENTS})`);

    // PHASE 2: EXAM START & ATTEMPT TOKEN ISSUANCE (150 REQUESTS)
    console.log('\nPHASE 2: EXAM START & ATTEMPT CREATION (150 REQUESTS)...');
    const attemptMap: Record<string, { attemptId: number; token: string }> = {};
    for (const reg of studentRegs) {
      const res = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: reg });
      latencies.push(res.durationMs);
      if (res.statusCode === 201 && res.data.data.attempt) {
        attemptMap[reg] = {
          attemptId: res.data.data.attempt.id,
          token: res.data.data.attemptToken
        };
      } else {
        errorCount++;
      }
    }
    console.log(` ✔ Phase 2 Complete (Attempts Created: ${Object.keys(attemptMap).length}/${TOTAL_STUDENTS})`);

    // PHASE 3: STAGGERED ANSWER PERSISTENCE (300 REQUESTS)
    console.log('\nPHASE 3: STAGGERED ANSWER PERSISTENCE (300 REQUESTS)...');
    for (const reg of studentRegs) {
      const att = attemptMap[reg];
      if (!att) continue;

      const res1 = await makeRequest(`/api/student/attempts/${att.attemptId}/answers/${q1Id}`, 'PUT', {
        Authorization: `Bearer ${att.token}`
      }, { selectedOption: 'A' });
      latencies.push(res1.durationMs);
      if (res1.statusCode !== 200) errorCount++;

      const res2 = await makeRequest(`/api/student/attempts/${att.attemptId}/answers/${q2Id}`, 'PUT', {
        Authorization: `Bearer ${att.token}`
      }, { selectedOption: 'B' });
      latencies.push(res2.durationMs);
      if (res2.statusCode !== 200) errorCount++;
    }
    console.log(` ✔ Phase 3 Complete (Answers Persisted)`);

    // PHASE 4: SESSION RECOVERY & REFRESH SMOKE (15 REQUESTS)
    console.log('\nPHASE 4: CANDIDATE REFRESH / SESSION RECOVERY SMOKE (15 CANDIDATES)...');
    const sampleRegs = studentRegs.slice(0, 15);
    for (const reg of sampleRegs) {
      const att = attemptMap[reg];
      if (!att) continue;
      const resDetail = await makeRequest(`/api/student/attempts/${att.attemptId}`, 'GET', {
        Authorization: `Bearer ${att.token}`
      });
      latencies.push(resDetail.durationMs);
      if (resDetail.statusCode !== 200) errorCount++;

      const resAns = await makeRequest(`/api/student/attempts/${att.attemptId}/answers`, 'GET', {
        Authorization: `Bearer ${att.token}`
      });
      latencies.push(resAns.durationMs);
      if (resAns.statusCode !== 200) errorCount++;
    }
    console.log(` ✔ Phase 4 Complete (Session Recovery Verified)`);

    // PHASE 5: CONCURRENT BURST SUBMISSION (150 REQUESTS PARALLEL)
    console.log('\nPHASE 5: CONCURRENT BURST SUBMISSION (150 PARALLEL REQUESTS)...');
    const submitPromises = studentRegs.map(async (reg) => {
      const att = attemptMap[reg];
      if (!att) return;
      const res = await makeRequest(`/api/student/attempts/${att.attemptId}/submit`, 'POST', {
        Authorization: `Bearer ${att.token}`
      });
      latencies.push(res.durationMs);
      if (res.statusCode !== 200) errorCount++;
    });
    await Promise.all(submitPromises);
    console.log(` ✔ Phase 5 Complete (Submissions Finalized)`);

    // METRICS SUMMARY
    console.log('\n==================================================');
    console.log(' LOAD TEST METRICS & PERFORMANCE SUMMARY');
    console.log('==================================================');
    console.log(` Total API Requests Executed: ${latencies.length}`);
    console.log(` Total Errors Encountered:     ${errorCount}`);
    console.log(` p50 Latency:                  ${percentile(latencies, 50)} ms`);
    console.log(` p95 Latency:                  ${percentile(latencies, 95)} ms`);
    console.log(` p99 Latency:                  ${percentile(latencies, 99)} ms`);
    console.log('==================================================\n');

    // CLEANUP SYNTHETIC DATA
    console.log('--- Cleaning Up Synthetic Load Test Records ---');
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_LOADTEST_%';`);
    console.log(' ✔ Load Test Data Cleanup Complete');

    server.close();
    await pool.end();
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal Load Test Error:', err.message);
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_LOADTEST_%';`);
    if (server) server.close();
    await pool.end();
    process.exit(1);
  }
}

run150CandidateLoadTest();
