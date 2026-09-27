import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { LabelRequest, LabelResponse } from '../models/label.model';

@Injectable({
  providedIn: 'root',
})
export class LabelService {
  private readonly apiUrl = 'http://localhost:8080/api/labels';

  private readonly labelsSubject = new BehaviorSubject<LabelResponse[]>([]);

  readonly labels$ = this.labelsSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  // =========================================================
  // GET ALL LABELS
  // =========================================================

  getLabels(): Observable<LabelResponse[]> {
    return this.http.get<LabelResponse[]>(this.apiUrl).pipe(
      tap((labels) => {
        this.labelsSubject.next(labels ?? []);
      }),
    );
  }

  // =========================================================
  // GET ONE LABEL
  // =========================================================

  getLabel(id: number): Observable<LabelResponse> {
    return this.http.get<LabelResponse>(`${this.apiUrl}/${id}`);
  }

  // =========================================================
  // CREATE LABEL
  // =========================================================

  createLabel(request: LabelRequest): Observable<LabelResponse> {
    return this.http.post<LabelResponse>(this.apiUrl, request).pipe(
      tap((createdLabel) => {
        const currentLabels = this.labelsSubject.value;

        this.labelsSubject.next([...currentLabels, createdLabel]);
      }),
    );
  }

  // =========================================================
  // UPDATE LABEL
  // =========================================================

  updateLabel(id: number, request: LabelRequest): Observable<LabelResponse> {
    return this.http.put<LabelResponse>(`${this.apiUrl}/${id}`, request).pipe(
      tap((updatedLabel) => {
        const updatedLabels = this.labelsSubject.value.map((label) =>
          label.id === updatedLabel.id ? updatedLabel : label,
        );

        this.labelsSubject.next(updatedLabels);
      }),
    );
  }

  // =========================================================
  // DELETE LABEL
  // =========================================================

  deleteLabel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        const updatedLabels = this.labelsSubject.value.filter((label) => label.id !== id);

        this.labelsSubject.next(updatedLabels);
      }),
    );
  }

  // =========================================================
  // CACHE
  // =========================================================

  getCachedLabels(): LabelResponse[] {
    return this.labelsSubject.value;
  }

  setCachedLabels(labels: LabelResponse[]): void {
    this.labelsSubject.next(labels);
  }

  // =========================================================
  // ADD LABEL TO NOTE
  // =========================================================

  addLabelToNote(noteId: number, labelId: number): Observable<any> {
    return this.http.post(`http://localhost:8080/api/notes/${noteId}/labels/${labelId}`, {});
  }

  // =========================================================
  // REMOVE LABEL FROM NOTE
  // =========================================================

  removeLabelFromNote(noteId: number, labelId: number): Observable<void> {
    return this.http.delete<void>(`http://localhost:8080/api/notes/${noteId}/labels/${labelId}`);
  }
}
