import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const FALLBACK_SCENES = [
  {
    id: 'memory-1',
    eyebrow: 'Remember Her',
    title: 'A name whispered back into the dark.',
    text: 'A quiet story about love, memory, and the pieces that refuse to disappear.',
    palette: ['#170b24', '#3d1f68'],
  },
  {
    id: 'memory-2',
    eyebrow: 'Scene One',
    title: 'Moments return in flashes.',
    text: 'Streetlights, late-night calls, and the feeling that someone still lingers nearby.',
    palette: ['#091b2a', '#22577a'],
  },
  {
    id: 'memory-3',
    eyebrow: 'Scene Two',
    title: 'Every frame holds a promise.',
    text: 'Hold on to what mattered, press play, and let the story unfold.',
    palette: ['#29110a', '#8c3d1f'],
  },
];

const FALLBACK_SCENE_DURATION_MS = 2800;

export default function App() {
  const [trailer, setTrailer] = useState(null);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  useEffect(() => {
    fetch('/trailer.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load trailer data (${res.status})`);
        return res.json();
      })
      .then(setTrailer)
      .catch((err) => setError(err.message));
  }, []);

  const hasVideoScenes = Boolean(trailer?.scenes?.length);
  const currentFallbackScene = useMemo(
    () => FALLBACK_SCENES[currentSceneIndex] ?? FALLBACK_SCENES[0],
    [currentSceneIndex]
  );

  useEffect(() => {
    if (!isPlaying || hasVideoScenes) return undefined;

    if (currentSceneIndex >= FALLBACK_SCENES.length - 1) {
      const stopTimer = window.setTimeout(() => setIsPlaying(false), FALLBACK_SCENE_DURATION_MS);
      return () => window.clearTimeout(stopTimer);
    }

    const timer = window.setTimeout(() => {
      setCurrentSceneIndex((index) => index + 1);
    }, FALLBACK_SCENE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [currentSceneIndex, hasVideoScenes, isPlaying]);

  const handlePlay = () => {
    setCurrentSceneIndex(0);
    setIsPlaying(true);
  };

  if (error) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <h1>Remember Her</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!trailer) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <h1>Remember Her</h1>
          <p>Loading…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Now Playing</p>
        <h1>Remember Her</h1>
        <p className="tagline">{trailer.tagline}</p>
        <p className="description">{trailer.description}</p>

        {hasVideoScenes ? (
          <section className="video-grid" aria-label="Trailer scenes">
            {trailer.scenes.map((scene, index) => (
              <article key={scene.id ?? scene.url ?? index} className="video-card">
                <video
                  src={scene.url}
                  controls
                  preload="metadata"
                  playsInline
                  className="video-player"
                  aria-label={scene.title ?? `Trailer scene ${index + 1}`}
                />
                {scene.title && <p className="video-title">{scene.title}</p>}
              </article>
            ))}
          </section>
        ) : (
          <section className="fallback-player" aria-label="Playable trailer preview">
            <div
              className={`fallback-stage ${isPlaying ? 'is-playing' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${currentFallbackScene.palette[0]}, ${currentFallbackScene.palette[1]})`,
              }}
            >
              <p className="scene-eyebrow">{currentFallbackScene.eyebrow}</p>
              <h2>{currentFallbackScene.title}</h2>
              <p>{currentFallbackScene.text}</p>
            </div>

            <div className="player-controls">
              <button type="button" className="play-button" onClick={handlePlay}>
                {isPlaying ? 'Replay' : 'Play'}
              </button>
              <div className="scene-progress" aria-hidden="true">
                {FALLBACK_SCENES.map((scene, index) => (
                  <span
                    key={scene.id}
                    className={index === currentSceneIndex ? 'is-active' : ''}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
