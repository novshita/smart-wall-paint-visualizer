import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectService } from '../../core/projects/project.service';
import { EditorStore } from '../../core/editor/editor.store';
import { ColorCache } from '../../core/editor/color-cache.service';
import { PatternService } from '../../core/editor/pattern.service';
import { ApiError } from '../../shared/models/api-error.model';

/**
 * Frame for the editor screens (wall selection → studio). Loads the project and its
 * photo once and provides the EditorStore both screens share.
 */
@Component({
  selector: 'app-editor-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  providers: [EditorStore, ColorCache, PatternService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-shell.html',
  styleUrl: './editor-shell.scss',
})
export class EditorShell {
  readonly store = inject(EditorStore);
  private readonly snackBar = inject(MatSnackBar);

  /** Route param */
  readonly id = input.required<string>();

  protected readonly resource = inject(ProjectService).project(this.id);
  protected readonly imageError = signal(false);
  protected readonly ready = computed(() => !!this.store.project() && !!this.store.image());
  protected readonly notFound = computed(() => {
    const status = (this.resource.error() as ApiError | undefined)?.status;
    return status === 404 || status === 400;
  });

  protected readonly saveLabel = computed(() => {
    switch (this.store.saveState()) {
      case 'saving':
        return 'Saving…';
      case 'unsaved':
        return 'Unsaved changes';
      case 'error':
        return 'Not saved';
      default:
        return 'All changes saved';
    }
  });

  constructor() {
    effect(() => {
      if (!this.resource.hasValue()) return;
      const project = this.resource.value().project;
      untracked(() => {
        // Load once per project; later reloads only refresh the (signed) image URL
        if (this.store.project()?._id === project._id) return;
        this.store.load(project);
        this.loadImage(project.workingImage.url);
      });
    });
  }

  protected rename(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.store.renameProject(inputEl.value).catch((err: ApiError) => {
      inputEl.value = this.store.project()?.title ?? '';
      this.snackBar.open(`Couldn't rename: ${err.message}`, 'OK', { duration: 4000 });
    });
  }

  protected retrySave(): void {
    this.store.save().catch(() => undefined);
  }

  private loadImage(url: string): void {
    this.imageError.set(false);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // keeps the canvas readable when the API is on another origin
    img.decoding = 'async';
    img.src = url;
    img
      .decode()
      .then(() => this.store.image.set(img))
      .catch(() => this.imageError.set(true));
  }
}
