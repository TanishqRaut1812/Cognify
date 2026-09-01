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

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runSecurityTests() {
  console.log('==================================================');
  console.log(' COGNIFY PHASE 4C: ADVERSARIAL SECURITY AUDIT SUITE');
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
      VALUES ('REG_P4C_ST1', 'REG_P4C_ST1', 'Student One P4C', 1, 'SY'),
             ('REG_P4C_ST2', 'REG_P4C_ST2', 'Student Two P4C', 1, 'SY')
      ON CONFLICT (registration_no) DO NOTHING;
    `);

    const tRes = await query(`
      INSERT INTO tests (
        test_number, title, class_id, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status
      ) VALUES ('TEST_P4C_001', 'P4C Security Test', 1, '2026-09-01', '10:00 AM', '11:00 AM', 60, 20.0, 'Current', 'Unpublished')
      RETURNING id;
    `);
    testId = tRes.rows[0].id;

    const qRes = await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, correct_option, marks)
      VALUES ($1, 1, 'Security question text 1?', 'A1', 'B1', 'C1', 'D1', 'A', 'A', 10.0)
      RETURNING id;
    `, [testId]);
    q1Id = qRes.rows[0].id;

    console.log(' ✔ Isolated Test Data Prepared');

    // 1. Unauthenticated Admin Request Rejection
    console.log('\n1. VERIFYING UNAUTHENTICATED ADMIN ACCESS REJECTION...');
    const adminRes = await makeRequest('/api/admin/dashboard');
    assert(adminRes.statusCode === 401, 'Unauthenticated Admin Access Rejection (Expect 401)');

    // 2. Student Verification & Session Token Generation
    console.log('\n2. VERIFYING STUDENT VERIFICATION & SESSION TOKEN GENERATION...');
    const verifyRes = await makeRequest('/api/student/verify', 'POST', {}, { registrationNumber: 'REG_P4C_ST1' });
    assert(verifyRes.statusCode === 200, 'Student Verification Status Code (Expect 200)');
    const studentToken = verifyRes.data?.data?.studentToken;
    assert(Boolean(studentToken), 'Student Session Token Issued');

    // 3. Student Session Token on Admin Endpoint Rejection
    console.log('\n3. VERIFYING STUDENT TOKEN ON ADMIN ENDPOINT REJECTION...');
    const adminWithStudentTokenRes = await makeRequest('/api/admin/dashboard', 'GET', {
      Authorization: `Bearer ${studentToken}`
    });
    assert(adminWithStudentTokenRes.statusCode === 403 || adminWithStudentTokenRes.statusCode === 401, 'Student Token on Admin Endpoint Rejection (Expect 403)');

    // 4. Student Result IDOR Protection
    console.log('\n4. VERIFYING STUDENT RESULT IDOR PROTECTION...');
    // Unauthenticated attempt
    const unauthResultsRes = await makeRequest('/api/student/results?registrationNumber=REG_P4C_ST1');
    assert(unauthResultsRes.statusCode === 401, 'Unauthenticated Student Results Rejection (Expect 401)');

    // Cross-student IDOR attempt (REG_P4C_ST1 token requesting REG_P4C_ST2 results)
    const idorResultsRes = await makeRequest('/api/student/results?registrationNumber=REG_P4C_ST2', 'GET', {
      Authorization: `Bearer ${studentToken}`
    });
    assert(idorResultsRes.statusCode === 403, 'Cross-Student Result IDOR Rejection (Expect 403)');

    // Own student results request
    const ownResultRes = await makeRequest('/api/student/results?registrationNumber=REG_P4C_ST1', 'GET', {
      Authorization: `Bearer ${studentToken}`
    });
    assert(ownResultRes.statusCode === 200, 'Own Student Results Authorization (Expect 200)');

    // 5. Test Start & Attempt Token Scope
    console.log('\n5. VERIFYING ATTEMPT TOKEN SCOPE & IDOR ISOLATION...');
    const startRes1 = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: 'REG_P4C_ST1' });
    const attempt1 = startRes1.data.data.attempt;
    const token1 = startRes1.data.data.attemptToken;

    const startRes2 = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: 'REG_P4C_ST2' });
    const attempt2 = startRes2.data.data.attempt;
    const token2 = startRes2.data.data.attemptToken;

    // Token 1 accessing Attempt 2 questions (IDOR attack)
    const idorQuestionsRes = await makeRequest(`/api/student/attempts/${attempt2.id}/questions`, 'GET', {
      Authorization: `Bearer ${token1}`
    });
    assert(idorQuestionsRes.statusCode === 403, 'Attempt Token IDOR Access Rejection (Expect 403)');

    // 6. Correct Answer Non-Leakage
    console.log('\n6. VERIFYING ZERO CORRECT ANSWER LEAKAGE...');
    const qRes2 = await makeRequest(`/api/student/attempts/${attempt1.id}/questions`, 'GET', {
      Authorization: `Bearer ${token1}`
    });
    const rawQuestionsStr = JSON.stringify(qRes2.data);
    assert(!rawQuestionsStr.includes('correct_answer') && !rawQuestionsStr.includes('correctOption'), 'Correct Answers Absent from Questions Response');

    // 7. Fullscreen Cheating Termination
    console.log('\n7. VERIFYING FULLSCREEN VIOLATION CHEATING TERMINATION...');
    for (let i = 1; i <= 3; i++) {
      await makeRequest(`/api/student/attempts/${attempt2.id}/fullscreen-violation`, 'POST', {
        Authorization: `Bearer ${token2}`
      });
    }

    // 4th exit -> Termination
    const termRes = await makeRequest(`/api/student/attempts/${attempt2.id}/fullscreen-violation`, 'POST', {
      Authorization: `Bearer ${token2}`
    });
    assert(termRes.data.data.terminated === true && termRes.data.data.cheating === true, '4th Exit Triggers Cheating Termination');

    // Attempting answer write post-termination
    const postTermAnswerRes = await makeRequest(`/api/student/attempts/${attempt2.id}/answers/${q1Id}`, 'PUT', {
      Authorization: `Bearer ${token2}`
    }, { selectedOption: 'A' });
    assert(postTermAnswerRes.statusCode === 403, 'Post-Termination Answer Save Rejection (Expect 403)');

    // 8. Rate Limiting Protection
    console.log('\n8. VERIFYING RATE LIMITING PROTECTION...');
    let rateLimited = false;
    for (let i = 0; i < 35; i++) {
      const r = await makeRequest('/api/student/verify', 'POST', {}, { registrationNumber: 'REG_RATE_LIMIT_TEST' });
      if (r.statusCode === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Auth Rate Limiter Active (Expect 429 on >30 requests)');

    // 9. Helmet Security Headers
    console.log('\n9. VERIFYING HELMET SECURITY HEADERS...');
    const healthRes = await makeRequest('/api/health');
    assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options Header Present');
    assert(Boolean(healthRes.headers['x-frame-options']), 'X-Frame-Options Header Present');

    // Cleanup temporary test data
    console.log('\n--- Cleaning Up Temporary Verification Records ---');
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_P4C_%';`);
    console.log(' ✔ Cleanup Complete');

    console.log('\n==================================================');
    console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    server.close();
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal Security Test Suite Error:', err.message);
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_P4C_%';`);
    if (server) server.close();
    await pool.end();
    process.exit(1);
  }
}

runSecurityTests();
