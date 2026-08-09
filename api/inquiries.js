const { json, method, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const input = req.body || {};
    if (input.company) return json(res, 200, { ok: true });
    const name = String(input.name || '').trim().slice(0, 120);
    const email = String(input.email || '').trim().toLowerCase().slice(0, 320);
    const phone = String(input.phone || '').trim().slice(0, 40);
    const contactPreference = ['sms', 'email'].includes(input.contact_preference) ? input.contact_preference : '';
    const kind = input.kind === 'cowrite' ? 'cowrite' : 'starter';
    const path = String(input.path || '').trim().slice(0, 240) || null;
    const idea = String(input.idea || '').trim().slice(0, 5000) || null;
    const availability = String(input.availability || '').trim().slice(0, 2000) || null;
    const timeZone = ['ET', 'CT', 'MT', 'PT', 'AKT', 'HT'].includes(input.time_zone) ? input.time_zone : null;
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'Please enter your name and a valid email.' });
    if (phone.length < 7 || !contactPreference) return json(res, 400, { error: 'Please enter a valid phone number and choose SMS or email.' });
    if (kind === 'starter' && !path) return json(res, 400, { error: 'Choose the option that fits best.' });
    if (kind === 'cowrite' && (!availability || !timeZone || input.consent !== true)) return json(res, 400, { error: 'List a few good dates and times, select your time zone, and confirm the inquiry notice.' });

    const response = await supabase('/rest/v1/inquiries', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ kind, name, email, phone, contact_preference: contactPreference, path, idea, availability, time_zone: timeZone, consent: input.consent === true, source: 'website' }),
    });
    if (!response.ok) throw new Error('We could not save your inquiry right now. Please try again.');
    return json(res, 201, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unable to submit inquiry.' });
  }
};
