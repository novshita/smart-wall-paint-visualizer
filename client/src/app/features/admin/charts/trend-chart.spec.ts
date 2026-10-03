import { niceTicks } from './trend-chart';

describe('niceTicks', () => {
  it('uses whole-number steps for counts', () => {
    expect(niceTicks(2)).toEqual([0, 1, 2]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it('uses clean decimal steps when asked', () => {
    expect(niceTicks(2, false)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500]);
  });
});
