import { describe, expect, it } from 'vitest';
import { dataUrlToBase64 } from '../imageUtils';

describe('dataUrlToBase64', () => {
  it('strips png prefix', () => {
    expect(dataUrlToBase64('data:image/png;base64,ABC123')).toBe('ABC123');
  });

  it('strips jpeg prefix', () => {
    expect(dataUrlToBase64('data:image/jpeg;base64,XYZ')).toBe('XYZ');
  });

  it('strips jpg prefix', () => {
    expect(dataUrlToBase64('data:image/jpg;base64,foo')).toBe('foo');
  });

  it('returns raw string if no prefix', () => {
    expect(dataUrlToBase64('ABC123')).toBe('ABC123');
  });
});
