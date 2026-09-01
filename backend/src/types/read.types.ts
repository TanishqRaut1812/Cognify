export interface ClassDto {
  id: number;
  name: string;
  code: string;
}

export interface TestMetadataDto {
  id: number;
  testNumber: string;
  title: string;
  className: string;
  classId?: number;
  testDate: string;
  formattedTestDate?: string;
  startTime: string;
  finishTime: string;
  durationMinutes: number;
  totalMarks: number;
  status: 'Upcoming' | 'Current' | 'Completed';
  resultStatus: 'Unpublished' | 'Published';
  isPublished: boolean;
  instructions?: string;
  updatedAt?: string;
}

export interface QuestionDto {
  id: number;
  testId: number;
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
  correctAnswer?: string; // Included ONLY if test is Completed AND result is Published
}

export interface SyllabusDto {
  id: number;
  classId: number;
  className: string;
  testId?: number;
  categoryName: string;
  title: string;
  content: string;
  topics: string[];
  displayOrder: number;
}

export interface ResourceDto {
  id: number;
  testId?: number;
  classId?: number;
  className?: string;
  resourceType: 'notes' | 'practice' | 'question_paper' | 'answer_key';
  title: string;
  visibility: 'public' | 'completed_only' | 'admin_only';
  downloadUrl?: string;
  createdAt: string;
}

export interface LeaderboardEntryDto {
  rank: number;
  registrationNo: string;
  name: string;
  className: string;
  overallPercentage: number;
  completedTestsCount: number;
  testBreakdown?: Array<{
    testId: number;
    testNumber: string;
    marksObtained: number;
    totalMarks: number;
    percentage: number;
    attendance: 'Present' | 'Absent';
  }>;
}
