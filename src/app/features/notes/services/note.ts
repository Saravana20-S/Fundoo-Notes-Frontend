import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';

import { NoteRequest, NoteResponse } from '../../../core/models/note.model';

@Injectable({
  providedIn: 'root',
})
export class NoteService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/api/notes`;

  // =========================================================
  // LOCAL CACHE
  // =========================================================

  private readonly notesCache = new BehaviorSubject<NoteResponse[] | null>(null);

  private loadingRequest$: Observable<NoteResponse[]> | null = null;

  // =========================================================
  // CREATE
  // =========================================================

  createNote(request: NoteRequest): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(this.apiUrl, request).pipe(
      tap((createdNote) => {
        const current = this.notesCache.value ?? [];

        this.notesCache.next([createdNote, ...current]);
      }),
    );
  }

  // =========================================================
  // GET NOTES
  //
  // First request -> backend
  // Later requests -> instant cache
  // =========================================================

  getNotes(): Observable<NoteResponse[]> {
    const cached = this.notesCache.value;

    if (cached !== null) {
      return of(cached);
    }

    if (this.loadingRequest$) {
      return this.loadingRequest$;
    }

    this.loadingRequest$ = this.http.get<NoteResponse[]>(this.apiUrl).pipe(
      tap((notes) => {
        this.notesCache.next(notes ?? []);

        this.loadingRequest$ = null;
      }),

      shareReplay(1),
    );

    return this.loadingRequest$;
  }

  // =========================================================
  // GET CURRENT CACHE
  // =========================================================

  getCachedNotes(): NoteResponse[] {
    return this.notesCache.value ?? [];
  }

  // =========================================================
  // UPDATE CACHE
  // =========================================================

  setCachedNotes(notes: NoteResponse[]): void {
    this.notesCache.next([...notes]);
  }

  // =========================================================
  // GET SINGLE NOTE
  // =========================================================

  getNote(id: number): Observable<NoteResponse> {
    return this.http.get<NoteResponse>(`${this.apiUrl}/${id}`);
  }

  // =========================================================
  // UPDATE NOTE
  // =========================================================

  updateNote(id: number, request: NoteRequest): Observable<NoteResponse> {
    return this.http.put<NoteResponse>(`${this.apiUrl}/${id}`, request).pipe(
      tap((updatedNote) => {
        const current = this.notesCache.value ?? [];

        const updated = current.map((note) => (note.id === id ? updatedNote : note));

        this.notesCache.next(updated);
      }),
    );
  }

  // =========================================================
  // PIN
  // =========================================================

  pinNote(id: number): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(`${this.apiUrl}/${id}/pin`, {}).pipe(
      tap((updatedNote) => {
        this.updateCachedNote(updatedNote);
      }),
    );
  }

  // =========================================================
  // UNPIN
  // =========================================================

  unpinNote(id: number): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(`${this.apiUrl}/${id}/unpin`, {}).pipe(
      tap((updatedNote) => {
        this.updateCachedNote(updatedNote);
      }),
    );
  }

  // =========================================================
  // ARCHIVE
  // =========================================================

  archiveNote(id: number): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(`${this.apiUrl}/${id}/archive`, {}).pipe(
      tap((updatedNote) => {
        this.updateCachedNote(updatedNote);
      }),
    );
  }

  // =========================================================
  // UNARCHIVE
  // =========================================================

  unarchiveNote(id: number): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(`${this.apiUrl}/${id}/unarchive`, {}).pipe(
      tap((updatedNote) => {
        this.updateCachedNote(updatedNote);
      }),
    );
  }

  // =========================================================
  // MOVE TO TRASH
  // =========================================================

  trashNote(id: number): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${id}/trash`, {}).pipe(
      tap(() => {
        const current = this.notesCache.value ?? [];

        const updated = current.map((note) =>
          note.id === id
            ? {
                ...note,
                trashed: true,
              }
            : note,
        );

        this.notesCache.next(updated);
      }),
    );
  }

  // =========================================================
  // RESTORE
  // =========================================================

  restoreNote(id: number): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(`${this.apiUrl}/${id}/restore`, {}).pipe(
      tap((updatedNote) => {
        this.updateCachedNote(updatedNote);
      }),
    );
  }

  // =========================================================
  // PERMANENT DELETE
  // =========================================================

  permanentlyDeleteNote(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}/permanent`).pipe(
      tap(() => {
        const current = this.notesCache.value ?? [];

        this.notesCache.next(current.filter((note) => note.id !== id));
      }),
    );
  }

  // =========================================================
  // GET TRASH
  // =========================================================

  getTrashNotes(): Observable<NoteResponse[]> {
    /*
     * First try the cache.
     *
     * This means that after moving a note to trash,
     * the Trash page can display it immediately.
     */

    const cached = this.notesCache.value;

    if (cached !== null) {
      const trashed = cached.filter((note) => note.trashed);

      return of(trashed);
    }

    return this.http.get<NoteResponse[]>(`${this.apiUrl}/trash`).pipe(
      tap((notes) => {
        const current = this.notesCache.value ?? [];

        const nonTrash = current.filter((note) => !note.trashed);

        this.notesCache.next([...nonTrash, ...(notes ?? [])]);
      }),
    );
  }

  // =========================================================
  // SEARCH
  // =========================================================

  searchNotes(search: string, page: number = 0, size: number = 50): Observable<any> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<any>(`${this.apiUrl}/search`, { params });
  }

  // =========================================================
  // SEARCH + FILTER
  // =========================================================

  searchAndFilter(
    search: string = '',
    pinned?: boolean,
    archived?: boolean,
    page: number = 0,
    size: number = 50,
    sortBy: string = 'updatedDate',
    direction: string = 'desc',
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (pinned !== undefined) {
      params = params.set('pinned', pinned);
    }

    if (archived !== undefined) {
      params = params.set('archived', archived);
    }

    return this.http.get<any>(`${this.apiUrl}/search`, { params });
  }

  // =========================================================
  // PRIVATE CACHE UPDATE
  // =========================================================

  private updateCachedNote(updatedNote: NoteResponse): void {
    const current = this.notesCache.value ?? [];

    const exists = current.some((note) => note.id === updatedNote.id);

    if (exists) {
      this.notesCache.next(
        current.map((note) => (note.id === updatedNote.id ? updatedNote : note)),
      );
    } else {
      this.notesCache.next([updatedNote, ...current]);
    }
  }


  
}
