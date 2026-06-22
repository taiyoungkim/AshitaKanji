// 사전 생성 TTS 오디오(edge-tts Nanami) 재생.
// 번들된 mp3 에셋(assets/audio/{words,examples}/<id>.mp3)을 id로 조회 → expo-audio 재생.
// 에셋 맵(audioMap.gen.ts)에 없으면 호출측이 expo-speech 폴백.

import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { WORD_AUDIO, EXAMPLE_AUDIO } from './audioMap.gen';

export type AudioKind = 'word' | 'example';

let _player: AudioPlayer | null = null;

function moduleFor(kind: AudioKind, id: string): number | undefined {
  return kind === 'word' ? WORD_AUDIO[id] : EXAMPLE_AUDIO[id];
}

/** 해당 id의 사전 생성 오디오 존재 여부. */
export function hasWordAudio(kind: AudioKind, id: string): boolean {
  return moduleFor(kind, id) != null;
}

/** 오디오 에셋이 하나라도 번들됐는지(미탑재 빌드 감지용). */
export function isWordAudioAvailable(): boolean {
  return Object.keys(WORD_AUDIO).length > 0;
}

/**
 * 사전 생성 오디오 재생 시도. 성공 true, 데이터 없음/실패 false(폴백 신호).
 */
export async function playWordAudio(
  kind: AudioKind,
  id: string,
  rate = 1,
): Promise<boolean> {
  const mod = moduleFor(kind, id);
  if (mod == null) return false;
  try {
    const asset = Asset.fromModule(mod);
    if (!asset.localUri) {
      await asset.downloadAsync(); // 번들 에셋이면 로컬 경로만 해석(네트워크 없음).
    }
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return false;

    stopWordAudio();
    _player = createAudioPlayer(uri);
    if (rate !== 1) {
      // 피치 보정으로 속도만 변경(음 높낮이 유지).
      _player.shouldCorrectPitch = true;
      _player.setPlaybackRate(rate);
    }
    _player.play();
    return true;
  } catch (err) {
    console.warn('[wordAudio] play failed:', err);
    return false;
  }
}

export function stopWordAudio(): void {
  if (_player) {
    try {
      _player.remove();
    } catch {
      /* noop */
    }
    _player = null;
  }
}
