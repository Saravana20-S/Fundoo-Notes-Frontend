import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

import { RouterLink, RouterLinkActive } from '@angular/router';

import { Subscription } from 'rxjs';

import { LabelService } from '../../../core/services/label';

import { LabelResponse } from '../../../core/models/label.model';

import { LabelDialog } from '../../../features/labels/label-dialog/label-dialog';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LabelDialog],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit, OnDestroy {
  @Output()
  navigationSelected = new EventEmitter<void>();

  labels: LabelResponse[] = [];

  isLabelDialogOpen = false;

  private labelsSubscription?: Subscription;

  constructor(private readonly labelService: LabelService) {}

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.labelsSubscription = this.labelService.labels$.subscribe((labels) => {
      this.labels = labels;
    });

    this.loadLabels();
  }

  // =========================================================
  // LOAD LABELS
  // =========================================================

  private loadLabels(): void {
    this.labelService.getLabels().subscribe({
      next: () => {
        // LabelService updates labels$
      },

      error: (error) => {
        console.error('Unable to load sidebar labels:', error);
      },
    });
  }

  // =========================================================
  // REFRESH LABELS
  // =========================================================

  refreshLabels(): void {
    this.loadLabels();
  }

  // =========================================================
  // OPEN LABEL DIALOG
  // =========================================================

  openLabelDialog(): void {
    this.isLabelDialogOpen = true;
  }

  // =========================================================
  // CLOSE LABEL DIALOG
  // =========================================================

  closeLabelDialog(): void {
    this.isLabelDialogOpen = false;
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  selectNavigation(): void {
    this.navigationSelected.emit();
  }

  // =========================================================
  // DESTROY
  // =========================================================

  ngOnDestroy(): void {
    this.labelsSubscription?.unsubscribe();
  }
}
