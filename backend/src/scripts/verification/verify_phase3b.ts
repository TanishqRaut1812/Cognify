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

async function verifyPhase3b() {
  console.log('==================================================');
  console.log(' COGNIFY PHASE 3B: PUBLIC READ APIs VERIFICATION');
  console.log('==================================================\n');

  // Import server & pool
  const { server, gracefulShutdown } = await import('../../server');
  const { query } = await import('../../db/pool');

  // Allow server time to bind
  await new Promise((resolve) => setTimeout(resolve, 1500));

  let tempClassId: number | null = null;
  let upcomingTestId: number | null = null;
  let currentTestId: number | null = null;
  let completedTest1Id: number | null = null;
  let completedTest2Id: number | null = null;
  const tempStudentIds: number[] = [];

  try {
    // SETUP TEMPORARY TEST RECORDS FOR COMPREHENSIVE VERIFICATION
    console.log('--- Setting Up Temporary Verification Records ---');

    // Get SY class ID
    const classRes = await query(`SELECT id FROM classes WHERE code = 'SY';`);
    tempClassId = classRes.rows[0]?.id || 1;

    // 1. Create Upcoming Test
    const upRes = await query(`
      INSERT INTO tests (test_number, title, class_id, test_date, total_marks, status, result_status)
      VALUES ('TEST_PHASE3B_UPCOMING', 'Upcoming Verification Test', $1, '2026-10-01', 50, 'Upcoming', 'Unpublished')
      RETURNING id;
    `, [tempClassId]);
    upcomingTestId = upRes.rows[0].id;

    // 2. Create Current (Active) Test
    const currRes = await query(`
      INSERT INTO tests (test_number, title, class_id, test_date, total_marks, status, result_status)
      VALUES ('TEST_PHASE3B_CURRENT', 'Active Verification Test', $1, '2026-09-01', 100, 'Current', 'Unpublished')
      RETURNING id;
    `, [tempClassId]);
    currentTestId = currRes.rows[0].id;

    // Insert Questions into Active Test
    await query(`
      INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer)
      VALUES ($1, 1, 'What is 2+2?', '3', '4', '5', '6', 'B');
    `, [currentTestId]);

    // 3. Create Completed Test 1 (Total Marks = 50)
    const comp1Res = await query(`
      INSERT INTO tests (test_number, title, class_id, test_date, total_marks, status, result_status, is_published)
      VALUES ('TEST_PHASE3B_COMP1', 'Completed Test 1 (50 Marks)', $1, '2026-08-01', 50, 'Completed', 'Published', 1)
      RETURNING id;
    `, [tempClassId]);
    completedTest1Id = comp1Res.rows[0].id;

    // 4. Create Completed Test 2 (Total Marks = 100)
    const comp2Res = await query(`
      INSERT INTO tests (test_number, title, class_id, test_date, total_marks, status, result_status, is_published)
      VALUES ('TEST_PHASE3B_COMP2', 'Completed Test 2 (100 Marks)', $1, '2026-08-15', 100, 'Completed', 'Published', 1)
      RETURNING id;
    `, [tempClassId]);
    completedTest2Id = comp2Res.rows[0].id;

    // 5. Create 4 Students with known scores for Leaderboard & Tie-Ranking test
    // Student A: Test 1 = 50/50 (100%), Test 2 = 90/100 (90%) -> Avg = 95%
    // Student B: Test 1 = 45/50 (90%), Test 2 = 90/100 (90%) -> Avg = 90%
    // Student C: Test 1 = 45/50 (90%), Test 2 = 90/100 (90%) -> Avg = 90% (TIED WITH B!)
    // Student D: Test 1 = 40/50 (80%), Test 2 = ABSENT (0%) -> Avg = 40% (ABSENT RULE!)
    const stA = await query(`INSERT INTO students (registration_no, name, class_id, class_name) VALUES ('REG_P3B_ST_A', 'Student A', $1, 'SY') RETURNING id;`, [tempClassId]);
    const stB = await query(`INSERT INTO students (registration_no, name, class_id, class_name) VALUES ('REG_P3B_ST_B', 'Student B', $1, 'SY') RETURNING id;`, [tempClassId]);
    const stC = await query(`INSERT INTO students (registration_no, name, class_id, class_name) VALUES ('REG_P3B_ST_C', 'Student C', $1, 'SY') RETURNING id;`, [tempClassId]);
    const stD = await query(`INSERT INTO students (registration_no, name, class_id, class_name) VALUES ('REG_P3B_ST_D', 'Student D', $1, 'SY') RETURNING id;`, [tempClassId]);

    tempStudentIds.push(stA.rows[0].id, stB.rows[0].id, stC.rows[0].id, stD.rows[0].id);

    // Insert Test 1 Results (Total Marks = 50)
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_A', 'Present', 50.0);`, [completedTest1Id, stA.rows[0].id]);
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_B', 'Present', 45.0);`, [completedTest1Id, stB.rows[0].id]);
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_C', 'Present', 45.0);`, [completedTest1Id, stC.rows[0].id]);
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_D', 'Present', 40.0);`, [completedTest1Id, stD.rows[0].id]);

    // Insert Test 2 Results (Total Marks = 100)
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_A', 'Present', 90.0);`, [completedTest2Id, stA.rows[0].id]);
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_B', 'Present', 90.0);`, [completedTest2Id, stB.rows[0].id]);
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_C', 'Present', 90.0);`, [completedTest2Id, stC.rows[0].id]);
    await query(`INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained) VALUES ($1, $2, 'REG_P3B_ST_D', 'Absent', 0.0);`, [completedTest2Id, stD.rows[0].id]);

    console.log(' ✔ Temporary Verification Setup Complete\n');

    // ----------------------------------------------------
    // TEST 1: CLASSES API (GET /api/classes)
    // ----------------------------------------------------
    console.log('1. VERIFYING CLASSES API (GET /api/classes)...');
    const classesRes = await makeRequest('/api/classes');
    console.log(` Status Code: ${classesRes.statusCode}`);
    console.log(` Classes Found:`, classesRes.data.data?.map((c: any) => c.code));

    if (classesRes.statusCode !== 200 || !classesRes.data.success || !Array.isArray(classesRes.data.data)) {
      throw new Error('Classes API failed');
    }
    const classCodes = classesRes.data.data.map((c: any) => c.code);
    if (!classCodes.includes('SY') || !classCodes.includes('TY') || !classCodes.includes('Final Year')) {
      throw new Error('Classes API missing required class codes');
    }
    console.log(' ✔ GET /api/classes: PASSED\n');

    // ----------------------------------------------------
    // TEST 2: TESTS API (GET /api/tests & GET /api/tests/:id)
    // ----------------------------------------------------
    console.log('2. VERIFYING TESTS API (GET /api/tests & GET /api/tests/:testId)...');
    const testsRes = await makeRequest('/api/tests?class=SY');
    console.log(` Status Code: ${testsRes.statusCode}`);
    console.log(` Tests Found for SY: ${testsRes.data.data?.length}`);

    if (testsRes.statusCode !== 200 || !testsRes.data.success || !Array.isArray(testsRes.data.data)) {
      throw new Error('Tests API failed');
    }

    const singleTestRes = await makeRequest(`/api/tests/${currentTestId}`);
    console.log(` Single Test Status Code: ${singleTestRes.statusCode}`);
    console.log(` Single Test Title: ${singleTestRes.data.data?.title}`);

    if (singleTestRes.statusCode !== 200 || singleTestRes.data.data?.id !== currentTestId) {
      throw new Error('Single test API failed');
    }
    console.log(' ✔ GET /api/tests & GET /api/tests/:testId: PASSED\n');

    // ----------------------------------------------------
    // TEST 3: TEST QUESTIONS API & ANSWER WITHHOLDING
    // ----------------------------------------------------
    console.log('3. VERIFYING QUESTIONS API & STRICT ANSWER WITHHOLDING...');
    
    // 3a. Upcoming test must return 403 Forbidden
    const upcomingQuestionsRes = await makeRequest(`/api/tests/${upcomingTestId}/questions`);
    console.log(` Upcoming Test Questions Status Code (Expect 403): ${upcomingQuestionsRes.statusCode}`);
    if (upcomingQuestionsRes.statusCode !== 403) {
      throw new Error('Upcoming test questions allowed access (Security Failure)');
    }

    // 3b. Active/Current test must return questions WITHOUT correct_answer
    const currentQuestionsRes = await makeRequest(`/api/tests/${currentTestId}/questions`);
    console.log(` Active Test Questions Status Code: ${currentQuestionsRes.statusCode}`);
    console.log(` Active Test Questions Count: ${currentQuestionsRes.data.data?.length}`);
    const q1 = currentQuestionsRes.data.data?.[0];
    console.log(` Question 1 Has correctAnswer Field?:`, 'correctAnswer' in (q1 || {}));

    if (currentQuestionsRes.statusCode !== 200 || !q1 || 'correctAnswer' in q1) {
      throw new Error('Active test returned correct answers or failed (Security Failure)');
    }
    console.log(' ✔ GET /api/tests/:testId/questions & Answer Protection: PASSED\n');

    // ----------------------------------------------------
    // TEST 4: SYLLABUS API (GET /api/syllabus)
    // ----------------------------------------------------
    console.log('4. VERIFYING SYLLABUS API (GET /api/syllabus)...');
    const syllabusRes = await makeRequest('/api/syllabus?class=SY');
    console.log(` Status Code: ${syllabusRes.statusCode}`);
    if (syllabusRes.statusCode !== 200 || !syllabusRes.data.success || !Array.isArray(syllabusRes.data.data)) {
      throw new Error('Syllabus API failed');
    }
    console.log(' ✔ GET /api/syllabus: PASSED\n');

    // ----------------------------------------------------
    // TEST 5: RESOURCES API (GET /api/resources)
    // ----------------------------------------------------
    console.log('5. VERIFYING RESOURCES API (GET /api/resources)...');
    const resourcesRes = await makeRequest('/api/resources?class=SY');
    console.log(` Status Code: ${resourcesRes.statusCode}`);
    if (resourcesRes.statusCode !== 200 || !resourcesRes.data.success || !Array.isArray(resourcesRes.data.data)) {
      throw new Error('Resources API failed');
    }
    // Verify zero S3 secret keys / paths exposed
    const resSample = resourcesRes.data.data?.[0] || {};
    if ('storage_path' in resSample || 'file_path' in resSample) {
      throw new Error('Resources API exposed private internal storage path');
    }
    console.log(' ✔ GET /api/resources: PASSED\n');

    // ----------------------------------------------------
    // TEST 6: LEADERBOARD, PERCENTAGE NORMALIZATION & COMPETITION RANKING
    // ----------------------------------------------------
    console.log('6. VERIFYING LEADERBOARD, PERCENTAGE NORMALIZATION & COMPETITION RANKING...');
    const leaderboardRes = await makeRequest('/api/leaderboard?class=SY');
    console.log(` Status Code: ${leaderboardRes.statusCode}`);
    const lbData: any[] = leaderboardRes.data.data || [];
    console.log(` Leaderboard Entries:`, lbData.map(e => ({ rank: e.rank, reg: e.registrationNo, pct: e.overallPercentage })));

    // Find our test students
    const entryA = lbData.find(e => e.registrationNo === 'REG_P3B_ST_A');
    const entryB = lbData.find(e => e.registrationNo === 'REG_P3B_ST_B');
    const entryC = lbData.find(e => e.registrationNo === 'REG_P3B_ST_C');
    const entryD = lbData.find(e => e.registrationNo === 'REG_P3B_ST_D');

    if (!entryA || !entryB || !entryC || !entryD) {
      throw new Error('Leaderboard missing expected test students');
    }

    // Verify Percentage Calculations:
    // Student A: (50/50*100 + 90/100*100) / 2 = (100 + 90) / 2 = 95%
    if (entryA.overallPercentage !== 95) {
      throw new Error(`Student A percentage calculation incorrect. Expected 95, got ${entryA.overallPercentage}`);
    }

    // Student B & C: (45/50*100 + 90/100*100) / 2 = (90 + 90) / 2 = 90%
    if (entryB.overallPercentage !== 90 || entryC.overallPercentage !== 90) {
      throw new Error(`Student B/C percentage calculation incorrect. Expected 90`);
    }

    // Student D: (40/50*100 + 0) / 2 = (80 + 0) / 2 = 40% (ABSENT RULE!)
    if (entryD.overallPercentage !== 40) {
      throw new Error(`Student D absent rule percentage calculation incorrect. Expected 40, got ${entryD.overallPercentage}`);
    }

    // Verify Competition Ranking:
    // Student A should be Rank 1
    // Student B & C should BOTH be Rank 2 (Tied!)
    // Student D should be Rank 4 (Competition ranking: 1, 2, 2, 4)!
    if (entryA.rank !== 1) {
      throw new Error(`Student A rank incorrect. Expected 1, got ${entryA.rank}`);
    }
    if (entryB.rank !== 2 || entryC.rank !== 2) {
      throw new Error(`Tied students B & C rank incorrect. Expected 2, got B:${entryB.rank}, C:${entryC.rank}`);
    }
    if (entryD.rank !== 4) {
      throw new Error(`Competition rank skipping incorrect. Expected 4 after two 2s, got ${entryD.rank}`);
    }

    // Verify Top 10 limit
    if (lbData.length > 10) {
      throw new Error(`Leaderboard exceeded top 10 limit: ${lbData.length}`);
    }

    console.log(' ✔ GET /api/leaderboard (Percentage Normalization, Absent=0, Competition Ranking 1,2,2,4): PASSED\n');

    // ----------------------------------------------------
    // TEST 7: SECURITY & NO SECRETS IN RESPONSES
    // ----------------------------------------------------
    console.log('7. VERIFYING SECURITY & SANITIZATION...');
    const rawJson = JSON.stringify(leaderboardRes.data);
    if (rawJson.includes('postgresql://') || rawJson.includes('nak_live') || rawJson.includes('nsk_live')) {
      throw new Error('Security failure: Secret credentials detected in API response payload');
    }
    console.log(' ✔ Security Checks: PASSED\n');

    console.log('==================================================');
    console.log(' ALL PHASE 3B VERIFICATION CHECKS PASSED SUCCESSFULLY');
    console.log('==================================================\n');

  } finally {
    // CLEANUP TEMPORARY VERIFICATION RECORDS
    console.log('--- Cleaning Up Temporary Verification Records ---');
    if (completedTest1Id) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [completedTest1Id]);
      await query(`DELETE FROM tests WHERE id = $1;`, [completedTest1Id]);
    }
    if (completedTest2Id) {
      await query(`DELETE FROM test_results WHERE test_id = $1;`, [completedTest2Id]);
      await query(`DELETE FROM tests WHERE id = $1;`, [completedTest2Id]);
    }
    if (currentTestId) {
      await query(`DELETE FROM questions WHERE test_id = $1;`, [currentTestId]);
      await query(`DELETE FROM tests WHERE id = $1;`, [currentTestId]);
    }
    if (upcomingTestId) {
      await query(`DELETE FROM tests WHERE id = $1;`, [upcomingTestId]);
    }
    if (tempStudentIds.length > 0) {
      await query(`DELETE FROM students WHERE id = ANY($1::int[]);`, [tempStudentIds]);
    }
    console.log(' ✔ Temporary Verification Records Cleaned Up\n');

    await gracefulShutdown('SIGTERM');
  }
}

verifyPhase3b().catch((err) => {
  console.error('PHASE3B_VERIFICATION_FAILED:', err);
  process.exit(1);
});
