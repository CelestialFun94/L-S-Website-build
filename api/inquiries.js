const { json, method, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const input = req.body || {};
    if (input.company) return json(res, 200, { ok: true });
    const name = String(input.name || '').trim().slice(0, 120);
    const email = String(input.email || '').trim().toLowerCase().slice(0, 320);
    const kind = input.kind === 'cowrite' ? 'cowrite' : 'starter';
    const path = String(input.path || '').trim().slice(0, 240) || null;
    const idea = String(input.idea || '').trim().slice(0, 5000) || null;
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'Please enter your name and a valid email.' });
    if (kind === 'starter' && !path) return json(res, 400, { error: 'Choose the option that fits best.' });
    if (kind === 'cowrite' && (!idea || input.consent !== true)) return json(res, 400, { error: 'Tell us about the song and confirm the inquiry notice.' });

    const response = await supabase('/rest/v1/inquiries', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ kind, name, email, path, idea, consent: input.consent === true, source: 'website' }),
    });
    if (!response.ok) throw new Error('We could not save your inquiry right now. Please try again.');
    return json(res, 201, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unable to submit inquiry.' });
  }
};
