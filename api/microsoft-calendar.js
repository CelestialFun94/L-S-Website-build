const { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { adminSupabase, json, method, session, supabase } = require('./_lib');

const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Calendars.ReadWrite', 'Mail.Send'];
const WRITERS = new Set(['owner', 'admin', 'operations']);
const PROVIDER = 'microsoft';
const OAUTH_COOKIE = 'ls_ms_oauth';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanBody(value, max = 10000) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function hasScope(record, scope) {
  return (record?.scopes || []).some(value => String(value).toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//i, '') === scope.toLowerCase());
}

function configuration() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'organizations';
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://loveandsunshinenash.com/api/microsoft-calendar?action=callback';
  const encodedKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const key = encodedKey ? Buffer.from(encodedKey, 'base64') : null;
  if (!clientId || !clientSecret || !key || key.length !== 32) {
    throw new Error('The Microsoft work account is not configured yet.');
  }
  return { clientId, clientSecret, tenant, redirectUri, key };
}

function seal(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function unseal(value, key) {
  const [iv, tag, encrypted] = String(value || '').split('.');
  if (!iv || !tag || !encrypted) throw new Error('Encrypted integration data is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function cookies(header = '') {
  return Object.fromEntries(header.split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return [decodeURIComponent(value.slice(0, index)), decodeURIComponent(value.slice(index + 1))];
  }));
}

function oauthCookie(value, maxAge = 600) {
  return `${OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/api/microsoft-calendar; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function body(response, fallback) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || data?.error_description || data?.message || fallback);
  return data;
}

async function admin(path, options = {}) {
  return body(await adminSupabase(path, options), 'Unable to update the Microsoft connection.');
}

async function connection(userId) {
  const rows = await admin(`/rest/v1/oauth_connections?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=*&limit=1`);
  return rows[0] || null;
}

async function storeConnection(userId, token, profile, calendar, config) {
  const email = profile.mail || profile.userPrincipalName;
  const record = {
    user_id: userId,
    provider: PROVIDER,
    account_email: email,
    tenant_id: token.id_token ? parseJwt(token.id_token).tid || null : null,
    access_token_encrypted: seal(token.access_token, config.key),
    refresh_token_encrypted: seal(token.refresh_token, config.key),
    token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
    scopes: String(token.scope || SCOPES.join(' ')).split(/\s+/).filter(Boolean),
    calendar_id: calendar.id,
    calendar_name: calendar.name,
    status: 'connected',
    last_error: null,
  };
  await admin('/rest/v1/oauth_connections?on_conflict=user_id,provider', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(record),
  });
  await admin('/rest/v1/integration_connections?provider=eq.microsoft_calendar', {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'connected', account_label: email, last_checked_at: new Date().toISOString(), notes: `Primary calendar: ${calendar.name}; Outlook email enabled` }),
  });
}

function parseJwt(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')); }
  catch { return {}; }
}

async function tokenRequest(config, values) {
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, scope: SCOPES.join(' '), ...values }),
  });
  return body(response, 'Microsoft did not issue account access.');
}

async function graph(path, accessToken, options = {}) {
  return body(await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  }), 'Microsoft Graph request failed.');
}

async function accessTokenFor(record, config) {
  if (new Date(record.token_expires_at).getTime() > Date.now() + 5 * 60 * 1000) return unseal(record.access_token_encrypted, config.key);
  try {
    const refreshed = await tokenRequest(config, {
      grant_type: 'refresh_token',
      refresh_token: unseal(record.refresh_token_encrypted, config.key),
    });
    const accessToken = refreshed.access_token;
    const refreshToken = refreshed.refresh_token || unseal(record.refresh_token_encrypted, config.key);
    await admin(`/rest/v1/oauth_connections?id=eq.${encodeURIComponent(record.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        access_token_encrypted: seal(accessToken, config.key),
        refresh_token_encrypted: seal(refreshToken, config.key),
        token_expires_at: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString(),
        status: 'connected', last_error: null,
      }),
    });
    return accessToken;
  } catch (error) {
    await admin(`/rest/v1/oauth_connections?id=eq.${encodeURIComponent(record.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'needs_attention', last_error: clean(error.message, 500) }),
    }).catch(() => {});
    throw new Error('The Microsoft work account connection needs to be reauthorized.');
  }
}

function redirect(res, location) {
  res.status(302).setHeader('Cache-Control', 'no-store').setHeader('Location', location).end();
}

async function connect(req, res, current, config) {
  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const envelope = seal(JSON.stringify({ state, verifier, userId: current.user.id, expires: Date.now() + 10 * 60 * 1000 }), config.key);
  res.setHeader('Set-Cookie', oauthCookie(envelope));
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  redirect(res, url.toString());
}

async function callback(req, res, current, config) {
  const fallback = '/admindashboard?calendar=microsoft-error';
  try {
    if (req.query.error) throw new Error('Microsoft authorization was not completed.');
    const envelope = cookies(req.headers.cookie)[OAUTH_COOKIE];
    if (!envelope) throw new Error('The Microsoft authorization request expired.');
    const saved = JSON.parse(unseal(envelope, config.key));
    if (saved.expires < Date.now() || saved.userId !== current.user.id || !safeEqual(saved.state, req.query.state)) throw new Error('The Microsoft authorization request is invalid.');
    const token = await tokenRequest(config, {
      grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: config.redirectUri, code_verifier: saved.verifier,
    });
    if (!token.refresh_token) throw new Error('Microsoft did not return renewable account access.');
    const [profile, calendar] = await Promise.all([
      graph('/me?$select=id,displayName,mail,userPrincipalName', token.access_token),
      graph('/me/calendar?$select=id,name', token.access_token),
    ]);
    await storeConnection(current.user.id, token, profile, calendar, config);
    res.setHeader('Set-Cookie', oauthCookie('', 0));
    return redirect(res, '/admindashboard?calendar=microsoft-connected');
  } catch (error) {
    res.setHeader('Set-Cookie', oauthCookie('', 0));
    return redirect(res, `${fallback}&reason=${encodeURIComponent(clean(error.message, 180))}`);
  }
}

async function status(res, current) {
  let configured = true;
  try { configuration(); } catch { configured = false; }
  const record = configured ? await connection(current.user.id) : null;
  const mailEnabled = Boolean(record && hasScope(record, 'Mail.Send'));
  return json(res, 200, {
    configured,
    connected: Boolean(record && record.status === 'connected'),
    status: record?.status || (configured ? 'not_connected' : 'not_configured'),
    accountLabel: record?.account_email || null,
    calendarName: record?.calendar_name || null,
    lastSyncedAt: record?.last_synced_at || null,
    mailEnabled,
    requiresReauthorization: Boolean(record && record.status === 'connected' && !mailEnabled),
  });
}

async function events(res, current, config) {
  const record = await connection(current.user.id);
  if (!record) return json(res, 409, { error: 'Connect Microsoft Calendar first.' });
  const accessToken = await accessTokenFor(record, config);
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 90 * 86400000).toISOString();
  const query = new URLSearchParams({
    startDateTime: start, endDateTime: end,
    '$select': 'id,subject,start,end,location,isAllDay,webLink,showAs', '$orderby': 'start/dateTime', '$top': '100',
  });
  const result = await graph(`/me/calendarView?${query}`, accessToken, { headers: { Prefer: 'outlook.timezone="America/Chicago"' } });
  await admin(`/rest/v1/oauth_connections?id=eq.${encodeURIComponent(record.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_synced_at: new Date().toISOString(), status: 'connected', last_error: null }),
  });
  return json(res, 200, {
    data: (result.value || []).map(event => ({
      id: event.id, title: event.subject || 'Busy', starts_at: event.start?.dateTime, ends_at: event.end?.dateTime,
      time_zone: event.start?.timeZone, location: event.location?.displayName || '', all_day: Boolean(event.isAllDay),
      show_as: event.showAs, web_url: event.webLink,
    })),
  });
}

