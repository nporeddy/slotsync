import { describe, it, expect } from 'vitest';
import { minutesToHHMM } from './time';

describe('minutesToHHMM', () => {
  it('converts 540 to 09:00', () => {
    expect(minutesToHHMM(540)).toBe('09:00');
  });
  it('converts 1020 to 17:00', () => {
    expect(minutesToHHMM(1020)).toBe('17:00');
  });
  it('handles midnight', () => {
    expect(minutesToHHMM(0)).toBe('00:00');
  });
});