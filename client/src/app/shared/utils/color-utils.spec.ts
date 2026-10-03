import { formatRgb, readableTextColor, relativeLuminance } from './color-utils';

describe('color utils', () => {
  it('computes luminance at the extremes', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1);
  });

  it('picks dark text on light colours and white text on dark colours', () => {
    expect(readableTextColor('#F4F1EA')).toBe('#1d2427');
    expect(readableTextColor('#22344A')).toBe('#ffffff');
    expect(readableTextColor('#A7B49A')).toBe('#1d2427');
  });

  it('formats rgb', () => {
    expect(formatRgb({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)');
  });
});
