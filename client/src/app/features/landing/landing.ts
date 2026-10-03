import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { SwatchCard } from '../../shared/components/swatch-card/swatch-card';
import { CatalogService } from '../../core/catalog/catalog.service';
import { Color } from '../../shared/models/catalog.model';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatButtonModule, MatIconModule, Disclaimer, SwatchCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly steps = [
    {
      icon: 'add_photo_alternate',
      title: 'Upload your room',
      text: 'Use a clear photo of a room you own.',
    },
    {
      icon: 'polyline',
      title: 'Select the walls',
      text: 'Trace walls with the polygon or brush tool.',
    },
    {
      icon: 'palette',
      title: 'Try colours',
      text: 'Solid, two-tone or patterned, with realistic shading.',
    },
    {
      icon: 'compare',
      title: 'Compare & save',
      text: 'Slide between before and after, then download.',
    },
  ];

  // Decorative strip on the hero
  protected readonly heroSwatches = ['#A9C6D8', '#A7B49A', '#D8C7A8', '#C46A45', '#5E3B5C'];

  private readonly catalog = inject(CatalogService).colors(() => ({ limit: 100 }));

  /** One colour from each family, up to 8, as a taste of the library. */
  protected readonly featured = computed<Color[]>(() => {
    if (!this.catalog.hasValue()) return [];
    const byFamily = new Map<string, Color>();
    for (const c of this.catalog.value().items) {
      if (!byFamily.has(c.family)) byFamily.set(c.family, c);
    }
    return [...byFamily.values()].slice(0, 8);
  });
}
