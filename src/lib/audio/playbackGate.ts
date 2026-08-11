export interface PlaybackRequest {
  accepted: boolean;
  token: number;
}

/**
 * 하나의 오디오 채널에서 최신 요청만 유효하게 유지한다.
 * 같은 키를 연속 요청하면 현재 로딩/재생을 유지하고 새 요청은 거부한다.
 */
export class PlaybackGate {
  private token = 0;
  private activeKey: string | null = null;

  begin(key: string): PlaybackRequest {
    if (this.activeKey === key) {
      return { accepted: false, token: this.token };
    }

    this.token += 1;
    this.activeKey = key;
    return { accepted: true, token: this.token };
  }

  isCurrent(token: number): boolean {
    return this.token === token && this.activeKey !== null;
  }

  finish(token: number): void {
    if (this.isCurrent(token)) this.activeKey = null;
  }

  cancel(): void {
    this.token += 1;
    this.activeKey = null;
  }
}
