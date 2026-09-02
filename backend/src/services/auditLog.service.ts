import { PoolClient } from 'pg';
import { query } from '../db/pool';

export interface AuditLogOptions {
  action: string;
  entityType?: string;
  entityId?: string | number;
  details?: string;
  adminIdentifier?: string;
  testId?: number;
  registrationNo?: string;
  previousValue?: string;
  newValue?: string;
}

export async function createAuditLog(
  options: AuditLogOptions,
  client?: PoolClient
): Promise<void> {
  const sql = `
    INSERT INTO audit_logs (
      action,
      test_id,
      registration_no,
      previous_value,
      new_value
    ) VALUES ($1, $2, $3, $4, $5);
  `;

  const params = [
    options.action,
    options.testId || null,
    options.registrationNo || null,
    options.previousValue || null,
    options.newValue || options.details || null
  ];

  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
}

export async function getAuditLogsAdmin(limit = 100): Promise<any[]> {
  const res = await query(
    `SELECT id, timestamp, action, test_id, registration_no, previous_value, new_value
     FROM audit_logs
     ORDER BY id DESC
     LIMIT $1;`,
    [limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
    action: r.action,
    test_id: r.test_id,
    registration_no: r.registration_no,
    previous_value: r.previous_value || '',
    new_value: r.new_value || ''
  }));
}
