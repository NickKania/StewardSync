import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('@features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('@features/reports/report-list/report-list.component').then(m => m.ReportListComponent)
      },
      {
        path: 'new',
        loadComponent: () => import('@features/reports/report-form/report-form.component').then(m => m.ReportFormComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('@features/reports/report-detail/report-detail.component').then(m => m.ReportDetailComponent)
      },
      {
        path: ':id/edit',
        loadComponent: () => import('@features/reports/report-form/report-form.component').then(m => m.ReportFormComponent)
      }
    ]
  },
  {
    path: 'reviews',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['steward', 'head_steward', 'event_manager'] },
    children: [
      {
        path: '',
        loadComponent: () => import('@features/reviews/review-dashboard/review-dashboard.component').then(m => m.ReviewDashboardComponent)
      },
      {
        path: ':reportId',
        loadComponent: () => import('@features/reviews/review-form/review-form.component').then(m => m.ReviewFormComponent)
      }
    ]
  },
  {
    path: 'finalize',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['head_steward', 'event_manager'] },
    children: [
      {
        path: '',
        loadComponent: () => import('@features/finalize/finalize-dashboard/finalize-dashboard.component').then(m => m.FinalizeDashboardComponent)
      },
      {
        path: ':reportId',
        loadComponent: () => import('@features/finalize/finalize-form/finalize-form.component').then(m => m.FinalizeFormComponent)
      }
    ]
  },
  {
    path: 'drivers',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('@features/drivers/driver-list/driver-list.component').then(m => m.DriverListComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('@features/drivers/driver-detail/driver-detail.component').then(m => m.DriverDetailComponent)
      }
    ]
  },
  {
    path: 'events',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('@features/events/event-list/event-list.component').then(m => m.EventListComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('@features/events/event-detail/event-detail.component').then(m => m.EventDetailComponent)
      }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['event_manager'] },
    children: [
      {
        path: 'users',
        loadComponent: () => import('@features/admin/user-management/user-management.component').then(m => m.UserManagementComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
