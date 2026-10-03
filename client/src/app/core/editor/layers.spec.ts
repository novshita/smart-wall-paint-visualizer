import { buildLayers, describeStyle } from './layers';
import { PatternService } from './pattern.service';
import { Region } from './editor.model';
import { Color } from '../../shared/models/catalog.model';

const sage = {
  _id: 'c1',
  name: 'Sage Garden',
  code: 'GN-501',
  brand: 'SWPV',
  hex: '#A7B49A',
} as Color;
const colors = new Map([[sage._id, sage]]);

const wall = (style: Region['style']): Region => ({
  regionId: 'w1',
  name: 'Wall 1',
  selection: {
    type: 'polygon',
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    feather: 0,
  },
  style,
});

function ctx(coverage: Uint8Array | null = null) {
  const patterns = { coverage: vi.fn(() => coverage) } as unknown as PatternService;
  return { colors, patterns, defaultFinish: 'matte' as const, width: 10, height: 10 };
}

describe('buildLayers', () => {
  it('skips unpainted walls and walls without area', () => {
    expect(buildLayers([wall({})], ctx())).toEqual([]);
    const empty = {
      ...wall({ customHex: '#FFFFFF' }),
      selection: { type: 'polygon' as const, feather: 0 },
    };
    expect(buildLayers([empty], ctx())).toEqual([]);
  });

  it('resolves library colours and applies defaults', () => {
    const [layer] = buildLayers([wall({ colorId: 'c1' })], ctx());
    expect(layer).toMatchObject({
      rgb: [167, 180, 154],
      opacity: 100,
      brightness: 0,
      finish: 'matte',
    });
    expect(layer.split).toBeUndefined();
  });

  it('builds two-tone layers with a split', () => {
    const [layer] = buildLayers(
      [
        wall({
          mode: 'dual',
          colorId: 'c1',
          secondaryCustomHex: '#22344A',
          split: { direction: 'vertical', position: 30 },
        }),
      ],
      ctx(),
    );
    expect(layer.secondaryRgb).toEqual([34, 52, 74]);
    expect(layer.split).toEqual({ direction: 'vertical', position: 30 });
  });

  it('adds pattern coverage once the tile has loaded, else paints the background only', () => {
    const style = {
      mode: 'pattern' as const,
      colorId: 'c1',
      secondaryCustomHex: '#000000',
      patternId: 'p1',
    };
    expect(buildLayers([wall(style)], ctx(null))[0].pattern).toBeUndefined();
    const coverage = new Uint8Array(100);
    expect(buildLayers([wall(style)], ctx(coverage))[0].pattern).toBe(coverage);
  });
});

describe('describeStyle', () => {
  it('describes solid, custom, two-tone and pattern paint for captions', () => {
    expect(describeStyle({ colorId: 'c1' }, colors)?.detail).toBe('Sage Garden (GN-501, SWPV)');
    expect(describeStyle({ customHex: '#123456' }, colors)?.label).toBe('Custom #123456');
    expect(
      describeStyle({ mode: 'dual', colorId: 'c1', secondaryCustomHex: '#FFFFFF' }, colors)?.detail,
    ).toBe('Two-tone: Sage Garden (GN-501, SWPV) and Custom #FFFFFF');
    expect(
      describeStyle(
        { mode: 'pattern', patternId: 'p', colorId: 'c1', secondaryCustomHex: '#000000' },
        colors,
        'Chevron',
      )?.label,
    ).toBe('Chevron · Sage Garden');
    expect(describeStyle({}, colors)).toBeUndefined();
  });
});
