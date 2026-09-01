import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (window as any).env?.SUPABASE_URL || 'https://xcsrhshotfqvisqwlxme.supabase.co';
const SUPABASE_ANON_KEY = (window as any).env?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhjc3Joc2hvdGZxdmlzcXdseG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzIwMDAsImV4cCI6MjA1NTc0ODAwMH0.dummykey';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  get supabase(): SupabaseClient {
    return this.client;
  }
}
