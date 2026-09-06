// 사전 생성 TTS 오디오(edge-tts Nanami) 재생.
// Android는 Ogg/Opus, iOS/web은 MP3 에셋을 플랫폼별 정적 맵으로 조회한다.
// 에셋 맵에 없으면 호출측이 expo-speech로 폴백한다.
//
// 플레이어는 앱 수명 동안 하나만 만들고 replace()로 소스만 바꾼다.
// expo-audio(SDK 54)의 player.remove()는 모듈 레지스트리에서만 빼고 네이티브
// ExoPlayer/AudioTrack은 JS GC 시점까지 살아 있다. 재생마다 새 플레이어를 만들면
// AudioTrack이 쌓여 수십 회 재생 뒤 "Cannot create AudioTrack"으로 이후 모든 음성이
// 무음이 된다(폴백도 못 탄다 — 예외가 JS로 올라오지 않음).

import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { WORD_AUDIO, EXAMPLE_AUDIO } from './audioMap.gen';
import { PlaybackGate } from './playbackGate';

export type AudioKind = 'word' | 'example';

let _player: AudioPlayer | null = null;
let _currentToken = 0;
const playbackGate = new PlaybackGate();

/** 플레이어는 재사용한다. 첫 호출에만 생성하고 이후엔 소스만 교체. */
function preparePlayer(uri: string): AudioPlayer {
  if (_player) {
    // pause() 를 부르면 안 된다. expo-audio(iOS)의 pause 는 100ms 뒤 오디오 세션을
    // setActive(false) 로 내린다. 그 판정은 timeControlStatus == .playing 인데
    // replace() 직후 play() 는 아이템 로딩 동안 .waitingToPlayAtSpecifiedRate 라
    // "재생 중 아님"으로 보여 세션이 내려가고, 막 시작된 재생이 페이드되며 끊긴다
    // (긴 예문일수록 뚜렷). replace 는 네이티브에서 이미 pause 하므로 필요도 없다.
    _player.replace(uri);
    return _player;
  }

  // keepAudioSessionActive: expo-audio(iOS)는 pause 와 재생 자연 종료 두 지점에서
  // 100ms 뒤 오디오 세션을 setActive(false) 로 내린다. expo-speech 의
  // AVSpeechSynthesizer 는 usesApplicationAudioSession 기본값 때문에 같은 세션을
  // 공유하므로, 번들 오디오 뒤에 폴백 TTS 가 나가면 그 해제에 음성이 깎여 작아진다
  // (튜토리얼 예문: 단어 번들 오디오 → 예문 expo-speech 순서에서 재현).
  const player = createAudioPlayer(uri, { keepAudioSessionActive: true });
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) playbackGate.finish(_currentToken);
  });
  _player = player;
  return player;
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

    _currentToken = request.token;
    const player = preparePlayer(uri);
    // 플레이어를 재사용하므로 이전 재생 속도가 남는다 — 매번 설정한다.
    player.shouldCorrectPitch = true; // 피치 보정으로 속도만 변경(음 높낮이 유지).
    player.setPlaybackRate(rate);
    player.play();
    return true;
  } catch (err) {
    // 더 최신 요청이 이미 시작됐다면 이 실패로 폴백 음성을 재생하지 않는다.
    if (!playbackGate.isCurrent(request.token)) return true;
    playbackGate.finish(request.token);
    console.warn('[wordAudio] play failed:', err);
    return false;
  }
}

export function stopWordAudio(): void {
  playbackGate.cancel();
  _player?.pause();
}
