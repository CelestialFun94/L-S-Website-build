const COOKIE_ACCESS = 'ls_access';
const COOKIE_REFRESH = 'ls_refresh';

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const index = v.indexOf('=');
    return [decodeURIComponent(v.slice(0, index)), decodeURIComponent(v.slice(index + 1))];
  }));
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function setSession(res, session) {
  res.setHeader('Set-Cookie', [
    cookie(COOKIE_ACCESS, session.access_token, Math.max(60, session.expires_in || 3600)),
    cookie(COOKIE_REFRESH, session.refresh_token, 60 * 60 * 24 * 30),
  ]);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', [cookie(COOKIE_ACCESS, '', 0), cookie(COOKIE_REFRESH, '', 0)]);
}

async function supabase(path, options = {}) {
  const { url, key } = env();
  const headers = { apikey: key, 'Content-Type': 'application/json', ...options.headers };
  if (!headers.Authorization) headers.Authorization = `Bearer ${key}`;
  return fetch(`${url}${path}`, { ...options, headers });
}

async function session(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  let access = cookies[COOKIE_ACCESS];
  let userResponse = access ? await supabase('/auth/v1/user', { headers: { Authorization: `Bearer ${access}` } }) : null;

  if ((!userResponse || !userResponse.ok) && cookies[COOKIE_REFRESH]) {
    const refreshResponse = await supabase('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: cookies[COOKIE_REFRESH] }),
    });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json();
      access = refreshed.access_token;
      setSession(res, refreshed);
      userResponse = await supabase('/auth/v1/user', { headers: { Authorization: `Bearer ${access}` } });
    }
  }

  if (!userResponse?.ok) return null;
  const user = await userResponse.json();
  const profileResponse = await supabase(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=user_id,display_name,role`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  return profiles[0] ? { access, user, profile: profiles[0] } : null;
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

function method(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    json(res, 405, { error: 'Method not allowed.' });
    return false;
  }
  return true;
}

module.exports = { clearSession, json, method, session, setSession, supabase };
