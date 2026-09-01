import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db/pool';
import { s3Client } from './storage.service';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById } from './testAdmin.service';
import { ValidationError } from '../types/api.types';

export async function uploadQuestionPaperAdmin(
  testId: number,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const test = await getAdminTestById(testId);

  const timestamp = Date.now();
  const s3Key = `question-papers/test_${testId}_paper_${timestamp}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Upload to private S3 bucket
  await s3Client.send(
    new PutObjectCommand({
      Bucket: 'question-papers',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    })
  );

  const title = `Question Paper - ${test.title}`;

  const sql = `
    INSERT INTO resources (test_id, class_id, resource_type, title, storage_path, file_path, visibility)
    VALUES ($1, $2, 'question_paper', $3, $4, $4, 'completed_only')
    RETURNING id;
  `;

  const res = await query(sql, [testId, test.classId || 1, title, s3Key]);
  const resourceId = res.rows[0].id;

  await createAuditLog({
    action: 'UPLOAD_QUESTION_PAPER',
    entityType: 'resource',
    entityId: resourceId,
    testId,
    details: `Uploaded question paper ${originalFilename} for test ${testId}`
  });

  return { resourceId, storagePath: s3Key, title };
}

export async function uploadAnswerKeyAdmin(
  testId: number,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const test = await getAdminTestById(testId);

  const timestamp = Date.now();
  const s3Key = `answer-keys/test_${testId}_key_${timestamp}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Upload to private S3 bucket
  await s3Client.send(
    new PutObjectCommand({
      Bucket: 'answer-keys',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    })
  );

  const title = `Answer Key - ${test.title}`;

  const sql = `
    INSERT INTO resources (test_id, class_id, resource_type, title, storage_path, file_path, visibility)
    VALUES ($1, $2, 'answer_key', $3, $4, $4, 'admin_only')
    RETURNING id;
  `;

  const res = await query(sql, [testId, test.classId || 1, title, s3Key]);
  const resourceId = res.rows[0].id;

  await createAuditLog({
    action: 'UPLOAD_ANSWER_KEY',
    entityType: 'resource',
    entityId: resourceId,
    testId,
    details: `Uploaded answer key ${originalFilename} for test ${testId}`
  });

  return { resourceId, storagePath: s3Key, title };
}
