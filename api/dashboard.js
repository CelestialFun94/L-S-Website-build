const { json, method, session, supabase } = require('./_lib');

const resources = {
  inquiries: 'id,name,email,kind,path,idea,status,created_at',
  artists: 'id,name,email,stage,status,next_step,created_at',
  projects: 'id,name,status,project_type,target_date,artist:artists(name),created_at',
  songs: 'id,title,status,split_status,project:projects(name),created_at',
  invoices: 'id,invoice_number,status,amount_cents,due_date,artist:artists(name),created_at',
};

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'PATCH'])) return;
  try {
    const current = await session(req, res);
    if (!current) return json(res, 401, { error: 'Sign in required.' });
    const resource = String(req.query.resource || '');
    if (!resources[resource]) return json(res, 400, { error: 'Unknown workspace resource.' });

    if (req.method === 'PATCH') {
      if (resource !== 'inquiries') return json(res, 405, { error: 'Only inquiry status updates are supported here.' });
      const id = String(req.body?.id || '');
      const status = String(req.body?.status || '');
      if (!/^[0-9a-f-]{36}$/i.test(id) || !['new', 'reviewing', 'contacted', 'closed'].includes(status)) return json(res, 400, { error: 'Invalid update.' });
      const update = await supabase(`/rest/v1/inquiries?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${current.access}`, Prefer: 'return=minimal' }, body: JSON.stringify({ status }),
      });
      if (!update.ok) throw new Error('Unable to update the inquiry.');
      return json(res, 200, { ok: true });
    }

    const response = await supabase(`/rest/v1/${resource}?select=${encodeURIComponent(resources[resource])}&order=created_at.desc&limit=100`, {
      headers: { Authorization: `Bearer ${current.access}` },
    });
    if (!response.ok) throw new Error('Unable to load workspace data.');
    return json(res, 200, { data: await response.json() });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Workspace request failed.' });
  }
};
