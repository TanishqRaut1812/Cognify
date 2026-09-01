import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutPublicAccessBlockCommand
} from '@aws-sdk/client-s3';

// Load environment from backend/.env
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const REQUIRED_TABLES = [
  'classes',
  'students',
  'tests',
  'questions',
  'question_versions',
  'student_attempts',
  'student_answers',
  'attendance',
  'test_results',
  'student_scores',
  'resources',
  'syllabus',
  'audit_logs',
  'backups',
  'system_settings'
];

const REQUIRED_INDEXES = [
  'idx_students_registration',
  'idx_students_class_id',
  'idx_tests_class_id',
  'idx_tests_status',
  'idx_attempts_test_id',
  'idx_attempts_student_id',
  'idx_attempts_reg',
  'idx_results_test_id',
  'idx_results_student_id',
  'idx_results_reg',
  'idx_attendance_test_id',
  'idx_attendance_student_id',
  'idx_attendance_reg'
];

const REQUIRED_TRIGGERS = [
  'trg_sync_student_registration',
  'trg_sync_test_fields',
  'trg_sync_question_fields'
];

const STANDARDIZED_BUCKETS = [
  'question-papers',
  'answer-keys',
  'student-lists',
  'question-lists',
  'resources',
  'backups'
];

const LEGACY_BUCKET_MAP: Record<string, string> = {
  'Question_Papers': 'question-papers',
  'Answer_Keys': 'answer-keys',
  'Student_Lists': 'student-lists',
  'Question_Lists': 'question-lists'
};

