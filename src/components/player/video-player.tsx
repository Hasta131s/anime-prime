import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/watch-progress";
import { isHlsUrl, type SourceKind } from "@/convex/sourceView";
import Hls from "hls.js";
import {
  AlertTriangle,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Quality = { index: number; height?: number; bitrate: number };

type PlayerStatus = "loading" | "ready" | "error";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CONTROLS_HIDE_DELAY = 2600;
const PROGRESS_SAVE_INTERVAL = 5000;

/**
 * HLS + MP4 player.
 *
 * HLS is played through hls.js wherever Media Source Extensions are available
 * and falls back to the browser's native implementation (Safari / iOS) for the
 * same `.m3u8` URL. Everything else is handed to the `<video>` element, so an
 * `.mp4` source just works.
 */
export function VideoPlayer({
  url,
  kind = "auto",
  title,
  subtitle,
  poster,
  startAt = 0,
  onProgress,
  onEnded,
  className,
}: {
  url: string;
  kind?: SourceKind;
  title: string;
  subtitle?: string;
  poster?: string;
  /** Resume position in seconds, applied once metadata is available. */
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hoveredRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  // Captured per source so changing it never re-attaches the stream.
  const startAtRef = useRef(startAt);
  startAtRef.current = startAt;

  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;

  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [activeQuality, setActiveQuality] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  // ------------------------------------------------------------ source setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setStatus("loading");
    setErrorMessage(undefined);
    setQualities([]);
    setActiveQuality(-1);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
    resumeAppliedRef.current = false;
    lastSavedRef.current = 0;

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    const useHlsJs = isHlsUrl(url, kind) && !nativeHls;

    const applyResume = () => {
      if (resumeAppliedRef.current) return;
      resumeAppliedRef.current = true;
      const start = startAtRef.current;
      if (start > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(start, Math.max(0, video.duration - 1));
      }
    };

    if (useHlsJs) {
      if (!Hls.isSupported()) {
        setStatus("error");
        setErrorMessage(
          "Bu tarayıcı HLS akışlarını oynatamıyor. MP4 kaynağı ekleyebilirsin.",
        );
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setQualities(
          data.levels.map((level, index) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
          })),
        );
        setStatus("ready");
        applyResume();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setActiveQuality(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        // Recoverable failures: retry before giving up on the stream.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        setStatus("error");
        setErrorMessage(`Akış oynatılamadı (${data.details}).`);
        hls.destroy();
        hlsRef.current = null;
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Progressive file, or native HLS on Safari / iOS.
    video.src = url;
    const handleLoadedMetadata = () => {
      setStatus("ready");
      applyResume();
    };
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeAttribute("src");
      video.load();
    };
  }, [url, kind, reloadToken]);

  // ---------------------------------------------------------- media listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (video.currentTime - lastSavedRef.current < PROGRESS_SAVE_INTERVAL / 1000) {
        return;
      }
      lastSavedRef.current = video.currentTime;
      onProgressRef.current?.(video.currentTime, duration);
    };
    const handleDurationChange = () =>
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setStatus("ready");
    };
    const handleVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const handleRate = () => setRate(video.playbackRate);
    const handleEnded = () => {
      setIsPlaying(false);
      if (Number.isFinite(video.duration)) {
        onProgressRef.current?.(video.currentTime, video.duration);
      }
      onEndedRef.current?.();
    };
    const handleError = () => {
      setStatus("error");
      setErrorMessage(
        "Video yüklenemedi. Kaynak adresi erişilebilir mi ve CORS izni var mı?",
      );
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("volumechange", handleVolume);
    video.addEventListener("ratechange", handleRate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("volumechange", handleVolume);
      video.removeEventListener("ratechange", handleRate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [url]);

  // ------------------------------------------------------------- fullscreen
  useEffect(() => {
    const handleChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || status === "error") return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [status]);

  const toggleFullscreen = useCallback(async () => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper || !video) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (typeof wrapper.requestFullscreen === "function") {
      await wrapper.requestFullscreen().catch(() => undefined);
      return;
    }
    // iOS Safari only supports fullscreen on the video element itself.
    const legacy = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    legacy.webkitEnterFullscreen?.();
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY);
  }, []);

  // Keyboard shortcuts, scoped to the player so page scrolling stays intact.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const wrapper = wrapperRef.current;
      const video = videoRef.current;
      if (!wrapper || !video) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!hoveredRef.current && !wrapper.contains(document.activeElement)) return;

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          revealControls();
          break;
        case "ArrowRight":
          event.preventDefault();
          video.currentTime = Math.min(
            video.duration || 0,
            video.currentTime + 10,
          );
          revealControls();
          break;
        case "ArrowUp":
          event.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          event.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "m":
        case "M":
          video.muted = !video.muted;
          break;
        case "f":
        case "F":
          void toggleFullscreen();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleFullscreen, revealControls]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const selectQuality = (value: number) => {
    setActiveQuality(value);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = value;
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || typeof video.requestPictureInPicture !== "function") return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Picture-in-picture is optional.
    }
  };

  const buffered = videoRef.current?.buffered;
  const bufferedEnd =
    buffered && buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;
  const watchedPercent =
    duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const playedPercent =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/8 bg-black outline-none",
        className,
      )}
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        revealControls();
      }}
      onMouseMove={revealControls}
      tabIndex={0}
      aria-label={`${title} oynatıcı`}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="metadata"
        controls={false}
        className="size-full bg-black"
        onClick={togglePlay}
      />

      {/* Buffered + progress bars, drawn above the video for a precise look. */}
      {status !== "error" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1">
          <div
            className="absolute inset-y-0 left-0 bg-white/20"
            style={{ width: `${watchedPercent}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-brand"
            style={{ width: `${playedPercent}%` }}
          />
        </div>
      ) : null}

      {isBuffering && status !== "error" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-9 animate-spin text-white/80" />
        </div>
      ) : null}

      {status === "loading" && !isBuffering ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45">
          <Loader2 className="size-8 animate-spin text-white/80" />
          <p className="text-xs text-white/70">Kaynak hazırlanıyor…</p>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
          <AlertTriangle className="size-8 text-amber-300" />
          <p className="font-display text-sm font-bold text-white">
            Bu kaynak oynatılamadı
          </p>
          <p className="max-w-md text-xs leading-relaxed text-white/70">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >
            <RotateCcw className="size-3.5" />
            Yeniden dene
          </button>
        </div>
      ) : null}

      {status === "ready" && !isPlaying ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Oynat"
          className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors hover:bg-black/25"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-brand text-white shadow-2xl shadow-black/50 transition-transform hover:scale-105">
            <Play className="size-7 translate-x-0.5 fill-current" />
          </span>
        </button>
      ) : null}

      {/* ------------------------------------------------------------ controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/60 to-transparent px-3 pt-8 pb-3 transition-opacity duration-300 sm:px-4",
          controlsVisible || !isPlaying
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Oynatma konumu"
            className="h-1.5 w-full accent-brand"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Duraklat" : "Oynat"}
            className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            {isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>

          <div className="group/volume flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (video) video.muted = !video.muted;
              }}
              aria-label={muted ? "Sesi aç" : "Sesi kapat"}
              className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.volume = Number(event.target.value);
                video.muted = Number(event.target.value) === 0;
              }}
              aria-label="Ses seviyesi"
              className="hidden h-1 w-20 accent-brand sm:block"
            />
          </div>

          <span className="ml-1 text-[11px] font-medium text-white/85 tabular-nums sm:text-xs">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {qualities.length > 1 ? (
              <select
                value={activeQuality}
                onChange={(event) => selectQuality(Number(event.target.value))}
                aria-label="Kalite"
                className="h-8 rounded-md border border-white/15 bg-black/50 px-2 text-[11px] font-medium text-white outline-none sm:text-xs"
              >
                <option value={-1}>Otomatik</option>
                {qualities.map((quality) => (
                  <option key={quality.index} value={quality.index}>
                    {quality.height ? `${quality.height}p` : `${Math.round(quality.bitrate / 1000)} kbps`}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              value={rate}
              onChange={(event) => {
                const video = videoRef.current;
                const value = Number(event.target.value);
                if (video) video.playbackRate = value;
                setRate(value);
              }}
              aria-label="Oynatma hızı"
              className="h-8 rounded-md border border-white/15 bg-black/50 px-2 text-[11px] font-medium text-white outline-none sm:text-xs"
            >
              {PLAYBACK_RATES.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>

            {typeof document !== "undefined" && "pictureInPictureEnabled" in document ? (
              <button
                type="button"
                onClick={() => void togglePictureInPicture()}
                aria-label="Küçük pencere (PiP)"
                className="hidden size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 sm:flex"
              >
                <PictureInPicture2 className="size-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </button>
          </div>
        </div>

        {subtitle ? (
          <p className="mt-1.5 truncate text-[11px] text-white/60">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
