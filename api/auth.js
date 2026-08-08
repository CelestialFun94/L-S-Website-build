const { clearSession, json, method, session, setSession, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'DELETE'])) return;
  try {
    if (req.method === 'GET') {
      const current = await session(req, res);
      return current ? json(res, 200, { user: { email: current.user.email }, profile: current.profile }) : json(res, 401, { error: 'Not signed in.' });
    }
    if (req.method === 'DELETE') {
      const current = await session(req, res);
      if (current) await supabase('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${current.access}` } });
      clearSession(res);
      return json(res, 200, { ok: true });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json(res, 400, { error: 'Enter a valid email and password.' });
    const response = await supabase('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    const body = await response.json();
    if (!response.ok) return json(res, 401, { error: 'The email or password was not accepted.' });
    setSession(res, body);
    const current = await session({ headers: { cookie: `ls_access=${encodeURIComponent(body.access_token)}; ls_refresh=${encodeURIComponent(body.refresh_token)}` } }, res);
    if (!current) {
      clearSession(res);
      return json(res, 403, { error: 'This account does not have workspace access.' });
    }
    return json(res, 200, { user: { email: current.user.email }, profile: current.profile });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Authentication failed.' });
  }
};
