import { Component, OnInit, inject } from '@angular/core';

import { CommonModule, DatePipe } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { NoteService } from '../services/note';

import { NoteRequest, NoteResponse } from '../../../core/models/note.model';

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './note-list.html',
  styleUrl: './note-list.css',
})
export class NoteList implements OnInit {
  private readonly noteService = inject(NoteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  // SEARCH NOTES

  searchText = '';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // =========================================================
  // INITIALIZATION
  // =========================================================

  ngOnInit(): void {
    this.route.url.subscribe((segments) => {
      const path = segments.length > 0 ? segments[segments.length - 1].path : 'notes';

      if (path === 'archive') {
        this.currentView = 'archive';
      } else if (path === 'trash') {
        this.currentView = 'trash';
      } else {
        this.currentView = 'notes';
      }

      this.loadNotes();
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
        // ================================================
        // REPLACE TEMPORARY NOTE WITH REAL NOTE
        // ================================================

        this.notes = this.notes.map((note) => (note.id === temporaryId ? createdNote : note));

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          currentCache.map((note) => (note.id === temporaryId ? createdNote : note)),
        );

        this.sortNotes();
      },

      error: (error) => {
        console.error('Unable to create note:', error);

        // ================================================
        // ROLLBACK
        // ================================================

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
        // Backend succeeded.
        // Replace optimistic version with real response.

        const currentCache = this.noteService.getCachedNotes();

        this.noteService.setCachedNotes(
          currentCache.map((item) => (item.id === serverNote.id ? serverNote : item)),
        );

        this.notes = this.notes.map((item) => (item.id === serverNote.id ? serverNote : item));

        this.sortNotes();
      },

      error: (error) => {
        console.error('Pin/Unpin failed:', error);

        // =====================================================
        // ROLLBACK
        // =====================================================

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

        // =================================================
        // ROLLBACK
        // =================================================

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

  // SEARCH NOTES FUNCTION
  // =========================================================
  // SEARCH INPUT
  // =========================================================

  onSearchInput(): void {
    /*
     * Clear previous timer.
     */
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    /*
     * Empty search -> restore normal notes.
     */
    if (!this.searchText.trim()) {
      this.loadNotes();

      return;
    }

    /*
     * Small debounce.
     *
     * Search starts 250ms after the user stops typing.
     */
    this.searchTimer = setTimeout(() => {
      this.searchNotes();
    }, 250);
  }

  // =========================================================
  // SEARCH NOTES
  // =========================================================

  searchNotes(): void {
    const search = this.searchText.trim().toLowerCase();

    if (!search) {
      this.loadNotes();

      return;
    }

    // =======================================================
    // SEARCH LOCAL CACHE FIRST
    // =======================================================

    const cachedNotes = this.noteService.getCachedNotes();

    if (cachedNotes.length > 0) {
      const filtered = cachedNotes.filter((note) => {
        /*
         * Search title
         */
        const title = (note.title ?? '').toLowerCase();

        /*
         * Search content
         */
        const content = (note.content ?? '').toLowerCase();

        /*
         * Search labels
         */
        const labels = (note.labels ?? []).map((label) => label.name.toLowerCase()).join(' ');

        const matches =
          title.includes(search) || content.includes(search) || labels.includes(search);

        if (!matches) {
          return false;
        }

        // ===============================================
        // CURRENT PAGE FILTER
        // ===============================================

        if (this.currentView === 'trash') {
          return note.trashed;
        }

        if (this.currentView === 'archive') {
          return note.archived && !note.trashed;
        }

        return !note.archived && !note.trashed;
      });

      this.notes = filtered;

      this.sortNotes();

      return;
    }

    // =======================================================
    // NO CACHE
    // FALL BACK TO BACKEND
    // =======================================================

    this.isLoading = true;

    this.noteService.searchNotes(search, 0, 50).subscribe({
      next: (response) => {
        const results = response?.content ?? response ?? [];

        this.notes = results.filter((note: NoteResponse) => {
          if (this.currentView === 'trash') {
            return note.trashed;
          }

          if (this.currentView === 'archive') {
            return note.archived && !note.trashed;
          }

          return !note.archived && !note.trashed;
        });

        this.sortNotes();

        this.isLoading = false;
      },

      error: (error) => {
        console.error('Search failed:', error);

        this.isLoading = false;

        this.errorMessage = 'Unable to search notes.';
      },
    });
  }

  // =========================================================
  // CLEAR SEARCH
  // =========================================================

  clearSearch(): void {
    this.searchText = '';

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);

      this.searchTimer = null;
    }

    this.loadNotes();
  }
}
