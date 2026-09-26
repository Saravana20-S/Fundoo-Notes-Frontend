import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';

import { CommonModule, DatePipe } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { NoteService } from '../services/note';

import { NoteRequest, NoteResponse } from '../../../core/models/note.model';

import { Subscription } from 'rxjs';

import { NoteListService } from '../../../core/services/note-list';

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './note-list.html',
  styleUrl: './note-list.css',
})
export class NoteList implements OnInit, OnDestroy {
  private readonly noteService = inject(NoteService);

  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  // Shared note list/search service
  private readonly noteListService = inject(NoteListService);

  // Change detection
  private readonly cdr = inject(ChangeDetectorRef);

  // Subscription for shared notes
  private notesSubscription?: Subscription;

  // =========================================================
  // NOTES
  // =========================================================

  notes: NoteResponse[] = [];

  // =========================================================
  // PAGE STATE
  // =========================================================

  isLoading = false;

  isSaving = false;

  errorMessage = '';

  // =========================================================
  // EDITOR
  // =========================================================

  isEditorOpen = false;

  editingNoteId: number | null = null;

  title = '';

  content = '';

  // =========================================================
  // CURRENT VIEW
  // =========================================================

  currentView: 'notes' | 'archive' | 'trash' = 'notes';

  // =========================================================
  // INITIALIZATION
  // =========================================================

  ngOnInit(): void {
    this.notesSubscription = this.noteListService.notes$.subscribe((notes) => {
      console.log('NOTE LIST RECEIVED LENGTH:', notes.length);

      console.log(
        'NOTE LIST RECEIVED TITLES:',
        notes.map((note) => note.title),
      );

      this.notes = notes;

      console.log(
        'THIS.NOTES AFTER ASSIGN:',
        this.notes.map((note) => note.title),
      );

      // Force UI update after search result is received
      this.cdr.detectChanges();
    });

    this.route.url.subscribe((segments) => {
      const path = segments.map((segment) => segment.path);

      if (path.includes('archive')) {
        this.currentView = 'archive';
      } else if (path.includes('trash')) {
        this.currentView = 'trash';
      } else {
        this.currentView = 'notes';
      }

      this.noteListService.setCurrentView(this.currentView);
      this.noteListService.loadNotes();
    });
  }

  // =========================================================
  // LOAD NOTES
  // =========================================================

