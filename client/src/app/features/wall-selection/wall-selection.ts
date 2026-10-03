import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorStore } from '../../core/editor/editor.store';
import { Tool } from '../../core/editor/editor.model';
import { EMPTY_SELECTION, hasArea } from '../../core/editor/geometry';
import { WallList } from '../../shared/components/wall-list/wall-list';
import { SelectionCanvas } from './selection-canvas';

interface ToolDef {
  id: Tool;
  icon: string;
  label: string;
  key: string;
}

/** Step 1 of the editor: select walls with polygon and brush tools (spec §6.3). */
@Component({
  selector: 'app-wall-selection',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
    SelectionCanvas,
    WallList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wall-selection.html',
  styleUrl: './wall-selection.scss',
  host: {
    '(document:keydown)': 'onKeyDown($event)',
    '(document:keyup)': 'onKeyUp($event)',
    '(window:blur)': 'spaceHeld.set(false)',
  },
})
export class WallSelection {
  protected readonly store = inject(EditorStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly canvas = viewChild.required(SelectionCanvas);

  protected readonly tools: ToolDef[] = [
    { id: 'move', icon: 'pan_tool', label: 'Move & select wall', key: 'V' },
    { id: 'polygon', icon: 'polyline', label: 'Polygon', key: 'P' },
    { id: 'brush', icon: 'brush', label: 'Brush', key: 'B' },
    { id: 'eraser', icon: 'ink_eraser', label: 'Eraser', key: 'E' },
  ];

  protected readonly tool = signal<Tool>('polygon');
  protected readonly brushSize = signal(40);
  protected readonly spaceHeld = signal(false);

  protected readonly active = this.store.activeRegion;
  protected readonly canContinue = computed(() =>
    this.store.regions().some((r) => hasArea(r.selection)),
  );
  protected readonly zoomPercent = computed(() => this.canvas().view().scale * 100);

  protected readonly guidance = computed(() => {
    const hint = this.canvas().hint();
    if (hint) return hint;
    if (this.canvas().drafting()) {
      return 'Click to add corners. Click the first point or press Enter to finish; Esc cancels.';
    }
    switch (this.tool()) {
      case 'polygon':
        return 'Click each corner of the wall. Zoom in for accuracy.';
      case 'brush':
        return 'Paint over the wall to select it. Use [ and ] to change the brush size.';
      case 'eraser':
        return 'Paint over windows, doors or furniture to remove them from the wall.';
      default:
        return 'Drag to move around. Click a wall to select it. Scroll or pinch to zoom.';
    }
  });

  protected setTool(tool: Tool): void {
    if (tool !== this.tool()) this.canvas().cancelDraft();
    this.tool.set(tool);
    this.canvas().hint.set(null);
  }

  protected undo(): void {
    if (!this.canvas().undoDraftPoint()) this.store.undo();
  }

  protected redo(): void {
    this.store.redo();
  }

  protected setFeather(value: number, live: boolean): void {
    const region = this.active();
    if (!region) return;
    this.store.setSelection(
      region.regionId,
      { ...region.selection, feather: value },
      { history: !live },
    );
    if (!live) this.store.endGesture();
  }

  protected clearWall(): void {
    const region = this.active();
    if (!region) return;
    this.canvas().cancelDraft();
    this.store.setSelection(region.regionId, {
      ...EMPTY_SELECTION,
      feather: region.selection.feather,
    });
  }

  protected continue(): void {
    this.canvas().closeDraft();
    this.router.navigate(['../studio'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], mat-slider')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (mod || e.altKey) return;

    switch (key) {
      case ' ':
        e.preventDefault();
        this.spaceHeld.set(true);
        break;
      case 'v':
      case 'h':
        this.setTool('move');
        break;
      case 'p':
        this.setTool('polygon');
        break;
      case 'b':
        this.setTool('brush');
        break;
      case 'e':
        this.setTool('eraser');
        break;
      case '[':
        this.brushSize.update((s) => Math.max(4, Math.round(s / 1.25)));
        break;
      case ']':
        this.brushSize.update((s) => Math.min(250, Math.round(s * 1.25)));
        break;
      case 'enter':
        this.canvas().closeDraft();
        break;
      case 'escape':
        this.canvas().cancelDraft();
        break;
      case 'backspace':
      case 'delete':
        if (this.canvas().undoDraftPoint()) e.preventDefault();
        break;
      case '+':
      case '=':
        this.canvas().zoomBy(1.25);
        break;
      case '-':
        this.canvas().zoomBy(0.8);
        break;
      case '0':
        this.canvas().fit();
        break;
    }
  }

  protected onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') this.spaceHeld.set(false);
  }
}
