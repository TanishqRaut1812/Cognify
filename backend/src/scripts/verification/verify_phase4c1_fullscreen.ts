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
): Promise<{ statusCode: number; data: any; headers: http.IncomingHttpHeaders }> {
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
      if (payload) {
        reqHeaders['Content-Length'] = String(payload.length);
      }
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
        try {
          const parsed = JSON.parse(resBody);
          resolve({ statusCode: res.statusCode || 500, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 500, data: resBody, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runFullscreenVerification() {
  console.log('==================================================');
  console.log(' COGNIFY PHASE 4C.1: FULLSCREEN ANTI-CHEAT AUDIT SUITE');
  console.log('==================================================\n');

  const server = app.listen(PORT);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string) {
    if (condition) {
      console.log(` ✔ ${title}: PASSED`);
      passed++;
    } else {
      console.error(` ✖ ${title}: FAILED`);
      failed++;
    }
  }

  let testId: number | null = null;
  let q1Id: number | null = null;

  try {
    // 0. SET UP TEST DATA
    console.log('0. SETTING UP ISOLATED TEST DATA...');
    await query(`
      INSERT INTO students (registration_no, registration_number, name, class_id, class_name)
      VALUES ('REG_P4C1_ST1', 'REG_P4C1_ST1', 'Candidate Fullscreen P4C1', 1, 'SY')
      ON CONFLICT (registration_no) DO NOTHING;
    `);

    const tRes = await query(`
      INSERT INTO tests (
        test_number, title, class_id, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status
      ) VALUES ('TEST_P4C1_001', 'Fullscreen Anti-Cheat Test', 1, '2026-09-01', '10:00 AM', '11:00 AM', 60, 20.0, 'Current', 'Unpublished')
      RETURNING id;
    `);
    testId = tRes.rows[0].id;

    const qRes = await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, correct_option, marks)
      VALUES ($1, 1, 'Fullscreen question 1?', 'A1', 'B1', 'C1', 'D1', 'A', 'A', 10.0)
      RETURNING id;
    `, [testId]);
    q1Id = qRes.rows[0].id;

    const startRes = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: 'REG_P4C1_ST1' });
    const attempt = startRes.data.data.attempt;
    const attemptToken = startRes.data.data.attemptToken;

    // 1. First Fullscreen Violation -> Warning (Count = 1)
    console.log('\n1. VERIFYING ACTUAL FULLSCREEN EXIT (VIOLATION 1)...');
    const v1Res = await makeRequest(`/api/student/attempts/${attempt.id}/fullscreen-violation`, 'POST', {
      Authorization: `Bearer ${attemptToken}`
    });
    assert(v1Res.data.data.violationCount === 1 && v1Res.data.data.terminated === false, 'Actual Fullscreen Exit (Violation 1/4 Warning)');

    // 2. Client Forgery Attempt (client sends violationCount: 999 in body) -> Server Increments By Exactly 1
    console.log('\n2. VERIFYING CLIENT FORGERY REJECTION (CLIENT SENDS violationCount: 999)...');
    const v2Res = await makeRequest(`/api/student/attempts/${attempt.id}/fullscreen-violation`, 'POST', {
      Authorization: `Bearer ${attemptToken}`
    }, { violationCount: 999 });
    assert(v2Res.data.data.violationCount === 2 && v2Res.data.data.terminated === false, 'Server Authoritative Count (Ignored Forgery 999, Count = 2)');

    // 3. Third Violation -> Warning (Count = 3)
    console.log('\n3. VERIFYING THIRD FULLSCREEN VIOLATION (VIOLATION 3)...');
    const v3Res = await makeRequest(`/api/student/attempts/${attempt.id}/fullscreen-violation`, 'POST', {
      Authorization: `Bearer ${attemptToken}`
    });
    assert(v3Res.data.data.violationCount === 3 && v3Res.data.data.terminated === false, 'Third Violation Warning (Count = 3)');

    // 4. Fourth Fullscreen Violation -> Cheating Termination (Count = 4)
    console.log('\n4. VERIFYING FOURTH FULLSCREEN VIOLATION (CHEATING TERMINATION)...');
    const v4Res = await makeRequest(`/api/student/attempts/${attempt.id}/fullscreen-violation`, 'POST', {
      Authorization: `Bearer ${attemptToken}`
    });
    assert(v4Res.data.data.violationCount === 4 && v4Res.data.data.terminated === true && v4Res.data.data.cheating === true, '4th Exit Triggers Cheating Termination');

    // 5. Post-Termination Answer Save Rejection
    console.log('\n5. VERIFYING POST-TERMINATION ANSWER SAVE REJECTION...');
    const postTermAnswerRes = await makeRequest(`/api/student/attempts/${attempt.id}/answers/${q1Id}`, 'PUT', {
      Authorization: `Bearer ${attemptToken}`
    }, { selectedOption: 'A' });
    assert(postTermAnswerRes.statusCode === 403, 'Post-Termination Answer Save Rejection (Expect 403)');

    // 6. Fifth Violation Attempt Cannot Revive Terminated Attempt
    console.log('\n6. VERIFYING FIFTH VIOLATION CANNOT REVIVE ATTEMPT...');
    const v5Res = await makeRequest(`/api/student/attempts/${attempt.id}/fullscreen-violation`, 'POST', {
      Authorization: `Bearer ${attemptToken}`
    });
    assert(v5Res.data.data.terminated === true, '5th Violation Cannot Revive Terminated Attempt');

    // Cleanup temporary test data
    console.log('\n--- Cleaning Up Temporary Verification Records ---');
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_P4C1_%';`);
    console.log(' ✔ Cleanup Complete');

    console.log('\n==================================================');
    console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    server.close();
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal Fullscreen Test Suite Error:', err.message);
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_P4C1_%';`);
    if (server) server.close();
    await pool.end();
    process.exit(1);
  }
}

runFullscreenVerification();