  loadNotes(): void {
    this.isLoading = true;

    this.errorMessage = '';

    if (this.currentView === 'trash') {
      this.noteService.getTrashNotes().subscribe({
        next: (notes) => {
          this.notes = notes ?? [];

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

  // =========================================================
  // SORT
  // =========================================================

  private sortNotes(): void {
    this.notes.sort((a, b) => {
      // Pinned notes first

      if (a.pinned && !b.pinned) {
        return -1;
      }

      if (!a.pinned && b.pinned) {
        return 1;
      }

      // Then latest updated note

      const dateA = new Date(a.updatedDate).getTime();

      const dateB = new Date(b.updatedDate).getTime();

      return dateB - dateA;
    });
  }

  // =========================================================
  // OPEN CREATE EDITOR
  // =========================================================

  openEditor(): void {
    this.editingNoteId = null;

    this.title = '';

    this.content = '';

    this.errorMessage = '';

    this.isEditorOpen = true;
  }

  // =========================================================
  // OPEN EXISTING NOTE
  // =========================================================

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

  // =========================================================
  // CLOSE EDITOR / OUTSIDE CLICK
  // =========================================================

  handleOutsideClick(): void {
    if (this.isSaving) {
      return;
    }

    this.saveNote();
  }

  // =========================================================
  // SAVE NOTE
  // CREATE OR UPDATE
  // =========================================================

  saveNote(): void {
    const trimmedTitle = this.title.trim();

    const trimmedContent = this.content.trim();

    // =========================================================
    // EMPTY NOTE
    // =========================================================

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

    // =========================================================
    // UPDATE EXISTING NOTE
    // =========================================================

    if (this.editingNoteId !== null) {
      this.isSaving = true;

      const noteId = this.editingNoteId;

      const originalNote = this.notes.find((note) => note.id === noteId);

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

    // =========================================================
    // CREATE NEW NOTE
    // =========================================================

    /*
     * Temporary ID.
     *
     * Negative numbers are used so they cannot normally
     * conflict with a real database ID.
     */

    const temporaryId = -Date.now();

    const temporaryNote: NoteResponse = {
      id: temporaryId,

      title: trimmedTitle,

      content: trimmedContent,

      pinned: false,

      archived: false,

      trashed: false,

      createdDate: new Date().toISOString(),

      updatedDate: new Date().toISOString(),

      labels: [],
    };

    // =========================================================
    // SHOW IMMEDIATELY
    // =========================================================

    this.notes = [temporaryNote, ...this.notes];

    // Add to cache immediately

    const cachedNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes([temporaryNote, ...cachedNotes]);

    // Close editor immediately

    this.closeEditor();

    // =========================================================
    // BACKEND REQUEST
    // =========================================================

    this.noteService.createNote(request).subscribe({
      next: (createdNote) => {
        // Replace temporary note with real note

        this.notes = this.notes.map((note) => (note.id === temporaryId ? createdNote : note));

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          currentCache.map((note) => (note.id === temporaryId ? createdNote : note)),
        );

        this.sortNotes();
      },

      error: (error) => {
        console.error('Unable to create note:', error);

        // Rollback

        this.notes = this.notes.filter((note) => note.id !== temporaryId);

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(currentCache.filter((note) => note.id !== temporaryId));

        this.errorMessage = 'Unable to create note. Please try again.';
      },
    });
  }

  // =========================================================
  // CLOSE EDITOR
  // =========================================================

  closeEditor(): void {
    this.isEditorOpen = false;

    this.editingNoteId = null;

    this.title = '';

    this.content = '';
  }

  // =========================================================
  // PIN / UNPIN
  // =========================================================

  togglePin(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const originalNote: NoteResponse = {
      ...note,
    };

    const newPinnedState = !note.pinned;

    // =========================================================
    // OPTIMISTIC UI UPDATE
    // =========================================================

    const updatedNote: NoteResponse = {
      ...note,

      pinned: newPinnedState,
    };

    // Update cache immediately

    const cachedNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      cachedNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    // Update current page immediately

    this.notes = this.notes.map((item) => (item.id === note.id ? updatedNote : item));

    // Pinned notes should immediately move to top

    this.sortNotes();

    // =========================================================
    // BACKEND REQUEST
    // =========================================================

    const request$ = newPinnedState
      ? this.noteService.pinNote(note.id)
      : this.noteService.unpinNote(note.id);

    request$.subscribe({
      next: (serverNote) => {
        // Replace optimistic version with real response

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          currentCache.map((item) => (item.id === serverNote.id ? serverNote : item)),
        );

        this.notes = this.notes.map((item) => (item.id === serverNote.id ? serverNote : item));

        this.sortNotes();
      },

      error: (error) => {
        console.error('Pin/Unpin failed:', error);

        // Rollback

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
  // ARCHIVE / UNARCHIVE
  // =========================================================

  toggleArchive(note: NoteResponse, event?: Event): void {
    event?.stopPropagation();

    const wasArchived = note.archived;

    /*
     * Save the original note.
     * If backend fails, we can restore it.
     */

    const originalNote = {
      ...note,
    };

    // =======================================================
    // OPTIMISTIC UI
    // =======================================================

    const updatedNote: NoteResponse = {
      ...note,

      archived: !wasArchived,
    };

    /*
     * Update local cache immediately.
     */

    const currentNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      currentNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    /*
     * Remove from the current page immediately.
     */

    this.notes = this.notes.filter((item) => item.id !== note.id);

    // =======================================================
    // BACKEND REQUEST
    // =======================================================

    const request$ = wasArchived
      ? this.noteService.unarchiveNote(note.id)
      : this.noteService.archiveNote(note.id);

    request$.subscribe({
      next: (serverNote) => {
        /*
         * Replace cache with actual backend response.
         */

        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === serverNote.id ? serverNote : item)),
        );
      },

      error: (error) => {
        console.error('Archive operation failed:', error);

        /*
         * ROLLBACK
         */

        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === originalNote.id ? originalNote : item)),
        );

        /*
         * Put note back into current page.
         */

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
  // MOVE TO TRASH
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

    // =======================================================
    // OPTIMISTIC UPDATE
    // =======================================================

    const updatedNote: NoteResponse = {
      ...note,

      trashed: true,
    };

    /*
     * Update cache immediately.
     */

    const currentNotes = this.noteService.getCachedNotes();

    this.noteService.setCachedNotes(
      currentNotes.map((item) => (item.id === note.id ? updatedNote : item)),
    );

    /*
     * Remove immediately from current page.
     */

    this.notes = this.notes.filter((item) => item.id !== note.id);

    // =======================================================
    // BACKEND REQUEST
    // =======================================================

    this.noteService.trashNote(note.id).subscribe({
      next: () => {
        console.log('Note moved to Trash successfully.');
      },

      error: (error) => {
        console.error('Unable to move note to Trash:', error);

        // Rollback

        const cached = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          cached.map((item) => (item.id === originalNote.id ? originalNote : item)),
        );

        /*
         * Put the note back.
         */

        if (this.currentView !== 'trash') {
          this.notes = [originalNote, ...this.notes];

          this.sortNotes();
        }

        this.errorMessage = 'Unable to move note to Trash.';
      },
    });
  }

  // =========================================================
  // RESTORE
  // =========================================================

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

  // =========================================================
  // PERMANENT DELETE
  // =========================================================

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

  // =========================================================
  // DELETE NOTE
  // =========================================================

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
  // UPDATE NOTE IN LOCAL ARRAY
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
  }
}
