import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./auth/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./auth/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'change-password',
        loadComponent: () => import('./auth/change-password.component').then(m => m.ChangePasswordComponent)
      },
      {
        path: 'employees',
        loadComponent: () => import('./employees/employee-list.component').then(m => m.EmployeeListComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./employees/profile-redirect.component').then(m => m.ProfileRedirectComponent)
      },
      {
        path: 'employees/new',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./employees/employee-form.component').then(m => m.EmployeeFormComponent)
      },
      {
        path: 'employees/:id/edit',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./employees/employee-form.component').then(m => m.EmployeeFormComponent)
      },
      {
        path: 'employees/:id',
        loadComponent: () => import('./employees/employee-profile.component').then(m => m.EmployeeProfileComponent)
      },
      {
        path: 'leaves/me',
        loadComponent: () => import('./leaves/leave-list.component').then(m => m.LeaveListComponent)
      },
      {
        path: 'leaves/apply',
        loadComponent: () => import('./leaves/leave-apply.component').then(m => m.LeaveApplyComponent)
      },
      {
        path: 'leaves/approvals',
        canActivate: [roleGuard('ADMIN', 'MANAGER')],
        loadComponent: () => import('./leaves/leave-approvals.component').then(m => m.LeaveApprovalsComponent)
      },
      {
        path: 'attendance/me',
        loadComponent: () => import('./attendance/my-attendance.component').then(m => m.MyAttendanceComponent)
      },
      {
        path: 'attendance/team',
        canActivate: [roleGuard('MANAGER', 'ADMIN')],
        loadComponent: () => import('./attendance/attendance-day.component').then(m => m.AttendanceDayComponent),
        data: { scope: 'team' }
      },
      {
        path: 'attendance/all',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./attendance/attendance-day.component').then(m => m.AttendanceDayComponent),
        data: { scope: 'all' }
      },
      {
        path: 'holidays',
        loadComponent: () => import('./holidays/holidays.component').then(m => m.HolidaysComponent)
      },
      {
        path: 'payroll',
        loadComponent: () => import('./payroll/payroll-page.component').then(m => m.PayrollPageComponent)
      },
      {
        path: 'performance',
        loadComponent: () => import('./performance/performance-page.component').then(m => m.PerformancePageComponent)
      },
      {
        path: 'documents',
        loadComponent: () => import('./documents/documents-page.component').then(m => m.DocumentsPageComponent)
      },
      {
        path: 'reimbursement',
        loadComponent: () => import('./reimbursement/reimbursement-page.component').then(m => m.ReimbursementPageComponent)
      },
      {
        path: 'policies',
        loadComponent: () => import('./policies/policies-page.component').then(m => m.PoliciesPageComponent)
      },
      {
        path: 'helpdesk',
        loadComponent: () => import('./helpdesk/helpdesk-page.component').then(m => m.HelpdeskPageComponent)
      },
      {
        path: 'travel',
        loadComponent: () => import('./travel/travel-page.component').then(m => m.TravelPageComponent)
      },
      {
        path: 'taskbox',
        loadComponent: () => import('./taskbox/taskbox-page.component').then(m => m.TaskBoxPageComponent)
      },
      {
        path: 'recruitment',
        loadComponent: () => import('./recruitment/recruitment-page.component').then(m => m.RecruitmentPageComponent)
      },
      {
        path: 'vibe',
        loadComponent: () => import('./vibe/vibe-page.component').then(m => m.VibePageComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
