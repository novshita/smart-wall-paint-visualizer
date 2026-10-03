import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogService } from '../../core/catalog/catalog.service';
import { RecentColorsService } from '../../core/catalog/recent-colors.service';
import { ColorCache } from '../../core/editor/color-cache.service';
import { EditorStore } from '../../core/editor/editor.store';
import { Region } from '../../core/editor/editor.model';
import { downloadBlob, renderExport, slugify } from '../../core/editor/export';
import { hasArea } from '../../core/editor/geometry';
import { buildLayers, describeStyle } from '../../core/editor/layers';
import { PaintLayer } from '../../core/editor/paint-engine';
import { PatternService } from '../../core/editor/pattern.service';
import { ProjectService } from '../../core/projects/project.service';
import { FeedbackService } from '../../core/analytics/feedback.service';
import { SettingsService } from '../../core/settings/settings.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { WallList, WallPaint } from '../../shared/components/wall-list/wall-list';
import { Finish } from '../../shared/models/catalog.model';
import { DownloadDialog, DownloadDialogData, DownloadOptions } from './download-dialog';
import { PaintPanel } from './paint-panel';
import { StudioCanvas } from './studio-canvas';
import { VariantBar } from './variant-bar';

/** Step 2 of the editor: paint walls, try variants, compare and download (spec §6.4–6.6, §8). */
@Component({
  selector: 'app-studio',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSliderModule,
    MatTooltipModule,
    Disclaimer,
    PaintPanel,
    StudioCanvas,
    VariantBar,
    WallList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './studio.html',
  styleUrl: './studio.scss',
  host: { '(document:keydown)': 'onKeyDown($event)' },
})
export class Studio {
  protected readonly store = inject(EditorStore);
  private readonly cache = inject(ColorCache);
  private readonly patterns = inject(PatternService);
  private readonly settings = inject(SettingsService).settings;
  private readonly projects = inject(ProjectService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly recent = inject(RecentColorsService);
  private readonly feedback = inject(FeedbackService);

  /** ?colorId= from "Try on my room": applied to the first unpainted wall */
  readonly colorId = input<string>();
  /** ?export=1 from the Saved Designs page: open the download dialog */
  readonly export = input<string>();
  private readonly incoming = inject(CatalogService).color(this.colorId);

  protected readonly canvas = viewChild.required(StudioCanvas);
  protected readonly compare = signal(false);
  protected readonly comparePos = signal(0.5);
  /** What the left side of the compare view shows: the original photo or another design */
  protected readonly compareWith = signal<string>('before');
  protected readonly showBefore = signal(false);
  protected readonly saving = signal(false);
  protected readonly exporting = signal(false);

  protected readonly paintable = computed(() =>
    this.store.regions().filter((r) => hasArea(r.selection)),
  );
  protected readonly active = computed(() => {
    const a = this.store.activeRegion();
    return a && hasArea(a.selection) ? a : null;
  });
  protected readonly zoomPercent = computed(() => this.canvas().view().scale * 100);
  protected readonly otherVariants = computed(() =>
    this.store.variants().filter((v) => v.variantId !== this.store.variant()?.variantId),
  );

  protected readonly layers = computed(() => this.layersFor(this.store.regions()));

  protected readonly compareLayers = computed<PaintLayer[] | null>(() => {
    const id = this.compareWith();
    const other =
      id === 'before' ? undefined : this.store.variants().find((v) => v.variantId === id);
    return other ? this.layersFor(other.regions) : null;
  });

  protected readonly compareLabel = computed(() => {
    const id = this.compareWith();
    return id === 'before'
      ? 'Before'
      : (this.store.variants().find((v) => v.variantId === id)?.name ?? 'Before');
  });

  protected readonly wallPaint = computed(() => {
    const colors = this.cache.byId();
    const patterns = this.patterns.byId();
    const result: Record<string, WallPaint | undefined> = {};
    for (const r of this.store.regions()) {
      const d = describeStyle(r.style, colors, patterns.get(r.style.patternId ?? '')?.name);
      if (d) result[r.regionId] = { hex: d.hex, label: d.label };
    }
    return result;
  });

  constructor() {
    // Fetch details of library colours used on any wall in any variant
    effect(() => {
      const ids = this.store
        .variants()
        .flatMap((v) => v.regions.flatMap((r) => [r.style.colorId, r.style.secondaryColorId]))
        .filter((id): id is string => !!id);
      untracked(() => this.cache.ensure(ids));
    });

    // Make sure a paintable wall is selected
    effect(() => {
      const walls = this.paintable();
      const activeId = this.store.activeRegionId();
      if (walls.length && !walls.some((w) => w.regionId === activeId)) {
        untracked(() => this.store.activeRegionId.set(walls[0].regionId));
      }
    });

    // If the design being compared against is deleted, fall back to the original photo
    effect(() => {
      const id = this.compareWith();
      if (id !== 'before' && !this.otherVariants().some((v) => v.variantId === id)) {
        untracked(() => this.compareWith.set('before'));
      }
    });

    // "Try on my room": paint the first unpainted wall with the chosen colour, once
    effect(() => {
      if (!this.incoming.hasValue()) return;
      const color = this.incoming.value().color;
      untracked(() => {
        const walls = this.paintable();
        const unpainted = (r: Region) => !r.style.colorId && !r.style.customHex;
        const target =
          walls.find((w) => w.regionId === this.store.activeRegionId() && unpainted(w)) ??
          walls.find(unpainted);
        if (target) {
          this.cache.remember(color);
          this.recent.add(color);
          this.store.activeRegionId.set(target.regionId);
          this.store.setStyle(target.regionId, {
            mode: 'solid',
            colorId: color._id,
            opacity: 100,
            brightness: 0,
            finish: this.defaultFinish(),
          });
        }
        this.clearQueryParam('colorId');
      });
    });

    // ?export=1: open the download dialog once the design is on screen
    effect(() => {
      if (this.export() !== '1' || !this.canvas().renderMs()) return;
      untracked(() => {
        this.clearQueryParam('export');
        void this.openDownload();
      });
    });
  }

  protected async saveDesign(): Promise<void> {
    this.saving.set(true);
    try {
      await this.store.save('saved');
      this.snackBar.open('Design saved', 'OK', { duration: 3000 });
      void this.uploadPreview();
    } catch {
      this.snackBar.open(`Couldn't save: ${this.store.saveError() ?? 'please try again'}`, 'OK', {
        duration: 5000,
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected async openDownload(): Promise<void> {
    const variant = this.store.variant();
    if (!variant || this.exporting()) return;
    const data: DownloadDialogData = {
      variants: this.store.variants().map((v) => ({ variantId: v.variantId, name: v.name })),
      activeVariantId: variant.variantId,
    };
    const options = await firstValueFrom(
      this.dialog
        .open<DownloadDialog, DownloadDialogData, DownloadOptions>(DownloadDialog, { data })
        .afterClosed(),
    );
    if (options) await this.download(options);
  }

  private async download(options: DownloadOptions): Promise<void> {
    const project = this.store.project();
    const variant = this.store.variants().find((v) => v.variantId === options.variantId);
    if (!project || !variant) return;

    this.exporting.set(true);
    const progress = this.snackBar.open('Preparing your full-resolution image…');
    try {
      const colors = this.cache.byId();
      const patterns = this.patterns.byId();
      const lines = variant.regions
        .filter((r) => hasArea(r.selection))
        .flatMap((r) => {
          const d = describeStyle(r.style, colors, patterns.get(r.style.patternId ?? '')?.name);
          return d ? [`${r.name}: ${d.detail}`] : [];
        });

      const blob = await renderExport({
        originalUrl: project.originalImage.url,
        layersAt: (w, h) => this.layersFor(variant.regions, w, h),
        format: options.format,
        layout: options.layout,
        caption: options.caption
          ? {
              title: `${project.title} · ${variant.name}`,
              lines: lines.length ? lines : ['No paint applied'],
              disclaimer: this.settings().disclaimerText,
            }
          : undefined,
      });
      const suffix = options.layout === 'before-after' ? '-before-after' : '';
      downloadBlob(
        blob,
        `${slugify(project.title)}-${slugify(variant.name)}${suffix}.${options.format}`,
      );
      progress.dismiss();
      this.snackBar.open('Downloaded', 'OK', { duration: 3000 });
      setTimeout(() => this.feedback.maybeAsk(project._id), 1200);

      this.projects
        .logActivity({
          action: 'download',
          projectId: project._id,
          metadata: { format: options.format, layout: options.layout },
        })
        .subscribe({ error: () => undefined });
    } catch {
      progress.dismiss();
      this.snackBar.open("Couldn't create the image. Please try again.", 'OK', { duration: 5000 });
    } finally {
      this.exporting.set(false);
    }
  }

  /** Stores a small painted preview so the Saved Designs grid shows the design, not the bare photo. */
  private async uploadPreview(): Promise<void> {
    const project = this.store.project();
    const variant = this.store.variant();
    const blob = await this.canvas().snapshot(960);
    if (!project || !variant || !blob) return;
    this.projects.uploadRender(project._id, variant.variantId, blob).subscribe({
      next: (saved) => {
        const url = saved.variants.find((v) => v.variantId === variant.variantId)?.renderUrl;
        this.store.setRenderUrl(variant.variantId, url);
      },
      error: () => undefined, // a missing thumbnail is not worth interrupting the user for
    });
  }

  private layersFor(regions: Region[], width?: number, height?: number): PaintLayer[] {
    const img = this.store.image();
    return buildLayers(regions, {
      colors: this.cache.byId(),
      patterns: this.patterns,
      defaultFinish: this.defaultFinish(),
      width: width ?? img?.naturalWidth ?? 1,
      height: height ?? img?.naturalHeight ?? 1,
    });
  }

  private defaultFinish(): Finish {
    return (this.settings().defaultFinish as Finish) ?? 'matte';
  }

  private clearQueryParam(name: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [name]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], mat-slider')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      this.store.redo();
    } else if (mod && key === 's') {
      e.preventDefault();
      void this.saveDesign();
    } else if (!mod && !e.altKey) {
      if (key === '+' || key === '=') this.canvas().zoomBy(1.25);
      else if (key === '-') this.canvas().zoomBy(0.8);
      else if (key === '0') this.canvas().fit();
      else if (key === '\\') this.compare.update((c) => !c);
    }
  }
}
