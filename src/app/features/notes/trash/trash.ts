import { Component, OnInit, inject } from '@angular/core';

import { CommonModule } from '@angular/common';

import { Router } from '@angular/router';

import { NoteService } from '../services/note';

import { NoteRequest, NoteResponse } from '../../../core/models/note.model';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trash.html',
  styleUrl: './trash.css',
})
export class Trash implements OnInit {
  private readonly noteService = inject(NoteService);
  private readonly router = inject(Router);

  // =========================================================
  // STATE
  // =========================================================

  notes: NoteResponse[] = [];

  isLoading = false;

  errorMessage = '';

  // =========================================================
  // INITIALIZE
  // =========================================================

  ngOnInit(): void {
    this.loadTrash();
  }

  // =========================================================
  // LOAD TRASH
  // =========================================================

  // loadTrash(): void {
  //   this.isLoading = true;

  //   this.errorMessage = '';

  //   this.noteService.getTrashNotes().subscribe({
  //     next: (notes) => {
  //       this.notes = notes ?? [];

  //       this.sortNotes();

  //       this.isLoading = false;
  //     },

  //     error: (error) => {
  //       console.error('Unable to load trash:', error);

  //       this.isLoading = false;

  //       this.errorMessage = 'Unable to load Trash. Please try again.';
  //     },
  //   });
  // }

  loadTrash(): void {
    this.errorMessage = '';

    /*
     * Get cached notes first.
     */
    const cachedNotes = this.noteService.getCachedNotes();

    if (cachedNotes.length > 0) {
      this.notes = cachedNotes.filter((note) => note.trashed);

      this.sortNotes();

      this.isLoading = false;

      return;
    }

    /*
     * No cache available.
     * Fetch from backend.
     */
    this.isLoading = true;

    this.noteService.getTrashNotes().subscribe({
      next: (notes) => {
        this.notes = notes ?? [];

        this.sortNotes();

        this.isLoading = false;
      },

      error: (error) => {
        console.error('Unable to load trash:', error);

        this.isLoading = false;

        this.errorMessage = 'Unable to load Trash. Please try again.';
      },
    });
  }

  // =========================================================
  // SORT
  // =========================================================

  private sortNotes(): void {
    this.notes.sort((a, b) => {
      const dateA = new Date(a.updatedDate).getTime();

      const dateB = new Date(b.updatedDate).getTime();

      return dateB - dateA;
    });
  }

  // =========================================================
  // RESTORE
  // =========================================================

  restoreNote(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const originalNote = {
      ...note,
    };

    // =======================================================
    // OPTIMISTIC UPDATE
    // =======================================================

    const updatedNote: NoteResponse = {
      ...note,
      trashed: false,
      archived: false,
    };

    const currentNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      currentNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    /*
     * Remove from Trash immediately.
     */
    this.notes = this.notes.filter((item) => item.id !== note.id);

    // =======================================================
    // BACKEND
    // =======================================================

    this.noteService.restoreNote(note.id).subscribe({
      next: (serverNote) => {
        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === serverNote.id ? serverNote : item)),
        );
      },

      error: (error) => {
        console.error('Unable to restore note:', error);

        // =================================================
        // ROLLBACK
        // =================================================

        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === originalNote.id ? originalNote : item)),
        );

        this.notes = [originalNote, ...this.notes];

        this.sortNotes();

        this.errorMessage = 'Unable to restore note.';
      },
    });
  }

  // =========================================================
  // PERMANENT DELETE
  // =========================================================

  permanentlyDelete(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const confirmed = window.confirm(
      'Delete this note permanently?\n\nThis action cannot be undone.',
    );

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

  // =========================================================
  // EMPTY TRASH
  // =========================================================

  emptyTrash(): void {
    if (this.notes.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      'Delete all notes permanently?\n\nThis action cannot be undone.',
    );

    if (!confirmed) {
      return;
    }

    /*
     * Delete each note one by one.
     *
     * We intentionally use the existing backend
     * permanent-delete endpoint.
     */

    const notesToDelete = [...this.notes];

    let completed = 0;

    notesToDelete.forEach((note) => {
      this.noteService.permanentlyDeleteNote(note.id).subscribe({
        next: () => {
          completed++;

          if (completed === notesToDelete.length) {
            this.notes = [];
          }
        },

        error: (error) => {
          console.error(`Unable to permanently delete note ${note.id}:`, error);

          completed++;

          if (completed === notesToDelete.length) {
            this.loadTrash();

            this.errorMessage = 'Some notes could not be permanently deleted.';
          }
        },
      });
    });
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
}
