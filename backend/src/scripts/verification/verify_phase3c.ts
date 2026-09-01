import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';

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

function makeMultipartRequest(
  urlPath: string,
  token: string,
  fieldName: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(`${BASE_URL}${urlPath}`);

    const headerText =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const footerText = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(headerText, 'utf8'),
      fileBuffer,
      Buffer.from(footerText, 'utf8')
    ]);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(bodyBuffer.length)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 500, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode || 500, data: body });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

async function verifyPhase3c() {
  console.log('==================================================');
  console.log(' COGNIFY PHASE 3C: ADMIN APIs VERIFICATION SUITE');
  console.log('==================================================\n');

  const { gracefulShutdown } = await import('../../server');
  const { query } = await import('../../db/pool');

  await new Promise((resolve) => setTimeout(resolve, 1500));

  let adminToken = '';
  let createdStudentId: number | null = null;
  let createdTestId: number | null = null;
  let createdQuestionId: number | null = null;
  let createdAttemptId: number | null = null;
  let createdResultId: number | null = null;

  try {
    // ----------------------------------------------------
    // 1 & 2. ADMIN AUTHENTICATION & AUTHORIZATION
    // ----------------------------------------------------
    console.log('1. VERIFYING ADMIN AUTHENTICATION & AUTHORIZATION...');
    
    // 1a. Unauthenticated request must return 401
    const unauthRes = await makeRequest('/api/admin/dashboard');
    console.log(` Unauthenticated Request Status Code (Expect 401): ${unauthRes.statusCode}`);
    if (unauthRes.statusCode !== 401) {
      throw new Error('Unauthenticated admin access was allowed');
    }

    // 1b. Invalid password login must return 401
    const invalidLogin = await makeRequest('/api/admin/auth/login', 'POST', {}, { password: 'WrongPassword123!' });
    console.log(` Invalid Login Status Code (Expect 401): ${invalidLogin.statusCode}`);
    if (invalidLogin.statusCode !== 401) {
      throw new Error('Invalid login was accepted');
    }

    // 1c. Valid login works
    const loginRes = await makeRequest('/api/admin/auth/login', 'POST', {}, { password: 'CognifyAdmin2026!' });
    console.log(` Valid Login Status Code (Expect 200): ${loginRes.statusCode}`);
    if (loginRes.statusCode !== 200 || !loginRes.data.data?.token) {
      throw new Error('Admin login failed');
    }
    adminToken = loginRes.data.data.token;
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    // 1d. GET /api/admin/auth/me works
    const meRes = await makeRequest('/api/admin/auth/me', 'GET', authHeader);
    if (meRes.statusCode !== 200 || !meRes.data.data?.authenticated) {
      throw new Error('/api/admin/auth/me failed');
    }
    console.log(' ✔ Admin Auth & Token Verification: PASSED\n');

    // ----------------------------------------------------
    // 3. ADMIN DASHBOARD API
    // ----------------------------------------------------
    console.log('2. VERIFYING ADMIN DASHBOARD API (GET /api/admin/dashboard)...');
    const dashRes = await makeRequest('/api/admin/dashboard', 'GET', authHeader);
    console.log(` Dashboard Status Code: ${dashRes.statusCode}`);
    console.log(` Dashboard Aggregated Metrics:`, JSON.stringify(dashRes.data.data, null, 2));

    if (dashRes.statusCode !== 200 || dashRes.data.data?.totalStudents === undefined) {
      throw new Error('Dashboard API failed');
    }
    console.log(' ✔ GET /api/admin/dashboard: PASSED\n');

    // ----------------------------------------------------
    // 4. STUDENT CRUD & DUPLICATE REGISTRATION PREVENTION
    // ----------------------------------------------------
    console.log('3. VERIFYING STUDENT CRUD & UNIQUE REGISTRATION ENFORCEMENT...');
    const createStRes = await makeRequest('/api/admin/students', 'POST', authHeader, {
      registrationNo: 'REG_P3C_TEMP_001',
      rollNo: 'R001',
      name: 'Temp Phase3C Student',
      className: 'SY'
    });
    console.log(` Create Student Status Code (Expect 201): ${createStRes.statusCode}`);
    if (createStRes.statusCode !== 201 || !createStRes.data.data?.id) {
      throw new Error('Create student failed');
    }
    createdStudentId = createStRes.data.data.id;

    // Test duplicate registration rejection
    const dupStRes = await makeRequest('/api/admin/students', 'POST', authHeader, {
      registrationNo: 'REG_P3C_TEMP_001',
      rollNo: 'R002',
      name: 'Duplicate Student',
      className: 'SY'
    });
    console.log(` Duplicate Student Status Code (Expect 400): ${dupStRes.statusCode}`);
    if (dupStRes.statusCode !== 400) {
      throw new Error('Duplicate student registration was allowed');
    }

    // Update student
    const updateStRes = await makeRequest(`/api/admin/students/${createdStudentId}`, 'PUT', authHeader, {
      name: 'Temp Student Updated'
    });
    if (updateStRes.statusCode !== 200 || updateStRes.data.data?.name !== 'Temp Student Updated') {
      throw new Error('Update student failed');
    }
    console.log(' ✔ Student CRUD & Uniqueness Enforcement: PASSED\n');

    // ----------------------------------------------------
    // 5. STUDENT EXCEL IMPORT & S3 STORAGE
    // ----------------------------------------------------
    console.log('4. VERIFYING STUDENT EXCEL IMPORT & S3 STORAGE...');
    const stWorkbook = new ExcelJS.Workbook();
    const stSheet = stWorkbook.addWorksheet('Students');
    stSheet.addRow(['Registration No', 'Roll No', 'Name', 'Class']);
    stSheet.addRow(['REG_P3C_EXCEL_1', 'R101', 'Excel Student 1', 'SY']);
    stSheet.addRow(['REG_P3C_EXCEL_2', 'R102', 'Excel Student 2', 'TY']);
    stSheet.addRow(['REG_P3C_EXCEL_1', 'R103', 'Duplicate Excel Student', 'SY']); // Duplicate row

    const stBuffer = (await stWorkbook.xlsx.writeBuffer()) as any as Buffer;
    const stImportRes = await makeMultipartRequest(
      '/api/admin/students/import',
      adminToken,
      'file',
      'students_import.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      stBuffer
    );
    console.log(` Student Import Status Code: ${stImportRes.statusCode}`);
    console.log(` Import Summary:`, JSON.stringify(stImportRes.data.data, null, 2));

    if (stImportRes.statusCode !== 200 || stImportRes.data.data?.inserted !== 2) {
      throw new Error('Student Excel import failed or inserted wrong row count');
    }
    console.log(' ✔ Student Excel Import & Storage: PASSED\n');

    // ----------------------------------------------------
    // 6. TEST CRUD & TIMING RULES
    // ----------------------------------------------------
    console.log('5. VERIFYING TEST CRUD & TIMING CONTROL...');
    const createTestRes = await makeRequest('/api/admin/tests', 'POST', authHeader, {
      testNumber: 'TEST_P3C_001',
      title: 'Phase 3C Verification Test',
      className: 'SY',
      testDate: '2026-09-01',
      startTime: '10:00 AM',
      finishTime: '11:00 AM',
      durationMinutes: 60,
      totalMarks: 50,
      status: 'Upcoming'
    });
    console.log(` Create Test Status Code (Expect 201): ${createTestRes.statusCode}`);
    if (createTestRes.statusCode !== 201 || !createTestRes.data.data?.id) {
      throw new Error('Create test failed');
    }
    createdTestId = createTestRes.data.data.id;

    // Complete test
    const completeRes = await makeRequest(`/api/admin/tests/${createdTestId}/complete`, 'POST', authHeader);
    if (completeRes.statusCode !== 200 || completeRes.data.data?.status !== 'Completed') {
      throw new Error('Complete test failed');
    }

    // Publish test results
    const pubRes = await makeRequest(`/api/admin/tests/${createdTestId}/publish`, 'POST', authHeader);
    if (pubRes.statusCode !== 200 || pubRes.data.data?.resultStatus !== 'Published') {
      throw new Error('Publish test results failed');
    }

    // Unpublish test results
    const unpubRes = await makeRequest(`/api/admin/tests/${createdTestId}/unpublish`, 'POST', authHeader);
    if (unpubRes.statusCode !== 200 || unpubRes.data.data?.resultStatus !== 'Unpublished') {
      throw new Error('Unpublish test results failed');
    }
    console.log(' ✔ Test CRUD, Timing, Completion & Publication: PASSED\n');

    // ----------------------------------------------------
    // 7. QUESTION CRUD & EXCEL IMPORT
    // ----------------------------------------------------
    console.log('6. VERIFYING QUESTION CRUD & EXCEL IMPORT...');
    const createQRes = await makeRequest(`/api/admin/tests/${createdTestId}/questions`, 'POST', authHeader, {
      questionNumber: 1,
      questionText: 'What is the capital of France?',
      optionA: 'London',
      optionB: 'Paris',
      optionC: 'Berlin',
      optionD: 'Madrid',
      correctAnswer: 'B',
      marks: 2.0
    });
    console.log(` Create Question Status Code: ${createQRes.statusCode}`);
    if (createQRes.statusCode !== 201 || createQRes.data.data?.correctAnswer !== 'B') {
      throw new Error('Create question failed or withheld correct answer from admin');
    }
    createdQuestionId = createQRes.data.data.id;

    // Questions Excel Import
    const qWorkbook = new ExcelJS.Workbook();
    const qSheet = qWorkbook.addWorksheet('Questions');
    qSheet.addRow(['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']);
    qSheet.addRow(['What is 5*5?', '10', '15', '20', '25', 'D']);
    qSheet.addRow(['What is 10/2?', '5', '4', '3', '2', 'A']);

    const qBuffer = (await qWorkbook.xlsx.writeBuffer()) as any as Buffer;
    const qImportRes = await makeMultipartRequest(
      `/api/admin/tests/${createdTestId}/questions/import`,
      adminToken,
      'file',
      'questions_import.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      qBuffer
    );
    console.log(` Question Import Status Code: ${qImportRes.statusCode}`);
    if (qImportRes.statusCode !== 200 || qImportRes.data.data?.inserted !== 2) {
      throw new Error('Question Excel import failed');
    }
    console.log(' ✔ Question CRUD & Excel Import: PASSED\n');

    // ----------------------------------------------------
    // 8. QUESTION PAPERS & ANSWER KEYS STORAGE
    // ----------------------------------------------------
    console.log('7. VERIFYING QUESTION PAPER & ANSWER KEY PRIVATE STORAGE UPLOADS...');
    const dummyPdf = Buffer.from('%PDF-1.4 sample PDF file content for test upload');
    
    const qpRes = await makeMultipartRequest(
      `/api/admin/tests/${createdTestId}/question-paper`,
      adminToken,
      'file',
      'paper.pdf',
      'application/pdf',
      dummyPdf
    );
    console.log(` Question Paper Upload Status Code: ${qpRes.statusCode}`);
    if (qpRes.statusCode !== 201 || !qpRes.data.data?.storagePath?.startsWith('question-papers/')) {
      throw new Error('Question paper upload failed');
    }

    const akRes = await makeMultipartRequest(
      `/api/admin/tests/${createdTestId}/answer-key`,
      adminToken,
      'file',
      'key.pdf',
      'application/pdf',
      dummyPdf
    );
    console.log(` Answer Key Upload Status Code: ${akRes.statusCode}`);
    if (akRes.statusCode !== 201 || !akRes.data.data?.storagePath?.startsWith('answer-keys/')) {
      throw new Error('Answer key upload failed');
    }
    console.log(' ✔ Question Paper & Answer Key Storage: PASSED\n');

    // ----------------------------------------------------
    // 9. ATTENDANCE & OVERRIDE CONTROL
    // ----------------------------------------------------
    console.log('8. VERIFYING ATTENDANCE MANAGEMENT & ADMIN OVERRIDES...');
    const attListRes = await makeRequest(`/api/admin/tests/${createdTestId}/attendance`, 'GET', authHeader);
    console.log(` Attendance List Status Code: ${attListRes.statusCode}`);
    if (attListRes.statusCode !== 200 || !Array.isArray(attListRes.data.data)) {
      throw new Error('Fetch test attendance failed');
    }

    // Set Present for created student
    const setPresentRes = await makeRequest(
      `/api/admin/tests/${createdTestId}/attendance/${createdStudentId}`,
      'PUT',
      authHeader,
      { status: 'Present' }
    );
    console.log(` Set Attendance Status Code: ${setPresentRes.statusCode}`);
    if (setPresentRes.statusCode !== 200 || setPresentRes.data.data?.status !== 'Present') {
      throw new Error('Update attendance failed');
    }
    console.log(' ✔ Attendance Control & Admin Overrides: PASSED\n');

    // ----------------------------------------------------
    // 10. ATTEMPTS INSPECTION & CHEATING FLAGS
    // ----------------------------------------------------
    console.log('9. VERIFYING ATTEMPT INSPECTION & CHEATING FLAGS...');
    const attemptIns = await query(`
      INSERT INTO student_attempts (test_id, student_id, registration_no, attempt_status, cheating_flag, fullscreen_violation_count, violation_count)
      VALUES ($1, $2, 'REG_P3C_TEMP_001', 'Terminated', 1, 4, 4)
      RETURNING id;
    `, [createdTestId, createdStudentId]);
    createdAttemptId = attemptIns.rows[0].id;

    const getAttemptsRes = await makeRequest(`/api/admin/tests/${createdTestId}/attempts`, 'GET', authHeader);
    console.log(` Attempts List Status Code: ${getAttemptsRes.statusCode}`);
    const foundAttempt = getAttemptsRes.data.data?.find((a: any) => a.id === createdAttemptId);
    if (!foundAttempt || !foundAttempt.cheatingFlag || foundAttempt.fullscreenViolationCount !== 4) {
      throw new Error('Attempt inspection failed to identify cheating flag or violation count');
    }
    console.log(' ✔ Attempt Inspection & Cheating Flags: PASSED\n');

    // ----------------------------------------------------
    // 11. RESULTS & SCORE OVERRIDES
    // ----------------------------------------------------
    console.log('10. VERIFYING RESULT MANAGEMENT & SCORE OVERRIDES...');
    const resultIns = await query(`
      INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained, percentage, published)
      VALUES ($1, $2, 'REG_P3C_TEMP_001', 'Present', 35.0, 70.0, 0)
      RETURNING id;
    `, [createdTestId, createdStudentId]);
    createdResultId = resultIns.rows[0].id;

    // Admin overrides score to 45/50 (90%)
    const overrideRes = await makeRequest(`/api/admin/results/${createdResultId}`, 'PUT', authHeader, {
      marksObtained: 45.0
    });
    console.log(` Override Score Status Code: ${overrideRes.statusCode}`);
    console.log(` Overridden Percentage: ${overrideRes.data.data?.percentage}%`);

    if (overrideRes.statusCode !== 200 || overrideRes.data.data?.marksObtained !== 45 || overrideRes.data.data?.percentage !== 90) {
      throw new Error('Score override failed or miscalculated percentage');
    }
    console.log(' ✔ Result Management & Score Overrides: PASSED\n');

    // ----------------------------------------------------
    // 12. AUDIT LOGS VERIFICATION
    // ----------------------------------------------------
    console.log('11. VERIFYING AUDIT LOGGING GENERATION...');
    const auditRes = await query(`
      SELECT action, entity_type, admin_identifier, created_at
      FROM audit_logs
      WHERE action IN ('CREATE_STUDENT', 'CREATE_TEST', 'OVERRIDE_SCORE', 'PUBLISH_RESULTS')
      ORDER BY id DESC;
    `);
    console.log(` Audit Log Entries Recorded: ${auditRes.rows.length}`);
    if (auditRes.rows.length === 0) {
      throw new Error('Audit logging failed to capture admin mutations');
    }
    console.log(' ✔ Audit Logging Verification: PASSED\n');

    // ----------------------------------------------------
    // 13. SECURITY & NO CREDENTIALS LEAKED
    // ----------------------------------------------------
    console.log('12. VERIFYING SECURITY & SANITIZATION...');
    const dashPayload = JSON.stringify(dashRes.data);
    if (dashPayload.includes('postgresql://') || dashPayload.includes('nak_live') || dashPayload.includes('nsk_live') || dashPayload.includes('$2a$')) {
      throw new Error('Security failure: Credentials or hashes leaked in API response');
    }
    console.log(' ✔ Security Sanitization: PASSED\n');

    console.log('==================================================');
    console.log(' ALL PHASE 3C VERIFICATION CHECKS PASSED SUCCESSFULLY');
    console.log('==================================================\n');

  } finally {
    // CLEANUP TEMPORARY RECORDS
    console.log('--- Cleaning Up Temporary Verification Records ---');
    if (createdResultId) {
      await query(`DELETE FROM test_results WHERE id = $1;`, [createdResultId]);
    }
    if (createdAttemptId) {
      await query(`DELETE FROM student_attempts WHERE id = $1;`, [createdAttemptId]);
    }
    if (createdQuestionId) {
      await query(`DELETE FROM questions WHERE id = $1;`, [createdQuestionId]);
    }
    if (createdTestId) {
      await query(`DELETE FROM questions WHERE test_id = $1;`, [createdTestId]);
      await query(`DELETE FROM resources WHERE test_id = $1;`, [createdTestId]);
      await query(`DELETE FROM attendance WHERE test_id = $1;`, [createdTestId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [createdTestId]);
    }
    if (createdStudentId) {
      await query(`DELETE FROM students WHERE id = $1;`, [createdStudentId]);
    }
    await query(`DELETE FROM students WHERE registration_no LIKE 'REG_P3C_%';`);
    console.log(' ✔ Temporary Verification Records Cleaned Up\n');

    await gracefulShutdown('SIGTERM');
  }
}

verifyPhase3c().catch((err) => {
  console.error('PHASE3C_VERIFICATION_FAILED:', err);
  process.exit(1);
});
