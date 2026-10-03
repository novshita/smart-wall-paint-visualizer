import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface FeedbackResult {
  rating: number;
  comment: string;
}

/** Quick 1–5 star satisfaction question (spec §14 "user satisfaction"). */
@Component({
  selector: 'app-feedback-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>How helpful was the preview?</h2>
    <mat-dialog-content>
      <p class="muted">Your rating helps us make the visualiser better.</p>
      <div class="stars" role="radiogroup" aria-label="Rating from 1 to 5 stars">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <button
            type="button"
            role="radio"
            class="star"
            [class.on]="n <= (hover() || rating())"
            [attr.aria-checked]="rating() === n"
            [attr.aria-label]="n + (n === 1 ? ' star' : ' stars')"
            (click)="rating.set(n)"
            (mouseenter)="hover.set(n)"
            (mouseleave)="hover.set(0)"
          >
            <mat-icon>star</mat-icon>
          </button>
        }
      </div>
      <label class="comment">
        Anything we could improve? <span class="muted">(optional)</span>
        <textarea rows="3" maxlength="1000" [(ngModel)]="comment"></textarea>
      </label>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Not now</button>
      <button mat-flat-button type="button" [disabled]="!rating()" (click)="submit()">Send</button>
    </mat-dialog-actions>
  `,
  styles: `
    .stars {
      display: flex;
      gap: 4px;
      margin: var(--swpv-space-2) 0 var(--swpv-space-4);
    }
    .star {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #c3c2b7;
      cursor: pointer;
    }
    .star mat-icon {
      font-size: 34px;
      width: 34px;
      height: 34px;
      font-variation-settings: 'FILL' 1;
    }
    .star.on {
      color: #eda100;
    }
    .comment {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.9rem;
    }
    textarea {
      padding: var(--swpv-space-2);
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius-sm);
      font: inherit;
      resize: vertical;
    }
  `,
})
export class FeedbackDialog {
  private readonly ref = inject(MatDialogRef<FeedbackDialog, FeedbackResult>);
  protected readonly rating = signal(0);
  protected readonly hover = signal(0);
  protected comment = '';

  protected submit(): void {
    this.ref.close({ rating: this.rating(), comment: this.comment.trim() });
  }
}
