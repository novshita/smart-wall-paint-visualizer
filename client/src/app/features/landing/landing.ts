import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatButtonModule, MatIconModule, Disclaimer],
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

  // Preview strip on the hero; real featured colours come from the API once the library exists.
  protected readonly heroSwatches = ['#A9C6D8', '#A7B49A', '#D8C7A8', '#C46A45', '#5E3B5C'];
}
