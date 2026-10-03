import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Color } from '../../models/catalog.model';
import { readableTextColor } from '../../utils/color-utils';
import { FavoriteButton } from '../favorite-button/favorite-button';

/**
 * A colour tile showing swatch, name, code and brand (spec §13: shown consistently
 * wherever a colour appears). Links to the colour's detail page.
 */
@Component({
  selector: 'app-swatch-card',
  imports: [RouterLink, FavoriteButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.compact]="compact()">
      <a
        class="link"
        [routerLink]="['/colors', color()._id]"
        [attr.aria-label]="color().name + ', ' + color().code + ', ' + color().brand"
      >
        <span class="swatch" [style.background]="color().hex" [style.color]="textColor()">
          <span class="hex">{{ color().hex }}</span>
        </span>
        <span class="info">
          <span class="name">{{ color().name }}</span>
          <span class="meta">{{ color().code }} · {{ color().brand }}</span>
        </span>
      </a>
      @if (showFavorite()) {
        <app-favorite-button class="fav" [color]="color()" />
      }
    </article>
  `,
  styleUrl: './swatch-card.scss',
})
export class SwatchCard {
  readonly color = input.required<Color>();
  readonly showFavorite = input(true);
  readonly compact = input(false);

  protected readonly textColor = computed(() => readableTextColor(this.color().hex));
}
