const { json, method, session, supabase } = require('./_lib');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGERS = new Set(['owner', 'admin']);
const OPERATORS = new Set(['owner', 'admin', 'operations']);

const resources = {
  inquiries: {
    select: 'id,name,email,phone,contact_preference,kind,path,idea,availability,time_zone,status,created_at',
    update: ['status'],
    roles: OPERATORS,
  },
  artists: {
    select: 'id,name,email,phone,pronouns,genres,lead_source,stage,status,next_step,notes,created_at,updated_at',
    create: ['name', 'email', 'phone', 'pronouns', 'genres', 'lead_source', 'stage', 'status', 'next_step', 'notes'],
    update: ['name', 'email', 'phone', 'pronouns', 'genres', 'lead_source', 'stage', 'status', 'next_step', 'notes'],
    required: ['name'], roles: OPERATORS,
  },
  projects: {
    select: 'id,artist_id,name,description,status,priority,progress,project_type,target_date,next_step,artist:artists(name),created_at,updated_at',
    create: ['artist_id', 'name', 'description', 'status', 'priority', 'progress', 'project_type', 'target_date', 'next_step'],
    update: ['artist_id', 'name', 'description', 'status', 'priority', 'progress', 'project_type', 'target_date', 'next_step'],
    required: ['artist_id', 'name'], roles: OPERATORS,
  },
  tasks: {
    select: 'id,project_id,artist_id,title,description,status,priority,due_date,assigned_user_id,completed_at,project:projects(name),artist:artists(name),assignee:profiles(display_name),created_at,updated_at',
    create: ['project_id', 'artist_id', 'title', 'description', 'status', 'priority', 'due_date', 'assigned_user_id'],
    update: ['project_id', 'artist_id', 'title', 'description', 'status', 'priority', 'due_date', 'assigned_user_id', 'completed_at'],
    required: ['title'], roles: OPERATORS,
  },
  activities: {
    select: 'id,artist_id,project_id,actor_user_id,activity_type,summary,detail,artist:artists(name),project:projects(name),actor:profiles(display_name),created_at',
    create: ['artist_id', 'project_id', 'activity_type', 'summary', 'detail'],
    required: ['summary'], roles: OPERATORS,
  },
  songs: {
    select: 'id,project_id,title,alternate_title,status,split_status,genre,musical_key,bpm,iswc,release_date,notes,project:projects(name),created_at,updated_at',
    create: ['project_id', 'title', 'alternate_title', 'status', 'split_status', 'genre', 'musical_key', 'bpm', 'iswc', 'release_date', 'notes'],
    update: ['project_id', 'title', 'alternate_title', 'status', 'split_status', 'genre', 'musical_key', 'bpm', 'iswc', 'release_date', 'notes'],
    required: ['title'], roles: OPERATORS,
  },
  song_contributors: {
    select: 'id,song_id,contributor_name,contributor_email,contributor_role,pro_affiliation,publisher,share_percent,confirmed_at,song:songs(title),created_at',
    create: ['song_id', 'contributor_name', 'contributor_email', 'contributor_role', 'pro_affiliation', 'publisher', 'share_percent', 'confirmed_at'],
    update: ['contributor_name', 'contributor_email', 'contributor_role', 'pro_affiliation', 'publisher', 'share_percent', 'confirmed_at'],
    required: ['song_id', 'contributor_name', 'share_percent'], roles: OPERATORS,
  },
  bookings: {
    select: 'id,artist_id,project_id,title,starts_at,ends_at,location,provider,provider_event_id,status,notes,artist:artists(name),project:projects(name),created_at,updated_at',
    create: ['artist_id', 'project_id', 'title', 'starts_at', 'ends_at', 'location', 'provider', 'status', 'notes'],
    update: ['artist_id', 'project_id', 'title', 'starts_at', 'ends_at', 'location', 'provider', 'provider_event_id', 'status', 'notes'],
    required: ['title', 'starts_at', 'ends_at'], roles: OPERATORS,
  },
  file_records: {
    select: 'id,artist_id,project_id,name,object_key,mime_type,size_bytes,storage_provider,status,notes,artist:artists(name),project:projects(name),creator:profiles(display_name),created_at,updated_at',
    create: ['artist_id', 'project_id', 'name', 'object_key', 'mime_type', 'size_bytes', 'storage_provider', 'status', 'notes'],
    update: ['artist_id', 'project_id', 'name', 'status', 'notes'],
    required: ['name'], roles: OPERATORS,
  },
  vault_links: {
    select: 'id,artist_id,project_id,service_name,manager_name,item_reference,login_url,notes,artist:artists(name),project:projects(name),created_at,updated_at',
    create: ['artist_id', 'project_id', 'service_name', 'manager_name', 'item_reference', 'login_url', 'notes'],
    update: ['artist_id', 'project_id', 'service_name', 'manager_name', 'item_reference', 'login_url', 'notes'],
    required: ['service_name'], roles: MANAGERS,
  },
  operator_items: {
    select: 'id,created_by,item_type,title,content,risk_level,status,related_type,related_id,creator:profiles(display_name),created_at,updated_at',
    create: ['item_type', 'title', 'content', 'risk_level', 'status', 'related_type', 'related_id'],
    update: ['item_type', 'title', 'content', 'risk_level', 'status', 'related_type', 'related_id'],
    required: ['title'], roles: OPERATORS,
  },
  integration_connections: {
    select: 'id,provider,display_name,status,account_label,last_checked_at,notes,updated_at',
  },
  profiles: {
    select: 'user_id,display_name,role,active,created_at,updated_at',
  },
  audit_events: {
    select: 'id,actor_user_id,action,target_type,target_id,outcome,metadata,actor:profiles(display_name),created_at',
  },
  invoices: { select: 'id,invoice_number,status,amount_cents,paid_cents,billing_type,description,due_date,payment_url,hosted_invoice_url,artist:artists(name),created_at' },
  payment_plans: { select: 'id,status,installment_amount_cents,installment_count,installments_paid,interval,checkout_url,artist:artists(name),invoice:invoices(invoice_number),created_at' },
  retainers: { select: 'id,status,description,amount_cents,interval,checkout_url,current_period_end,artist:artists(name),invoice:invoices(invoice_number),created_at' },
  payments: { select: 'id,status,amount_cents,refunded_cents,currency,paid_at,invoice:invoices(invoice_number),artist:artists(name),created_at' },
};

