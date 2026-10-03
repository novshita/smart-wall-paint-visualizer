import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SettingsService } from '../../../core/settings/settings.service';

/** Persistent colour-accuracy disclaimer (spec §8.7, §13, §23 rule 2). */
@Component({
  selector: 'app-disclaimer',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="disclaimer" [class.compact]="compact()" role="note">
      <mat-icon aria-hidden="true">info</mat-icon>
      <span>{{ message() }}</span>
    </p>
  `,
  styles: `
    .disclaimer {
      display: flex;
      gap: var(--swpv-space-2);
      align-items: flex-start;
      margin: 0;
      padding: var(--swpv-space-3) var(--swpv-space-4);
      background: var(--swpv-warn-bg);
      color: var(--swpv-warn-ink);
      border-radius: var(--swpv-radius-sm);
      line-height: 1.4;
    }
    .compact {
      padding: var(--swpv-space-2) var(--swpv-space-3);
      font-size: 0.85rem;
    }
    mat-icon {
      flex-shrink: 0;
    }
  `,
})
export class Disclaimer {
  readonly compact = input(false);
  /** Overrides the admin-configured disclaimer text */
  readonly text = input<string>();

  private readonly settings = inject(SettingsService).settings;
  protected readonly message = computed(() => this.text() ?? this.settings().disclaimerText);
}
