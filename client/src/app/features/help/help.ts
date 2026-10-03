import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';

/** "How to use": in-app user guide (spec deliverable 5) and colour-accuracy disclaimer. */
@Component({
  selector: 'app-help',
  imports: [RouterLink, MatIconModule, MatExpansionModule, Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help.html',
  styleUrl: './help.scss',
})
export class Help {
  protected readonly shortcuts = [
    ['P', 'Polygon tool'],
    ['B', 'Brush'],
    ['E', 'Eraser'],
    ['V', 'Move and select a wall'],
    ['[ / ]', 'Smaller / bigger brush'],
    ['Enter', 'Finish the polygon'],
    ['Esc', 'Cancel the polygon'],
    ['Space (hold)', 'Pan with any tool'],
    ['+ / − / 0', 'Zoom in / out / fit'],
    ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
    ['Ctrl+S', 'Save design (Paint step)'],
    ['\\', 'Toggle before/after compare'],
  ];
}