function text(value, max = 1000) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().slice(0, max);
}

function cleanValue(field, value) {
  if (value === '' || value === undefined) return null;
  if (['progress', 'bpm', 'share_percent', 'size_bytes'].includes(field)) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${field.replaceAll('_', ' ')} must be a number.`);
    return number;
  }
  if (field.endsWith('_id') || field === 'related_id') {
    if (value === null) return null;
    if (!UUID.test(String(value))) throw new Error(`Invalid ${field.replaceAll('_', ' ')}.`);
    return String(value);
  }
  return text(value, field === 'description' || field === 'notes' || field === 'content' || field === 'detail' ? 5000 : 500);
}

function payload(config, body, mode) {
  const allowed = config[mode];
  if (!allowed) throw new Error(`${mode === 'create' ? 'Creating' : 'Updating'} this resource is not supported.`);
  const result = {};
  for (const field of allowed) if (Object.hasOwn(body || {}, field)) result[field] = cleanValue(field, body[field]);
  for (const field of config.required || []) if (mode === 'create' && (result[field] === null || result[field] === undefined)) throw new Error(`${field.replaceAll('_', ' ')} is required.`);
  if (!Object.keys(result).length) throw new Error('No valid changes were supplied.');
  return result;
}

async function api(access, path, options = {}) {
  const response = await supabase(path, {
    ...options,
    headers: { Authorization: `Bearer ${access}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error || 'Workspace request failed.');
  return body;
}

async function audit(current, action, resource, id, fields) {
  await api(current.access, '/rest/v1/audit_events', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_user_id: current.user.id,
      action, target_type: resource, target_id: id || null,
      metadata: { changed_fields: fields },
    }),
  }).catch(() => {});
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PATCH'])) return;
  try {
    const current = await session(req, res);
    if (!current) return json(res, 401, { error: 'Sign in required.' });
    const resource = String(req.query.resource || '');
    const config = resources[resource];
    if (!config) return json(res, 400, { error: 'Unknown workspace resource.' });

    if (req.method === 'GET') {
      const order = ['bookings'].includes(resource) ? 'starts_at.asc' : 'created_at.desc';
      const data = await api(current.access, `/rest/v1/${resource}?select=${encodeURIComponent(config.select)}&order=${order}&limit=250`);
      return json(res, 200, { data });
    }

    if (!config.roles?.has(current.profile.role)) return json(res, 403, { error: 'Your role cannot change this section.' });

    if (req.method === 'POST') {
      const record = payload(config, req.body, 'create');
      if (resource === 'activities') record.actor_user_id = current.user.id;
      if (resource === 'file_records') record.created_by = current.user.id;
      if (resource === 'operator_items') record.created_by = current.user.id;
      const created = await api(current.access, `/rest/v1/${resource}`, {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record),
      });
      await audit(current, 'create', resource, created[0]?.id, Object.keys(record));
      return json(res, 201, { data: created[0] });
    }

    const id = String(req.body?.id || '');
    if (!UUID.test(id)) return json(res, 400, { error: 'A valid record ID is required.' });
    const record = payload(config, req.body, 'update');
    if (resource === 'inquiries' && !['new', 'reviewing', 'contacted', 'closed'].includes(record.status)) {
      return json(res, 400, { error: 'Invalid inquiry status.' });
    }
    if (resource === 'tasks' && record.status === 'complete' && !record.completed_at) record.completed_at = new Date().toISOString();
    if (resource === 'tasks' && record.status && record.status !== 'complete') record.completed_at = null;
    const updated = await api(current.access, `/rest/v1/${resource}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record),
    });
    if (!updated[0]) return json(res, 404, { error: 'Record not found.' });
    await audit(current, 'update', resource, id, Object.keys(record));
    return json(res, 200, { data: updated[0] });
  } catch (error) {
    return json(res, 400, { error: error.message || 'Workspace request failed.' });
  }
};

module.exports._test = { cleanValue, payload, resources };
