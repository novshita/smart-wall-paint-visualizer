import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { SwatchCard } from '../../shared/components/swatch-card/swatch-card';
import { FavoritesService } from '../../core/catalog/favorites.service';
import { ProjectService } from '../../core/projects/project.service';
import { Project } from '../../shared/models/project.model';

/** Signed-in home: quick start, recent designs, and favourite colours. */
@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, Disclaimer, SwatchCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoritesService);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly favoriteColors = computed(() => this.favorites.colors().slice(0, 6));
  protected readonly favoriteCount = computed(() => this.favorites.colors().length);

  protected readonly recent = inject(ProjectService).projects(() => ({ limit: 4 }));

  protected thumbnail(p: Project): string {
    return p.variants.find((v) => v.renderUrl)?.renderUrl ?? p.thumbnailUrl;
  }

  protected openLink(p: Project): string[] {
    const started = p.status === 'saved' || p.variants.some((v) => v.renderUrl);
    return ['/projects', p._id, started ? 'studio' : 'select'];
  }
}
