import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'h/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/household/household.component').then((m) => m.HouseholdComponent),
  },
  { path: '**', redirectTo: '' },
];
