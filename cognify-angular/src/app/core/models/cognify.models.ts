export interface Student {
  registration_no: string;
  roll_no: string;
  name: string;
  class_name: 'SY' | 'TY' | 'Final Year';
  created_at?: string;
}

export interface Test {
  id: number;
  test_number: string;
  test_name: string;
  class_name?: 'SY' | 'TY' | 'Final Year';
  test_date: string;
  total_marks: number;
  status: 'Upcoming' | 'Current' | 'Completed';
  is_published: number;
  duration_minutes: number;
  instructions: string;
  start_time: string;
  finish_time: string;
  created_at?: string;
  formatted_date?: string;
  availability_state?: 'BEFORE_START' | 'ACTIVE' | 'AFTER_FINISH';
  resources_accessible?: boolean;
}

export interface QuestionVersion {
  id: number;
  test_id: number;
  version_number: number;
  created_at: string;
}

// Full Question model used by Admin
export interface TestQuestion {
  id: number;
  test_id: number;
  version_id?: number;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  marks: number;
  is_active: number;
}

// Sanitized Question model sent to Student during exam (CRITICAL: correct_option is omitted!)
export interface StudentExamQuestion {
  id: number;
  test_id: number;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
}

export interface StudentAttempt {
  id: number;
  test_id: number;
  registration_no: string;
  version_id?: number;
  attempt_status: 'Not Started' | 'In Progress' | 'Submitted' | 'Terminated';
  attendance: 'Present' | 'Absent';
  is_late_attempt: number;
  violation_count: number;
  violation_logs_json: any[];
  start_time?: string;
  end_time?: string;
  calculated_score: number;
  calculated_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export interface StudentAnswer {
  id: number;
  attempt_id: number;
  question_id: number;
  selected_option: 'A' | 'B' | 'C' | 'D' | '';
  saved_at?: string;
}

export interface AttendanceRecord {
  id: number;
  test_id: number;
  registration_no: string;
  status: 'Present' | 'Absent';
  is_late_attempt: number;
  updated_at?: string;
  student_name?: string;
  roll_no?: string;
}

export interface TestResult {
  id: number;
  test_id: number;
  registration_no: string;
  attendance: 'Present' | 'Absent';
  marks_obtained: number;
  percentage: number;
  student_name?: string;
  roll_no?: string;
  class_name?: string;
}

export interface StudentScore {
  registration_no: string;
  cognify_score: number;
  completed_tests_count: number;
  rank: number;
  class_name: string;
  student_name?: string;
  roll_no?: string;
  last_updated?: string;
}

export interface ClassRankings {
  SY: StudentScore[];
  TY: StudentScore[];
  'Final Year': StudentScore[];
}

export interface Resource {
  id: number;
  test_id: number;
  resource_type: 'notes' | 'practice' | 'question_paper' | 'answer_key';
  title: string;
  file_path: string;
  updated_at?: string;
  accessible?: boolean;
}

export interface SyllabusCategory {
  id: number;
  test_id: number;
  category_name: string;
  topics_json: string[] | string;
  display_order: number;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  test_id?: number;
  registration_no?: string;
  previous_value?: string;
  new_value?: string;
}

export interface BackupRecord {
  id: number;
  backup_name: string;
  created_at: string;
  file_path: string;
  size_bytes: number;
}

export interface DashboardStats {
  students_by_class: {
    SY: number;
    TY: number;
    'Final Year': number;
    total: number;
  };
  tests_by_status: {
    Upcoming: number;
    Current: number;
    Completed: number;
    Published: number;
    total: number;
  };
}
