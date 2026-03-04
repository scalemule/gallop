import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { GallopPlayerCore } from './core/GallopPlayerCore';
import type { GallopConfig, GallopEventMap, GallopEventCallback } from './types';

export interface GallopPlayerProps extends GallopConfig {
  className?: string;
  style?: React.CSSProperties;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: GallopEventCallback<GallopEventMap['timeupdate']>;
  onVolumeChange?: GallopEventCallback<GallopEventMap['volumechange']>;
  onQualityChange?: GallopEventCallback<GallopEventMap['qualitychange']>;
  onEngineStats?: GallopEventCallback<GallopEventMap['enginestats']>;
  onError?: GallopEventCallback<GallopEventMap['error']>;
  onReady?: () => void;
  onFullscreenChange?: GallopEventCallback<GallopEventMap['fullscreenchange']>;
  onStatusChange?: GallopEventCallback<GallopEventMap['statuschange']>;
}

export interface GallopPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  toggleFullscreen: () => void;
  getCore: () => GallopPlayerCore | null;
}

export const GallopPlayer = forwardRef<GallopPlayerHandle, GallopPlayerProps>(
  function GallopPlayer(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<GallopPlayerCore | null>(null);

    const {
      className,
      style,
      onPlay,
      onPause,
      onEnded,
      onTimeUpdate,
      onVolumeChange,
      onQualityChange,
      onEngineStats,
      onError,
      onReady,
      onFullscreenChange,
      onStatusChange,
      ...config
    } = props;

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seek: (time: number) => playerRef.current?.seek(time),
      toggleFullscreen: () => playerRef.current?.toggleFullscreen(),
      getCore: () => playerRef.current,
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const player = new GallopPlayerCore(container, config);
      playerRef.current = player;

      if (onPlay) player.on('play', onPlay);
      if (onPause) player.on('pause', onPause);
      if (onEnded) player.on('ended', onEnded);
      if (onTimeUpdate) player.on('timeupdate', onTimeUpdate);
      if (onVolumeChange) player.on('volumechange', onVolumeChange);
      if (onQualityChange) player.on('qualitychange', onQualityChange);
      if (onEngineStats) player.on('enginestats', onEngineStats);
      if (onError) player.on('error', onError);
      if (onReady) player.on('ready', onReady);
      if (onFullscreenChange) player.on('fullscreenchange', onFullscreenChange);
      if (onStatusChange) player.on('statuschange', onStatusChange);

      return () => {
        player.destroy();
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.videoId, props.src, props.apiKey]);

    return <div ref={containerRef} className={className} style={style} />;
  },
);

export function useGallopPlayer(config: GallopConfig) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<GallopPlayerCore | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = new GallopPlayerCore(container, config);
    playerRef.current = player;

    return () => {
      player.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.videoId, config.src, config.apiKey]);

  const getPlayer = useCallback(() => playerRef.current, []);

  return { containerRef, getPlayer };
}

export type { GallopConfig, GallopEventMap, GallopPlayerCore };
