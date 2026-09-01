import http from 'http';
import path from 'path';
import dotenv from 'dotenv';

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

async function verifyPhase3d() {
  console.log('==================================================');
  console.log(' COGNIFY PHASE 3D: STUDENT EXAM ENGINE VERIFICATION');
  console.log('==================================================\n');

  const { gracefulShutdown } = await import('../../server');
  const { query } = await import('../../db/pool');

  await new Promise((resolve) => setTimeout(resolve, 1500));

  let studentId: number | null = null;
  let testId: number | null = null;
  let question1Id: number | null = null;
  let question2Id: number | null = null;
  let attemptId: number | null = null;
  let attemptToken: string = '';

  let student2Id: number | null = null;
  let attempt2Id: number | null = null;
  let attempt2Token: string = '';

  try {
    // ----------------------------------------------------
    // SETUP TEMPORARY TEST DATA
    // ----------------------------------------------------
    console.log('0. SETTING UP ISOLATED TEST DATA...');
    
    // Create Student 1
    const stRes = await query(`
      INSERT INTO students (registration_no, registration_number, name, class_id, class_name)
      VALUES ('REG_P3D_ST1', 'REG_P3D_ST1', 'Student One P3D', 1, 'SY')
      RETURNING id;
    `);
    studentId = stRes.rows[0].id;

    // Create Student 2
    const st2Res = await query(`
      INSERT INTO students (registration_no, registration_number, name, class_id, class_name)
      VALUES ('REG_P3D_ST2', 'REG_P3D_ST2', 'Student Two P3D', 1, 'SY')
      RETURNING id;
    `);
    student2Id = st2Res.rows[0].id;

    // Create Active Test
    const tRes = await query(`
      INSERT INTO tests (
        test_number, title, class_id, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status
      ) VALUES ('TEST_P3D_001', 'P3D Exam Engine Test', 1, '2026-09-01', '10:00 AM', '11:00 AM', 60, 20.0, 'Current', 'Unpublished')
      RETURNING id;
    `);
    testId = tRes.rows[0].id;

    // Create Question 1 (Answer B, 10 marks)
    const q1Res = await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, correct_option, marks, is_active)
      VALUES ($1, 1, 'Question 1 Text', 'Opt A', 'Opt B', 'Opt C', 'Opt D', 'B', 'B', 10.0, 1)
      RETURNING id;
    `, [testId]);
    question1Id = q1Res.rows[0].id;

    // Create Question 2 (Answer C, 10 marks)
    const q2Res = await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, correct_option, marks, is_active)
      VALUES ($1, 2, 'Question 2 Text', 'Opt A', 'Opt B', 'Opt C', 'Opt D', 'C', 'C', 10.0, 1)
      RETURNING id;
    `, [testId]);
    question2Id = q2Res.rows[0].id;

    console.log(' ✔ Isolated Test Data Setup Complete\n');

    // ----------------------------------------------------
    // 1 & 2. STUDENT VERIFICATION
    // ----------------------------------------------------
    console.log('1. VERIFYING STUDENT VERIFICATION (POST /api/student/verify)...');
    
    // Unknown reg no rejected
    const unkRes = await makeRequest('/api/student/verify', 'POST', {}, { registrationNumber: 'REG_UNKNOWN_999' });
    console.log(` Unknown Student Status Code (Expect 404): ${unkRes.statusCode}`);
    if (unkRes.statusCode !== 404) {
      throw new Error('Unknown student registration number was accepted');
    }

    // Valid student verification
    const vRes = await makeRequest('/api/student/verify', 'POST', {}, { registrationNumber: 'REG_P3D_ST1' });
    console.log(` Valid Student Status Code (Expect 200): ${vRes.statusCode}`);
    if (vRes.statusCode !== 200 || vRes.data.data?.student?.registrationNumber !== 'REG_P3D_ST1') {
      throw new Error('Student verification failed for valid registration number');
    }
    console.log(' ✔ Student Verification: PASSED\n');

    // ----------------------------------------------------
    // 3. AVAILABLE TESTS
    // ----------------------------------------------------
    console.log('2. VERIFYING AVAILABLE TESTS (GET /api/student/tests)...');
    const testsRes = await makeRequest('/api/student/tests?registrationNumber=REG_P3D_ST1');
    console.log(` Available Tests Status Code: ${testsRes.statusCode}`);
    if (testsRes.statusCode !== 200 || !Array.isArray(testsRes.data.data)) {
      throw new Error('Fetch available tests failed');
    }
    const foundTest = testsRes.data.data.find((t: any) => t.id === testId);
    if (!foundTest || foundTest.correctAnswer || foundTest.correct_answer) {
      throw new Error('Test list missing test or exposed internal secrets');
    }
    console.log(' ✔ Available Tests: PASSED\n');

    // ----------------------------------------------------
    // 4, 5, 6, 7, 8. START TEST & ATTEMPT TOKEN & TIMING
    // ----------------------------------------------------
    console.log('3. VERIFYING START TEST & ATTEMPT TOKEN GENERATION...');
    const startRes = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: 'REG_P3D_ST1' });
    console.log(` Start Test Status Code (Expect 201): ${startRes.statusCode}`);
    if (startRes.statusCode !== 201 || !startRes.data.data?.attemptToken) {
      throw new Error('Start test failed or missing attemptToken');
    }

    const attemptInfo = startRes.data.data.attempt;
    attemptId = attemptInfo.id;
    attemptToken = startRes.data.data.attemptToken;
    const attemptHeader = { Authorization: `Bearer ${attemptToken}` };

    console.log(` Attempt ID: ${attemptId}`);
    console.log(` Server Started At: ${attemptInfo.startedAt}`);
    console.log(` Server Deadline:   ${attemptInfo.deadline}`);

    const startedTime = new Date(attemptInfo.startedAt).getTime();
    const deadlineTime = new Date(attemptInfo.deadline).getTime();
    const diffMinutes = Math.round((deadlineTime - startedTime) / (60 * 1000));
    console.log(` Calculated Duration: ${diffMinutes} minutes`);
    if (diffMinutes !== 60) {
      throw new Error(`Deadline calculation incorrect. Expected 60 minutes, got ${diffMinutes}`);
    }

    // Verify duplicate start returns existing attempt without creating second attempt
    const dupStart = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: 'REG_P3D_ST1' });
    console.log(` Duplicate Start Status Code: ${dupStart.statusCode}`);
    if (dupStart.data.data?.attempt?.id !== attemptId) {
      throw new Error('Duplicate start attempt created a second attempt ID');
    }
    console.log(' ✔ Start Test & Deadline Verification: PASSED\n');

    // ----------------------------------------------------
    // 9 & 10. GET EXAM QUESTIONS & ANSWER PROTECTION
    // ----------------------------------------------------
    console.log('4. VERIFYING EXAM QUESTIONS API & STRICT ANSWER PROTECTION...');
    const qRes = await makeRequest(`/api/student/attempts/${attemptId}/questions`, 'GET', attemptHeader);
    console.log(` Get Questions Status Code: ${qRes.statusCode}`);
    if (qRes.statusCode !== 200 || !Array.isArray(qRes.data.data) || qRes.data.data.length !== 2) {
      throw new Error('Failed to fetch exam questions');
    }

    const firstQ = qRes.data.data[0];
    if (firstQ.correctAnswer || firstQ.correct_answer || firstQ.correctOption || firstQ.correct_option) {
      throw new Error('SECURITY VIOLATION: Correct answer fields returned in student questions response');
    }
    console.log(' ✔ Questions API & Answer Protection: PASSED\n');

    // ----------------------------------------------------
    // 11, 12, 13, 14, 15. SAVE ANSWERS & REVIEW
    // ----------------------------------------------------
    console.log('5. VERIFYING SAVE ANSWER & REVIEW ENDPOINT...');
    
    // Save Question 1 as 'A'
    const save1 = await makeRequest(`/api/student/attempts/${attemptId}/answers/${question1Id}`, 'PUT', attemptHeader, { selectedOption: 'A' });
    console.log(` Save Q1 Option A Status Code: ${save1.statusCode}`);

    // Update Question 1 to 'B' (correct answer)
    const save1Update = await makeRequest(`/api/student/attempts/${attemptId}/answers/${question1Id}`, 'PUT', attemptHeader, { selectedOption: 'B' });
    console.log(` Update Q1 to Option B Status Code: ${save1Update.statusCode}`);

    // Save Question 2 as 'C' (correct answer)
    const save2 = await makeRequest(`/api/student/attempts/${attemptId}/answers/${question2Id}`, 'PUT', attemptHeader, { selectedOption: 'C' });
    console.log(` Save Q2 Option C Status Code: ${save2.statusCode}`);

    // Get saved answers / review
    const reviewRes = await makeRequest(`/api/student/attempts/${attemptId}/answers`, 'GET', attemptHeader);
    console.log(` Saved Answers Count: ${reviewRes.data.data?.answers?.length}`);
    const q1Saved = reviewRes.data.data?.answers?.find((a: any) => a.questionId === question1Id);
    if (!q1Saved || q1Saved.selectedOption !== 'B') {
      throw new Error('Saved answer update failed or did not replace previous option');
    }
    console.log(' ✔ Save Answer & State Restoration: PASSED\n');

    // ----------------------------------------------------
    // 16, 17, 18, 19. IDOR & FORGERY PROTECTION
    // ----------------------------------------------------
    console.log('6. VERIFYING IDOR & CLIENT FORGERY PROTECTION...');
    
    // Start Student 2 attempt
    const st2Start = await makeRequest(`/api/student/tests/${testId}/start`, 'POST', {}, { registrationNumber: 'REG_P3D_ST2' });
    attempt2Id = st2Start.data.data.attempt.id;
    attempt2Token = st2Start.data.data.attemptToken;

    // Student 1 tries to access Student 2's attempt using Student 1's token
    const idorRes = await makeRequest(`/api/student/attempts/${attempt2Id}/questions`, 'GET', attemptHeader);
    console.log(` IDOR Access Attempt Status Code (Expect 403): ${idorRes.statusCode}`);
    if (idorRes.statusCode !== 403) {
      throw new Error('IDOR attack succeeded: Student 1 accessed Student 2 attempt!');
    }
    console.log(' ✔ IDOR & Forgery Protection: PASSED\n');

    // ----------------------------------------------------
    // 20, 21, 22, 23. FULLSCREEN VIOLATIONS & CHEATING TERMINATION
    // ----------------------------------------------------
    console.log('7. VERIFYING FULLSCREEN VIOLATIONS & CHEATING TERMINATION...');
    
    // Report 3 violations on Student 2 attempt
    await makeRequest(`/api/student/attempts/${attempt2Id}/fullscreen-violation`, 'POST', { Authorization: `Bearer ${attempt2Token}` });
    await makeRequest(`/api/student/attempts/${attempt2Id}/fullscreen-violation`, 'POST', { Authorization: `Bearer ${attempt2Token}` });
    await makeRequest(`/api/student/attempts/${attempt2Id}/fullscreen-violation`, 'POST', { Authorization: `Bearer ${attempt2Token}` });

    // Report 4th violation -> must terminate attempt
    const v4Res = await makeRequest(`/api/student/attempts/${attempt2Id}/fullscreen-violation`, 'POST', { Authorization: `Bearer ${attempt2Token}` });
    console.log(` 4th Violation Response:`, JSON.stringify(v4Res.data.data, null, 2));

    if (v4Res.statusCode !== 200 || !v4Res.data.data?.terminated || !v4Res.data.data?.cheating) {
      throw new Error('4th violation failed to terminate attempt or flag cheating');
    }

    // Try to save answer after termination -> must fail
    const termSave = await makeRequest(`/api/student/attempts/${attempt2Id}/answers/${question1Id}`, 'PUT', { Authorization: `Bearer ${attempt2Token}` }, { selectedOption: 'A' });
    console.log(` Post-Termination Answer Save Status Code (Expect 403): ${termSave.statusCode}`);
    if (termSave.statusCode !== 403) {
      throw new Error('Answer save allowed on terminated attempt');
    }
    console.log(' ✔ Fullscreen Violations & Cheating Termination: PASSED\n');

    // ----------------------------------------------------
    // 24, 25, 26. SERVER-SIDE SCORING & SUBMISSION IDEMPOTENCY
    // ----------------------------------------------------
    console.log('8. VERIFYING SERVER-SIDE SCORING & SUBMIT IDEMPOTENCY...');
    
    // Submit Student 1 attempt (Answers B and C -> 10 + 10 = 20/20 = 100%)
    const subRes = await makeRequest(`/api/student/attempts/${attemptId}/submit`, 'POST', attemptHeader);
    console.log(` Submit Attempt Status Code (Expect 200): ${subRes.statusCode}`);
    console.log(` Submit Response Message: ${subRes.data.data?.message}`);

    if (subRes.statusCode !== 200 || !subRes.data.data?.success) {
      throw new Error('Submit test attempt failed');
    }

    // Double submission -> must be idempotent
    const subDup = await makeRequest(`/api/student/attempts/${attemptId}/submit`, 'POST', attemptHeader);
    console.log(` Double Submit Status Code (Expect 200): ${subDup.statusCode}`);
    if (subDup.statusCode !== 200 || !subDup.data.data?.success) {
      throw new Error('Double submission failed idempotent check');
    }
    console.log(' ✔ Server-side Scoring & Submission Idempotency: PASSED\n');

    // ----------------------------------------------------
    // 29, 30, 31. RESULT PUBLICATION GATING & OVERRIDES
    // ----------------------------------------------------
    console.log('9. VERIFYING RESULT PUBLICATION GATING & ADMIN OVERRIDES...');
    
    // Check results while unpublished
    const unpubResults = await makeRequest('/api/student/results?registrationNumber=REG_P3D_ST1');
    console.log(` Unpublished Results Status Code: ${unpubResults.statusCode}`);
    const unpubItem = unpubResults.data.data?.find((r: any) => r.testId === testId);
    if (!unpubItem || unpubItem.published !== false || unpubItem.marksObtained !== null) {
      throw new Error('SECURITY VIOLATION: Unpublished test score exposed to student');
    }

    // Admin publishes test results
    const adminLogin = await makeRequest('/api/admin/auth/login', 'POST', {}, { password: 'CognifyAdmin2026!' });
    const adminHeader = { Authorization: `Bearer ${adminLogin.data.data.token}` };
    await makeRequest(`/api/admin/tests/${testId}/publish`, 'POST', adminHeader);

    // Check results after publication
    const pubResults = await makeRequest('/api/student/results?registrationNumber=REG_P3D_ST1');
    console.log(` Published Results Status Code: ${pubResults.statusCode}`);
    const pubItem = pubResults.data.data?.find((r: any) => r.testId === testId);
    console.log(` Published Marks: ${pubItem?.marksObtained}/${pubItem?.totalMarks} (${pubItem?.percentage}%)`);
    if (!pubItem || pubItem.published !== true || pubItem.marksObtained !== 20 || pubItem.percentage !== 100) {
      throw new Error('Published score mismatch. Expected 20 marks (100%)');
    }

    // Admin overrides score to 18 marks (90%)
    const resList = await makeRequest(`/api/admin/tests/${testId}/results`, 'GET', adminHeader);
    const resultObj = resList.data.data?.find((r: any) => r.registrationNo === 'REG_P3D_ST1');
    await makeRequest(`/api/admin/results/${resultObj.id}`, 'PUT', adminHeader, { marksObtained: 18.0 });

    // Re-verify student sees overridden score (18 marks / 90%)
    const overrideResults = await makeRequest('/api/student/results?registrationNumber=REG_P3D_ST1');
    const overItem = overrideResults.data.data?.find((r: any) => r.testId === testId);
    console.log(` Overridden Marks Visible to Student: ${overItem?.marksObtained} (${overItem?.percentage}%)`);
    if (!overItem || overItem.marksObtained !== 18 || overItem.percentage !== 90) {
      throw new Error('Admin score override not reflected in student results');
    }
    console.log(' ✔ Result Publication Gating & Score Overrides: PASSED\n');

    console.log('==================================================');
    console.log(' ALL PHASE 3D VERIFICATION CHECKS PASSED SUCCESSFULLY');
    console.log('==================================================\n');

  } finally {
    // CLEANUP TEMPORARY RECORDS
    console.log('--- Cleaning Up Temporary Verification Records ---');
    if (testId) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [testId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_P3D_%';`);
    console.log(' ✔ Temporary Verification Records Cleaned Up\n');

    await gracefulShutdown('SIGTERM');
  }
}

verifyPhase3d().catch((err) => {
  console.error('PHASE3D_VERIFICATION_FAILED:', err);
  process.exit(1);
});
