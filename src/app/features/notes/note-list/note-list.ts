import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';

import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NoteService } from '../services/note';

import { NoteRequest, NoteResponse } from '../../../core/models/note.model';

import { LabelService } from '../../../core/services/label';

import { LabelResponse } from '../../../core/models/label.model';

import { Subscription } from 'rxjs';

import { NoteListService } from '../../../core/services/note-list';

// ================= REMINDER =================
import { ReminderService } from '../../../core/services/reminder';

import { ReminderRequest, ReminderResponse } from '../../../core/models/reminder.model';
// =============================================

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './note-list.html',
  styleUrl: './note-list.css',
})
export class NoteList implements OnInit, OnDestroy {
  private readonly noteService = inject(NoteService);
  private readonly labelService = inject(LabelService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteListService = inject(NoteListService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ================= REMINDER =================

  private readonly reminderService = inject(ReminderService);

  private reminderSubscription?: Subscription;

  reminders: ReminderResponse[] = [];

  /**
   * Stores the note for which reminder popup is currently open.
   */
  reminderPopupNoteId: number | null = null;

  /**
   * Date selected in reminder popup.
   * Format:
   * yyyy-MM-dd
   */
  reminderDate = '';

  /**
   * Time selected in reminder popup.
   * Format:
   * HH:mm
   */
  reminderTime = '';

  isSavingReminder = false;

  reminderErrorMessage = '';

  // =============================================

  private notesSubscription?: Subscription;
  private labelsSubscription?: Subscription;

  notes: NoteResponse[] = [];
  labels: LabelResponse[] = [];

  selectedLabel: LabelResponse | null = null;
  selectedLabelId: number | null = null;

  openLabelNoteId: number | null = null;
  labelSearchText = '';

  isLoading = false;
  isSaving = false;
  errorMessage = '';

  isEditorOpen = false;
  editingNoteId: number | null = null;

  title = '';
  content = '';

  currentView: 'notes' | 'archive' | 'trash' = 'notes';

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.labelsSubscription = this.labelService.labels$.subscribe((labels) => {
      this.labels = labels ?? [];
    });

    this.labelService.getLabels().subscribe({
      next: () => {},

      error: (error) => {
        console.error('Unable to load labels:', error);
      },
    });

    this.notesSubscription = this.noteListService.notes$.subscribe((notes) => {
      console.log('NOTE LIST RECEIVED LENGTH:', notes.length);

      console.log(
        'NOTE LIST RECEIVED TITLES:',
        notes.map((note) => note.title),
      );

      this.notes = this.applySelectedLabelFilter(notes);

      console.log(
        'THIS.NOTES AFTER LABEL FILTER:',
        this.notes.map((note) => note.title),
      );

      this.cdr.detectChanges();
    });

    // ================= REMINDER =================

    this.loadReminders();

    // =============================================

    this.route.url.subscribe((segments) => {
      const path = segments.map((segment) => segment.path);

      if (path.includes('archive')) {
        this.currentView = 'archive';

        this.clearSelectedLabel();

        this.noteListService.setCurrentView(this.currentView);

        this.noteListService.loadNotes();

        return;
      }

      if (path.includes('trash')) {
        this.currentView = 'trash';

        this.clearSelectedLabel();

        this.noteListService.setCurrentView(this.currentView);

        this.noteListService.loadNotes();

        return;
      }

      if (path.length >= 2 && path[0] === 'label') {
        const labelId = Number(path[1]);

        if (!Number.isNaN(labelId)) {
          this.currentView = 'notes';

          this.loadSelectedLabel(labelId);

          return;
        }
      }

      this.currentView = 'notes';

      this.clearSelectedLabel();

      this.noteListService.setCurrentView(this.currentView);

      this.noteListService.loadNotes();
    });
  }

  // =========================================================
  // REMINDER
  // =========================================================

  /**
   * Load all reminders from backend.
   */
  private loadReminders(): void {
    this.reminderSubscription = this.reminderService.getReminders().subscribe({
      next: (reminders) => {
        this.reminders = reminders ?? [];

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to load reminders:', error);
      },
    });
  }

  /**
   * Get reminders belonging to a particular note.
   *
   * Reminders are sorted by reminder time.
   */
  getRemindersForNote(noteId: number): ReminderResponse[] {
    return this.reminders
      .filter((reminder) => reminder.noteId === noteId)
      .sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());
  }