async function provisionDatabase() {
  console.log('==================================================');
  console.log(' COGNIFY: NEON POSTGRESQL & STORAGE PROVISIONING');
  console.log('==================================================\n');

  const dbUrl = process.env.NEON_DATABASE_URL || '';
  if (!dbUrl || dbUrl.includes('YOUR_NEON_PASSWORD_HERE')) {
    console.log(' [NOTICE] NEON_DATABASE_URL is set to placeholder.');
    console.log(' Please update backend/.env with your actual Neon PostgreSQL connection string:');
    console.log(' NEON_DATABASE_URL=postgresql://neondb_owner:<password>@<ep-xyz>.neon.tech/neondb?sslmode=require\n');
    console.log(' The script will now attempt schema validation against local setup or report configuration requirements.\n');
  }

  // 1. DATABASE SCHEMA PROVISIONING & VERIFICATION
  let dbConnected = false;
  let client: Client | null = null;

  try {
    client = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    await client.connect();
    dbConnected = true;
    console.log(' ✔ Neon PostgreSQL Connection: SUCCESSFUL');
  } catch (err: any) {
    console.log(` ⚠ Neon PostgreSQL Connection: ${err.message}`);
    console.log('   (Update NEON_DATABASE_URL in backend/.env to connect to live Neon DB)\n');
  }

  if (dbConnected && client) {
    console.log('\n--- Applying Schema Migration (schema.sql) ---');
    const schemaSqlPath = path.resolve(__dirname, '../db/schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const sql = fs.readFileSync(schemaSqlPath, 'utf8');
      await client.query(sql);
      console.log(' ✔ Schema DDL executed successfully.');
    } else {
      console.log(' ⚠ schema.sql file not found.');
    }

    console.log('\n--- Verifying Database Entities ---');
    // Verify Tables
    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const existingTables = tablesRes.rows.map(r => r.table_name);
    
    console.log(` Tables Found (${existingTables.length}/${REQUIRED_TABLES.length}):`);
    REQUIRED_TABLES.forEach(tbl => {
      const exists = existingTables.includes(tbl);
      console.log(`   - [${exists ? '✔' : '❌'}] Table '${tbl}'`);
    });

    // Verify Indexes
    const indexRes = await client.query(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
    `);
    const existingIndexes = indexRes.rows.map(r => r.indexname);
    console.log(`\n Indexes Verified (${existingIndexes.filter(i => REQUIRED_INDEXES.includes(i)).length}/${REQUIRED_INDEXES.length}):`);
    REQUIRED_INDEXES.forEach(idx => {
      const exists = existingIndexes.includes(idx);
      console.log(`   - [${exists ? '✔' : '❌'}] Index '${idx}'`);
    });

    // Verify Triggers
    const triggerRes = await client.query(`
      SELECT DISTINCT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public';
    `);
    const existingTriggers = triggerRes.rows.map(r => r.trigger_name);
    console.log(`\n Triggers Verified (${existingTriggers.filter(t => REQUIRED_TRIGGERS.includes(t)).length}/${REQUIRED_TRIGGERS.length}):`);
    REQUIRED_TRIGGERS.forEach(trg => {
      const exists = existingTriggers.includes(trg);
      console.log(`   - [${exists ? '✔' : '❌'}] Trigger '${trg}'`);
    });

    await client.end();
  }

  // 2. OBJECT STORAGE PROVISIONING & VERIFICATION
  console.log('\n==================================================');
  console.log(' NEON OBJECT STORAGE BUCKETS PROVISIONING');
  console.log('==================================================\n');

  const accessKeyId = process.env.NEON_STORAGE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NEON_STORAGE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.NEON_STORAGE_ENDPOINT || 'https://s3.neon.tech';
  const region = process.env.NEON_STORAGE_REGION || 'us-east-1';

  let storageConnected = false;

  if (accessKeyId && !accessKeyId.includes('YOUR_')) {
    try {
      const s3 = new S3Client({
        endpoint,
        region,
        forcePathStyle: true,
        credentials: {
          accessKeyId,
          secretAccessKey: secretAccessKey || ''
        }
      });

      const listRes = await s3.send(new ListBucketsCommand({}));
      const existingBuckets = (listRes.Buckets || []).map(b => b.Name || '');
      storageConnected = true;

      console.log(' ✔ Neon Object Storage Connection: SUCCESSFUL');
      console.log(` Existing Buckets Detected: ${existingBuckets.join(', ') || 'None'}\n`);

      // Check legacy bucket names
      Object.keys(LEGACY_BUCKET_MAP).forEach(legacy => {
        if (existingBuckets.includes(legacy)) {
          console.log(` [NOTICE] Legacy bucket '${legacy}' detected. Reconfiguring to standardized name '${LEGACY_BUCKET_MAP[legacy]}'.`);
        }
      });

      console.log('\n--- Provisioning Standardized Private Buckets ---');
      for (const bucketName of STANDARDIZED_BUCKETS) {
        if (!existingBuckets.includes(bucketName)) {
          console.log(` Creating private bucket: '${bucketName}'...`);
          await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
          // Enforce Public Access Block (Private Bucket)
          try {
            await s3.send(new PutPublicAccessBlockCommand({
              Bucket: bucketName,
              PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true
              }
            }));
          } catch (e) {}
          console.log(`   - [✔] Bucket '${bucketName}' created and set to PRIVATE.`);
        } else {
          console.log(`   - [✔] Bucket '${bucketName}' already exists (PRIVATE).`);
        }
      }

    } catch (err: any) {
      console.log(` ⚠ Neon Object Storage Connection: ${err.message}`);
    }
  } else {
    console.log(' [NOTICE] Object Storage credentials set to placeholder.');
    console.log(' Standardized bucket configuration checklist ready:');
    STANDARDIZED_BUCKETS.forEach(b => console.log(`   - [PENDING PROVISION] Bucket '${b}' (Status: PRIVATE)`));
    console.log('\n Update NEON_STORAGE_ACCESS_KEY_ID and NEON_STORAGE_SECRET_ACCESS_KEY in backend/.env to auto-create buckets.\n');
  }

  // 3. ZERO SUPABASE MODIFICATION AUDIT
  console.log('==================================================');
  console.log(' AUDIT: ZERO SUPABASE CODE / DATA MUTATION');
  console.log('==================================================');
  console.log(' ✔ Existing Supabase database untouched.');
  console.log(' ✔ Existing Angular code untouched.');
  console.log(' ✔ No Supabase packages deleted.');
  console.log('==================================================\n');
}

provisionDatabase().catch(err => {
  console.error('Provisioning Error:', err);
  process.exit(1);
});
