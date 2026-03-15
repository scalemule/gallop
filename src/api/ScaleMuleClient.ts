import type { TrackPlaybackPayload, VideoMetadata } from '../types';
import { DEFAULT_CONFIG } from '../constants';

export interface ScaleMuleClientOptions {
  apiKey?: string;
  embedToken?: string;
  baseUrl?: string;
}

export class ScaleMuleClient {
  private baseUrl: string;
  private apiKey?: string;
  private embedToken?: string;

  constructor(options: ScaleMuleClientOptions);
  /** @deprecated Use options object instead */
  constructor(apiKey: string, baseUrl?: string);
  constructor(optionsOrKey: ScaleMuleClientOptions | string, baseUrl?: string) {
    if (typeof optionsOrKey === 'string') {
      // Legacy: new ScaleMuleClient(apiKey, baseUrl)
      this.apiKey = optionsOrKey;
      this.baseUrl = (baseUrl ?? DEFAULT_CONFIG.apiBaseUrl).replace(/\/$/, '');
    } else {
      this.apiKey = optionsOrKey.apiKey;
      this.embedToken = optionsOrKey.embedToken;
      this.baseUrl = (optionsOrKey.baseUrl ?? DEFAULT_CONFIG.apiBaseUrl).replace(/\/$/, '');
    }
  }

  private buildUrl(path: string): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (this.embedToken) {
      url.searchParams.set('token', this.embedToken);
    }
    return url.toString();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  async getVideoMetadata(videoId: string): Promise<VideoMetadata> {
    const path = this.embedToken
      ? `/v1/videos/embed/${videoId}/metadata`
      : `/v1/videos/${videoId}`;
    const response = await fetch(this.buildUrl(path), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to load video ${videoId}: ${response.status} ${text}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      title: data.title ?? '',
      duration: data.duration ?? 0,
      poster: data.poster_url ?? data.thumbnail_url,
      preview: data.preview_url,
      playlistUrl: data.playlist_url,
      qualities: (data.qualities ?? []).map((q: Record<string, unknown>, i: number) => ({
        index: i,
        height: q.height as number,
        width: q.width as number,
        bitrate: q.bitrate as number,
        label: `${q.height}p`,
        active: false,
      })),
    };
  }

  async trackPlayback(
    videoId: string,
    payload: TrackPlaybackPayload,
    options?: { keepalive?: boolean },
  ): Promise<void> {
    const path = this.embedToken
      ? `/v1/videos/embed/${videoId}/track`
      : `/v1/videos/${videoId}/track`;
    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: options?.keepalive ?? false,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to track playback for ${videoId}: ${response.status} ${text}`);
    }
  }
}