  /**
   * Check whether a note has at least one reminder.
   */
  hasReminder(noteId: number): boolean {
    return this.reminders.some((reminder) => reminder.noteId === noteId);
  }

  /**
   * Get the first reminder for a note.
   *
   * Since reminders are sorted by time,
   * this returns the nearest reminder.
   */
  getFirstReminder(noteId: number): ReminderResponse | null {
    const noteReminders = this.getRemindersForNote(noteId);

    return noteReminders.length > 0 ? noteReminders[0] : null;
  }

  /**
   * Open reminder popup for a note.
   *
   * If the note already has a reminder,
   * the existing reminder time is loaded.
   */
  openReminderPopup(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    // Clicking reminder icon again closes popup.
    if (this.reminderPopupNoteId === note.id) {
      this.closeReminderPopup();

      return;
    }

    this.reminderPopupNoteId = note.id;

    this.reminderErrorMessage = '';

    const existingReminder = this.getFirstReminder(note.id);

    if (existingReminder) {
      const date = new Date(existingReminder.reminderTime);

      this.reminderDate = this.formatDateForInput(date);

      this.reminderTime = this.formatTimeForInput(date);
    } else {
      /**
       * Default reminder:
       * 30 minutes from now.
       */
      const defaultDate = new Date();

      defaultDate.setMinutes(defaultDate.getMinutes() + 30);

      this.reminderDate = this.formatDateForInput(defaultDate);

      this.reminderTime = this.formatTimeForInput(defaultDate);
    }

    this.cdr.detectChanges();
  }

  /**
   * Close reminder popup.
   */
  closeReminderPopup(): void {
    this.reminderPopupNoteId = null;

    this.reminderDate = '';

    this.reminderTime = '';

    this.reminderErrorMessage = '';

    this.isSavingReminder = false;
  }

  /**
   * Quick option:
   * One hour from now.
   */
  setReminderLaterToday(): void {
    const date = new Date();

    date.setHours(date.getHours() + 1);

    this.reminderDate = this.formatDateForInput(date);

    this.reminderTime = this.formatTimeForInput(date);
  }

  /**
   * Quick option:
   * Tomorrow at 8:00 AM.
   */
  setReminderTomorrow(): void {
    const date = new Date();

    date.setDate(date.getDate() + 1);

    date.setHours(8, 0, 0, 0);

    this.reminderDate = this.formatDateForInput(date);

    this.reminderTime = this.formatTimeForInput(date);
  }

  /**
   * Quick option:
   * One week from now at 8:00 AM.
   */
  setReminderNextWeek(): void {
    const date = new Date();

    date.setDate(date.getDate() + 7);

    date.setHours(8, 0, 0, 0);

    this.reminderDate = this.formatDateForInput(date);

    this.reminderTime = this.formatTimeForInput(date);
  }

  /**
   * Create a reminder for the selected note.
   */
  saveReminder(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    // Validate date.
    if (!this.reminderDate) {
      this.reminderErrorMessage = 'Please select a date.';

      return;
    }

    // Validate time.
    if (!this.reminderTime) {
      this.reminderErrorMessage = 'Please select a time.';

      return;
    }

    /**
     * Backend expects:
     *
     * 2026-09-07T08:00:00
     */
    const reminderDateTime = `${this.reminderDate}T${this.reminderTime}`;

    const selectedDate = new Date(reminderDateTime);

    // Validate date/time.
    if (Number.isNaN(selectedDate.getTime())) {
      this.reminderErrorMessage = 'Please select a valid date and time.';

      return;
    }

    // Reminder must be in future.
    if (selectedDate.getTime() <= Date.now()) {
      this.reminderErrorMessage = 'Please select a future date and time.';

      return;
    }

    // Prevent double click.
    if (this.isSavingReminder) {
      return;
    }

    const request: ReminderRequest = {
      reminderTime: reminderDateTime,
    };

    this.isSavingReminder = true;

    this.reminderErrorMessage = '';

    this.reminderService.createReminder(note.id, request).subscribe({
      next: (createdReminder) => {
        this.reminders = [...this.reminders, createdReminder];

        this.isSavingReminder = false;

        this.closeReminderPopup();

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to create reminder:', error);

        this.isSavingReminder = false;

        this.reminderErrorMessage = 'Unable to create reminder. Please try again.';
      },
    });
  }

