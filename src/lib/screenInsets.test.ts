import { describe, expect, it } from 'vitest';
import {
  resolveBottomInset,
  resolveFullScreenTopInset,
  resolveSheetTopInset,
} from './screenInsets';

describe('resolveFullScreenTopInset', () => {
  it('uses the live inset when the platform reports one', () => {
    expect(
      resolveFullScreenTopInset({
        insetTop: 44,
        metricsTop: 44,
        statusBarHeight: 0,
        isAndroid: false,
      }),
    ).toBe(44);
  });

  it('falls back to captured metrics when a modal reports 0 (iOS fullScreenModal)', () => {
    expect(
      resolveFullScreenTopInset({
        insetTop: 0,
        metricsTop: 47,
        statusBarHeight: 0,
        isAndroid: false,
      }),
    ).toBe(47);
  });

  it('falls back to the Android status bar height when both insets are 0', () => {
    expect(
      resolveFullScreenTopInset({
        insetTop: 0,
        metricsTop: 0,
        statusBarHeight: 36,
        isAndroid: true,
      }),
    ).toBe(36);
  });

  it('never returns a negative inset', () => {
    expect(
      resolveFullScreenTopInset({
        insetTop: -1,
        metricsTop: 0,
        statusBarHeight: 0,
        isAndroid: true,
      }),
    ).toBe(0);
  });
});

describe('resolveSheetTopInset', () => {
  it('is 0 on iOS — the native sheet already insets itself', () => {
    expect(
      resolveSheetTopInset({
        insetTop: 0,
        metricsTop: 47,
        statusBarHeight: 0,
        isAndroid: false,
      }),
    ).toBe(0);
  });

  it('pads by the status bar on Android', () => {
    expect(
      resolveSheetTopInset({
        insetTop: 0,
        metricsTop: 0,
        statusBarHeight: 24,
        isAndroid: true,
      }),
    ).toBe(24);
  });
});

describe('resolveBottomInset', () => {
  it('takes the larger of live and captured insets', () => {
    expect(resolveBottomInset(0, 34)).toBe(34);
    expect(resolveBottomInset(48, 34)).toBe(48);
    expect(resolveBottomInset(0, 0)).toBe(0);
  });
});
