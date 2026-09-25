import { Routes } from '@angular/router';

import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';

import { Layout } from './shared/components/layout/layout';
import { NoteList } from './features/notes/note-list/note-list';

import { authGuard } from './core/guards/auth.guard';

import { Trash } from './features/notes/trash/trash';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

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

  {
    path: '',
    component: Layout,
    canActivate: [authGuard],

    children: [
      {
        path: 'notes',
        component: NoteList,
      },

      {
        path: 'archive',
        component: NoteList,
      },

      {
        path: 'trash',
        component: Trash,
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'login',
  },
];
