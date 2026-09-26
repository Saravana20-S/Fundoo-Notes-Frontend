import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { NoteService } from '../../features/notes/services/note';
import { NoteResponse } from '../models/note.model';

@Injectable({
  providedIn: 'root',
})
export class NoteListService {

  private readonly noteService = inject(NoteService);

  // =========================================================
  // NOTES
  // =========================================================

  private readonly notesSubject =
    new BehaviorSubject<NoteResponse[]>([]);

  readonly notes$ = this.notesSubject.asObservable();

  // =========================================================
  // PAGE STATE
  // =========================================================

  isLoading = false;

  errorMessage = '';

  // =========================================================
  // CURRENT VIEW
  // =========================================================

  private currentView: 'notes' | 'archive' | 'trash' = 'notes';

  // =========================================================
  // SEARCH
  // =========================================================

  private searchText = '';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // =========================================================
  // SET CURRENT VIEW
  // =========================================================

  setCurrentView(
    view: 'notes' | 'archive' | 'trash'
  ): void {

    this.currentView = view;
  }

  // =========================================================
  // LOAD NOTES
  // =========================================================
loadNotes(): void {

  // =======================================================
  // IF SEARCH IS ACTIVE
  // DO NOT LOAD ALL NOTES
  // =======================================================

  if (this.searchText.trim()) {
    this.searchNotes();
    return;
  }

  // =======================================================
  // START LOADING
  // =======================================================

  this.isLoading = true;
  this.errorMessage = '';

  // =======================================================
  // TRASH
  // =======================================================

  if (this.currentView === 'trash') {

    this.noteService.getTrashNotes().subscribe({

      next: (notes) => {

        // Search may have started while this request
        // was running. Do not overwrite search results.

        if (this.searchText.trim()) {
          return;
        }

        this.setNotes(notes ?? []);

        this.isLoading = false;
      },

      error: (error) => {

        console.error(
          'Unable to load trash:',
          error
        );

        this.isLoading = false;

        this.errorMessage =
          'Unable to load trash. Please try again.';
      },
    });

    return;
  }

  // =======================================================
  // NORMAL NOTES / ARCHIVE
  // =======================================================

  this.noteService.getNotes().subscribe({

    next: (notes) => {

      // Search may have started while GET /notes
      // was still running.

      if (this.searchText.trim()) {
        return;
      }

      const allNotes = notes ?? [];

      let filtered: NoteResponse[];

      // =====================================================
      // ARCHIVE
      // =====================================================

      if (this.currentView === 'archive') {

        filtered = allNotes.filter((note) => {

          return note.archived && !note.trashed;
        });

      }

      // =====================================================
      // NORMAL NOTES
      // =====================================================

      else {

        filtered = allNotes.filter((note) => {

          return !note.archived && !note.trashed;
        });
      }

      this.setNotes(filtered);

      this.isLoading = false;
    },

    error: (error) => {

      console.error(
        'Unable to load notes:',
        error
      );

      this.isLoading = false;

      this.errorMessage =
        'Unable to load notes. Please try again.';
    },
  });
}
  // =========================================================
  // SORT NOTES
  // =========================================================

  private setNotes(notes: NoteResponse[]): void {

    const sorted = [...notes].sort((a, b) => {

      // -----------------------------------------------------
      // Pinned notes first
      // -----------------------------------------------------

      if (a.pinned && !b.pinned) {
        return -1;
      }

      if (!a.pinned && b.pinned) {
        return 1;
      }

      // -----------------------------------------------------
      // Latest updated note first
      // -----------------------------------------------------

      const dateA =
        new Date(a.updatedDate ?? '').getTime();

      const dateB =
        new Date(b.updatedDate ?? '').getTime();

      return dateB - dateA;
    });

    this.notesSubject.next(sorted);
  }

  // =========================================================
  // SEARCH INPUT
  // =========================================================

  onSearchInput(searchText: string): void {

    // Store latest search text
    this.searchText = searchText;

    // -------------------------------------------------------
    // Clear previous debounce timer
    // -------------------------------------------------------

    if (this.searchTimer) {

      clearTimeout(this.searchTimer);

      this.searchTimer = null;
    }

    // -------------------------------------------------------
    // Empty search
    // -------------------------------------------------------

    if (!this.searchText.trim()) {

      this.loadNotes();

      return;
    }

    // -------------------------------------------------------
    // Debounce search by 250 ms
    // -------------------------------------------------------

    this.searchTimer = setTimeout(() => {

      this.searchNotes();

    }, 250);
  }

