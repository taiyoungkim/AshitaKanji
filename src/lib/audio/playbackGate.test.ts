import { describe, expect, it } from 'vitest';
import { PlaybackGate } from './playbackGate';

describe('PlaybackGate', () => {
  it('rejects repeated requests for the same active audio', () => {
    const gate = new PlaybackGate();
    const first = gate.begin('word:w_1');
    const repeated = gate.begin('word:w_1');

    expect(first.accepted).toBe(true);
    expect(repeated).toEqual({ accepted: false, token: first.token });
    expect(gate.isCurrent(first.token)).toBe(true);
  });

  it('invalidates an older request when another audio starts', () => {
    const gate = new PlaybackGate();
    const first = gate.begin('word:w_1');
    const next = gate.begin('example:w_1');

    expect(next.accepted).toBe(true);
    expect(gate.isCurrent(first.token)).toBe(false);
    expect(gate.isCurrent(next.token)).toBe(true);
  });

  it('allows the same audio again after playback finishes', () => {
    const gate = new PlaybackGate();
    const first = gate.begin('word:w_1');

    gate.finish(first.token);

    expect(gate.begin('word:w_1').accepted).toBe(true);
  });

  it('invalidates pending work when playback is cancelled', () => {
    const gate = new PlaybackGate();
    const request = gate.begin('word:w_1');

    gate.cancel();

    expect(gate.isCurrent(request.token)).toBe(false);
  });
});
