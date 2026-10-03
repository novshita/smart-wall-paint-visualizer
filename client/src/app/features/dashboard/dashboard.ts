import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';

/**
 * Signed-in home. Recent projects and favourites are filled in as those
 * features land (upload: step 4, favourites: step 3).
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatIconModule, Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
}
