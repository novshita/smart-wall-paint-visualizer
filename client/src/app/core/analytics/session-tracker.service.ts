import { Injectable, effect, inject, untracked } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const KEY = 'swpv.session';
const MAX_SECONDS = 4 * 60 * 60;

interface Session {
  id: string;
  userId: string;
  start: number;
}

/**
 * Measures how long signed-in users spend in the app, for the "average session
 * duration" KPI (spec §14). A session starts when a signed-in page loads (or on
 * login) and ends when the tab is closed/hidden away or the user logs out.
 */
@Injectable({ providedIn: 'root' })
export class SessionTracker {
  private readonly auth = inject(AuthService);
  private session: Session | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => {
        if (user && this.session?.userId !== user._id) this.start(user._id);
        if (!user && this.session) this.end(false);
      });
    });
    window.addEventListener('pagehide', () => this.end(true));
  }

  private start(userId: string): void {
    if (this.session) this.end(false);
    this.session = { id: crypto.randomUUID(), userId, start: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(this.session));
    this.send({ action: 'session_start', sessionId: this.session.id });
  }

  /** `unloading`: the page is going away, so the request must outlive it (keepalive). */
  private end(unloading: boolean): void {
    const s = this.session;
    if (!s) return;
    this.session = null;
    sessionStorage.removeItem(KEY);
    const seconds = Math.min(MAX_SECONDS, Math.round((Date.now() - s.start) / 1000));
    if (seconds < 1) return;
    this.send(
      { action: 'session_end', sessionId: s.id, metadata: { durationSeconds: seconds } },
      unloading,
    );
  }

  private send(body: object, keepalive = false): void {
    const token = this.auth.token;
    if (!token) return;
    // fetch (not HttpClient) so the request can be kept alive while the page unloads
    fetch(`${environment.apiUrl}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      keepalive,
    }).catch(() => undefined);
  }
}
