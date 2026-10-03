import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorStore, MAX_VARIANTS } from '../../core/editor/editor.store';
import { Variant } from '../../shared/models/project.model';

/** Switch between design variants of the same photo, and add/rename/delete them (FR-C6). */
@Component({
  selector: 'app-variant-bar',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" role="group" aria-label="Design variants">
      @for (v of store.variants(); track v.variantId) {
        @let active = v.variantId === store.variant()?.variantId;
        @if (editingId() === v.variantId) {
          <input
            [id]="'variant-name-' + v.variantId"
            class="rename"
            [value]="v.name"
            maxlength="100"
            aria-label="Design name"
            (keydown.enter)="finishRename(v, $any($event.target).value)"
            (keydown.escape)="editingId.set(null)"
            (blur)="finishRename(v, $any($event.target).value)"
          />
        } @else {
          <button
            type="button"
            class="variant"
            [class.on]="active"
            [attr.aria-pressed]="active"
            (click)="store.selectVariant(v.variantId)"
            (dblclick)="startRename(v)"
          >
            {{ v.name }}
          </button>
        }
        @if (active && editingId() !== v.variantId) {
          <button
            mat-icon-button
            type="button"
            class="more"
            [matMenuTriggerFor]="menu"
            [attr.aria-label]="'Options for ' + v.name"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #menu="matMenu">
            <button mat-menu-item (click)="startRename(v)">
              <mat-icon>edit</mat-icon><span>Rename</span>
            </button>
            <button mat-menu-item (click)="add()" [disabled]="store.variants().length >= max">
              <mat-icon>content_copy</mat-icon><span>Duplicate</span>
            </button>
            <button mat-menu-item (click)="remove(v)" [disabled]="store.variants().length <= 1">
              <mat-icon>delete</mat-icon><span>Delete</span>
            </button>
          </mat-menu>
        }
      }
      <button
        mat-icon-button
        type="button"
        (click)="add()"
        [disabled]="store.variants().length >= max"
        aria-label="New design variant (copies the current one)"
        matTooltip="Try another idea: copies the current design"
      >
        <mat-icon>add</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      gap: var(--swpv-space-1);
      padding: var(--swpv-space-1) var(--swpv-space-2);
      overflow-x: auto;
      border-bottom: 1px solid var(--swpv-border);
      background: var(--swpv-surface-alt);
    }
    .variant {
      flex-shrink: 0;
      min-height: 34px;
      padding: 0 var(--swpv-space-3);
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--swpv-muted);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .variant:hover {
      background: #fff;
    }
    .variant.on {
      border-color: var(--swpv-border);
      background: #fff;
      color: var(--swpv-ink);
      box-shadow: var(--swpv-shadow);
    }
    .more {
      margin-left: -6px;
    }
    .rename {
      width: 140px;
      min-height: 32px;
      padding: 0 var(--swpv-space-2);
      border: 1px solid var(--swpv-brand);
      border-radius: 999px;
      font: inherit;
    }
  `,
})
export class VariantBar {
  protected readonly store = inject(EditorStore);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly editingId = signal<string | null>(null);
  protected readonly max = MAX_VARIANTS;

  protected add(): void {
    if (this.store.addVariant()) {
      this.snackBar.open('New design created from a copy. Try different colours!', undefined, {
        duration: 2500,
      });
    }
  }

  protected startRename(v: Variant): void {
    this.editingId.set(v.variantId);
    setTimeout(() => {
      const input = document.getElementById(
        `variant-name-${v.variantId}`,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected finishRename(v: Variant, value: string): void {
    if (this.editingId() !== v.variantId) return;
    this.editingId.set(null);
    if (value.trim() && value.trim() !== v.name) this.store.renameVariant(v.variantId, value);
  }

  protected remove(v: Variant): void {
    this.store.deleteVariant(v.variantId);
    this.snackBar
      .open(`Deleted “${v.name}”`, 'Undo', { duration: 5000 })
      .onAction()
      .subscribe(() => this.store.undo());
  }
}
