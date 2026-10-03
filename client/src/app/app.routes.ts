import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell';
import { authGuard, guestGuard } from './core/auth/auth.guards';

// Every feature is lazy-loaded. Remaining pages from spec §5 are added as each feature is built.
export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Smart Wall Paint Visualizer',
        loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
      },
      {
        path: 'auth',
        canActivate: [guestGuard],
        children: [
          {
            path: 'login',
            title: 'Log in · Wall Visualizer',
            loadComponent: () => import('./features/auth/login').then((m) => m.Login),
          },
          {
            path: 'register',
            title: 'Create account · Wall Visualizer',
            loadComponent: () => import('./features/auth/register').then((m) => m.Register),
          },
          { path: '', pathMatch: 'full', redirectTo: 'login' },
        ],
      },
      {
        path: 'dashboard',
        canActivate: [authGuard],
        title: 'Dashboard · Wall Visualizer',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        title: 'Profile · Wall Visualizer',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'help',
        title: 'How to use · Wall Visualizer',
        loadComponent: () => import('./features/help/help').then((m) => m.Help),
      },
      {
        path: '**',
        title: 'Not found · Wall Visualizer',
        loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
