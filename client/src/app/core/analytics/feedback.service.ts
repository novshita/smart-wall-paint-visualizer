import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { FeedbackDialog, FeedbackResult } from '../../shared/components/feedback/feedback-dialog';

const ASK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

interface FeedbackMemory {
  lastAsked?: number;
  projects: string[];
}

/** Asks for a satisfaction rating at a natural moment (after a download), rarely. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  /** Shows the rating dialog at most once per design and once a week. */
  maybeAsk(projectId: string): void {
    const key = this.key();
    if (!key) return;
    const memory = this.read(key);
    const recentlyAsked = memory.lastAsked && Date.now() - memory.lastAsked < ASK_INTERVAL_MS;
    if (recentlyAsked || memory.projects.includes(projectId)) return;

    this.write(key, {
      lastAsked: Date.now(),
      projects: [...memory.projects, projectId].slice(-50),
    });
    this.dialog
      .open<FeedbackDialog, void, FeedbackResult>(FeedbackDialog, { autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.http.post(`${environment.apiUrl}/feedback`, { ...result, projectId }).subscribe({
          next: () =>
            this.snackBar.open('Thanks for your feedback!', undefined, { duration: 2500 }),
          error: () => undefined,
        });
      });
  }

  private key(): string | null {
    const id = this.auth.user()?._id;
    return id ? `swpv.feedback.${id}` : null;
  }

  private read(key: string): FeedbackMemory {
    try {
      return { projects: [], ...JSON.parse(localStorage.getItem(key) ?? '{}') };
    } catch {
      return { projects: [] };
    }
  }

  private write(key: string, value: FeedbackMemory): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable: we may ask again, which is harmless
    }
  }
}
