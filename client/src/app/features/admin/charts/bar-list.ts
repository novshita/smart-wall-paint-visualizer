import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarItem {
  label: string;
  sublabel?: string;
  value: number;
  /** Optional swatch shown before the label, e.g. a paint colour (content, not encoding) */
  swatch?: string;
}

/**
 * Horizontal bars for magnitude (one sequential hue): thin bars from a shared baseline,
 * rounded data end, value at the tip in ink. Each row is a focusable list item.
 */
@Component({
  selector: 'app-bar-list',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bars" [attr.aria-label]="label()">
      @for (item of items(); track item.label) {
        <li class="row" tabindex="0" [attr.aria-label]="item.label + ': ' + item.value">
          <span class="name">
            @if (item.swatch) {
              <span class="swatch" [style.background]="item.swatch" aria-hidden="true"></span>
            }
            <span class="text">
              {{ item.label }}
              @if (item.sublabel) {
                <span class="sub">{{ item.sublabel }}</span>
              }
            </span>
          </span>
          <span class="track" aria-hidden="true">
            <span class="bar" [style.width.%]="pct(item.value)"></span>
            <span class="value">{{ item.value | number }}</span>
          </span>
        </li>
      } @empty {
        <li class="empty">{{ emptyText() }}</li>
      }
    </ul>
  `,
  styles: `
    :host {
      --bar: #2a78d6;
      --text-primary: #0b0b0b;
      --text-secondary: #52514e;
      display: block;
    }
    .bars {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(110px, 38%) 1fr;
      align-items: center;
      gap: var(--swpv-space-3);
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .row:hover .bar,
    .row:focus-visible .bar {
      filter: brightness(1.12);
    }
    .name {
      display: flex;
      align-items: center;
      gap: var(--swpv-space-2);
      min-width: 0;
      color: var(--text-primary);
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      color: var(--text-secondary);
      font-size: 0.75rem;
    }
    .swatch {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border: 1px solid rgb(0 0 0 / 12%);
      border-radius: 5px;
    }
    .track {
      display: flex;
      align-items: center;
      gap: var(--swpv-space-2);
      min-width: 0;
    }
    .bar {
      height: 14px;
      min-width: 2px;
      border-radius: 0 4px 4px 0;
      background: var(--bar);
    }
    .value {
      flex-shrink: 0;
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .empty {
      color: var(--text-secondary);
      font-size: 0.85rem;
    }
  `,
})
export class BarList {
  readonly items = input.required<BarItem[]>();
  readonly label = input('Bar chart');
  readonly emptyText = input('No data yet');

  private readonly max = computed(() => Math.max(1, ...this.items().map((i) => i.value)));

  protected pct(value: number): number {
    // leave room for the value label at the tip
    return (value / this.max()) * 82;
  }
}
