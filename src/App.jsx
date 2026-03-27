import React, { useEffect, useState } from 'react';

export default function App() {
  const [trailer, setTrailer] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/trailer.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load trailer data (${res.status})`);
        return res.json();
      })
      .then(setTrailer)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <main>
        <h1>Remember Her</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!trailer) {
    return (
      <main>
        <h1>Remember Her</h1>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Remember Her</h1>
      <p className="tagline">{trailer.tagline}</p>
      <p className="description">{trailer.description}</p>
      {trailer.scenes && trailer.scenes.length > 0 && (
        <section className="scenes">
          {trailer.scenes.map((scene) => (
            <video key={scene.id} src={scene.url} controls width="640" />
          ))}
        </section>
      )}
    </main>
  );
}
