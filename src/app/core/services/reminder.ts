import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

import { ReminderRequest, ReminderResponse } from '../models/reminder.model';

@Injectable({
  providedIn: 'root',
})
export class ReminderService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/api/reminders`;

  createReminder(noteId: number, request: ReminderRequest): Observable<ReminderResponse> {
    return this.http.post<ReminderResponse>(`${this.apiUrl}/notes/${noteId}`, request);
  }

  getReminders(): Observable<ReminderResponse[]> {
    return this.http.get<ReminderResponse[]>(this.apiUrl);
  }

  getReminder(id: number): Observable<ReminderResponse> {
    return this.http.get<ReminderResponse>(`${this.apiUrl}/${id}`);
  }

  deleteReminder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
