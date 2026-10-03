import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../../core/admin/admin.service';
import { ApiError } from '../../shared/models/api-error.model';
import { Pattern } from '../../shared/models/catalog.model';
import { assetUrl } from '../../shared/utils/asset-url';

type AdminPattern = Pattern & { isActive: boolean };

/** Pattern/wallpaper catalogue (FR-AD2): upload tiles, edit details, remove/restore. */
@Component({
  selector: 'app-admin-patterns',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-head">
      <div>
        <h1>Patterns</h1>
        <p class="muted">
          Tiles repeat across the wall and are tinted with the user's colours, so upload them in
          greys on white.
        </p>
      </div>
    </header>

    <form class="add card" (ngSubmit)="save()" aria-labelledby="add-heading">
      <h2 id="add-heading">{{ editing() ? 'Edit pattern' : 'Add a pattern' }}</h2>
      <div class="fields">
        <label>Name <input name="name" [(ngModel)]="name" required maxlength="80" /></label>
        <label
          >Category
          <input
            name="category"
            [(ngModel)]="category"
            required
            maxlength="40"
            placeholder="Geometric"
        /></label>
        <label class="wide"
          >Description <input name="description" [(ngModel)]="description" maxlength="500"
        /></label>
        <label
          >Tile image (PNG or JPG)
          <input
            type="file"
            accept="image/png,image/jpeg"
            (change)="pick($event)"
            [required]="!editing()"
          />
        </label>
      </div>
      <div class="buttons">
        @if (editing()) {
          <button mat-button type="button" (click)="reset()">Cancel</button>
        }
        <button
          mat-flat-button
          type="submit"
          [disabled]="busy() || !name.trim() || !category.trim() || (!editing() && !file)"
        >
          {{ busy() ? 'Saving…' : editing() ? 'Save changes' : 'Add pattern' }}
        </button>
      </div>
    </form>

    <ul class="grid">
      @for (p of list.value()?.items ?? []; track p._id) {
        <li class="card tile" [class.inactive]="!p.isActive">
          <span
            class="preview"
            [style.background-image]="'url(' + assetUrl(p.imageUrl) + ')'"
            aria-hidden="true"
          ></span>
          <div class="info">
            <strong>{{ p.name }}</strong>
            <span class="muted">{{ p.category }}</span>
            <span class="chip" [class.on]="p.isActive" [class.off]="!p.isActive">{{
              p.isActive ? 'Active' : 'Removed'
            }}</span>
          </div>
          <div class="acts">
            <button
              mat-icon-button
              type="button"
              (click)="startEdit(p)"
              [attr.aria-label]="'Edit ' + p.name"
              matTooltip="Edit"
            >
              <mat-icon>edit</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              (click)="toggle(p)"
              [attr.aria-label]="(p.isActive ? 'Remove ' : 'Restore ') + p.name"
              [matTooltip]="p.isActive ? 'Remove' : 'Restore'"
            >
              <mat-icon>{{ p.isActive ? 'visibility_off' : 'restore' }}</mat-icon>
            </button>
          </div>
        </li>
      } @empty {
        <li class="admin-empty">{{ list.isLoading() ? 'Loading…' : 'No patterns yet.' }}</li>
      }
    </ul>
  `,
  styles: `
    .card {
      padding: var(--swpv-space-4);
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius);
      background: #fff;
    }
    .add {
      margin-bottom: var(--swpv-space-5);
    }
    .add h2 {
      margin: 0 0 var(--swpv-space-3);
      font-size: 1rem;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--swpv-space-3);
    }
    .fields label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .fields input:not([type='file']) {
      min-height: 38px;
      padding: 0 var(--swpv-space-2);
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius-sm);
      font: inherit;
    }
    .wide {
      grid-column: span 2;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--swpv-space-2);
      margin-top: var(--swpv-space-3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--swpv-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: var(--swpv-space-2);
      padding: var(--swpv-space-3);
    }
    .tile.inactive {
      opacity: 0.6;
    }
    .preview {
      display: block;
      height: 110px;
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius-sm);
      background-color: #fff;
      background-size: 48px;
    }
    .info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--swpv-space-2);
    }
    .acts {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class AdminPatterns {
  private readonly admin = inject(AdminService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly assetUrl = assetUrl;
  protected readonly list = this.admin.patterns(() => ({ status: 'all' }));

  protected readonly editing = signal<AdminPattern | null>(null);
  protected readonly busy = signal(false);
  protected name = '';
  protected category = '';
  protected description = '';
  protected file: File | null = null;

  protected pick(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected startEdit(p: AdminPattern): void {
    this.editing.set(p);
    this.name = p.name;
    this.category = p.category;
    this.description = p.description ?? '';
    this.file = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected reset(): void {
    this.editing.set(null);
    this.name = this.category = this.description = '';
    this.file = null;
  }

  protected save(): void {
    this.busy.set(true);
    const fields = {
      name: this.name.trim(),
      category: this.category.trim(),
      description: this.description.trim(),
    };
    this.admin.savePattern(fields, this.file, this.editing()?._id).subscribe({
      next: () => {
        this.snackBar.open(this.editing() ? 'Pattern updated' : 'Pattern added', undefined, {
          duration: 2500,
        });
        this.busy.set(false);
        this.reset();
        this.list.reload();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.snackBar.open(err.message, 'OK', { duration: 4000 });
      },
    });
  }

  protected toggle(p: AdminPattern): void {
    this.admin.setPatternActive(p._id, !p.isActive).subscribe({
      next: () => this.list.reload(),
      error: (err: ApiError) => this.snackBar.open(err.message, 'OK', { duration: 4000 }),
    });
  }
}
