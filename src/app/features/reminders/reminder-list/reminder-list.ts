import { Component, OnDestroy, OnInit, ChangeDetectorRef, inject } from '@angular/core';

import { CommonModule } from '@angular/common';

import { Subscription } from 'rxjs';

import { ReminderService } from '../../../core/services/reminder';

import { ReminderResponse } from '../../../core/models/reminder.model';

import { NoteService } from '../../notes/services/note';

import { NoteResponse } from '../../../core/models/note.model';

@Component({
  selector: 'app-reminder-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reminder-list.html',
  styleUrl: './reminder-list.css',
})
export class ReminderList implements OnInit, OnDestroy {
  private readonly reminderService = inject(ReminderService);

  private readonly noteService = inject(NoteService);

  private readonly cdr = inject(ChangeDetectorRef);

  private remindersSubscription?: Subscription;
  private notesSubscription?: Subscription;

  reminders: ReminderResponse[] = [];

  notes: NoteResponse[] = [];

  isLoading = false;

  errorMessage = '';

  ngOnInit(): void {
    this.loadNotes();
    this.loadReminders();
  }

  private loadNotes(): void {
    this.notesSubscription = this.noteService.getNotes().subscribe({
      next: (notes) => {
        this.notes = notes ?? [];

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to load notes for reminders:', error);
      },
    });
  }

  private loadReminders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.remindersSubscription = this.reminderService.getReminders().subscribe({
      next: (reminders) => {
        console.log('GET REMINDERS RESPONSE:', reminders);

        this.reminders = [...(reminders ?? [])].sort(
          (a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime(),
        );

        console.log('REMINDERS ASSIGNED:', this.reminders);
        console.log('REMINDER COUNT:', this.reminders.length);

        this.isLoading = false;

        console.log('IS LOADING:', this.isLoading);

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to load reminders:', error);

        this.isLoading = false;

        this.errorMessage = 'Unable to load reminders. Please try again.';

        this.cdr.detectChanges();
      },
    });
  }

  getNoteTitle(noteId: number): string {
    const note = this.notes.find((item) => item.id === noteId);

    return note?.title || 'Untitled note';
  }

  getNoteContent(noteId: number): string {
    const note = this.notes.find((item) => item.id === noteId);

    return note?.content || '';
  }

  deleteReminder(reminder: ReminderResponse): void {
    const confirmed = window.confirm('Delete this reminder?');

    if (!confirmed) {
      return;
    }

    this.reminderService.deleteReminder(reminder.id).subscribe({
      next: () => {
        this.reminders = this.reminders.filter((item) => item.id !== reminder.id);

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to delete reminder:', error);

        this.errorMessage = 'Unable to delete reminder.';

        this.cdr.detectChanges();
      },
    });
  }

  trackByReminder(index: number, reminder: ReminderResponse): number {
    return reminder.id;
  }

  ngOnDestroy(): void {
    this.remindersSubscription?.unsubscribe();
    this.notesSubscription?.unsubscribe();
  }
}
