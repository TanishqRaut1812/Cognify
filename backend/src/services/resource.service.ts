import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query } from '../db/pool';
import { s3Client } from './storage.service';
import { ResourceDto } from '../types/read.types';
import { AppError } from '../types/api.types';

export async function getResources(
  classCode?: string,
  testId?: number,
  resourceType?: string
): Promise<ResourceDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (testId) {
    params.push(testId);
    conditions.push(`r.test_id = $${params.length}`);
  }

  if (resourceType) {
    params.push(resourceType);
    conditions.push(`r.resource_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      r.id,
      r.test_id AS "testId",
      r.resource_type AS "resourceType",
      r.title,
      r.file_path AS "filePath",
      r.updated_at AS "createdAt"
    FROM resources r
    ${whereClause}
    ORDER BY r.id DESC;
  `;

  const res = await query(sql, params);

  return res.rows.map((row) => ({
    id: row.id,
    testId: row.testId,
    classId: undefined,
    className: undefined,
    resourceType: row.resourceType,
    title: row.title,
    visibility: 'public',
    filePath: row.filePath,
    createdAt: row.createdAt
  }));
}

function isResourceUnlockedByFinishTime(test: { test_date?: string; finish_time?: string }): boolean {
  if (!test.finish_time) return true;
  const now = new Date();
  const rawDate = test.test_date || '2026-08-25';
  const dateOnly = typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0];
  const finishTimeStr = test.finish_time.length === 5 ? `${test.finish_time}:00` : test.finish_time;
  const finishDateTime = new Date(`${dateOnly}T${finishTimeStr}`);
  return now >= finishDateTime;
}

export async function getTestResourceStatus(testId: number): Promise<any> {
  // Fetch test info
  const testRes = await query("SELECT id, status, is_published, test_date, finish_time FROM tests WHERE id = $1;", [testId]);
  if (testRes.rows.length === 0) {
    throw new AppError('Test not found', 404, 'NOT_FOUND');
  }
  const test = testRes.rows[0];
  const isUnlocked = isResourceUnlockedByFinishTime(test);

  // Fetch resources for test
  const resList = await query("SELECT id, resource_type, title, file_path FROM resources WHERE test_id = $1;", [testId]);

  const map: Record<string, { exists: boolean; resourceId?: number; title?: string; isLocked: boolean }> = {
    notes: { exists: false, isLocked: false },
    practice: { exists: false, isLocked: false },
    question_paper: { exists: false, isLocked: !isUnlocked },
    answer_key: { exists: false, isLocked: !isUnlocked }
  };

  for (const r of resList.rows) {
    const rType = r.resource_type;
    if (map[rType]) {
      map[rType].exists = true;
      map[rType].resourceId = r.id;
      map[rType].title = r.title;
    }
  }

  return {
    testId,
    testStatus: test.status,
    isCompleted: isUnlocked,
    resources: map
  };
}

export async function getResourceDownloadUrl(testId: number, resourceType: string): Promise<{ downloadUrl: string; title: string; resourceType: string }> {
  // 1. Verify test & access rules
  const testRes = await query("SELECT id, test_number, test_name, status, is_published, test_date, finish_time FROM tests WHERE id = $1;", [testId]);
  if (testRes.rows.length === 0) {
    throw new AppError('Test not found', 404, 'NOT_FOUND');
  }
  const test = testRes.rows[0];

  const typeNorm = resourceType.toLowerCase().trim();

  // Rule 2: Access control rule: question_paper and answer_key locked until finish_time
  const isUnlocked = isResourceUnlockedByFinishTime(test);
  if ((typeNorm === 'question_paper' || typeNorm === 'answer_key') && !isUnlocked) {
    throw new AppError(
      `${typeNorm === 'question_paper' ? 'Question Paper' : 'Answer Key'} is inaccessible until the test finish time (${test.finish_time || 'scheduled time'}).`,
      403,
      'LOCKED_RESOURCE'
    );
  }

  // 2. Fetch resource entry
  const res = await query("SELECT id, title, file_path FROM resources WHERE test_id = $1 AND resource_type = $2 LIMIT 1;", [testId, typeNorm]);
  if (res.rows.length === 0) {
    throw new AppError(`No ${typeNorm.replace('_', ' ')} resource uploaded for this test.`, 404, 'RESOURCE_NOT_FOUND');
  }

  const resource = res.rows[0];
  const s3Key: string = resource.file_path;

  // 3. Determine bucket
  let bucketName = 'resources';
  if (s3Key.startsWith('question-papers/')) {
    bucketName = 'question-papers';
  } else if (s3Key.startsWith('answer-keys/')) {
    bucketName = 'answer-keys';
  }

  // 4. Generate short-lived signed URL (15 minutes = 900 seconds)
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    ResponseContentDisposition: `inline; filename="${encodeURIComponent(resource.title || 'document')}.pdf"`
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    downloadUrl,
    title: resource.title,
    resourceType: typeNorm
  };
}
