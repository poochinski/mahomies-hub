// Every call to our own server lives here. Never call Sleeper from the browser.

async function get(path) {
  const res = await fetch(`/api${path}`, { headers: { accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => get('/health'),
  state: () => get('/state')
};
