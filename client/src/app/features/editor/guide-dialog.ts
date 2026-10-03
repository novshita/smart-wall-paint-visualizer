import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface GuideStep {
  icon: string;
  title: string;
  text: string;
  tips: string[];
}

/** First-use walkthrough for the editor (spec §7 guided first-run tour, §13 hints). */
@Component({
  selector: 'app-guide-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="guide">
      <p class="count" aria-live="polite">Step {{ index() + 1 }} of {{ steps.length }}</p>
      <mat-icon class="hero" aria-hidden="true">{{ step().icon }}</mat-icon>
      <h2 mat-dialog-title>{{ step().title }}</h2>
      <mat-dialog-content>
        <p>{{ step().text }}</p>
        <ul>
          @for (tip of step().tips; track tip) {
            <li>{{ tip }}</li>
          }
        </ul>
      </mat-dialog-content>
      <div class="dots" aria-hidden="true">
        @for (s of steps; track s.title; let i = $index) {
          <span [class.on]="i === index()"></span>
        }
      </div>
      <mat-dialog-actions align="end">
        @if (index() > 0) {
          <button mat-button type="button" (click)="index.set(index() - 1)">Back</button>
        } @else {
          <button mat-button type="button" mat-dialog-close>Skip</button>
        }
        @if (last()) {
          <button mat-flat-button type="button" mat-dialog-close cdkFocusInitial>
            Start designing
          </button>
        } @else {
          <button mat-flat-button type="button" (click)="index.set(index() + 1)" cdkFocusInitial>
            Next
          </button>
        }
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .guide {
      max-width: 460px;
      padding-top: var(--swpv-space-4);
      text-align: center;
    }
    .count {
      margin: 0;
      font-size: 0.8rem;
      color: var(--swpv-muted);
    }
    .hero {
      width: 56px;
      height: 56px;
      margin: var(--swpv-space-3) auto 0;
      font-size: 56px;
      color: var(--swpv-brand);
    }
    h2 {
      margin-top: var(--swpv-space-2);
    }
    ul {
      margin: var(--swpv-space-3) 0 0;
      padding-left: var(--swpv-space-5);
      text-align: left;
      line-height: 1.6;
    }
    .dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin: var(--swpv-space-3) 0 0;
    }
    .dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--swpv-border);
    }
    .dots span.on {
      background: var(--swpv-brand);
    }
  `,
})
export class GuideDialog {
  protected readonly steps: GuideStep[] = [
    {
      icon: 'polyline',
      title: 'Select a wall',
      text: 'Tell the app which part of the photo is wall.',
      tips: [
        'Polygon (P): click each corner, then click the first point or press Enter.',
        'Brush (B): paint over curved or awkward areas.',
        'Scroll or pinch to zoom in for accuracy.',
      ],
    },
    {
      icon: 'ink_eraser',
      title: 'Leave out windows and furniture',
      text: "Use the eraser so paint doesn't land on things that aren't wall.",
      tips: [
        'Eraser (E): paint over windows, doors, pictures or sofas.',
        'Undo with Ctrl+Z if you slip.',
        'Add more walls with "Add wall"; each can have its own colour.',
      ],
    },
    {
      icon: 'format_paint',
      title: 'Try colours',
      text: 'Pick a wall, then a colour. Light and shadow from your photo stay visible.',
      tips: [
        'Choose Solid, Two-tone or Pattern for each wall.',
        'Adjust finish, opacity and brightness to match your room.',
        'Use "+" to try another idea, and Compare to see them side by side.',
      ],
    },
    {
      icon: 'download',
      title: 'Save and share',
      text: 'Your work saves automatically while you edit.',
      tips: [
        'Click Save to keep it in My designs.',
        'Download a full-size image, or a before & after.',
        'Real paint can look different: try a sample pot before you commit.',
      ],
    },
  ];
  protected readonly index = signal(0);
  protected readonly step = computed(() => this.steps[this.index()]);
  protected readonly last = computed(() => this.index() === this.steps.length - 1);
}
