import { query } from '../db/pool';
import { QuestionDto } from '../types/read.types';
import { AppError, NotFoundError } from '../types/api.types';
import { getTestById } from './test.service';

export async function getQuestionsForTest(testId: number): Promise<QuestionDto[]> {
  // 1. Check test existence and status
  const test = await getTestById(testId);

  // 2. Strict accessibility rules
  if (test.status === 'Upcoming') {
    throw new AppError('Test questions are not accessible before the test becomes active', 403, 'TEST_NOT_ACTIVE');
  }

  const isResultPublished = test.status === 'Completed' && test.resultStatus === 'Published';

  // 3. Query questions
  const sql = `
    SELECT 
      id,
      test_id AS "testId",
      question_number AS "questionNumber",
      question_text AS "questionText",
      option_a AS "optionA",
      option_b AS "optionB",
      option_c AS "optionC",
      option_d AS "optionD",
      marks,
      COALESCE(NULLIF(correct_answer, ''), correct_option) AS "correctAnswerRaw"
    FROM questions
    WHERE test_id = $1 AND is_active = 1
    ORDER BY question_number ASC, id ASC;
  `;

  const res = await query(sql, [testId]);

  return res.rows.map((row) => {
    const dto: QuestionDto = {
      id: row.id,
      testId: row.testId,
      questionNumber: row.questionNumber,
      questionText: row.questionText,
      optionA: row.optionA,
      optionB: row.optionB,
      optionC: row.optionC,
      optionD: row.optionD,
      marks: parseFloat(row.marks)
    };

    // ONLY include correct answer if test is Completed AND result is Published
    if (isResultPublished) {
      dto.correctAnswer = row.correctAnswerRaw;
    }

    return dto;
  });
}
