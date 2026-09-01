import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AuditLog {
  id: number;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  admin_identifier?: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  constructor(private supabaseService: SupabaseService) {}

  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}
