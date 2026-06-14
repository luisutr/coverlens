import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOUBLE_TAP_WINDOW_MS,
  nextDoubleTapResult,
  singleTapTimeoutResult,
} from '../hooks/doubleTapLogic';

describe('doubleTapLogic', () => {
  it('primer toque no dispara acción', () => {
    const r = nextDoubleTapResult(0);
    expect(r.result).toBe('none');
    expect(r.tapCount).toBe(1);
    expect(r.resetAfterMs).toBe(DEFAULT_DOUBLE_TAP_WINDOW_MS);
  });

  it('segundo toque dispara double', () => {
    const r = nextDoubleTapResult(1);
    expect(r.result).toBe('double');
    expect(r.tapCount).toBe(0);
  });

  it('timeout con un toque pendiente es single', () => {
    expect(singleTapTimeoutResult(1)).toBe('single');
    expect(singleTapTimeoutResult(0)).toBe('none');
  });
});
