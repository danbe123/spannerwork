import { describe, it, expect } from 'vitest';
import { brandColors } from './colors';

describe('Brand Colors', () => {
  it('exports brandColors object', () => {
    expect(brandColors).toBeDefined();
    expect(typeof brandColors).toBe('object');
  });

  it('has expected color keys', () => {
    expect(brandColors[500]).toBeDefined();
    expect(brandColors[800]).toBeDefined();
  });

  it('colors are valid hex values', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    
    Object.values(brandColors).forEach((color) => {
      if (typeof color === 'string') {
        expect(color).toMatch(hexRegex);
      }
    });
  });
});
