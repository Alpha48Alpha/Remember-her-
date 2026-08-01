import React, { useEffect, useMemo, useRef, useState } from 'react';
import heroImage from '../impact-machine-runway/hero.jpg';
import scene1Image from '../impact-machine-runway/scene-1.jpg';
import scene2Image from '../impact-machine-runway/scene-2.jpg';
import scene3Image from '../impact-machine-runway/scene-3.jpg';
import scene4Image from '../impact-machine-runway/scene-4.jpg';
import './App.css';

const FALLBACK_SCENES = [
  {
    id: 'memory-1',
    label: 'Featured',
    title: 'Remember Her',
    hook: 'A story that glows long after the credits fade.',
    overview:
      'A cinematic memory piece about love, distance, and the echoes people leave behind when the room goes quiet.',
    detail:
      'When the city sleeps, every remembered promise returns brighter than before. Press play and let each moment surface.',
    runtime: '1h 48m',
    year: '2026',
    maturity: '13+',
    genre: 'Romantic Drama',
    accent: '#e50914',
    palette: ['#05070d', '#28112e', '#6c2042'],
    poster: heroImage,
  },
  {
    id: 'memory-2',
    label: 'Chapter 1',
    title: 'Streetlights & Static',
    hook: 'Every call feels like it happened five minutes ago.',
    overview:
      'Late-night streets, soft neon reflections, and a voice still alive inside unfinished conversations.',
    detail:
      'The first chapter drifts through the electric calm of a city that keeps replaying what mattered most.',
    runtime: '48m',
    year: '2026',
    maturity: '13+',
    genre: 'Emotional Mystery',
    accent: '#46d5ff',
    palette: ['#07111e', '#10304b', '#245c85'],
    poster: scene2Image,
  },
  {
    id: 'memory-3',
    label: 'Chapter 2',
    title: 'Afterimage',
    hook: 'Some moments stay sharp no matter how far away they move.',
    overview:
      'A warm, intimate turn where grief and hope start sounding like the same heartbeat.',
    detail:
      'The frame softens, the colors deepen, and the story leans into the impossible wish of one more minute.',
    runtime: '52m',
    year: '2026',
    maturity: '13+',
    genre: 'Character Drama',
    accent: '#ffb14a',
    palette: ['#1a0b07', '#4c1d13', '#9d5622'],
    poster: scene3Image,
  },
  {
    id: 'memory-4',
    label: 'Finale',
    title: 'The Last Light Left On',
    hook: 'Not everything disappears when it ends.',
    overview:
      'The closing movement pulls every remembered thread together into a final, luminous release.',
    detail:
      'A final room, a final glance, and a quiet certainty that love outlives the silence around it.',
    runtime: '58m',
    year: '2026',
    maturity: '13+',
    genre: 'Prestige Romance',
    accent: '#b68cff',
    palette: ['#0b0613', '#25143b', '#55327b'],
    poster: scene4Image,
  },
];

const FALLBACK_SCENE_DURATION_MS = 3000;

