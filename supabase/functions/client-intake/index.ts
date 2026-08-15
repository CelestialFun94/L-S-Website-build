const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const HASH = /^[a-f0-9]{64}$/;

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function database(path: string, options: RequestInit = {}) {
  const result = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await result.json().catch(() => null);
  if (!result.ok) throw new Error(data?.message || data?.error || 'Database request failed.');
  return data;
}

function safeResponses(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Questionnaire responses are invalid.');
  const input = value as Record<string, unknown>;
  const output: Record<string, string | boolean> = {};
  let total = 0;
  if (Object.keys(input).length > 450) throw new Error('Questionnaire responses are invalid.');
  for (const [id, raw] of Object.entries(input)) {
    if (!/^s\d{2}_\d{2}$/.test(id)) continue;
    if (typeof raw === 'boolean') output[id] = raw;
    else {
      const answer = String(raw ?? '').trim().slice(0, 5000);
      total += answer.length;
      if (total > 120000) throw new Error('The questionnaire response is too large.');
      output[id] = answer;
    }
  }
  return output;
}

Deno.serve(async request => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('The intake service is not configured.');
    const payload = await request.json();
    const tokenHash = String(payload?.token_hash || '').toLowerCase();
    if (!HASH.test(tokenHash)) return response(404, { error: 'This questionnaire link is invalid.' });
    const requests = await database(`/rest/v1/intake_requests?token_hash=eq.${tokenHash}&select=id,artist_id,recipient_email,status,expires_at,sent_at,completed_at,artist:artists(name)&limit=1`);
    const intakeRequest = requests[0];
    if (!intakeRequest) return response(404, { error: 'This questionnaire link is invalid.' });
    if (intakeRequest.status === 'revoked') return response(410, { error: 'This questionnaire link is no longer active.' });
    if (new Date(intakeRequest.expires_at) < new Date() && intakeRequest.status !== 'completed') {
      return response(410, { error: 'This questionnaire link has expired. Please ask Love & Sunshine for a new one.' });
    }
    const existing = await database(`/rest/v1/intake_responses?request_id=eq.${encodeURIComponent(intakeRequest.id)}&select=responses,submitted_at,updated_at&limit=1`);
    if (payload.action === 'get') return response(200, { request: intakeRequest, response: existing[0] || null });
    if (payload.action !== 'save') return response(400, { error: 'Unknown intake action.' });
    if (intakeRequest.status === 'completed') return response(409, { error: 'This questionnaire has already been completed.' });

    const responses = safeResponses(payload.responses);
    const finalize = payload.finalize === true;
    if (finalize && responses.s35_04 !== true) return response(400, { error: 'Please accept the artist certification before submitting.' });
    const submittedAt = finalize ? new Date().toISOString() : null;
    await database('/rest/v1/intake_responses?on_conflict=request_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ request_id: intakeRequest.id, artist_id: intakeRequest.artist_id, responses, submitted_at: submittedAt }),
    });
    if (finalize) {
      await database(`/rest/v1/intake_requests?id=eq.${encodeURIComponent(intakeRequest.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'completed', completed_at: submittedAt }),
      });
      await database('/rest/v1/activities', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ artist_id: intakeRequest.artist_id, activity_type: 'system', summary: 'Client intake questionnaire completed', detail: `Completed by ${intakeRequest.recipient_email}` }),
      }).catch(() => {});
    }
    return response(200, { saved: true, completed: finalize, savedAt: new Date().toISOString() });
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : 'The questionnaire could not be completed.' });
  }
});
