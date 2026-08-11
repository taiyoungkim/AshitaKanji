// 사전 생성 TTS 오디오(edge-tts Nanami) 재생.
// Android는 Ogg/Opus, iOS/web은 MP3 에셋을 플랫폼별 정적 맵으로 조회한다.
// 에셋 맵에 없으면 호출측이 expo-speech로 폴백한다.

import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { WORD_AUDIO, EXAMPLE_AUDIO } from './audioMap.gen';
import { PlaybackGate } from './playbackGate';

export type AudioKind = 'word' | 'example';

let _player: AudioPlayer | null = null;
let _finishSubscription: { remove: () => void } | null = null;
const playbackGate = new PlaybackGate();

function releasePlayer(): void {
  _finishSubscription?.remove();
  _finishSubscription = null;
  if (_player) {
    try {
      _player.remove();
    } catch {
      /* noop */
    }
    _player = null;
  }
}

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
  if (mod == null) {
    stopWordAudio();
    return false;
  }

  const request = playbackGate.begin(`${kind}:${id}`);
  // 같은 음성이 이미 로딩 또는 재생 중이면 연타를 새 재생으로 쌓지 않는다.
  if (!request.accepted) return true;

  releasePlayer();
  try {
    const asset = Asset.fromModule(mod);
    if (!asset.localUri) {
      await asset.downloadAsync(); // 번들 에셋이면 로컬 경로만 해석(네트워크 없음).
    }
    const uri = asset.localUri ?? asset.uri;
    if (!playbackGate.isCurrent(request.token)) return true;
    if (!uri) {
      playbackGate.finish(request.token);
      return false;
    }

    _player = createAudioPlayer(uri);
    if (rate !== 1) {
      // 피치 보정으로 속도만 변경(음 높낮이 유지).
      _player.shouldCorrectPitch = true;
      _player.setPlaybackRate(rate);
    }
    _finishSubscription = _player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish || !playbackGate.isCurrent(request.token)) return;
      playbackGate.finish(request.token);
      releasePlayer();
    });
    _player.play();
    return true;
  } catch (err) {
    // 더 최신 요청이 이미 시작됐다면 이 실패로 폴백 음성을 재생하지 않는다.
    if (!playbackGate.isCurrent(request.token)) return true;
    playbackGate.finish(request.token);
    releasePlayer();
    console.warn('[wordAudio] play failed:', err);
    return false;
  }
}

export function stopWordAudio(): void {
  playbackGate.cancel();
  releasePlayer();
}