async function createEvent(req, res, current, config) {
  if (!WRITERS.has(current.profile.role)) return json(res, 403, { error: 'Your role cannot create calendar events.' });
  const title = clean(req.body?.title, 200);
  const starts = new Date(req.body?.starts_at);
  const ends = new Date(req.body?.ends_at);
  if (title.length < 2 || !Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) return json(res, 400, { error: 'Enter a title and a valid start and end time.' });
  const record = await connection(current.user.id);
  if (!record) return json(res, 409, { error: 'Connect Microsoft Calendar first.' });
  const accessToken = await accessTokenFor(record, config);
  const event = await graph('/me/events', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      subject: title,
      start: { dateTime: starts.toISOString().replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
      end: { dateTime: ends.toISOString().replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
      location: { displayName: clean(req.body?.location, 300) },
      body: { contentType: 'text', content: clean(req.body?.notes, 2000) },
      transactionId: randomBytes(16).toString('hex'),
    }),
  });
  const bookingResponse = await supabase('/rest/v1/bookings', {
    method: 'POST', headers: { Authorization: `Bearer ${current.access}`, Prefer: 'return=representation' },
    body: JSON.stringify({
      title, starts_at: starts.toISOString(), ends_at: ends.toISOString(), location: clean(req.body?.location, 300) || null,
      provider: 'microsoft', provider_event_id: event.id, status: 'confirmed', notes: clean(req.body?.notes, 2000) || null,
      artist_id: req.body?.artist_id || null, project_id: req.body?.project_id || null,
    }),
  });
  const booking = await body(bookingResponse, 'The Outlook event was created, but the workspace booking could not be saved.');
  return json(res, 201, { event: { id: event.id, web_url: event.webLink }, booking: booking[0] });
}

