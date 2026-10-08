import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Home() {
  const [state, setState] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.state().then(setState).catch((e) => setError(e.message));
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  const league = state?.league;
  const seasons = state?.seasons ?? [];
  const first = seasons.at(-1)?.season;

  return (
    <section className="page">
      <div className="hero">
        <div className="eyebrow">
          {league ? `${league.season} SEASON · WEEK ${state.nfl.week}` : 'LOADING LEAGUE…'}
        </div>
        <h1>{league?.name ?? "Rollin' with Mahomies"}</h1>
        <p className="hero-copy">League HQ is under construction. History, records and the Banana Book are on the way.</p>

        {error && <div className="error-banner">Couldn't load league data: {error}</div>}

        <div className="tile-grid">
          <div className="tile tile-yellow">
            <small>SEASONS ON SLEEPER</small>
            <strong className="num">{seasons.length || '–'}</strong>
            <span>{first ? `${first} – ${league.season}` : '…'}</span>
          </div>
          <div className="tile tile-blue">
            <small>TEAMS</small>
            <strong className="num">{league?.teams ?? '–'}</strong>
            <span>{league?.scoring ?? '…'}</span>
          </div>
          <div className="tile tile-green">
            <small>PLAYOFFS</small>
            <strong className="num">{league ? `Wk ${league.playoff_week_start}` : '–'}</strong>
            <span>{league ? `${league.playoff_teams} teams make it` : '…'}</span>
          </div>
          <div className="tile tile-gray">
            <small>LAST SCORED</small>
            <strong className="num">{state?.nfl.last_scored_week ? `Wk ${state.nfl.last_scored_week}` : '–'}</strong>
            <span>Sleeper final scores</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-kicker">LEAGUE HISTORY</div>
        <h2>Every season we found</h2>
        <ul className="season-list">
          {seasons.map((s) => (
            <li key={s.league_id}>
              <span className="season-year num">{s.season}</span>
              <span className="season-name">{s.name}</span>
              <span className={`status-pill ${s.status === 'complete' ? 'done' : 'live'}`}>
                {s.status === 'complete' ? 'Complete' : 'In season'}
              </span>
            </li>
          ))}
          {!seasons.length && !error && <li className="muted">Loading…</li>}
        </ul>
      </div>

      <div className="panel status-panel">
        <div>
          <div className="panel-kicker">SYSTEM CHECK</div>
          <h2>Under the hood</h2>
        </div>
        <ul className="checks">
          <li className={state ? 'ok' : error ? 'bad' : ''}>Sleeper connection</li>
          <li className={health?.ok ? 'ok' : health ? 'bad' : ''}>Server</li>
          <li className={health?.db?.connected ? 'ok' : health ? 'bad' : ''}>
            Database{health && !health.db?.connected ? ` (${health.db?.reason ?? 'offline'})` : ''}
          </li>
        </ul>
      </div>
    </section>
  );
}
