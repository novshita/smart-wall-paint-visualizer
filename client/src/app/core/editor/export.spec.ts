import { slugify } from './export';

describe('slugify', () => {
  it('makes safe file names', () => {
    expect(slugify('Living Room — Option #2!')).toBe('living-room-option-2');
    expect(slugify('Café wall')).toBe('cafe-wall');
    expect(slugify('***')).toBe('design');
  });
});
