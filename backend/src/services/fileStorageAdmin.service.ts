import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db/pool';
import { s3Client } from './storage.service';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById } from './testAdmin.service';
import { AppError } from '../types/api.types';

export async function uploadOrReplaceResourceAdmin(
  testId: number,
  title: string,
  resourceType: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string; isReplacement: boolean }> {
  // 1. Verify test exists
  const test = await getAdminTestById(testId);

  const typeNorm = resourceType.toLowerCase().trim();

  // 2. Check if resource already exists for (test_id, resource_type)
  const existingRes = await query(
    'SELECT id, title, file_path FROM resources WHERE test_id = $1 AND resource_type = $2;',
    [testId, typeNorm]
  );
  const oldResource = existingRes.rows.length > 0 ? existingRes.rows[0] : null;

  // 3. Determine bucket & S3 key with deterministic pattern
  const timestamp = Date.now();
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  let bucketName = 'resources';
  let s3Key = `resources/test_${testId}_${typeNorm}_${timestamp}_${sanitizedFilename}`;

  if (typeNorm === 'question_paper') {
    bucketName = 'question-papers';
    s3Key = `question-papers/test_${testId}_paper_${timestamp}_${sanitizedFilename}`;
  } else if (typeNorm === 'answer_key') {
    bucketName = 'answer-keys';
    s3Key = `answer-keys/test_${testId}_key_${timestamp}_${sanitizedFilename}`;
  }

  // 4. Upload NEW file to S3 Object Storage first (Failure Safety Step A)
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/pdf'
      })
    );
  } catch (s3Err: any) {
    throw new AppError(`Object Storage upload failed: ${s3Err.message}`, 500, 'STORAGE_UPLOAD_ERROR');
  }

  // 5. Upsert DB row using PostgreSQL ON CONFLICT (test_id, resource_type) (Failure Safety Step B)
  let resourceId: number;
  const docTitle = title || `${typeNorm.replace('_', ' ').toUpperCase()} - ${test.title}`;

  try {
    const upsertSql = `
      INSERT INTO resources (test_id, resource_type, title, file_path, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (test_id, resource_type)
      DO UPDATE SET
        title = EXCLUDED.title,
        file_path = EXCLUDED.file_path,
        updated_at = NOW()
      RETURNING id;
    `;
    const dbRes = await query(upsertSql, [testId, typeNorm, docTitle, s3Key]);
    resourceId = dbRes.rows[0].id;
  } catch (dbErr: any) {
    // DB failed after S3 upload -> clean up newly uploaded S3 object!
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: s3Key }));
    } catch (_) {}
    throw new AppError(`Database persistence failed: ${dbErr.message}`, 500, 'DB_PERSISTENCE_ERROR');
  }

  // 6. Delete OLD S3 file only after new upload & DB update succeeded! (Failure Safety Step C)
  if (oldResource && oldResource.file_path && oldResource.file_path !== s3Key) {
    try {
      let oldBucket = 'resources';
      if (oldResource.file_path.startsWith('question-papers/')) oldBucket = 'question-papers';
      else if (oldResource.file_path.startsWith('answer-keys/')) oldBucket = 'answer-keys';
      await s3Client.send(new DeleteObjectCommand({ Bucket: oldBucket, Key: oldResource.file_path }));
    } catch (_) {}
  }

  await createAuditLog({
    action: oldResource ? 'REPLACE_RESOURCE' : 'UPLOAD_RESOURCE',
    entityType: 'resource',
    entityId: resourceId,
    testId,
    details: `${oldResource ? 'Replaced' : 'Uploaded'} ${typeNorm} resource for test ${testId} (${docTitle})`
  });

  return {
    resourceId,
    storagePath: s3Key,
    title: docTitle,
    isReplacement: !!oldResource
  };
}

export async function uploadQuestionPaperAdmin(
  testId: number,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const test = await getAdminTestById(testId);
  const docTitle = `Question Paper - ${test.title}`;
  const res = await uploadOrReplaceResourceAdmin(testId, docTitle, 'question_paper', fileBuffer, originalFilename);
  return { resourceId: res.resourceId, storagePath: res.storagePath, title: res.title };
}

export async function uploadAnswerKeyAdmin(
  testId: number,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const test = await getAdminTestById(testId);
  const docTitle = `Answer Key - ${test.title}`;
  const res = await uploadOrReplaceResourceAdmin(testId, docTitle, 'answer_key', fileBuffer, originalFilename);
  return { resourceId: res.resourceId, storagePath: res.storagePath, title: res.title };
}

export async function uploadResourceAdmin(
  testId: number,
  title: string,
  resourceType: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ resourceId: number; storagePath: string; title: string }> {
  const res = await uploadOrReplaceResourceAdmin(testId, title, resourceType, fileBuffer, originalFilename);
  return { resourceId: res.resourceId, storagePath: res.storagePath, title: res.title };
}

export async function deleteResourceAdmin(resourceId: number): Promise<void> {
  const res = await query('SELECT id, test_id, resource_type, file_path FROM resources WHERE id = $1;', [resourceId]);
  if (res.rows.length === 0) {
    throw new AppError('Resource not found', 404, 'NOT_FOUND');
  }
  const item = res.rows[0];

  // Delete DB row first
  await query('DELETE FROM resources WHERE id = $1;', [resourceId]);

  // Delete S3 object
  if (item.file_path) {
    let bucketName = 'resources';
    if (item.file_path.startsWith('question-papers/')) bucketName = 'question-papers';
    else if (item.file_path.startsWith('answer-keys/')) bucketName = 'answer-keys';
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: item.file_path }));
    } catch (_) {}
  }

  await createAuditLog({
    action: 'DELETE_RESOURCE',
    entityType: 'resource',
    entityId: resourceId,
    testId: item.test_id,
    details: `Deleted ${item.resource_type} resource ${resourceId} for test ${item.test_id}`
  });
}
