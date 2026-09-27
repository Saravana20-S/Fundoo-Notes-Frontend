import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LabelService } from '../../../core/services/label';
import { LabelRequest, LabelResponse } from '../../../core/models/label.model';

@Component({
  selector: 'app-label-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './label-dialog.html',
  styleUrl: './label-dialog.css',
})
export class LabelDialog implements OnInit {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  labels: LabelResponse[] = [];

  newLabelName = '';

  editingLabelId: number | null = null;

  editingLabelName = '';

  isSaving = false;

  errorMessage = '';

  constructor(private readonly labelService: LabelService) {}

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  ngOnInit(): void {
    this.loadLabels();
  }

  // =========================================================
  // LOAD LABELS
  // =========================================================

  loadLabels(): void {
    this.errorMessage = '';

    this.labelService.getLabels().subscribe({
      next: (labels) => {
        this.labels = labels ?? [];
      },

      error: (error) => {
        console.error('Unable to load labels:', error);

        this.errorMessage = 'Unable to load labels.';
      },
    });
  }

  // =========================================================
  // CREATE LABEL
  // =========================================================

  createLabel(): void {
    const name = this.newLabelName.trim();

    if (!name) {
      return;
    }

    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const request: LabelRequest = {
      name,
    };

    this.labelService.createLabel(request).subscribe({
      next: (createdLabel) => {
        this.labels = [...this.labels, createdLabel];

        this.newLabelName = '';

        this.isSaving = false;
      },

      error: (error) => {
        console.error('Unable to create label:', error);

        this.isSaving = false;

        this.errorMessage = 'Unable to create label.';
      },
    });
  }

  // =========================================================
  // START EDIT
  // =========================================================

  startEdit(label: LabelResponse): void {
    this.editingLabelId = label.id;

    this.editingLabelName = label.name;

    this.errorMessage = '';
  }

  // =========================================================
  // CANCEL EDIT
  // =========================================================

  cancelEdit(): void {
    this.editingLabelId = null;

    this.editingLabelName = '';
  }

  // =========================================================
  // SAVE EDIT
  // =========================================================

  saveEdit(label: LabelResponse): void {
    const name = this.editingLabelName.trim();

    if (!name) {
      return;
    }

    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const request: LabelRequest = {
      name,
    };

    this.labelService.updateLabel(label.id, request).subscribe({
      next: (updatedLabel) => {
        this.labels = this.labels.map((item) =>
          item.id === updatedLabel.id ? updatedLabel : item,
        );

        this.cancelEdit();

        this.isSaving = false;
      },

      error: (error) => {
        console.error('Unable to update label:', error);

        this.isSaving = false;

        this.errorMessage = 'Unable to update label.';
      },
    });
  }

  // =========================================================
  // DELETE LABEL
  // =========================================================

  deleteLabel(label: LabelResponse): void {
    const confirmed = window.confirm(`Delete label "${label.name}"?`);

    if (!confirmed) {
      return;
    }

    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    this.labelService.deleteLabel(label.id).subscribe({
      next: () => {
        this.labels = this.labels.filter((item) => item.id !== label.id);

        if (this.editingLabelId === label.id) {
          this.cancelEdit();
        }

        this.isSaving = false;
      },

      error: (error) => {
        console.error('Unable to delete label:', error);

        this.isSaving = false;

        this.errorMessage = 'Unable to delete label.';
      },
    });
  }

  // =========================================================
  // CLOSE
  // =========================================================

  done(): void {
    this.closed.emit();
  }

  // =========================================================
  // CLICK OUTSIDE
  // =========================================================

  onOverlayClick(): void {
    if (this.isSaving) {
      return;
    }

    this.done();
  }

  // =========================================================
  // STOP POPUP CLICK
  // =========================================================

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
