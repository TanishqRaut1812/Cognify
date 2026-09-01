import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { RankingsComponent } from './features/rankings/rankings.component';
import { TestsComponent } from './features/tests/tests.component';
import { PlanComponent } from './features/plan/plan.component';
import { StudentDashboardComponent } from './features/student-dashboard/student-dashboard.component';
import { ExamComponent } from './features/exam/exam.component';
import { AdminDashboardComponent } from './features/admin/admin-dashboard.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'rankings', component: RankingsComponent },
  { path: 'tests', component: TestsComponent },
  { path: 'plan', component: PlanComponent },
  { path: 'student-dashboard/:regNo', component: StudentDashboardComponent },
  { path: 'exam', component: ExamComponent },
  { path: 'admin', component: AdminDashboardComponent },
  { path: '**', redirectTo: '' }
];