  /**
   * Delete an existing reminder.
   */
  deleteReminder(reminder: ReminderResponse, event?: Event): void {
    event?.stopPropagation();

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

        this.reminderErrorMessage = 'Unable to delete reminder.';
      },
    });
  }

  /**
   * Convert Date to:
   * yyyy-MM-dd
   *
   * Required by input[type="date"].
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, '0');

    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /**
   * Convert Date to:
   * HH:mm
   *
   * Required by input[type="time"].
   */
  private formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');

    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  // =========================================================
  // EXISTING LABEL LOGIC
  // =========================================================

  private loadSelectedLabel(labelId: number): void {
    this.selectedLabelId = labelId;

    const cachedLabel = this.labelService.getCachedLabels().find((label) => label.id === labelId);

    if (cachedLabel) {
      this.selectedLabel = cachedLabel;

      this.noteListService.setCurrentView(this.currentView);

      this.noteListService.loadNotes();

      return;
    }

    this.labelService.getLabel(labelId).subscribe({
      next: (label) => {
        this.selectedLabel = label;

        this.noteListService.setCurrentView(this.currentView);

        this.noteListService.loadNotes();
      },

      error: (error) => {
        console.error('Unable to load selected label:', error);

        this.selectedLabel = null;

        this.noteListService.setCurrentView(this.currentView);

        this.noteListService.loadNotes();
      },
    });
  }

  private clearSelectedLabel(): void {
    this.selectedLabel = null;

    this.selectedLabelId = null;

    this.openLabelNoteId = null;

    this.labelSearchText = '';
  }

  private applySelectedLabelFilter(notes: NoteResponse[]): NoteResponse[] {
    if (this.selectedLabelId === null) {
      return notes;
    }

    return notes.filter((note) =>
      (note.labels ?? []).some((label) => label.id === this.selectedLabelId),
    );
  }

  get filteredLabels(): LabelResponse[] {
    const search = this.labelSearchText.trim().toLowerCase();

    if (!search) {
      return this.labels;
    }

    return this.labels.filter((label) => label.name.toLowerCase().includes(search));
  }

  // =========================================================
  // EXISTING NOTE LOADING
  // =========================================================

  loadNotes(): void {
    this.isLoading = true;

    this.errorMessage = '';

    if (this.currentView === 'trash') {
      this.noteService.getTrashNotes().subscribe({
        next: (notes) => {
          this.notes = this.applySelectedLabelFilter(notes ?? []);

          this.isLoading = false;
        },

        error: (error) => {
          console.error('Unable to load trash:', error);

          this.isLoading = false;

          this.errorMessage = 'Unable to load trash. Please try again.';
        },
      });

      return;
    }

    this.noteService.getNotes().subscribe({
      next: (notes) => {
        const allNotes = notes ?? [];

        if (this.currentView === 'archive') {
          this.notes = allNotes.filter((note) => note.archived && !note.trashed);
        } else {
          this.notes = allNotes.filter((note) => !note.archived && !note.trashed);
        }

        this.notes = this.applySelectedLabelFilter(this.notes);

        this.sortNotes();

        this.isLoading = false;
      },

      error: (error) => {
        console.error('Unable to load notes:', error);

        this.isLoading = false;

        this.errorMessage = 'Unable to load notes. Please try again.';
      },
    });
  }

  private sortNotes(): void {
    this.notes.sort((a, b) => {
      if (a.pinned && !b.pinned) {
        return -1;
      }

      if (!a.pinned && b.pinned) {
        return 1;
      }

      const dateA = new Date(a.updatedDate).getTime();

      const dateB = new Date(b.updatedDate).getTime();

      return dateB - dateA;
    });
  }

  // =========================================================
  // EXISTING EDITOR
  // =========================================================

  openEditor(): void {
    this.editingNoteId = null;

    this.title = '';

    this.content = '';

    this.errorMessage = '';

    this.isEditorOpen = true;
  }

  openNote(note: NoteResponse): void {
    if (this.currentView === 'trash') {
      return;
    }

    this.editingNoteId = note.id;

    this.title = note.title ?? '';

    this.content = note.content ?? '';

    this.errorMessage = '';

    this.isEditorOpen = true;
  }

  handleOutsideClick(): void {
    if (this.isSaving) {
      return;
    }

    this.saveNote();
  }

  saveNote(): void {
    const trimmedTitle = this.title.trim();

    const trimmedContent = this.content.trim();

    if (!trimmedTitle && !trimmedContent) {
      this.closeEditor();

      return;
    }

    if (this.isSaving) {
      return;
    }

    const request: NoteRequest = {
      title: trimmedTitle,
      content: trimmedContent,
    };

    if (this.editingNoteId !== null) {
      this.isSaving = true;

      const noteId = this.editingNoteId;

      this.noteService.updateNote(noteId, request).subscribe({
        next: (updatedNote) => {
          this.isSaving = false;

          this.notes = this.notes.map((note) => (note.id === updatedNote.id ? updatedNote : note));

          this.closeEditor();

          this.sortNotes();
        },

        error: (error) => {
          console.error('Unable to update note:', error);

          this.isSaving = false;

          this.errorMessage = 'Unable to update note.';
        },
      });

      return;
    }

    const temporaryId = -Date.now();

    const temporaryLabels = this.selectedLabel ? [this.selectedLabel] : [];

    const temporaryNote: NoteResponse = {
      id: temporaryId,

      title: trimmedTitle,

      content: trimmedContent,

      pinned: false,

      archived: false,

      trashed: false,

      createdDate: new Date().toISOString(),

      updatedDate: new Date().toISOString(),

      labels: temporaryLabels,
    };

    this.notes = [temporaryNote, ...this.notes];

    const cachedNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes([temporaryNote, ...cachedNotes]);

    this.closeEditor();

    this.noteService.createNote(request).subscribe({
      next: (createdNote) => {
        let finalNote = createdNote;

        if (this.selectedLabel) {
          const label = this.selectedLabel;

          const alreadyHasLabel = (createdNote.labels ?? []).some((item) => item.id === label.id);

          if (!alreadyHasLabel) {
            this.labelService.addLabelToNote(createdNote.id, label.id).subscribe({
              next: () => {
                finalNote = {
                  ...createdNote,

                  labels: [...(createdNote.labels ?? []), label],
                };

                this.replaceCreatedNote(temporaryId, finalNote);
              },

              error: (error) => {
                console.error('Unable to add label to created note:', error);

                this.replaceCreatedNote(temporaryId, createdNote);

                this.errorMessage = 'Note created, but unable to add label.';
              },
            });

            return;
          }

          finalNote = createdNote;
        }

        this.replaceCreatedNote(temporaryId, finalNote);
      },

      error: (error) => {
        console.error('Unable to create note:', error);

        this.notes = this.notes.filter((note) => note.id !== temporaryId);

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(currentCache.filter((note) => note.id !== temporaryId));

        this.errorMessage = 'Unable to create note. Please try again.';
      },
    });
  }

  private replaceCreatedNote(temporaryId: number, createdNote: NoteResponse): void {
    this.notes = this.notes.map((note) => (note.id === temporaryId ? createdNote : note));

    const currentCache = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      currentCache.map((note) => (note.id === temporaryId ? createdNote : note)),
    );

    this.notes = this.applySelectedLabelFilter(this.notes);

    this.sortNotes();
  }

  closeEditor(): void {
    this.isEditorOpen = false;

    this.editingNoteId = null;

    this.title = '';

    this.content = '';
  }

  // =========================================================
  // EXISTING LABEL LOGIC
  // =========================================================

  toggleLabelMenu(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    if (this.openLabelNoteId === note.id) {
      this.closeLabelMenu();

      return;
    }

    this.openLabelNoteId = note.id;

    this.labelSearchText = '';

    this.labelService.getLabels().subscribe({
      next: () => {},

      error: (error) => {
        console.error('Unable to load labels:', error);
      },
    });
  }

  closeLabelMenu(): void {
    this.openLabelNoteId = null;

    this.labelSearchText = '';
  }

  hasLabel(note: NoteResponse, labelId: number): boolean {
    return (note.labels ?? []).some((label) => label.id === labelId);
  }

  toggleLabel(note: NoteResponse, label: LabelResponse, event: Event): void {
    event.stopPropagation();

    const input = event.target as HTMLInputElement;

    const checked = input.checked;

    const oldLabels = [...(note.labels ?? [])];

    let updatedLabels: LabelResponse[];

    if (checked) {
      const alreadyExists = oldLabels.some((item) => item.id === label.id);

      if (alreadyExists) {
        return;
      }

      updatedLabels = [...oldLabels, label];
    } else {
      updatedLabels = oldLabels.filter((item) => item.id !== label.id);
    }

    const updatedNote: NoteResponse = {
      ...note,
      labels: updatedLabels,
    };

    this.updateNoteLabelsLocally(note.id, updatedNote);

    const request$ = checked
      ? this.labelService.addLabelToNote(note.id, label.id)
      : this.labelService.removeLabelFromNote(note.id, label.id);

    request$.subscribe({
      next: () => {
        console.log(checked ? 'Label added successfully.' : 'Label removed successfully.');

        if (!checked && this.selectedLabelId === label.id) {
          this.notes = this.applySelectedLabelFilter(this.notes);
        }
      },

      error: (error) => {
        console.error(checked ? 'Unable to add label:' : 'Unable to remove label:', error);

        const rollbackNote: NoteResponse = {
          ...note,
          labels: oldLabels,
        };

        this.updateNoteLabelsLocally(note.id, rollbackNote);

        this.errorMessage = checked ? 'Unable to add label.' : 'Unable to remove label.';
      },
    });
  }

  private updateNoteLabelsLocally(noteId: number, updatedNote: NoteResponse): void {
    this.notes = this.notes.map((note) => (note.id === noteId ? updatedNote : note));

    const cachedNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      cachedNotes.map((note) => (note.id === noteId ? updatedNote : note)),
    );

    this.notes = this.applySelectedLabelFilter(this.notes);

    this.cdr.detectChanges();
  }

  // =========================================================
  // EXISTING PIN LOGIC
  // =========================================================

  togglePin(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const originalNote: NoteResponse = {
      ...note,
    };

    const newPinnedState = !note.pinned;

    const updatedNote: NoteResponse = {
      ...note,
      pinned: newPinnedState,
    };

    const cachedNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      cachedNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    this.notes = this.notes.map((item) => (item.id === note.id ? updatedNote : item));

    this.sortNotes();

    const request$ = newPinnedState
      ? this.noteService.pinNote(note.id)
      : this.noteService.unpinNote(note.id);

    request$.subscribe({
      next: (serverNote) => {
        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          currentCache.map((item) => (item.id === serverNote.id ? serverNote : item)),
        );

        this.notes = this.notes.map((item) => (item.id === serverNote.id ? serverNote : item));

        this.sortNotes();
      },

      error: (error) => {
        console.error('Pin/Unpin failed:', error);

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          currentCache.map((item) => (item.id === originalNote.id ? originalNote : item)),
        );

        this.notes = this.notes.map((item) => (item.id === originalNote.id ? originalNote : item));

        this.sortNotes();

        this.errorMessage = 'Unable to update pin status.';
      },
    });
  }

  // =========================================================
  // EXISTING ARCHIVE LOGIC
  // =========================================================

  toggleArchive(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const wasArchived = note.archived;

    const originalNote = {
      ...note,
    };

    const updatedNote: NoteResponse = {
      ...note,
      archived: !wasArchived,
    };

    const currentNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      currentNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    this.notes = this.notes.filter((item) => item.id !== note.id);

    const request$ = wasArchived
      ? this.noteService.unarchiveNote(note.id)
      : this.noteService.archiveNote(note.id);

    request$.subscribe({
      next: (serverNote) => {
        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === serverNote.id ? serverNote : item)),
        );
      },

      error: (error) => {
        console.error('Archive operation failed:', error);

        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === originalNote.id ? originalNote : item)),
        );

        if (this.currentView === 'notes' && !originalNote.archived && !originalNote.trashed) {
          this.notes = [originalNote, ...this.notes];

          this.sortNotes();
        }

        if (this.currentView === 'archive' && originalNote.archived && !originalNote.trashed) {
          this.notes = [originalNote, ...this.notes];

          this.sortNotes();
        }

        this.errorMessage = 'Unable to update archive status.';
      },
    });
  }

  // =========================================================
  // EXISTING TRASH LOGIC
  // =========================================================

  moveToTrash(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const confirmed = window.confirm('Move this note to Trash?');

    if (!confirmed) {
      return;
    }

    const originalNote = {
      ...note,
    };

    const updatedNote: NoteResponse = {
      ...note,
      trashed: true,
    };

    const currentNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      currentNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    this.notes = this.notes.filter((item) => item.id !== note.id);

    this.noteService.trashNote(note.id).subscribe({
      next: () => {
        console.log('Note moved to Trash successfully.');
      },

      error: (error) => {
        console.error('Unable to move note to Trash:', error);

        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === originalNote.id ? originalNote : item)),
        );

        if (this.currentView !== 'trash') {
          this.notes = [originalNote, ...this.notes];

          this.sortNotes();
        }

        this.errorMessage = 'Unable to move note to Trash.';
      },
    });
  }

  restoreNote(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    this.noteService.restoreNote(note.id).subscribe({
      next: () => {
        this.notes = this.notes.filter((item) => item.id !== note.id);
      },

      error: (error) => {
        console.error('Unable to restore note:', error);

        this.errorMessage = 'Unable to restore note.';
      },
    });
  }

  permanentlyDelete(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const confirmed = window.confirm('Delete this note permanently? This action cannot be undone.');

    if (!confirmed) {
      return;
    }

    this.noteService.permanentlyDeleteNote(note.id).subscribe({
      next: () => {
        this.notes = this.notes.filter((item) => item.id !== note.id);
      },

      error: (error) => {
        console.error('Unable to permanently delete note:', error);

        this.errorMessage = 'Unable to permanently delete note.';
      },
    });
  }

  deleteNote(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    this.moveToTrash(note, event);
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  goToNotes(): void {
    this.router.navigate(['/notes']);
  }

  goToArchive(): void {
    this.router.navigate(['/archive']);
  }

  goToTrash(): void {
    this.router.navigate(['/trash']);
  }

  // =========================================================
  // EXISTING HELPER
  // =========================================================

  private updateNoteInList(updatedNote: NoteResponse): void {
    const index = this.notes.findIndex((note) => note.id === updatedNote.id);

    if (index !== -1) {
      this.notes[index] = updatedNote;
    }
  }

  // =========================================================
  // DESTROY
  // =========================================================

  ngOnDestroy(): void {
    this.notesSubscription?.unsubscribe();

    this.labelsSubscription?.unsubscribe();

    // ================= REMINDER =================

    this.reminderSubscription?.unsubscribe();

    // =============================================
  }
}
