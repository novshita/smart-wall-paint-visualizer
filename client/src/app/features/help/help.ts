import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';

/** "How to use" guide. Expanded with screenshots once the studio is built. */
@Component({
  selector: 'app-help',
  imports: [Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="page help">
      <h1>How to use</h1>
      <ol>
        <li><strong>Sign up or log in.</strong></li>
        <li>
          <strong>Upload</strong> a clear, well-lit photo of your room (JPG or PNG). Only upload
          photos you took yourself or have permission to use.
        </li>
        <li>
          <strong>Select the wall</strong> with the polygon tool (click corners) or the brush (paint
          over the wall). Zoom in for precision; use undo if you slip.
        </li>
        <li>
          <strong>Pick a colour or pattern</strong> from the library, or enter your own HEX code.
        </li>
        <li><strong>Fine-tune</strong> opacity, finish, and brightness.</li>
        <li><strong>Compare</strong> before and after with the slider.</li>
        <li><strong>Save</strong> your design or <strong>download</strong> the image.</li>
      </ol>
      <p class="muted">Tip: photos taken in good, even daylight give the most realistic results.</p>
      <app-disclaimer />
    </article>
  `,
  styles: `
    .help {
      max-width: 760px;
    }
    ol {
      line-height: 1.7;
      padding-left: var(--swpv-space-5);
    }
  `,
})
export class Help {}