async function updateEvent(req, res, current, config) {
  if (!WRITERS.has(current.profile.role)) return json(res, 403, { error: 'Your role cannot edit calendar events.' });
  const bookingId = String(req.body?.id || '');
  const title = clean(req.body?.title, 200);
  const starts = new Date(req.body?.starts_at);
  const ends = new Date(req.body?.ends_at);
  if (!UUID.test(bookingId) || title.length < 2 || !Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
    return json(res, 400, { error: 'Enter a title and a valid start and end time.' });
  }
  for (const field of ['artist_id', 'project_id']) {
    if (req.body?.[field] && !UUID.test(String(req.body[field]))) return json(res, 400, { error: `Choose a valid ${field.replace('_id', '')}.` });
  }
  const bookingResponse = await supabase(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,provider,provider_event_id&limit=1`, {
    headers: { Authorization: `Bearer ${current.access}` },
  });
  const bookings = await body(bookingResponse, 'The calendar entry could not be verified.');
  const booking = bookings[0];
  if (!booking) return json(res, 404, { error: 'Calendar entry not found.' });
  if (booking.provider !== 'microsoft' || !booking.provider_event_id) return json(res, 409, { error: 'This is not an Outlook calendar entry.' });

  const record = await connection(current.user.id);
  if (!record) return json(res, 409, { error: 'Reconnect Microsoft Calendar before editing this event.' });
  const accessToken = await accessTokenFor(record, config);
  const location = clean(req.body?.location, 300);
  const notes = cleanBody(req.body?.notes, 2000);
  const status = clean(req.body?.status, 40) || 'confirmed';
  if (!['tentative', 'confirmed', 'completed', 'canceled'].includes(status)) return json(res, 400, { error: 'Choose a valid calendar status.' });
  await graph(`/me/events/${encodeURIComponent(booking.provider_event_id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({
      subject: title,
      start: { dateTime: starts.toISOString().replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
      end: { dateTime: ends.toISOString().replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
      location: { displayName: location },
      body: { contentType: 'text', content: notes },
    }),
  });
  const updatedResponse = await supabase(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${current.access}`, Prefer: 'return=representation' },
    body: JSON.stringify({
      title,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: location || null,
      notes: notes || null,
      artist_id: req.body?.artist_id || null,
      project_id: req.body?.project_id || null,
      status,
    }),
  });
  const updated = await body(updatedResponse, 'Outlook was updated, but the workspace calendar could not be synchronized.');
  await supabase('/rest/v1/audit_events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${current.access}`, Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_user_id: current.user.id,
      action: 'update',
      target_type: 'bookings',
      target_id: bookingId,
      metadata: { changed_fields: ['title', 'starts_at', 'ends_at', 'location', 'notes', 'artist_id', 'project_id', 'status'], provider: 'microsoft' },
    }),
  }).catch(() => {});
  return json(res, 200, { event: { id: booking.provider_event_id }, booking: updated[0] });
}

