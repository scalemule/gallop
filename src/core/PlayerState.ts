import type { PlayerStatus } from '../types';

const VALID_TRANSITIONS: Record<PlayerStatus, PlayerStatus[]> = {
  idle: ['loading'],
  loading: ['ready', 'error'],
  ready: ['playing', 'paused', 'error'],
  playing: ['paused', 'buffering', 'ended', 'error', 'loading'],
  paused: ['playing', 'buffering', 'ended', 'error', 'loading'],
  buffering: ['playing', 'paused', 'error', 'ended'],
  ended: ['playing', 'loading', 'idle'],
  error: ['loading', 'idle'],
};

export class PlayerState {
  private _status: PlayerStatus = 'idle';
  private onChange?: (status: PlayerStatus, prev: PlayerStatus) => void;

  constructor(onChange?: (status: PlayerStatus, prev: PlayerStatus) => void) {
    this.onChange = onChange;
  }

  get status(): PlayerStatus {
    return this._status;
  }

  transition(next: PlayerStatus): boolean {
    if (next === this._status) return false;
    const allowed = VALID_TRANSITIONS[this._status];
    if (!allowed.includes(next)) {
      return false;
    }
    const prev = this._status;
    this._status = next;
    this.onChange?.(next, prev);
    return true;
  }

  reset(): void {
    const prev = this._status;
    this._status = 'idle';
    if (prev !== 'idle') {
      this.onChange?.('idle', prev);
    }
  }

  get isPlaying(): boolean {
    return this._status === 'playing';
  }

  get isPaused(): boolean {
    return this._status === 'paused';
  }

  get isBuffering(): boolean {
    return this._status === 'buffering';
  }

  get isEnded(): boolean {
    return this._status === 'ended';
  }
}
