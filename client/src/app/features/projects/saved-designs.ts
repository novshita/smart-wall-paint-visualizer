import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../core/projects/project.service';
import { ConfirmData, ConfirmDialog } from '../../shared/components/dialogs/confirm-dialog';
import { PromptData, PromptDialog } from '../../shared/components/dialogs/prompt-dialog';
import { ApiError } from '../../shared/models/api-error.model';
import { Project } from '../../shared/models/project.model';

const PAGE_SIZE = 12;

/** Saved Designs (FR-S4): thumbnails, reopen, rename, duplicate, download, delete. */
@Component({
  selector: 'app-saved-designs',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-designs.html',
  styleUrl: './saved-designs.scss',
})
export class SavedDesigns {
  private readonly projects = inject(ProjectService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  // Query params
  readonly status = input<string>();
  readonly page = input<string>();

  protected readonly pageSize = PAGE_SIZE;
  protected readonly filter = computed(() =>
    this.status() === 'draft' || this.status() === 'saved' ? this.status()! : 'all',
  );
  protected readonly list = this.projects.projects(() => {
    const status = this.filter();
    return {
      page: Math.max(1, Number(this.page()) || 1),
      limit: PAGE_SIZE,
      ...(status === 'all' ? {} : { status }),
    };
  });

  /** The painted preview of the first design that has one, else the bare photo */
  protected thumbnail(p: Project): string {
    return p.variants.find((v) => v.renderUrl)?.renderUrl ?? p.thumbnailUrl;
  }

  /** Painted designs reopen in the studio; untouched uploads in wall selection */
  protected openLink(p: Project): string[] {
    const started = p.status === 'saved' || p.variants.some((v) => v.renderUrl);
    return ['/projects', p._id, started ? 'studio' : 'select'];
  }

  protected setFilter(status: string): void {
    this.router.navigate([], {
      queryParams: { status: status === 'all' ? null : status, page: null },
    });
  }

  protected onPage(e: PageEvent): void {
    this.router.navigate([], {
      queryParams: { page: e.pageIndex ? e.pageIndex + 1 : null },
      queryParamsHandling: 'merge',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected download(p: Project): void {
    this.router.navigate(['/projects', p._id, 'studio'], { queryParams: { export: 1 } });
  }

  protected async rename(p: Project): Promise<void> {
    const title = await firstValueFrom(
      this.dialog
        .open<PromptDialog, PromptData, string>(PromptDialog, {
          data: { title: 'Rename design', label: 'Name', value: p.title, maxLength: 150 },
        })
        .afterClosed(),
    );
    if (!title || title === p.title) return;
    this.projects.rename(p._id, title).subscribe({
      next: () => {
        this.list.reload();
        this.snackBar.open('Renamed', undefined, { duration: 2000 });
      },
      error: (err: ApiError) => this.snackBar.open(err.message, 'OK', { duration: 4000 }),
    });
  }

  protected duplicate(p: Project): void {
    this.projects.duplicate(p._id).subscribe({
      next: (copy) => {
        this.list.reload();
        this.snackBar
          .open(`Created “${copy.title}”`, 'Open', { duration: 4000 })
          .onAction()
          .subscribe(() => this.router.navigate(this.openLink(copy)));
      },
      error: (err: ApiError) => this.snackBar.open(err.message, 'OK', { duration: 4000 }),
    });
  }

  protected async remove(p: Project): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
          data: {
            title: 'Delete this design?',
            message: `“${p.title}” and its photo will be permanently deleted. This can't be undone.`,
            confirmText: 'Delete',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!confirmed) return;
    this.projects.delete(p._id).subscribe({
      next: () => {
        this.list.reload();
        this.snackBar.open('Design deleted', undefined, { duration: 2500 });
      },
      error: (err: ApiError) => this.snackBar.open(err.message, 'OK', { duration: 4000 }),
    });
  }
}
