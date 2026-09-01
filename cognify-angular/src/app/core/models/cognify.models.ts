export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
  timestamp?: string;
}

export interface Student {
  id?: number;
  registration_no: string;
  registrationNumber?: string;
  roll_no?: string;
  rollNumber?: string;
  name: string;
  class_name?: 'SY' | 'TY' | 'Final Year';
  class?: string;
  created_at?: string;
}

export interface StudentProfile {
  id: number;
  registrationNumber: string;
  name: string;
  class: string;
}

export interface Test {
  id: number;
  test_number?: string;
  testNumber?: string;
  title?: string;
  test_name?: string;
  class_name?: 'SY' | 'TY' | 'Final Year';
  className?: string;
  class_id?: number;
  classId?: number;
  test_date?: string;
  testDate?: string;
  formatted_date?: string;
  total_marks?: number;
  totalMarks?: number;
  status: 'Upcoming' | 'Current' | 'Completed';
  result_status?: 'Unpublished' | 'Published';
  resultStatus?: 'Unpublished' | 'Published';
  is_published?: number;
  isPublished?: boolean;
  duration_minutes?: number;
  durationMinutes?: number;
  instructions?: string;
  start_time?: string;
  startTime?: string;
  finish_time?: string;
  finishTime?: string;
  created_at?: string;
}

export interface TestQuestion {
  id: number;
  test_id: number;
  question_number: number;
  questionText?: string;
  question_text?: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correct_answer?: 'A' | 'B' | 'C' | 'D';
  correctAnswer?: 'A' | 'B' | 'C' | 'D';
  correct_option?: 'A' | 'B' | 'C' | 'D';
  marks: number;
  is_active?: number;
}

export interface StudentExamQuestion {
  id: number;
  test_id?: number;
  testId?: number;
  question_number: number;
  questionNumber?: number;
  question_text: string;
  questionText?: string;
  option_a: string;
  optionA?: string;
  option_b: string;
  optionB?: string;
  option_c: string;
  optionC?: string;
  option_d: string;
  optionD?: string;
  marks: number;
}

export interface StudentAttemptDetails {
  id: number;
  testId: number;
  studentId?: number;
  registrationNo: string;
  startedAt: string;
  deadline: string;
  currentServerTime: string;
  attemptStatus: 'In Progress' | 'Submitted' | 'Terminated';
  fullscreenViolationCount: number;
  cheatingFlag: boolean;
  score?: number;
  percentage?: number;
}

export interface StudentAttempt {
  id: number;
  test_id: number;
  testId?: number;
  registration_no: string;
  registrationNo?: string;
  attempt_status: 'Not Started' | 'In Progress' | 'Submitted' | 'Terminated';
  attemptStatus?: 'Not Started' | 'In Progress' | 'Submitted' | 'Terminated';
  attendance: 'Present' | 'Absent';
  fullscreen_violation_count?: number;
  fullscreenViolationCount?: number;
  violation_count?: number;
  violationCount?: number;
  cheating_flag?: number;
  cheatingFlag?: boolean;
  started_at?: string;
  startedAt?: string;
  submitted_at?: string;
  submittedAt?: string;
  score?: number;
  percentage?: number;
}

export interface StudentAnswer {
  questionId: number;
  selectedOption: string;
}

export interface AttendanceRecord {
  id?: number;
  test_id?: number;
  testId?: number;
  student_id?: number;
  studentId?: number;
  registration_no?: string;
  registrationNo?: string;
  student_name?: string;
  studentName?: string;
  roll_no?: string;
  rollNo?: string;
  class_name?: string;
  className?: string;
  status: 'Present' | 'Absent';
  is_late_attempt?: number;
  updated_at?: string;
  updatedAt?: string;
}

export interface TestResult {
  id?: number;
  testId?: number;
  test_id?: number;
  studentId?: number;
  student_id?: number;
  registrationNo?: string;
  registration_no?: string;
  testTitle?: string;
  roll_no?: string;
  rollNo?: string;
  student_name?: string;
  studentName?: string;
  totalMarks?: number;
  attendance: 'Present' | 'Absent';
  published: boolean;
  marksObtained?: number | null;
  marks_obtained?: number | null;
  percentage?: number | null;
}

export type StudentResult = TestResult;

export interface StudentScore {
  registration_no: string;
  registrationNo?: string;
  student_name?: string;
  name?: string;
  roll_no?: string;
  cognify_score?: number;
  percentage?: number;
  completed_tests_count?: number;
  rank: number;
  class_name?: string;
}

export interface Resource {
  id: number;
  test_id?: number;
  testId?: number;
  class_id?: number;
  classId?: number;
  className?: string;
  resource_type?: 'notes' | 'practice' | 'question_paper' | 'answer_key';
  type?: string;
  title: string;
  file_path?: string;
  storagePath?: string;
  accessible?: boolean;
}

export interface SyllabusCategory {
  id?: number;
  classId?: number;
  className?: string;
  testId?: number;
  test_id?: number;
  categoryName?: string;
  category_name?: string;
  topics?: string[];
  topics_json?: string[] | string;
  displayOrder?: number;
  display_order?: number;
}

export interface AuditLog {
  id: number;
  created_at?: string;
  timestamp?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  admin_identifier?: string;
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
  totalStudents?: number;
  studentsByClass?: {
    SY: number;
    TY: number;
    'Final Year': number;
  };
  students_by_class: {
    SY: number;
    TY: number;
    'Final Year': number;
    total: number;
  };
  totalTests?: number;
  activeTests?: number;
  completedTests?: number;
  publishedTests?: number;
  cheatingAttemptsCount?: number;
  terminatedAttemptsCount?: number;
  tests_by_status: {
    Upcoming: number;
    Current: number;
    Completed: number;
    Published: number;
    total: number;
  };
}