  // =========================================================
  // SEARCH NOTES
  // =========================================================

  private searchNotes(): void {

    const search =
      this.searchText.trim().toLowerCase();

    // =======================================================
    // EMPTY SEARCH
    // =======================================================

    if (!search) {

      this.loadNotes();

      return;
    }

    // =======================================================
    // RESET ERROR
    // =======================================================

    this.errorMessage = '';

    // =======================================================
    // SEARCH LOCAL CACHE FIRST
    // =======================================================

    const cachedNotes =
      this.noteService.getCachedNotes();

    console.log('SEARCH TEXT:', search);

    console.log('CACHED NOTES:', cachedNotes);

    // =======================================================
    // CACHE AVAILABLE
    // =======================================================

    if (cachedNotes.length > 0) {

      const filtered =
        cachedNotes.filter((note) => {

          // -------------------------------------------------
          // TITLE
          // -------------------------------------------------

          const title =
            (note.title ?? '').toLowerCase();

          // -------------------------------------------------
          // CONTENT
          // -------------------------------------------------

          const content =
            (note.content ?? '').toLowerCase();

          // -------------------------------------------------
          // LABELS
          // -------------------------------------------------

          const labels =
            (note.labels ?? [])
              .map((label) =>
                (label.name ?? '').toLowerCase()
              )
              .join(' ');

          // -------------------------------------------------
          // SEARCH MATCH
          // -------------------------------------------------

          const matches =
            title.includes(search) ||
            content.includes(search) ||
            labels.includes(search);

          if (!matches) {
            return false;
          }

          // -------------------------------------------------
          // TRASH VIEW
          // -------------------------------------------------

          if (this.currentView === 'trash') {

            return note.trashed;
          }

          // -------------------------------------------------
          // ARCHIVE VIEW
          // -------------------------------------------------

          if (this.currentView === 'archive') {

            return note.archived && !note.trashed;
          }

          // -------------------------------------------------
          // NORMAL NOTES VIEW
          // -------------------------------------------------

          return !note.archived && !note.trashed;
        });

      console.log(
        'FILTERED NOTES:',
        filtered
      );

      // -----------------------------------------------------
      // Sort + send results to NoteList
      // -----------------------------------------------------

      this.setNotes(filtered);

      return;
    }

    // =======================================================
    // NO CACHE
    // FALL BACK TO BACKEND SEARCH
    // =======================================================

    this.isLoading = true;

    this.noteService
      .searchNotes(search, 0, 50)
      .subscribe({

        next: (response) => {

          // -------------------------------------------------
          // Extract backend results
          // -------------------------------------------------

          const results =
            response?.content ??
            response ??
            [];

          // -------------------------------------------------
          // Apply current view filter
          // -------------------------------------------------

          const filtered =
            results.filter(
              (note: NoteResponse) => {

                // Trash
                if (
                  this.currentView === 'trash'
                ) {

                  return note.trashed;
                }

                // Archive
                if (
                  this.currentView === 'archive'
                ) {

                  return (
                    note.archived &&
                    !note.trashed
                  );
                }

                // Normal notes
                return (
                  !note.archived &&
                  !note.trashed
                );
              }
            );

          console.log(
            'BACKEND SEARCH RESULTS:',
            filtered
          );

          // -------------------------------------------------
          // Sort + update NoteList
          // -------------------------------------------------

          this.setNotes(filtered);

          this.isLoading = false;
        },

        error: (error) => {

          console.error(
            'Search failed:',
            error
          );

          this.isLoading = false;

          this.errorMessage =
            'Unable to search notes.';
        },
      });
  }

  // =========================================================
  // CLEAR SEARCH
  // =========================================================

  clearSearch(): void {

    // -------------------------------------------------------
    // Clear search text
    // -------------------------------------------------------

    this.searchText = '';

    // -------------------------------------------------------
    // Clear pending debounce
    // -------------------------------------------------------

    if (this.searchTimer) {

      clearTimeout(this.searchTimer);

      this.searchTimer = null;
    }

    // -------------------------------------------------------
    // Load normal notes again
    // -------------------------------------------------------

    this.loadNotes();
  }
}