export default function App() {
  const [trailer, setTrailer] = useState(null);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const featuredVideoRef = useRef(null);

  useEffect(() => {
    fetch('/trailer.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load trailer data (${res.status})`);
        return res.json();
      })
      .then(setTrailer)
      .catch((err) => setError(err.message));
  }, []);

  const videoScenes = useMemo(
    () =>
      (trailer?.scenes ?? []).map((scene, index) => {
        const fallbackMeta = FALLBACK_SCENES[index % FALLBACK_SCENES.length];
        return {
          id: scene.id ?? `scene-${index + 1}`,
          url: scene.url,
          title: scene.title ?? fallbackMeta.title,
          hook: scene.tagline ?? trailer?.tagline ?? fallbackMeta.hook,
          overview: scene.description ?? trailer?.description ?? fallbackMeta.overview,
          detail: scene.description ?? fallbackMeta.detail,
          runtime: scene.runtime ?? fallbackMeta.runtime,
          year: scene.year ?? fallbackMeta.year,
          maturity: scene.maturity ?? fallbackMeta.maturity,
          genre: scene.genre ?? fallbackMeta.genre,
          accent: fallbackMeta.accent,
          palette: fallbackMeta.palette,
          poster: fallbackMeta.poster,
          label: scene.label ?? `Scene ${index + 1}`,
        };
      }),
    [trailer]
  );

  const hasVideoScenes = videoScenes.length > 0;
  const activeScenes = hasVideoScenes ? videoScenes : FALLBACK_SCENES;
  const activeScene = activeScenes[currentSceneIndex] ?? activeScenes[0];

  useEffect(() => {
    setCurrentSceneIndex(0);
    setIsPlaying(false);
  }, [hasVideoScenes]);

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

  const handlePlay = async () => {
    if (hasVideoScenes) {
      try {
        await featuredVideoRef.current?.play();
      } catch {
        featuredVideoRef.current?.focus();
      }
      return;
    }

    setCurrentSceneIndex(0);
    setIsPlaying(true);
  };

  const handleSelectScene = (index) => {
    setCurrentSceneIndex(index);
    setIsPlaying(false);
  };

  const handleSecondaryAction = () => {
    if (hasVideoScenes) {
      setCurrentSceneIndex((index) => (index + 1) % activeScenes.length);
      return;
    }

    setIsPlaying((value) => !value);
  };

  const recommendations = activeScenes.map((scene, index) => ({
    id: `${scene.id}-recommendation`,
    title: scene.title,
    subtitle: scene.genre,
    description: scene.hook ?? scene.overview,
    accent: scene.accent,
    index,
  }));

  const spotlightFacts = [
    trailer?.generatedAt ? `Generated ${new Date(trailer.generatedAt).getFullYear()}` : activeScene.year,
    activeScene.genre,
    hasVideoScenes ? `${videoScenes.length} video scene${videoScenes.length > 1 ? 's' : ''}` : 'Interactive preview',
  ];

  if (error) {
    return (
      <main className="app-shell">
        <section className="hero-panel">
          <p className="brand">REMEMBER HER</p>
          <h1>Unable to load the story</h1>
          <p className="hero-copy">{error}</p>
        </section>
      </main>
    );
  }

  if (!trailer) {
    return (
      <main className="app-shell">
        <section className="hero-panel">
          <p className="brand">REMEMBER HER</p>
          <h1>Loading your feature presentation…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div>
            <p className="brand">REMEMBER HER</p>
            <p className="subbrand">A premium memory-streaming experience</p>
          </div>
          <div className="topbar-meta">
            <span>Home</span>
            <span>Series</span>
            <span>My List</span>
          </div>
        </header>

        <section
          className="hero-panel"
          style={{
            backgroundImage: `linear-gradient(120deg, ${activeScene.palette[0]}ee 8%, ${activeScene.palette[1]}d9 55%, ${activeScene.palette[2]}d0 100%), url(${activeScene.poster ?? heroImage})`,
          }}
        >
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="collection-label">{activeScene.label}</p>
            <h1>{activeScene.title}</h1>
            <p className="hero-hook">{trailer.tagline ?? activeScene.hook}</p>
            <div className="hero-tags" aria-label="Title metadata">
              <span>{activeScene.year}</span>
              <span>{activeScene.maturity}</span>
              <span>{activeScene.runtime}</span>
              <span>{activeScene.genre}</span>
            </div>
            <p className="hero-copy">{activeScene.overview}</p>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={handlePlay}>
                ▶ Play
              </button>
              <button type="button" className="secondary-button" onClick={handleSecondaryAction}>
                {hasVideoScenes ? 'Next Scene' : isPlaying ? 'Pause Preview' : 'More Vibe'}
              </button>
            </div>
            <div className="spotlight-row">
              {spotlightFacts.map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </div>
          </div>

          <aside className="hero-preview">
            {hasVideoScenes ? (
              <div className="featured-player-card">
                <video
                  ref={featuredVideoRef}
                  src={activeScene.url}
                  controls
                  preload="metadata"
                  playsInline
                  className="featured-video"
                  aria-label={activeScene.title}
                />
                <p>{activeScene.detail}</p>
              </div>
            ) : (
              <div
                className={`fallback-stage ${isPlaying ? 'is-playing' : ''}`}
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(5, 5, 5, 0.08), rgba(5, 5, 5, 0.78)), url(${activeScene.poster})`,
                }}
              >
                <div className="preview-shine" />
                <p className="preview-kicker">Featured Preview</p>
                <h2>{activeScene.hook}</h2>
                <p>{activeScene.detail}</p>
                <div className="scene-progress" aria-hidden="true">
                  {FALLBACK_SCENES.map((scene, index) => (
                    <span key={scene.id} className={index === currentSceneIndex ? 'is-active' : ''} />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <h2>Continue Watching</h2>
            <p>Pick a moment and jump right back into the feeling.</p>
          </div>
          <div className="card-rail">
            {recommendations.map((scene) => (
              <button
                type="button"
                key={scene.id}
                className={`media-card ${scene.index === currentSceneIndex ? 'is-selected' : ''}`}
                onClick={() => handleSelectScene(scene.index)}
                style={{
                  '--accent-color': scene.accent,
                  backgroundImage: `linear-gradient(180deg, rgba(5, 5, 5, 0.08), rgba(5, 5, 5, 0.9)), url(${activeScenes[scene.index].poster ?? scene1Image})`,
                }}
              >
                <span className="media-card-label">{scene.subtitle}</span>
                <strong>{scene.title}</strong>
                <p>{scene.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="details-grid">
          <article className="detail-card">
            <p className="detail-label">Synopsis</p>
            <h3>An emotional premium original</h3>
            <p>{trailer.description ?? activeScene.overview}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Why it works</p>
            <h3>Cinematic, intimate, replayable</h3>
            <ul>
              <li>Hero-first layout with instant play access</li>
              <li>Streaming-style metadata, sections, and selection rail</li>
              <li>Graceful fallback when no generated video assets exist</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
