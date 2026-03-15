export interface GallopConfig {
  /** ScaleMule video ID — loads video metadata from API */
  videoId?: string;
  /** ScaleMule API key for authenticated requests */
  apiKey?: string;
  /** Direct HLS source URL (alternative to videoId) */
  src?: string;
  /** Poster image URL shown before playback */
  poster?: string;
  /** Animated preview URL (WebP) — shown on hover before playback starts */
  preview?: string;
  /** Base URL for the ScaleMule API */
  apiBaseUrl?: string;
  /** Show built-in controls (default: true) */
  controls?: boolean;
  /** Autoplay on load (default: false) */
  autoplay?: boolean;
  /** Loop playback (default: false) */
  loop?: boolean;
  /** Start muted (default: false) */
  muted?: boolean;
  /** Start time in seconds */
  startTime?: number;
  /** Preferred initial quality level ('auto' or height like 720) */
  preferredQuality?: 'auto' | number;
  /** Theme overrides */
  theme?: Partial<GallopTheme>;
  /** Enable keyboard shortcuts (default: true) */
  keyboard?: boolean;
  /** Enable touch gestures (default: true) */
  touch?: boolean;
  /** Player aspect ratio (default: '16:9') */
  aspectRatio?: string;
  /** hls.js config overrides */
  hlsConfig?: Record<string, unknown>;
  /** CSP nonce applied to the injected &lt;style&gt; tag (required for strict style-src policies) */
  nonce?: string;
  /** Playback analytics and debugging telemetry settings */
  analytics?: GallopAnalyticsConfig;
  /** Enable debug mode (default: false) */
  debug?: boolean;
  /** Player mode: 'inline' (default), 'iframe', or 'auto' */
  mode?: 'inline' | 'iframe' | 'auto';
  /** Embed token for iframe mode (signed JWT) */
  embedToken?: string;
  /** Disable all analytics + local storage (default: false) */
  doNotTrack?: boolean;
  /** Host page URL — passed to context menu for "Copy link" / "Report a problem" */
  pageUrl?: string;
}

export interface GallopDiagnostics {
  version: string;
  mode: 'inline' | 'iframe';
  engineType: string;
  bitrate: number;
  bufferLength: number;
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  status: PlayerStatus;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  currentTime: number;
  duration: number;
  nonceStatus: string;
  cspStatus: string;
}

export interface GallopQueryMap {
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  status: PlayerStatus;
  isFullscreen: boolean;
  currentQuality: number;
  qualityLevels: QualityLevel[];
  diagnostics: GallopDiagnostics;
}

export interface GallopAnalyticsConfig {
  /** Enable telemetry dispatch (default: true when apiKey and videoId are available) */
  enabled?: boolean;
  /** Override video ID used for telemetry (useful when loading src directly) */
  videoId?: string;
  /** Stable session identifier used for deduplicating playback sessions */
  sessionId?: string;
  /** Queue flush interval for telemetry events */
  flushIntervalMs?: number;
  /** Maximum number of events sent per flush cycle */
  maxBatchSize?: number;
  /** Maximum number of queued events before dropping oldest entries */
  maxQueueSize?: number;
  /** Seconds between heartbeat progress events */
  progressIntervalSeconds?: number;
  /** Include navigator.connection metrics when available */
  includeNetworkInfo?: boolean;
  /** Include browser/device context metrics when available */
  includeDeviceInfo?: boolean;
  /** Track if player is in viewport using IntersectionObserver (default: true) */
  trackVisibility?: boolean;
  /** Additional metadata attached to all events */
  metadata?: Record<string, unknown>;
  /** Enable console debug logs for telemetry internals */
  debug?: boolean;
}

export interface GallopTheme {
  colorPrimary: string;
  colorSecondary: string;
  colorText: string;
  colorBackground: string;
  colorBuffered: string;
  colorProgress: string;
  controlBarBackground: string;
  controlBarHeight: string;
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  iconSize: string;
}

export interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
  active: boolean;
}

export interface VideoMetadata {
  id: string;
  title: string;
  duration: number;
  poster?: string;
  preview?: string;
  playlistUrl: string;
  qualities: QualityLevel[];
}

export type PlayerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

export interface GallopEventMap {
  play: void;
  pause: void;
  ended: void;
  timeupdate: { currentTime: number; duration: number };
  volumechange: { volume: number; muted: boolean };
  qualitychange: { level: QualityLevel };
  enginestats: { stats: GallopEngineStats };
  qualitylevels: { levels: QualityLevel[] };
  ratechange: { rate: number };
  seeked: { time: number };
  buffering: { isBuffering: boolean };
  error: { code: string; message: string };
  statuschange: { status: PlayerStatus };
  fullscreenchange: { isFullscreen: boolean };
  ready: void;
  destroy: void;
}

export interface GallopEngineStats {
  kind: 'fragment' | 'level_switch' | 'hls_error' | 'periodic';
  /** Identifies which engine produced this stat: 'hlsjs' or 'native_resource_timing' */
  statsSource?: 'hlsjs' | 'native_resource_timing';
  bandwidthEstimate?: number;
  level?: number;
  fragmentDuration?: number;
  fragmentSizeBytes?: number;
  fragmentLoadMs?: number;
  cdnNode?: string;
  cdnCacheStatus?: string;
  cdnRequestID?: string;
  droppedFrames?: number;
  totalFrames?: number;
  /** Whether Timing-Allow-Origin was present on cross-origin fragment responses (false = transferSize/bandwidth unavailable) */
  taoAvailable?: boolean;
  fatal?: boolean;
  errorType?: string;
  errorDetails?: string;
}

export type PlaybackEventType = 'play' | 'pause' | 'seek' | 'complete' | 'buffer' | 'error';

export interface TrackPlaybackPayload {
  session_id: string;
  event_type: PlaybackEventType;
  timestamp_seconds?: number;
  quality?: string;
  metadata?: Record<string, unknown>;
}

export type GallopEventCallback<T> = T extends void ? () => void : (data: T) => void;

export interface GallopPlayer {
  // --- Sync properties (cached in iframe mode, max 250ms stale) ---
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  volume: number;             // get + set
  muted: boolean;             // get + set
  playbackRate: number;       // get + set
  readonly status: PlayerStatus;
  readonly isFullscreen: boolean;

  // --- Control methods (always Promise<void>) ---
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  setQualityLevel(index: number): Promise<void>;
  setAutoQuality(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  destroy(): void;            // exception: sync + idempotent (no round-trip needed)

  // --- Query methods (sync: return cached/local values) ---
  getQualityLevels(): QualityLevel[];
  getCurrentQuality(): number;
  getDiagnostics(): GallopDiagnostics;  // sync: returns cached snapshot in iframe mode

  // --- Async exact query (for iframe precision when needed) ---
  query<K extends keyof GallopQueryMap>(key: K): Promise<GallopQueryMap[K]>;

  // --- Events ---
  on<K extends keyof GallopEventMap>(event: K, cb: GallopEventCallback<GallopEventMap[K]>): void;
  off<K extends keyof GallopEventMap>(event: K, cb: GallopEventCallback<GallopEventMap[K]>): void;
}

export interface StreamingEngine {
  load(url: string, videoElement: HTMLVideoElement): void;
  destroy(): void;
  getQualityLevels(): QualityLevel[];
  setQualityLevel(index: number): void;
  getCurrentQuality(): number;
  isAutoQuality(): boolean;
  setAutoQuality(): void;
  on<K extends string>(event: K, callback: (...args: unknown[]) => void): void;
  off<K extends string>(event: K, callback: (...args: unknown[]) => void): void;
}
