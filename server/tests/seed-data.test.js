const colors = require('../src/seed/colors');
const patterns = require('../src/seed/patterns');
const { hexToRgb } = require('../src/utils/color');
const fs = require('fs');
const path = require('path');

describe('seed data', () => {
  it('has unique colour codes and valid HEX values', () => {
    const codes = colors.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of colors) expect(hexToRgb(c.hex)).toBeDefined();
  });

  it('references pattern tiles that exist on disk', () => {
    for (const p of patterns) {
      const file = path.join(__dirname, '../public', p.imageUrl.replace('/static/', ''));
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});

describe('hexToRgb', () => {
  it('converts valid hex and rejects anything else', () => {
    expect(hexToRgb('#A7B49A')).toEqual({ r: 167, g: 180, b: 154 });
    expect(hexToRgb('#abc')).toBeUndefined();
    expect(hexToRgb(undefined)).toBeUndefined();
  });
});