async function sendMail(req, res, current, config) {
  if (!WRITERS.has(current.profile.role)) return json(res, 403, { error: 'Your role cannot send client email.' });
  const to = clean(req.body?.to, 320).toLowerCase();
  const subject = clean(req.body?.subject, 200);
  const message = cleanBody(req.body?.message, 10000);
  const artistId = req.body?.artist_id ? String(req.body.artist_id) : null;
  if (!EMAIL.test(to) || subject.length < 2 || message.length < 1) return json(res, 400, { error: 'Choose a valid recipient and enter a subject and message.' });
  if (!artistId || !UUID.test(artistId)) return json(res, 400, { error: 'Choose a valid roster contact.' });
  const rosterResponse = await supabase(`/rest/v1/artists?id=eq.${encodeURIComponent(artistId)}&select=id,email&limit=1`, {
    headers: { Authorization: `Bearer ${current.access}` },
  });
  const roster = await body(rosterResponse, 'The selected roster contact could not be verified.');
  if (!roster[0]?.email || String(roster[0].email).trim().toLowerCase() !== to) return json(res, 400, { error: 'The recipient must match the selected roster email.' });
  const record = await connection(current.user.id);
  if (!record) return json(res, 409, { error: 'Connect the Microsoft work account first.' });
  if (!hasScope(record, 'Mail.Send')) return json(res, 409, { error: 'Reconnect Outlook once to approve outgoing email access.' });
  const accessToken = await accessTokenFor(record, config);
  await graph('/me/sendMail', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: message },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });

  let activityLogged = false;
  try {
    const activityResponse = await supabase('/rest/v1/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${current.access}`, Prefer: 'return=minimal' },
      body: JSON.stringify({
        artist_id: artistId,
        actor_user_id: current.user.id,
        activity_type: 'email',
        summary: `Email sent: ${subject}`,
        detail: `To: ${to}`,
      }),
    });
    activityLogged = activityResponse.ok;
  } catch {}
  return json(res, 202, { sent: true, activityLogged, recipient: to });
}

async function disconnect(res, current) {
  await admin(`/rest/v1/oauth_connections?user_id=eq.${encodeURIComponent(current.user.id)}&provider=eq.${PROVIDER}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await admin('/rest/v1/integration_connections?provider=eq.microsoft_calendar', {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'not_configured', account_label: null, last_checked_at: new Date().toISOString(), notes: 'Unified availability' }),
  });
  return json(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const current = await session(req, res);
    if (!current) return json(res, 401, { error: 'Sign in required.' });
    const action = String(req.query.action || 'status');
    if (req.method === 'DELETE' || action === 'disconnect') return disconnect(res, current);
    if (action === 'status') return status(res, current);
    const config = configuration();
    if (action === 'connect') return connect(req, res, current, config);
    if (action === 'callback') return callback(req, res, current, config);
    if (action === 'events' && req.method === 'GET') return events(res, current, config);
    if (action === 'create_event' && req.method === 'POST') return createEvent(req, res, current, config);
    if (action === 'update_event' && req.method === 'PATCH') return updateEvent(req, res, current, config);
    if (action === 'send_mail' && req.method === 'POST') return sendMail(req, res, current, config);
    return json(res, 400, { error: 'Unknown Microsoft Calendar action.' });
  } catch (error) {
    const statusCode = /not configured/i.test(error.message) ? 503 : 400;
    return json(res, statusCode, { error: clean(error.message, 500) || 'Microsoft Calendar request failed.' });
  }
};

module.exports._test = { clean, cleanBody, hasScope, parseJwt, safeEqual, seal, unseal };
