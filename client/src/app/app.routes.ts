import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { editorLeaveGuard } from './features/editor/editor-leave.guard';

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
        path: 'projects',
        canActivate: [authGuard],
        children: [
          {
            path: 'new',
            title: 'Upload a room · Wall Visualizer',
            loadComponent: () => import('./features/upload/upload').then((m) => m.Upload),
          },
          {
            // Editor: the shell loads the project once; both steps share its state
            path: ':id',
            loadComponent: () =>
              import('./features/editor/editor-shell').then((m) => m.EditorShell),
            canDeactivate: [editorLeaveGuard],
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'select' },
              {
                path: 'select',
                title: 'Select walls · Wall Visualizer',
                loadComponent: () =>
                  import('./features/wall-selection/wall-selection').then((m) => m.WallSelection),
              },
              {
                path: 'studio',
                title: 'Paint · Wall Visualizer',
                loadComponent: () => import('./features/studio/studio').then((m) => m.Studio),
              },
            ],
          },
        ],
      },
      {
        path: 'colors',
        children: [
          {
            path: '',
            title: 'Colour library · Wall Visualizer',
            loadComponent: () =>
              import('./features/colors/color-library').then((m) => m.ColorLibrary),
          },
          {
            path: ':id',
            title: 'Colour · Wall Visualizer',
            loadComponent: () =>
              import('./features/colors/color-detail').then((m) => m.ColorDetail),
          },
        ],
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
