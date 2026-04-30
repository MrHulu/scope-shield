import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onDataChange, notifyDataChange } from '../changeNotifier';

// changeNotifier holds a module-level listener array, so we must clean it up
// between tests by calling each unsubscribe handler.
let cleanups: Array<() => void> = [];

function subscribe(fn: () => void): void {
  cleanups.push(onDataChange(fn));
}

beforeEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
});

describe('changeNotifier', () => {
  it('invokes a listener when notifyDataChange is called', () => {
    const fn = vi.fn();
    subscribe(fn);
    notifyDataChange();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invokes multiple listeners in registration order', () => {
    const calls: number[] = [];
    subscribe(() => calls.push(1));
    subscribe(() => calls.push(2));
    subscribe(() => calls.push(3));
    notifyDataChange();
    expect(calls).toEqual([1, 2, 3]);
  });

  it('does not invoke listener after its unsubscribe handler is called', () => {
    const fn = vi.fn();
    const unsub = onDataChange(fn);
    notifyDataChange();
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    notifyDataChange();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only removes the matching listener when one of several unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    cleanups.push(onDataChange(a));
    const unsubB = onDataChange(b);
    cleanups.push(onDataChange(c));
    unsubB();
    notifyDataChange();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no listeners are registered', () => {
    expect(() => notifyDataChange()).not.toThrow();
  });

  it('handles repeated unsubscribe gracefully', () => {
    const fn = vi.fn();
    const unsub = onDataChange(fn);
    unsub();
    expect(() => unsub()).not.toThrow();
    notifyDataChange();
    expect(fn).not.toHaveBeenCalled();
  });

  it('fires once per notify call (no replay of past notifies on new subscribers)', () => {
    notifyDataChange();
    const fn = vi.fn();
    subscribe(fn);
    expect(fn).not.toHaveBeenCalled();
    notifyDataChange();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
