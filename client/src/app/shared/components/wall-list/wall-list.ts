import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorStore, WALL_COLORS } from '../../../core/editor/editor.store';
import { hasArea } from '../../../core/editor/geometry';
import { Region } from '../../../core/editor/editor.model';

export interface WallPaint {
  hex: string;
  label: string;
}

/** Named walls of the current design (FR-W3): pick, rename, delete, add. */
@Component({
  selector: 'app-wall-list',
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wall-list.html',
  styleUrl: './wall-list.scss',
})
export class WallList {
  protected readonly store = inject(EditorStore);
  private readonly snackBar = inject(MatSnackBar);

  /** 'select' shows overlay colours and editing; 'paint' shows each wall's paint */
  readonly mode = input<'select' | 'paint'>('select');
  /** For paint mode: what each wall is painted with */
  readonly paint = input<Record<string, WallPaint | undefined>>({});

  protected readonly editingId = signal<string | null>(null);
  protected readonly hasArea = hasArea;

  protected overlayColor(index: number): string {
    return WALL_COLORS[index % WALL_COLORS.length];
  }

  protected startRename(region: Region): void {
    this.editingId.set(region.regionId);
    // focus after the input renders
    setTimeout(() => document.getElementById(`rename-${region.regionId}`)?.focus());
  }

  protected finishRename(region: Region, value: string): void {
    if (this.editingId() !== region.regionId) return;
    this.editingId.set(null);
    if (value.trim() && value.trim() !== region.name) this.store.renameWall(region.regionId, value);
  }

  protected remove(region: Region): void {
    this.store.deleteWall(region.regionId);
    this.snackBar
      .open(`Deleted “${region.name}”`, 'Undo', { duration: 5000 })
      .onAction()
      .subscribe(() => this.store.undo());
  }
}
