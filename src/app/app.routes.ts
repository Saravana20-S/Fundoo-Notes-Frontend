import { Routes } from '@angular/router';

import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';

import { Layout } from './shared/components/layout/layout';
import { NoteList } from './features/notes/note-list/note-list';

import { authGuard } from './core/guards/auth.guard';

import { ReminderList } from './features/reminders/reminder-list/reminder-list';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  // =========================
  // PUBLIC ROUTES
  // =========================

  {
    path: 'login',
    component: Login,
  },

  {
    path: 'register',
    component: Register,
  },

  {
    path: 'forgot-password',
    component: ForgotPassword,
  },

  // =========================
  // PROTECTED APPLICATION
  // =========================

  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      // Normal notes
      {
        path: 'notes',
        component: NoteList,
      },

      // Archive
      {
        path: 'archive',
        component: NoteList,
      },

      // Trash / Bin
      {
        path: 'trash',
        component: NoteList,
      },

      // Label-specific notes
      {
        path: 'label/:labelId',
        component: NoteList,
      },
      {
        path: 'reminders',
        component: ReminderList,
      },
    ],
  },

  // =========================
  // FALLBACK
  // =========================

  {
    path: '**',
    redirectTo: 'login',
  },
];
