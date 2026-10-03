import { History } from './history';

describe('History', () => {
  it('undoes and redoes in order', () => {
    const h = new History<number>();
    h.push(1); // state went 1 -> 2
    h.push(2); // 2 -> 3
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeUndefined();
    expect(h.redo(1)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.canRedo).toBe(false);
  });

  it('clears redo after a new change and respects the size limit', () => {
    const h = new History<number>(2);
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo(4)).toBe(3);
    h.push(9);
    expect(h.canRedo).toBe(false);
    expect(h.undo(10)).toBe(9);
    expect(h.undo(9)).toBe(2);
    expect(h.undo(2)).toBeUndefined(); // 1 was dropped by the limit
  });
});
