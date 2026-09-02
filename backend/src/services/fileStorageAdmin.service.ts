import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db/pool';
import { s3Client } from './storage.service';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById } from './testAdmin.service';

export async function uploadQuestionPaperAdmin(
  testId: number,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const test = await getAdminTestById(testId);
  const timestamp = Date.now();
  const s3Key = `question-papers/test_${testId}_paper_${timestamp}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Upload to private S3 bucket 'question-papers'
  await s3Client.send(
    new PutObjectCommand({
      Bucket: 'question-papers',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    })
  );

  const title = `Question Paper - ${test.title}`;

  // Delete previous question paper entry if any for this test
  await query("DELETE FROM resources WHERE test_id = $1 AND resource_type = 'question_paper';", [testId]);

  const sql = `
    INSERT INTO resources (test_id, resource_type, title, file_path)
    VALUES ($1, 'question_paper', $2, $3)
    RETURNING id;
  `;

  const res = await query(sql, [testId, title, s3Key]);
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

  // Upload to private S3 bucket 'answer-keys'
  await s3Client.send(
    new PutObjectCommand({
      Bucket: 'answer-keys',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    })
  );

  const title = `Answer Key - ${test.title}`;

  // Delete previous answer key entry if any for this test
  await query("DELETE FROM resources WHERE test_id = $1 AND resource_type = 'answer_key';", [testId]);

  const sql = `
    INSERT INTO resources (test_id, resource_type, title, file_path)
    VALUES ($1, 'answer_key', $2, $3)
    RETURNING id;
  `;

  const res = await query(sql, [testId, title, s3Key]);
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

export async function uploadResourceAdmin(
  testId: number,
  title: string,
  resourceType: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const test = await getAdminTestById(testId);
  const timestamp = Date.now();
  const bucketName = 'resources';
  const s3Key = `resources/test_${testId}_${resourceType}_${timestamp}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    })
  );

  await query("DELETE FROM resources WHERE test_id = $1 AND resource_type = $2;", [testId, resourceType]);

  const sql = `
    INSERT INTO resources (test_id, resource_type, title, file_path)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;

  const res = await query(sql, [testId, resourceType, title, s3Key]);
  const resourceId = res.rows[0].id;

  await createAuditLog({
    action: 'UPLOAD_RESOURCE',
    entityType: 'resource',
    entityId: resourceId,
    testId,
    details: `Uploaded ${resourceType} resource ${originalFilename} for test ${testId}`
  });

  return { resourceId, storagePath: s3Key, title };
}
