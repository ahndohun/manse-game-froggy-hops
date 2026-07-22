"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createMansePlayer, type MansePlayer, type PlayerSnapshot, type ProviderKind } from "@manse/runtime-web";
import { DEFAULT_LOCALE, GAME_CONFIG, getBrowserLocale, SHOWCASE_URL, UI_COPY, type GameLocale } from "./game-config";
import { createFroggyRendererFactory } from "./game-renderer";
import { FROGGY_PROVIDER_FACTORY } from "./froggy-pointer-provider";

const PACK_URL = `/packs/${GAME_CONFIG.slug}/manse.pack.json`;
const EMPTY: Pick<PlayerSnapshot, "phase" | "provider" | "tier" | "renderer" | "cameraActive" | "targetProgress" | "caption"> = {
  phase: "idle",
  provider: "simulated",
  tier: "A",
  renderer: null,
  cameraActive: false,
  targetProgress: null,
  caption: null,
};

export function GameClient() {
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MansePlayer | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const runIdRef = useRef(0);
  const detectedBrowserLocaleRef = useRef(false);
  const [locale, setLocale] = useState<GameLocale>(DEFAULT_LOCALE);
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = UI_COPY[locale];

  const disposePlayer = useCallback(() => {
    runIdRef.current += 1;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player !== null) void player.destroy().catch(() => undefined);
  }, []);

  const resetPlayer = useCallback(() => {
    disposePlayer();
    setSnapshot(EMPTY);
    setBusy(false);
    setError(null);
  }, [disposePlayer]);

  const selectLocale = useCallback((nextLocale: GameLocale) => {
    if (nextLocale === locale) return;
    resetPlayer();
    setLocale(nextLocale);
  }, [locale, resetPlayer]);

  const boot = useCallback(async (provider: ProviderKind) => {
    const container = stageRef.current;
    if (container === null) return;
    const runId = ++runIdRef.current;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const previousPlayer = playerRef.current;
    playerRef.current = null;
    await previousPlayer?.destroy();
    if (runId !== runIdRef.current) return;

    const player = createMansePlayer({
      container,
      locale,
      provider,
      providerFactory: FROGGY_PROVIDER_FACTORY,
      rendererFactory: createFroggyRendererFactory(locale),
      captions: true,
      reducedStimulation: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onEvent: (event) => {
        if (runId !== runIdRef.current) return;
        if (event.type === "error") setError(copy.player.errorStart);
      },
    });
    playerRef.current = player;
    unsubscribeRef.current = player.subscribe((next) => {
      if (runId === runIdRef.current) setSnapshot(next);
    });
    try {
      await player.load(PACK_URL);
      await player.setup();
      await player.play();
    } catch {
      if (runId === runIdRef.current) setError(copy.player.errorStart);
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  }, [copy.player.errorStart, locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (detectedBrowserLocaleRef.current) return;
    detectedBrowserLocaleRef.current = true;
    const browserLocale = getBrowserLocale(navigator.languages.length > 0 ? navigator.languages : [navigator.language]);
    if (browserLocale !== DEFAULT_LOCALE) selectLocale(browserLocale);
  }, [selectLocale]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return disposePlayer;
  }, [disposePlayer]);

  const start = (provider: ProviderKind) => {
    setBusy(true);
    setError(null);
    void boot(provider);
  };

  const movePointer = (clientX: number, clientY: number) => {
    if (busy || snapshot.provider !== "simulated") return;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width === 0 || bounds.height === 0) return;
    try {
      playerRef.current?.setPointer((clientX - bounds.left) / bounds.width, (clientY - bounds.top) / bounds.height);
    } catch {
      // A reset or provider change can overlap one final pointer event.
    }
  };

  const progress = snapshot.targetProgress;
  const status = error !== null
    ? copy.player.status.attention
    : busy
      ? copy.player.status.starting
      : snapshot.phase === "complete"
        ? copy.player.status.complete
        : snapshot.phase === "idle"
          ? copy.player.status.choose
          : snapshot.cameraActive
            ? copy.player.status.camera
            : copy.player.status.simulator;

  return (
    <>
      <nav className="platform-shell" aria-label={copy.page.platformLabel}>
        <div className="platform-shell-inner">
          <a className="manse-wordmark" href={SHOWCASE_URL} aria-label={`${copy.page.browseGames}: MANSE`}>MANSE</a>
          <div className="platform-actions">
            <a className="browse-games" href={SHOWCASE_URL}>{copy.page.browseGames}</a>
            <div className="locale-switcher" role="group" aria-label={copy.page.languageLabel}>
              <button type="button" className={locale === "ko" ? "active" : ""} onClick={() => selectLocale("ko")} aria-pressed={locale === "ko"}>KO</button>
              <button type="button" className={locale === "en" ? "active" : ""} onClick={() => selectLocale("en")} aria-pressed={locale === "en"}>EN</button>
            </div>
          </div>
        </div>
      </nav>
      <main>
      <header className="game-hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow">{copy.page.heroEyebrow}</p>
            <h1>{GAME_CONFIG.title[locale]}</h1>
            <p className="summary">{GAME_CONFIG.summary[locale]}</p>
            <div className="privacy-line"><span aria-hidden="true" /> {copy.page.privacy}</div>
          </div>
          <figure className="hero-art">
            <img src={GAME_CONFIG.hero.src} alt={GAME_CONFIG.hero.alt[locale]} width="1600" height="900" />
          </figure>
        </div>
      </header>

      <section className="player-shell" aria-label={copy.player.label}>
        <div className="player-bar">
          <span><i className={error === null ? "status-dot" : "status-dot status-error"} aria-hidden="true" /> {status}</span>
          <span>{copy.player.mission}</span>
        </div>
        <div
          className="stage"
          ref={stageRef}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button, a")) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            movePointer(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => movePointer(event.clientX, event.clientY)}
          aria-label={copy.player.stageLabel}
        >
          {snapshot.phase === "idle" && (
            <div className="start-card">
              <p>{copy.player.startHelp}</p>
              <div className="actions">
                <button type="button" onClick={() => start("simulated")} disabled={busy}>{copy.player.playPointer}</button>
                <button className="secondary" type="button" onClick={() => start("mediapipe")} disabled={busy}>{copy.player.useCamera}</button>
              </div>
            </div>
          )}
        </div>
        <div className="player-footer" aria-live="polite">
          <span>{error ?? snapshot.caption ?? copy.player.comfort}</span>
          <strong aria-label={copy.player.progressLabel}>{progress === null ? "—" : `${progress.completed} / ${progress.total}`}</strong>
        </div>
        {snapshot.phase !== "idle" && (
          <div className="restart-row">
            <button type="button" onClick={() => start("simulated")} disabled={busy}>{copy.player.restartPointer}</button>
            <button className="text-button" type="button" onClick={() => start("mediapipe")} disabled={busy}>{copy.player.switchCamera}</button>
          </div>
        )}
      </section>

      <footer>
        <p>{copy.page.footer}</p>
        <a href={GAME_CONFIG.sourceUrl}>{copy.page.source} <span aria-hidden="true">↗</span></a>
      </footer>
      </main>
    </>
  );
}
