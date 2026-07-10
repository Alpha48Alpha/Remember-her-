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
      {trailer.neuralTech && (
        <section className="neural-tech">
          <h2>{trailer.neuralTech.sectionTitle}</h2>
          <p>{trailer.neuralTech.intro}</p>
          <p>{trailer.neuralTech.experienceDescription}</p>
          {trailer.neuralTech.broaderTopics && trailer.neuralTech.broaderTopics.length > 0 && (
            <ul>
              {trailer.neuralTech.broaderTopics.map((topic, index) => (
                <li key={index}>{topic}</li>
              ))}
            </ul>
          )}
          <p className="central-question">
            <em>{trailer.neuralTech.centralQuestion}</em>
          </p>
          <blockquote className="personal-statement">
            {trailer.neuralTech.personalStatement}
          </blockquote>
        </section>
      )}
    </main>
  );
}
