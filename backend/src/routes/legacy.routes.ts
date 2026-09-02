import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { verifyStudentHandler, startTestHandler, saveStudentAnswerHandler, submitTestAttemptHandler, reportFullscreenViolationHandler } from '../controllers/studentExam.controller';
import { loginAdminHandler, logoutAdminHandler } from '../controllers/adminAuth.controller';

const router = Router();

// --- PUBLIC ROUTE ALIASES ---
router.get('/public/rankings', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT ss.registration_no, s.roll_no, s.name, s.class_name, ss.cognify_score, ss.rank, ss.completed_tests_count
      FROM student_scores ss
      JOIN students s ON ss.registration_no = s.registration_no
      ORDER BY ss.cognify_score DESC, s.name ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/public/rankings/:className', async (req: Request, res: Response) => {
  try {
    const { className } = req.params;
    const query = `
      SELECT ss.registration_no, s.roll_no, s.name, s.class_name, ss.cognify_score, ss.rank, ss.completed_tests_count
      FROM student_scores ss
      JOIN students s ON ss.registration_no = s.registration_no
      WHERE s.class_name = $1
      ORDER BY ss.cognify_score DESC, s.name ASC
    `;
    const result = await pool.query(query, [className]);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/public/timeline', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM tests ORDER BY id ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/public/current-test', async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM tests WHERE status = 'Current' ORDER BY id DESC LIMIT 1");
    if (result.rows.length === 0) {
      const upcoming = await pool.query("SELECT * FROM tests WHERE status = 'Upcoming' ORDER BY id ASC LIMIT 1");
      return res.json(upcoming.rows[0] || null);
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/public/plan', async (req: Request, res: Response) => {
  try {
    const testsRes = await pool.query('SELECT * FROM tests ORDER BY id ASC');
    const categoriesRes = await pool.query('SELECT * FROM syllabus_categories ORDER BY display_order ASC');
    res.json({ tests: testsRes.rows, syllabus: categoriesRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN ALIASES ---
router.post('/admin/login', loginAdminHandler);
router.post('/admin/logout', logoutAdminHandler);

router.get('/admin/status', (req: Request, res: Response) => {
  res.json({ authenticated: true, role: 'admin' });
});

// --- STUDENT ALIASES ---
router.post('/student/verify-registration', verifyStudentHandler);
router.post('/student/verify-reg', verifyStudentHandler);
router.post('/student/start-attempt', startTestHandler);
router.post('/student/save-answer', saveStudentAnswerHandler);
router.post('/student/log-violation', reportFullscreenViolationHandler);
router.post('/student/submit-attempt', submitTestAttemptHandler);

export default router;
