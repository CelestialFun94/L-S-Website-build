const { createHash } = require('node:crypto');
const { json, method, session, supabase } = require('./_lib');
const { questionnaire, questionMap } = require('./_intake-questionnaire');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,100}$/;
const INTERNAL = new Set(['owner', 'admin', 'operations']);

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

async function userApi(access, path, options = {}, fallback = 'The intake request could not be completed.') {
  const response = await supabase(path, { ...options, headers: { Authorization: `Bearer ${access}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || fallback);
  return data;
}

async function intakeService(payload) {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('The intake service is not configured.');
  const response = await fetch(`${base}/functions/v1/client-intake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'The intake request could not be completed.');
  return data;
}

function validateResponses(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Questionnaire responses are invalid.');
  const output = {};
  let total = 0;
  for (const [id, raw] of Object.entries(input)) {
    const question = questionMap.get(id);
    if (!question) continue;
    if (question.type === 'yesno') {
      if (!['yes', 'no', 'na', ''].includes(String(raw))) throw new Error('Choose Yes, No, or N/A for each status response.');
      output[id] = String(raw);
      continue;
    }
    if (question.type === 'certify') {
      output[id] = raw === true || raw === 'true' || raw === 'on';
      continue;
    }
    const value = String(raw ?? '').trim().slice(0, 5000);
    total += value.length;
    if (total > 120000) throw new Error('The questionnaire response is too large.');
    output[id] = value;
  }
  return output;
}

async function publicGet(req, res) {
  const token = String(req.query.token || '');
  if (!TOKEN.test(token)) return json(res, 404, { error: 'This questionnaire link is invalid.' });
  const data = await intakeService({ action: 'get', token_hash: hashToken(token) });
  const request = data.request;
  return json(res, 200, {
    artistName: request.artist?.name || 'Artist',
    recipientEmail: request.recipient_email,
    expiresAt: request.expires_at,
    completed: request.status === 'completed',
    questionnaire,
    responses: data.response?.responses || {},
    savedAt: data.response?.updated_at || null,
    submittedAt: data.response?.submitted_at || null,
  });
}

async function publicSave(req, res) {
  const token = String(req.body?.token || '');
  if (!TOKEN.test(token)) return json(res, 404, { error: 'This questionnaire link is invalid.' });
  const responses = validateResponses(req.body?.responses);
  const finalize = req.body?.finalize === true;
  const certification = questionnaire.at(-1).questions.find(question => question.type === 'certify');
  if (finalize && responses[certification.id] !== true) return json(res, 400, { error: 'Please accept the artist certification before submitting.' });
  const saved = await intakeService({ action: 'save', token_hash: hashToken(token), responses, finalize });
  return json(res, 200, saved);
}

async function internalGet(req, res) {
  const current = await session(req, res);
  if (!current) return json(res, 401, { error: 'Sign in required.' });
  if (!INTERNAL.has(current.profile.role)) return json(res, 403, { error: 'Your role cannot view client intake responses.' });
  const requestId = String(req.query.request_id || '');
  if (!UUID.test(requestId)) return json(res, 400, { error: 'A valid questionnaire ID is required.' });
  const requests = await userApi(current.access, `/rest/v1/intake_requests?id=eq.${encodeURIComponent(requestId)}&select=id,recipient_email,status,sent_at,completed_at,expires_at,artist:artists(name)&limit=1`);
  if (!requests[0]) return json(res, 404, { error: 'Questionnaire not found.' });
  const responses = await userApi(current.access, `/rest/v1/intake_responses?request_id=eq.${encodeURIComponent(requestId)}&select=responses,submitted_at,updated_at&limit=1`);
  return json(res, 200, { request: requests[0], response: responses[0] || null, questionnaire });
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'GET' && req.query.request_id) return await internalGet(req, res);
    if (req.method === 'GET') return await publicGet(req, res);
    return await publicSave(req, res);
  } catch (error) {
    return json(res, 400, { error: error.message || 'The questionnaire could not be completed.' });
  }
};

module.exports._test = { hashToken, validateResponses };
