/** Lógica pura de detección de doble toque (testeable sin React). */

export const DEFAULT_DOUBLE_TAP_WINDOW_MS = 300;

export type DoubleTapTapResult = 'none' | 'single' | 'double';

export function nextDoubleTapResult(
  tapCount: number,
  windowMs: number = DEFAULT_DOUBLE_TAP_WINDOW_MS
): { tapCount: number; result: DoubleTapTapResult; resetAfterMs: number | null } {
  const next = tapCount + 1;
  if (next >= 2) {
    return { tapCount: 0, result: 'double', resetAfterMs: null };
  }
  return { tapCount: next, result: 'none', resetAfterMs: windowMs };
}

export function singleTapTimeoutResult(tapCount: number): DoubleTapTapResult {
  return tapCount === 1 ? 'single' : 'none';
}
