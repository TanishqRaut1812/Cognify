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
      entity_type,
      entity_id,
      details,
      admin_identifier,
      test_id,
      registration_no,
      previous_value,
      new_value
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
  `;

  const params = [
    options.action,
    options.entityType || null,
    options.entityId ? String(options.entityId) : null,
    options.details || null,
    options.adminIdentifier || 'Admin',
    options.testId || null,
    options.registrationNo || null,
    options.previousValue || null,
    options.newValue || null
  ];

  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
}

export async function getAuditLogsAdmin(limit = 100): Promise<any[]> {
  const res = await query(
    `SELECT id, action, entity_type AS "entityType", entity_id AS "entityId", details, admin_identifier AS "adminIdentifier", registration_no AS "registrationNo", created_at AS "createdAt", previous_value AS "previous_value", new_value AS "new_value"
     FROM audit_logs
     ORDER BY id DESC
     LIMIT $1;`,
    [limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    timestamp: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    action: r.action,
    previous_value: r.previous_value || '',
    new_value: r.new_value || r.details || ''
  }));
}

