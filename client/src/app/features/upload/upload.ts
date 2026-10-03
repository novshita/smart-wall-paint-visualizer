import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ProjectService } from '../../core/projects/project.service';
import { SettingsService } from '../../core/settings/settings.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { ApiError } from '../../shared/models/api-error.model';
import {
  MIN_IMAGE_SIDE,
  formatBytes,
  prepareImage,
  sniffImageType,
  titleFromFilename,
} from '../../shared/utils/image-utils';

interface Selected {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

/** Room photo upload (FR-U1–U5). */
@Component({
  selector: 'app-upload',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    Disclaimer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class Upload {
  private readonly projects = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService).settings;

  /** Optional ?colorId= from "Try on my room", carried through to the editor */
  readonly colorId = input<string>();
  private readonly colorResource = inject(CatalogService).color(this.colorId);
  protected readonly color = computed(() =>
    this.colorResource.hasValue() ? this.colorResource.value().color : undefined,
  );

  protected readonly maxMb = computed(() => this.settings().maxUploadMb);
  protected readonly selected = signal<Selected | null>(null);
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly progress = signal<number | null>(null);
  protected readonly processing = computed(() => this.progress() === 100);

  protected title = '';
  protected ownershipConfirmed = false;

  private uploadSub?: Subscription;
  protected readonly minSide = MIN_IMAGE_SIDE;
  protected readonly formatBytes = formatBytes;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.uploadSub?.unsubscribe();
      this.revokePreview();
    });
  }

  protected onFileInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = ''; // allow re-selecting the same file after an error
    if (file) this.select(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.select(file);
  }

  /** Validates in the browser first for instant feedback; the server re-checks everything. */
  protected async select(file: File): Promise<void> {
    this.error.set(null);
    this.checking.set(true);
    try {
      const type = await sniffImageType(file);
      const allowed = this.settings().allowedFormats;
      if (!type || !allowed.includes(type)) {
        return this.fail('Only JPG and PNG photos are allowed.');
      }
      if (file.size > this.maxMb() * 1024 * 1024) {
        return this.fail(
          `This photo is ${formatBytes(file.size)}. The maximum size is ${this.maxMb()} MB.`,
        );
      }

      let prepared;
      try {
        prepared = await prepareImage(file);
      } catch {
        return this.fail('This file could not be opened as an image. It may be damaged.');
      }
      if (Math.min(prepared.width, prepared.height) < MIN_IMAGE_SIDE) {
        return this.fail(
          `This photo is too small (${prepared.width} × ${prepared.height}). Use one at least ${MIN_IMAGE_SIDE} × ${MIN_IMAGE_SIDE} pixels.`,
        );
      }

      this.revokePreview();
      this.selected.set({
        file,
        previewUrl: URL.createObjectURL(prepared.preview),
        width: prepared.width,
        height: prepared.height,
      });
      if (!this.title) this.title = titleFromFilename(file.name);
    } finally {
      this.checking.set(false);
    }
  }

  protected clear(): void {
    this.revokePreview();
    this.selected.set(null);
    this.error.set(null);
    this.title = '';
  }

  protected upload(): void {
    const selected = this.selected();
    if (!selected || !this.ownershipConfirmed || this.progress() !== null) return;

    this.error.set(null);
    this.progress.set(0);
    this.uploadSub = this.projects.upload(selected.file, this.title.trim()).subscribe({
      next: (event) => {
        if (event.kind === 'progress') {
          this.progress.set(event.percent);
        } else {
          const colorId = this.colorId();
          this.router.navigate(['/projects', event.project._id, 'select'], {
            queryParams: colorId ? { colorId } : {},
          });
        }
      },
      error: (err: ApiError) => {
        this.progress.set(null);
        this.error.set(err.message);
      },
    });
  }

  protected cancelUpload(): void {
    this.uploadSub?.unsubscribe();
    this.progress.set(null);
  }

  private fail(message: string): void {
    this.error.set(message);
  }

  private revokePreview(): void {
    const current = this.selected();
    if (current) URL.revokeObjectURL(current.previewUrl);
  }
}
