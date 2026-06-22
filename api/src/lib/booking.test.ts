import { describe, it, expect } from 'vitest';
import { orderResourceIds } from './booking';

describe('orderResourceIds', () => {
  it('sorts ids deterministically', () => {
    expect(orderResourceIds(['c', 'a', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('produces the SAME order regardless of input order', () => {
    const x = orderResourceIds(['room3', 'room1', 'room2']);
    const y = orderResourceIds(['room1', 'room2', 'room3']);
    expect(x).toEqual(y);
  });

  it('removes duplicates', () => {
    expect(orderResourceIds(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('handles an empty list', () => {
    expect(orderResourceIds([])).toEqual([]);
  });
});