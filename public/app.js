const $ = (selector, element = document) => element.querySelector(selector);
const $$ = (selector, element = document) => [...element.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const friendly = value => String(value ?? '—').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const openModal = dialog => {
  if (!dialog) return;
  if (dialog.tagName !== 'DIALOG') { dialog.hidden = false; return; }
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else { dialog.setAttribute('open', ''); dialog.style.display = 'block'; }
};
const closeModal = dialog => {
  if (!dialog) return;
  if (dialog.tagName !== 'DIALOG') { dialog.hidden = true; return; }
  if (typeof dialog.close === 'function') dialog.close();
  else { dialog.removeAttribute('open'); dialog.style.display = ''; }
};

const year = $('#year');
if (year) year.textContent = new Date().getFullYear();
const dashboardDate = $('#dashboard-date');
if (dashboardDate) dashboardDate.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

const navigationToggle = $('.nav-toggle');
if (navigationToggle) {
  const closeNavigation = () => {
    navigationToggle.closest('.site-header').classList.remove('menu-open');
    navigationToggle.setAttribute('aria-expanded', 'false');
    navigationToggle.setAttribute('aria-label', 'Open navigation');
    navigationToggle.textContent = 'Menu';
  };
  navigationToggle.addEventListener('click', () => {
    const header = navigationToggle.closest('.site-header');
    const open = header.classList.toggle('menu-open');
    navigationToggle.setAttribute('aria-expanded', String(open));
    navigationToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigationToggle.textContent = open ? 'Close' : 'Menu';
  });
  $$('.site-header nav a, .site-header nav button').forEach(control => control.addEventListener('click', closeNavigation));
  document.addEventListener('click', event => {
    const header = navigationToggle.closest('.site-header');
    if (header.classList.contains('menu-open') && !header.contains(event.target)) closeNavigation();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeNavigation();
  });
}

$$('[data-open]').forEach(button => button.addEventListener('click', () => openModal($('#' + button.dataset.open))));
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('dialog'))));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) closeModal(dialog); }));

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

$$('[data-form]').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault();
  const result = $('.form-result', form.parentElement);
  const submit = $('[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));
  const kind = form.dataset.form;
  result.setAttribute('role', 'status');
  result.hidden = true;
  submit.disabled = true;
  submit.textContent = 'Sending…';
  try {
    await request('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify({ ...data, kind, consent: data.consent === 'on' }),
    });
    const guidance = {
      'I’m looking for management': 'A focused management conversation is a strong place to start.',
      'I need publishing support': 'A catalog and publishing conversation is a strong next move.',
      'I’m still finding the fit': 'A short discovery conversation was made for exactly this moment.',
    };
    result.classList.remove('error');
    result.setAttribute('role', 'status');
    result.innerHTML = kind === 'starter'
      ? `<strong>Thank you, ${escapeHtml(data.name)}.</strong><br>${escapeHtml(guidance[data.path])} Your note is safely in the Love & Sunshine workspace.`
      : `<strong>We received your inquiry, ${escapeHtml(data.name)}.</strong><br>We’ll review it with care and follow up before confirming any session.`;
    form.reset();
  } catch (error) {
    result.classList.add('error');
    result.setAttribute('role', 'alert');
    result.textContent = error.message;
  } finally {
    result.hidden = false;
    submit.disabled = false;
    submit.innerHTML = kind === 'starter' ? 'Send my starting point <span>→</span>' : 'Send inquiry <span>→</span>';
  }
}));

let signedInAccount = null;
let currentView = 'overview';
let calendarMonthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function showDashboard(account) {
  signedInAccount = account;
  closeModal($('#admin'));
  $('#dashboard').hidden = false;
  document.body.style.overflow = 'hidden';
  const name = account.profile.display_name || 'Team';
  $('#view-title').textContent = `Welcome, ${name}.`;
  $('#account-avatar').textContent = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  render('overview');
}

$('#login-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $('#login-result');
  const submit = $('[type="submit"]', form);
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  result.hidden = true;
  try {
    const account = await request('/api/auth', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    showDashboard(account);
  } catch (error) {
    result.textContent = error.message;
    result.classList.add('error');
    result.hidden = false;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Sign in <span>→</span>';
  }
});

async function load(resource) {
  return (await request(`/api/dashboard?resource=${encodeURIComponent(resource)}`)).data;
}

function empty(message) {
  return `<div class="empty"><h2>Nothing here yet.</h2><p>${escapeHtml(message)}</p></div>`;
}

function table(title, headings, rows, action = '') {
  if (!rows.length) return `<section class="table-panel"><div class="panel-heading"><div><p class="eyebrow">Love & Sunshine</p><h2>${escapeHtml(title)}</h2></div>${action}</div>${empty(`New ${title.toLowerCase()} will appear here.`)}</section>`;
  return `<section class="table-panel"><div class="panel-heading"><div><p class="eyebrow">Love & Sunshine</p><h2>${escapeHtml(title)}</h2></div>${action}</div><div class="table-scroll"><table><thead><tr>${headings.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr data-search-row>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

const tag = value => `<span class="tag ${['active', 'paid', 'confirmed', 'complete'].includes(String(value).toLowerCase()) ? 'green' : ''}">${escapeHtml(friendly(value))}</span>`;
const date = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const dateTime = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
const calendarKey = value => {
  const day = value instanceof Date ? value : new Date(value);
  return Number.isFinite(day.getTime()) ? `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}` : '';
};
const calendarTime = value => value ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
const paymentLink = url => url ? `<a class="billing-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open ↗</a>` : '—';
const addButton = (resource, label) => `<button class="button button-small" data-create="${escapeHtml(resource)}">+ ${escapeHtml(label)}</button>`;
const editButton = (resource, id) => `<button class="edit-record" type="button" data-edit-resource="${escapeHtml(resource)}" data-edit-id="${escapeHtml(id)}">Edit</button>`;

function monthCalendar(outlookEvents, bookings, microsoft, outlookError) {
  const year = calendarMonthCursor.getFullYear();
  const month = calendarMonthCursor.getMonth();
  const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  const today = calendarKey(new Date());
  const outlookIds = new Set(outlookEvents.map(item => item.id));
  const events = [
    ...outlookEvents.map(item => ({ ...item, source: 'outlook' })),
    ...bookings.filter(item => item.provider !== 'microsoft' && !outlookIds.has(item.provider_event_id)).map(item => ({ ...item, source: 'workspace' })),
  ].sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
  const byDay = events.reduce((map, item) => {
    const key = calendarKey(item.starts_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = calendarKey(day);
    const items = byDay.get(key) || [];
    const chips = items.slice(0, 3).map(item => {
      const label = `${item.all_day ? 'All day' : calendarTime(item.starts_at)} ${item.title || 'Busy'}`.trim();
      const content = `<span class="calendar-event-time">${escapeHtml(item.all_day ? 'All day' : calendarTime(item.starts_at))}</span><span>${escapeHtml(item.title || 'Busy')}</span>`;
      return item.web_url
        ? `<a class="calendar-event ${item.source}" href="${escapeHtml(item.web_url)}" target="_blank" rel="noopener" title="${escapeHtml(label)}">${content}</a>`
        : `<span class="calendar-event ${item.source}" title="${escapeHtml(label)}">${content}</span>`;
    }).join('');
    return `<div class="calendar-day ${day.getMonth() === month ? '' : 'outside-month'} ${key === today ? 'today' : ''}" data-date="${key}"><div class="calendar-date"><span>${day.getDate()}</span>${key === today ? '<small>Today</small>' : ''}</div><div class="calendar-day-events">${chips}${items.length > 3 ? `<span class="calendar-more">+${items.length - 3} more</span>` : ''}</div></div>`;
  }).join('');
  const account = microsoft.connected ? `<span class="calendar-account"><i></i>${escapeHtml(microsoft.accountLabel || 'Outlook connected')}</span>` : '';
  const connect = !microsoft.connected && microsoft.configured ? '<a class="button button-small" href="/api/microsoft-calendar?action=connect">Connect Outlook</a>' : '';
  return `<section class="month-calendar" aria-label="Monthly calendar"><div class="calendar-toolbar"><div><p class="eyebrow">Unified calendar</p><h2>${escapeHtml(new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarMonthCursor))}</h2><div class="calendar-sources">${account}<span><i class="workspace-dot"></i>Workspace bookings</span></div></div><div class="calendar-controls"><button type="button" data-calendar-today>Today</button><button type="button" data-calendar-shift="-1" aria-label="Previous month">‹</button><button type="button" data-calendar-shift="1" aria-label="Next month">›</button>${addButton('bookings', 'Booking')}${connect}</div></div>${outlookError ? `<div class="form-result error calendar-error">${escapeHtml(outlookError)}</div>` : ''}<div class="calendar-scroll"><div class="calendar-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${days}</div></div></section>`;
}

const optionList = (items, label = item => item.name) => items.map(item => ({ value: item.id || item.user_id, label: label(item) }));

function localDateTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function inputField(field, record = {}) {
  const required = field.required ? ' required' : '';
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
  const attributes = `${required}${placeholder}${field.min !== undefined ? ` min="${field.min}"` : ''}${field.max !== undefined ? ` max="${field.max}"` : ''}${field.step ? ` step="${field.step}"` : ''}`;
  const rawValue = record[field.name] ?? '';
  const value = field.type === 'datetime-local' ? localDateTime(rawValue) : field.type === 'date' && rawValue ? String(rawValue).slice(0, 10) : String(rawValue);
  if (field.type === 'select') {
    return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}"${required}><option value="">${escapeHtml(field.empty || 'Choose…')}</option>${field.options.map(option => `<option value="${escapeHtml(option.value)}" ${String(option.value) === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  }
  if (field.type === 'textarea') return `<label class="record-wide">${escapeHtml(field.label)}<textarea name="${escapeHtml(field.name)}" rows="4"${attributes}>${escapeHtml(value)}</textarea></label>`;
  return `<label class="${field.wide ? 'record-wide' : ''}">${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || 'text')}" value="${escapeHtml(value)}"${attributes} /></label>`;
}

async function recordDefinition(resource) {
  const status = values => values.map(value => ({ value, label: friendly(value) }));
  if (resource === 'inquiries') return { title: 'Edit an inquiry', fields: [
    { name: 'name', label: 'Contact name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone' }, { name: 'contact_preference', label: 'Preferred contact', type: 'select', options: status(['email', 'sms']) },
    { name: 'kind', label: 'Inquiry type' }, { name: 'status', label: 'Status', type: 'select', options: status(['new', 'reviewing', 'contacted', 'closed']) },
    { name: 'path', label: 'Requested support', type: 'textarea' }, { name: 'idea', label: 'Idea or note', type: 'textarea' },
    { name: 'availability', label: 'Availability', type: 'textarea' }, { name: 'time_zone', label: 'Time zone' },
  ] };
  if (resource === 'artists') return { title: 'Add an artist', fields: [
    { name: 'name', label: 'Artist or client name', required: true, wide: true }, { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone' }, { name: 'stage', label: 'Development stage' }, { name: 'genres', label: 'Genres' },
    { name: 'lead_source', label: 'Lead source' }, { name: 'status', label: 'Lifecycle status', type: 'select', options: status(['lead', 'active', 'paused', 'archived']) },
    { name: 'next_step', label: 'Next step', wide: true }, { name: 'notes', label: 'Internal notes', type: 'textarea' },
  ] };
  if (resource === 'projects') {
    const artists = await load('artists');
    return { title: 'Create a project', fields: [
      { name: 'artist_id', label: 'Artist', type: 'select', required: true, options: optionList(artists) },
      { name: 'name', label: 'Project name', required: true }, { name: 'project_type', label: 'Project type', placeholder: 'Single, EP, release plan…' },
      { name: 'status', label: 'Status', type: 'select', options: status(['planning', 'active', 'blocked', 'complete', 'archived']) },
      { name: 'priority', label: 'Priority', type: 'select', options: status(['low', 'normal', 'high', 'urgent']) },
      { name: 'target_date', label: 'Target date', type: 'date' }, { name: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100 },
      { name: 'next_step', label: 'Next step', wide: true }, { name: 'description', label: 'Project brief', type: 'textarea' },
    ] };
  }
  if (resource === 'tasks') {
    const [projects, artists, profiles] = await Promise.all(['projects', 'artists', 'profiles'].map(load));
    return { title: 'Add a task', fields: [
      { name: 'title', label: 'Task', required: true, wide: true },
      { name: 'artist_id', label: 'Roster assignee', type: 'select', required: true, options: optionList(artists) }, { name: 'project_id', label: 'Project', type: 'select', options: optionList(projects) },
      { name: 'assigned_user_id', label: 'Team coordinator', type: 'select', options: optionList(profiles, item => item.display_name) },
      { name: 'status', label: 'Status', type: 'select', options: status(['todo', 'in_progress', 'waiting', 'complete']) },
      { name: 'priority', label: 'Priority', type: 'select', options: status(['low', 'normal', 'high', 'urgent']) },
      { name: 'due_date', label: 'Due date', type: 'date' }, { name: 'description', label: 'Details', type: 'textarea' },
    ] };
  }
  if (resource === 'activities') {
    const [projects, artists] = await Promise.all(['projects', 'artists'].map(load));
    return { title: 'Log activity', fields: [
      { name: 'summary', label: 'Summary', required: true, wide: true },
      { name: 'activity_type', label: 'Type', type: 'select', options: status(['note', 'call', 'email', 'meeting', 'status_change']) },
      { name: 'artist_id', label: 'Artist', type: 'select', options: optionList(artists) }, { name: 'project_id', label: 'Project', type: 'select', options: optionList(projects) },
      { name: 'detail', label: 'Details', type: 'textarea' },
    ] };
  }
  if (resource === 'songs') {
    const projects = await load('projects');
    return { title: 'Add a song or work', fields: [
      { name: 'title', label: 'Title', required: true }, { name: 'alternate_title', label: 'Alternate title' },
      { name: 'project_id', label: 'Project', type: 'select', options: optionList(projects) },
      { name: 'status', label: 'Status', type: 'select', options: status(['draft', 'writing', 'recording', 'mixing', 'mastered', 'released']) },
      { name: 'split_status', label: 'Split status', type: 'select', options: status(['not_started', 'pending', 'confirmed']) },
      { name: 'genre', label: 'Genre' }, { name: 'musical_key', label: 'Key' }, { name: 'bpm', label: 'BPM', type: 'number', min: 20, max: 300 },
      { name: 'iswc', label: 'ISWC' }, { name: 'release_date', label: 'Release date', type: 'date' }, { name: 'notes', label: 'Notes', type: 'textarea' },
    ] };
  }
  if (resource === 'song_contributors') {
    const songs = await load('songs');
    return { title: 'Add a collaborator or split', fields: [
      { name: 'song_id', label: 'Song', type: 'select', required: true, options: optionList(songs, item => item.title) },
      { name: 'contributor_name', label: 'Contributor name', required: true }, { name: 'contributor_email', label: 'Email', type: 'email' },
      { name: 'contributor_role', label: 'Role', placeholder: 'Songwriter, producer…' },
      { name: 'share_percent', label: 'Share %', type: 'number', min: 0, max: 100, step: '0.01', required: true },
      { name: 'pro_affiliation', label: 'PRO affiliation' }, { name: 'publisher', label: 'Publisher / administrator' },
    ] };
  }
  if (resource === 'bookings') {
    const [projects, artists, microsoft] = await Promise.all([load('projects'), load('artists'), request('/api/microsoft-calendar?action=status').catch(() => ({ connected: false }))]);
    return { title: 'Add a booking', fields: [
      { name: 'title', label: 'Event title', required: true, wide: true }, { name: 'starts_at', label: 'Starts', type: 'datetime-local', required: true },
      { name: 'ends_at', label: 'Ends', type: 'datetime-local', required: true }, { name: 'location', label: 'Location or link' },
      { name: 'provider', label: 'Calendar', type: 'select', options: [{ value: 'manual', label: 'Workspace only' }, { value: 'microsoft', label: microsoft.connected ? 'Outlook Calendar' : 'Outlook Calendar (reconnect required)' }] },
      { name: 'artist_id', label: 'Artist', type: 'select', options: optionList(artists) }, { name: 'project_id', label: 'Project', type: 'select', options: optionList(projects) },
      { name: 'status', label: 'Status', type: 'select', options: status(['tentative', 'confirmed', 'completed', 'canceled']) }, { name: 'notes', label: 'Notes', type: 'textarea' },
    ] };
  }
  if (resource === 'file_records') {
    const [projects, artists] = await Promise.all(['projects', 'artists'].map(load));
    return { title: 'Add a file reference', fields: [
      { name: 'name', label: 'File name', required: true, wide: true }, { name: 'artist_id', label: 'Artist', type: 'select', options: optionList(artists) },
      { name: 'project_id', label: 'Project', type: 'select', options: optionList(projects) }, { name: 'object_key', label: 'Repository path or R2 object key', wide: true },
      { name: 'mime_type', label: 'File type' }, { name: 'size_bytes', label: 'Size in bytes', type: 'number', min: 0 },
      { name: 'storage_provider', label: 'Storage provider' }, { name: 'status', label: 'Status' }, { name: 'notes', label: 'Notes', type: 'textarea' },
    ] };
  }
  if (resource === 'vault_links') {
    const [projects, artists] = await Promise.all(['projects', 'artists'].map(load));
    return { title: 'Add password-manager reference', fields: [
      { name: 'service_name', label: 'Service', required: true }, { name: 'manager_name', label: 'Password manager', placeholder: '1Password or Bitwarden' },
      { name: 'item_reference', label: 'Item or vault reference', wide: true }, { name: 'login_url', label: 'Login URL', type: 'url', wide: true },
      { name: 'artist_id', label: 'Artist', type: 'select', options: optionList(artists) }, { name: 'project_id', label: 'Project', type: 'select', options: optionList(projects) },
      { name: 'notes', label: 'Access guidance — never enter a password', type: 'textarea' },
    ] };
  }
  if (resource === 'operator_items') return { title: 'Capture for Sunshine Operator', fields: [
    { name: 'title', label: 'Title', required: true, wide: true }, { name: 'item_type', label: 'Type', type: 'select', options: status(['capture', 'brief', 'draft', 'review', 'decision']) },
    { name: 'risk_level', label: 'Risk level', type: 'select', options: status(['read_only', 'internal_write', 'approval_required']) },
    { name: 'content', label: 'Notes or proposed action', type: 'textarea' },
  ] };
  if (resource === 'profiles') return { title: 'Edit team access', fields: [
    { name: 'display_name', label: 'Display name', required: true, wide: true },
    { name: 'role', label: 'Role', type: 'select', required: true, options: status(['owner', 'admin', 'operations', 'finance', 'read_only']) },
    { name: 'active', label: 'Access status', type: 'select', required: true, options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Disabled' }] },
  ] };
  throw new Error('This record type is not available.');
}

async function openRecordForm(resource, id = null) {
  const modal = $('#record-modal');
  const form = $('#record-form');
  const result = $('#record-result');
  const [definition, records] = await Promise.all([recordDefinition(resource), id ? load(resource) : Promise.resolve([])]);
  const record = id ? records.find(item => String(item.id || item.user_id) === String(id)) : null;
  if (id && !record) throw new Error('That workspace record could not be found.');
  $('#record-modal-title').textContent = record ? 'Edit workspace record' : definition.title;
  $('#record-modal-eyebrow').textContent = friendly(resource);
  form.dataset.resource = resource;
  form.dataset.id = record ? String(record.id || record.user_id) : '';
  form.innerHTML = `<div class="record-grid">${definition.fields.map(field => inputField(field, record || {})).join('')}</div><button class="button" type="submit">${record ? 'Save changes' : 'Save to workspace'} <span>→</span></button>`;
  result.hidden = true;
  openModal(modal);
}

$('#record-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $('#record-result');
  const submit = $('[type="submit"]', form);
  submit.disabled = true;
  submit.textContent = 'Saving…';
  result.hidden = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const editing = Boolean(form.dataset.id);
    const microsoftBooking = form.dataset.resource === 'bookings' && values.provider === 'microsoft';
    const url = microsoftBooking
      ? `/api/microsoft-calendar?action=${editing ? 'update_event' : 'create_event'}`
      : `/api/dashboard?resource=${encodeURIComponent(form.dataset.resource)}`;
    await request(url, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(editing ? { ...values, id: form.dataset.id } : values) });
    closeModal($('#record-modal'));
    await render(currentView);
  } catch (error) {
    result.textContent = error.message;
    result.classList.add('error');
    result.hidden = false;
  } finally {
    submit.disabled = false;
    submit.innerHTML = `${form.dataset.id ? 'Save changes' : 'Save to workspace'} <span>→</span>`;
  }
});

async function overview() {
  const [artists, projects, tasks, inquiries, invoices, payments, bookings, activities] = await Promise.all(['artists', 'projects', 'tasks', 'inquiries', 'invoices', 'payments', 'bookings', 'activities'].map(load));
  const openProjects = projects.filter(item => !['complete', 'archived'].includes(item.status)).length;
  const newInquiries = inquiries.filter(item => item.status === 'new').length;
  const outstanding = invoices.filter(item => ['open', 'sent', 'partially_paid', 'past_due', 'overdue'].includes(item.status)).reduce((total, item) => total + Math.max(0, item.amount_cents - (item.paid_cents || 0)), 0);
  const collected = payments.filter(item => item.status === 'succeeded').reduce((total, item) => total + Math.max(0, item.amount_cents - (item.refunded_cents || 0)), 0);
  const openTasks = tasks.filter(item => !['complete', 'canceled'].includes(item.status));
  const urgent = openTasks.filter(item => item.priority === 'urgent' || (item.due_date && new Date(`${item.due_date}T23:59:59`) < new Date(Date.now() + 7 * 86400000)));
  const upcoming = bookings.filter(item => !['completed', 'canceled'].includes(item.status) && new Date(item.ends_at) >= new Date()).slice(0, 5);
  const attentionRows = [
    ...urgent.slice(0, 4).map(item => [tag(item.priority), escapeHtml(item.title), escapeHtml(item.artist?.name || item.project?.name || 'Workspace'), escapeHtml(date(item.due_date))]),
    ...inquiries.filter(item => item.status === 'new').slice(0, 3).map(item => [tag('new'), escapeHtml(`Inquiry: ${item.name}`), escapeHtml(friendly(item.kind)), escapeHtml(date(item.created_at))]),
    ...invoices.filter(item => ['past_due', 'overdue'].includes(item.status)).slice(0, 3).map(item => [tag(item.status), escapeHtml(item.invoice_number), escapeHtml(item.artist?.name || '—'), escapeHtml(money(item.amount_cents - (item.paid_cents || 0)))]),
  ];
  return `<div class="quick-actions"><button data-create="artists">+ Artist</button><button data-create="projects">+ Project</button><button data-create="tasks">+ Task</button><button data-create="activities">+ Note</button><button data-create="bookings">+ Booking</button></div>
    <div class="metrics six"><article><p>Active artists</p><strong>${artists.filter(item => item.status === 'active').length}</strong><span>Current relationships</span></article><article><p>Open projects</p><strong>${openProjects}</strong><span>Planning through active</span></article><article><p>Open tasks</p><strong>${openTasks.length}</strong><span>${urgent.length} need attention</span></article><article><p>New inquiries</p><strong>${newInquiries}</strong><span>Awaiting review</span></article><article><p>Collected</p><strong>${money(collected)}</strong><span>Successful payments, net refunds</span></article><article><p>Outstanding</p><strong>${money(outstanding)}</strong><span>Open and overdue invoices</span></article></div>
    <div class="dashboard-grid"><div>${table('Needs attention', ['Signal', 'Item', 'Related to', 'Due / amount'], attentionRows)}</div><div class="panel"><div class="panel-heading"><div><p class="eyebrow">Schedule</p><h2>Upcoming</h2></div>${addButton('bookings', 'Booking')}</div>${upcoming.length ? `<div class="agenda">${upcoming.map(item => `<article data-search-row><time>${escapeHtml(dateTime(item.starts_at))}</time><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.artist?.name || item.location || friendly(item.status))}</p></div></article>`).join('')}</div>` : '<p class="muted-copy">No upcoming bookings yet.</p>'}</div></div>
    ${table('Recent activity', ['Type', 'Summary', 'Artist / project', 'When'], activities.slice(0, 8).map(item => [tag(item.activity_type), escapeHtml(item.summary), escapeHtml(item.artist?.name || item.project?.name || 'Workspace'), escapeHtml(dateTime(item.created_at))]), addButton('activities', 'Log activity'))}`;
}

async function billing() {
  const [artists, invoices, plans, retainers, payments, stripeStatus] = await Promise.all([
    load('artists'), load('invoices'), load('payment_plans'), load('retainers'), load('payments'), request('/api/billing'),
  ]);
  const artistOptions = artists.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.email ? ` — ${escapeHtml(item.email)}` : ''}</option>`).join('');
  const billingForm = artists.length ? `<section class="billing-create panel"><div class="panel-heading"><div><p class="eyebrow">Stripe ${escapeHtml(stripeStatus.mode || '')}</p><h2>Create billing</h2></div><span class="connection-state ${stripeStatus.connected ? 'connected' : ''}">${stripeStatus.connected ? 'Connected' : 'Not connected'}</span></div><form id="billing-form">
    <label>Billing type<select name="type" id="billing-type"><option value="invoice">One-time invoice</option><option value="payment_plan">Payment plan</option><option value="retainer">Recurring retainer</option></select></label>
    <label>Artist<select name="artist_id" required><option value="">Choose an artist</option>${artistOptions}</select></label>
    <label class="billing-wide">Description<input name="description" maxlength="500" required placeholder="Studio session, production package, monthly support…" /></label>
    <label>Amount per charge (USD)<input name="amount" type="number" min="1" max="1000000" step="0.01" required placeholder="500.00" /></label>
    <label data-invoice-only>Due date<input name="due_date" type="date" /></label>
    <label data-recurring hidden>Billing interval<select name="interval"><option value="month">Monthly</option><option value="week">Weekly</option><option value="year" data-retainer-only>Yearly</option></select></label>
    <label data-plan-only hidden>Number of installments<input name="installment_count" type="number" min="2" max="36" value="3" /></label>
    <div class="billing-wide"><button class="button" type="submit">Create secure payment link <span>→</span></button><div class="form-result" id="billing-result" hidden></div></div>
  </form></section>` : `<section class="panel"><h2>Add an artist first</h2><p>Billing needs an artist name and email before Stripe can create a customer.</p></section>`;

  const invoiceTable = table('Invoices', ['Invoice', 'Artist', 'Type', 'Total', 'Paid', 'Status', 'Payment'], invoices.map(item => [
    escapeHtml(item.invoice_number), escapeHtml(item.artist?.name || '—'), escapeHtml(friendly(item.billing_type)), escapeHtml(money(item.amount_cents)),
    escapeHtml(money(item.paid_cents)), tag(item.status), paymentLink(item.payment_url || item.hosted_invoice_url),
  ]));
  const planTable = plans.length ? table('Payment plans', ['Artist', 'Installment', 'Progress', 'Interval', 'Status', 'Link'], plans.map(item => [
    escapeHtml(item.artist?.name || '—'), escapeHtml(money(item.installment_amount_cents)), escapeHtml(`${item.installments_paid}/${item.installment_count}`),
    escapeHtml(friendly(item.interval)), tag(item.status), paymentLink(item.checkout_url),
  ])) : '';
  const retainerTable = retainers.length ? table('Retainers', ['Artist', 'Amount', 'Interval', 'Status', 'Next period', 'Link'], retainers.map(item => [
    escapeHtml(item.artist?.name || '—'), escapeHtml(money(item.amount_cents)), escapeHtml(friendly(item.interval)), tag(item.status),
    escapeHtml(date(item.current_period_end)), paymentLink(item.checkout_url),
  ])) : '';
  const paymentTable = payments.length ? table('Payments', ['Invoice', 'Artist', 'Amount', 'Status', 'Paid'], payments.map(item => [
    escapeHtml(item.invoice?.invoice_number || '—'), escapeHtml(item.artist?.name || '—'), escapeHtml(money(item.amount_cents)), tag(item.status), escapeHtml(date(item.paid_at)),
  ])) : '';
  return `<div class="billing-layout">${billingForm}<div class="billing-records">${invoiceTable}${planTable}${retainerTable}${paymentTable}</div></div>`;
}

async function settings() {
  const [items, stripeStatus, microsoft] = await Promise.all([
    load('integration_connections'), request('/api/billing').catch(() => ({ connected: false, mode: null })),
    request('/api/microsoft-calendar?action=status').catch(() => ({ configured: false, connected: false, status: 'not_configured' })),
  ]);
  const cards = items.map(item => {
    const isMicrosoft = item.provider === 'microsoft_calendar';
    const status = isMicrosoft ? microsoft.status : item.status;
    const account = isMicrosoft ? microsoft.accountLabel : item.account_label;
    const action = isMicrosoft
      ? microsoft.connected
        ? ''
        : microsoft.configured
          ? '<a class="integration-action" href="/api/microsoft-calendar?action=connect">Connect Outlook</a>'
          : '<span class="setup-needed">Microsoft app registration needed</span>'
      : '';
    return `<article class="integration-card" data-search-row><div class="integration-icon">${escapeHtml(item.display_name.slice(0, 1))}</div><div><p class="eyebrow">${escapeHtml(friendly(item.provider))}</p><h2>${escapeHtml(item.display_name)}</h2><p>${escapeHtml(isMicrosoft && microsoft.calendarName ? `Primary calendar: ${microsoft.calendarName}` : item.notes || 'Integration status')}</p>${account ? `<small>${escapeHtml(account)}</small>` : ''}${action}</div><span class="connection-state ${status === 'connected' ? 'connected' : status === 'needs_attention' ? 'attention-state' : ''}">${escapeHtml(friendly(status))}</span></article>`;
  }).join('');
  return `<p class="integration-note"><strong>Safe setup center.</strong> Account labels and connection health may appear here, but secret keys and OAuth tokens are never returned to the browser. Stripe is reporting ${stripeStatus.connected ? `${escapeHtml(stripeStatus.mode)} mode` : 'not configured'}.</p><div class="integration-grid">${cards}</div><section class="decision-panel"><h2>Decisions still required</h2><p>Before connecting the remaining providers, confirm the email sender, required Google calendars, R2 bucket, AI operator name and limits, password-manager choice, and whether Chase means merchant processing or bank reconciliation.</p></section>`;
}

const pages = {
  overview,
  artists: async () => {
    const items = await load('artists');
    return table('Artists & CRM', ['Name', 'Email', 'Phone', 'Stage', 'Status', 'Next step', 'Actions'], items.map(item => [
      `<strong>${escapeHtml(item.name)}</strong>${item.genres ? `<small>${escapeHtml(item.genres)}</small>` : ''}`,
      item.email ? `<a href="mailto:${encodeURIComponent(item.email)}">${escapeHtml(item.email)}</a>` : '—',
      item.phone ? `<a href="tel:${encodeURIComponent(item.phone)}">${escapeHtml(item.phone)}</a>` : '—',
      escapeHtml(item.stage || '—'), tag(item.status), escapeHtml(item.next_step || '—'), editButton('artists', item.id),
    ]), addButton('artists', 'Add artist'));
  },
  projects: async () => {
    const items = await load('projects');
    return table('Projects & roadmaps', ['Project', 'Artist', 'Type', 'Progress', 'Priority', 'Status', 'Target', 'Actions'], items.map(item => [
      `<strong>${escapeHtml(item.name)}</strong>${item.next_step ? `<small>Next: ${escapeHtml(item.next_step)}</small>` : ''}`, escapeHtml(item.artist?.name || '—'), escapeHtml(item.project_type || '—'),
      `<div class="progress"><span style="width:${Math.max(0, Math.min(100, item.progress || 0))}%"></span></div><small>${item.progress || 0}%</small>`, tag(item.priority),
      statusSelect('projects', item.id, 'status', item.status, ['planning', 'active', 'blocked', 'complete', 'archived']), escapeHtml(date(item.target_date)), editButton('projects', item.id),
    ]), addButton('projects', 'Create project'));
  },
  tasks: async () => {
    const items = await load('tasks');
    return table('Tasks by roster', ['Task', 'Roster assignee', 'Project', 'Team coordinator', 'Priority', 'Status', 'Due', 'Actions'], items.map(item => [
      `<strong>${escapeHtml(item.title)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}`,
      `<strong>${escapeHtml(item.artist?.name || 'Needs roster assignment')}</strong>`, escapeHtml(item.project?.name || '—'),
      escapeHtml(item.assignee?.display_name || 'Unassigned'), tag(item.priority), statusSelect('tasks', item.id, 'status', item.status, ['todo', 'in_progress', 'waiting', 'complete', 'canceled']), escapeHtml(date(item.due_date)), editButton('tasks', item.id),
    ]), addButton('tasks', 'Add task'));
  },
  activity: async () => {
    const items = await load('activities');
    return table('Activity timeline', ['Type', 'Summary', 'Artist', 'Project', 'By', 'When', 'Actions'], items.map(item => [
      tag(item.activity_type), escapeHtml(item.summary), escapeHtml(item.artist?.name || '—'), escapeHtml(item.project?.name || '—'), escapeHtml(item.actor?.display_name || 'Team'), escapeHtml(dateTime(item.created_at)), editButton('activities', item.id),
    ]), addButton('activities', 'Log activity'));
  },
  songs: async () => {
    const [songs, contributors] = await Promise.all(['songs', 'song_contributors'].map(load));
    const totals = contributors.reduce((map, item) => map.set(item.song_id, (map.get(item.song_id) || 0) + Number(item.share_percent || 0)), new Map());
    return `<div class="section-stack">${table('Songs & works', ['Song', 'Project', 'Status', 'Splits', 'Share total', 'Release', 'Actions'], songs.map(item => [
      `<strong>${escapeHtml(item.title)}</strong>${item.genre ? `<small>${escapeHtml(item.genre)}${item.bpm ? ` · ${item.bpm} BPM` : ''}</small>` : ''}`,
      escapeHtml(item.project?.name || '—'), tag(item.status), tag(item.split_status), `<span class="${totals.get(item.id) === 100 ? 'share-ok' : 'share-warning'}">${totals.get(item.id) || 0}%</span>`, escapeHtml(date(item.release_date)), editButton('songs', item.id),
    ]), addButton('songs', 'Add song'))}${table('Collaborators & ownership claims', ['Song', 'Contributor', 'Role', 'PRO / publisher', 'Share', 'Confirmed', 'Actions'], contributors.map(item => [
      escapeHtml(item.song?.title || '—'), escapeHtml(item.contributor_name), escapeHtml(friendly(item.contributor_role)), escapeHtml([item.pro_affiliation, item.publisher].filter(Boolean).join(' · ') || '—'), `${escapeHtml(item.share_percent)}%`, item.confirmed_at ? tag('confirmed') : tag('pending'), editButton('song_contributors', item.id),
    ]), addButton('song_contributors', 'Add collaborator'))}</div>`;
  },
  invoices: billing,
  inquiries: async () => {
    const items = await load('inquiries');
    return items.length ? `<section class="table-panel"><div class="panel-heading"><div><p class="eyebrow">Website leads</p><h2>Inquiries</h2></div></div><div class="inquiry-list">${items.map(item => `<article><div><h3>${escapeHtml(item.name)}</h3><p><a href="mailto:${encodeURIComponent(item.email)}">${escapeHtml(item.email)}</a> · <a href="tel:${encodeURIComponent(item.phone || '')}">${escapeHtml(item.phone || 'No phone')}</a> · Prefers ${escapeHtml(friendly(item.contact_preference || 'email'))} · ${escapeHtml(friendly(item.kind))} · ${escapeHtml(date(item.created_at))}</p><p>${escapeHtml(item.path || (item.availability ? `${item.availability} (${item.time_zone || 'time zone not provided'})` : item.idea) || 'No additional note.')}</p></div><div class="inquiry-actions"><label>Status<select data-inquiry-id="${escapeHtml(item.id)}">${['new', 'reviewing', 'contacted', 'closed'].map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${friendly(status)}</option>`).join('')}</select></label>${editButton('inquiries', item.id)}</div></article>`).join('')}</div></section>` : empty('New public website inquiries will appear here.');
  },
  calendar: async () => {
    const [bookings, microsoft] = await Promise.all([load('bookings'), request('/api/microsoft-calendar?action=status').catch(() => ({ configured: false, connected: false, status: 'not_configured' }))]);
    let outlookEvents = [];
    let outlookError = null;
    if (microsoft.connected) {
      try { outlookEvents = (await request('/api/microsoft-calendar?action=events')).data || []; }
      catch (error) { outlookError = error.message; }
    }
    return `${monthCalendar(outlookEvents, bookings, microsoft, outlookError)}<div class="section-stack">${table('Workspace bookings', ['Event', 'Artist / project', 'Starts', 'Ends', 'Provider', 'Status', 'Location', 'Actions'], bookings.map(item => [
        escapeHtml(item.title), escapeHtml(item.artist?.name || item.project?.name || '—'), escapeHtml(dateTime(item.starts_at)), escapeHtml(dateTime(item.ends_at)), escapeHtml(friendly(item.provider)),
        statusSelect('bookings', item.id, 'status', item.status, ['tentative', 'confirmed', 'completed', 'canceled']), escapeHtml(item.location || '—'), editButton('bookings', item.id),
      ]), addButton('bookings', 'Add booking'))}</div>`;
  },
  communications: async () => {
    const [artists, microsoft, activities] = await Promise.all([
      load('artists'),
      request('/api/microsoft-calendar?action=status').catch(() => ({ configured: false, connected: false, mailEnabled: false, status: 'not_configured' })),
      load('activities'),
    ]);
    const recipients = artists.filter(item => item.email);
    const connectionAction = microsoft.configured
      ? `<a class="button button-small" href="/api/microsoft-calendar?action=connect">${microsoft.connected ? 'Reconnect Outlook' : 'Connect Outlook'}</a>`
      : '<span class="setup-needed">Microsoft app registration needed</span>';
    const composer = microsoft.connected && microsoft.mailEnabled
      ? `<form id="communication-form" class="communication-form"><div class="communication-heading"><div><p class="eyebrow">Outlook · ${escapeHtml(microsoft.accountLabel || 'Work email')}</p><h2>Compose client email</h2></div><span class="connection-state connected">Ready to send</span></div><div class="record-grid"><label>Roster contact<select name="artist_id" id="communication-artist" required><option value="">Choose a client…</option>${recipients.map(item => `<option value="${escapeHtml(item.id)}" data-email="${escapeHtml(item.email)}">${escapeHtml(item.name)} — ${escapeHtml(item.email)}</option>`).join('')}</select></label><label>To<input name="to" id="communication-to" type="email" autocomplete="off" required /></label><label class="record-wide">Subject<input name="subject" maxlength="200" required /></label><label class="record-wide">Message<textarea name="message" rows="10" maxlength="10000" required></textarea></label></div><button class="button" type="submit">Send through Outlook <span>→</span></button><div class="form-result" id="communication-result" role="status" aria-live="polite" aria-atomic="true" hidden></div></form>`
      : `<section class="communication-connect"><div><p class="eyebrow">Outlook communications</p><h2>${microsoft.requiresReauthorization ? 'Approve email access once.' : 'Connect the work mailbox.'}</h2><p>${microsoft.requiresReauthorization ? 'The calendar connection is active, but Outlook needs one additional Mail.Send permission before this dashboard can send client email.' : 'Connect the Love & Sunshine Microsoft work account to send client email from this workspace.'}</p></div>${connectionAction}</section>`;
    const sent = activities.filter(item => item.activity_type === 'email');
    return `${composer}${table('Recent client communications', ['Client', 'Summary', 'Details', 'Sent by', 'When', 'Actions'], sent.map(item => [
      escapeHtml(item.artist?.name || '—'), escapeHtml(item.summary), escapeHtml(item.detail || '—'), escapeHtml(item.actor?.display_name || 'Team'), escapeHtml(dateTime(item.created_at)), editButton('activities', item.id),
    ]))}`;
  },
  files: async () => `<p class="integration-note"><strong>File catalog enabled.</strong> Approved public brand assets remain in the GitHub repository. Connect Cloudflare R2 before uploading private artist files; until then this section stores metadata and references only.</p>${table('File records', ['Name', 'Artist / project', 'Provider', 'Type', 'Status', 'Added', 'Actions'], (await load('file_records')).map(item => [
    `<strong>${escapeHtml(item.name)}</strong>${item.object_key ? `<small>${escapeHtml(item.object_key)}</small>` : ''}`, escapeHtml(item.artist?.name || item.project?.name || '—'), escapeHtml(friendly(item.storage_provider)), escapeHtml(item.mime_type || '—'), tag(item.status), escapeHtml(date(item.created_at)), editButton('file_records', item.id),
  ]), addButton('file_records', 'Add file reference'))}`,
  operator: async () => `<section class="operator-hero"><div><p class="eyebrow">Controlled assistant workspace</p><h2>Sunshine Operator</h2><p>Capture decisions, drafts, briefs, and review items now. Model-powered tools remain disabled until an OpenAI project, budget, permissions, and approval rules are confirmed.</p></div>${addButton('operator_items', 'New capture')}</section>${table('Review & capture queue', ['Type', 'Title', 'Risk', 'Status', 'Created by', 'Added', 'Actions'], (await load('operator_items')).map(item => [
    tag(item.item_type), `<strong>${escapeHtml(item.title)}</strong>${item.content ? `<small>${escapeHtml(item.content)}</small>` : ''}`, tag(item.risk_level),
    statusSelect('operator_items', item.id, 'status', item.status, ['open', 'draft', 'approved', 'completed', 'dismissed']), escapeHtml(item.creator?.display_name || 'Team'), escapeHtml(dateTime(item.created_at)), editButton('operator_items', item.id),
  ]), addButton('operator_items', 'New capture'))}`,
  vault: async () => `<p class="integration-note"><strong>No passwords are stored here.</strong> This dashboard keeps references to records in a mature password manager such as 1Password or Bitwarden. Never enter secret values into titles, notes, or URLs.</p>${table('Password-manager references', ['Service', 'Manager', 'Artist / project', 'Reference', 'Login', 'Updated', 'Actions'], (await load('vault_links')).map(item => [
    escapeHtml(item.service_name), escapeHtml(item.manager_name), escapeHtml(item.artist?.name || item.project?.name || 'Workspace'), escapeHtml(item.item_reference || '—'), item.login_url ? `<a href="${escapeHtml(item.login_url)}" target="_blank" rel="noopener">Open service ↗</a>` : '—', escapeHtml(date(item.updated_at)), editButton('vault_links', item.id),
  ]), addButton('vault_links', 'Add reference'))}`,
  team: async () => table('Team & access', ['Name', 'Role', 'Status', 'Added', 'Updated', 'Actions'], (await load('profiles')).map(item => [escapeHtml(item.display_name), tag(item.role), tag(item.active ? 'active' : 'disabled'), escapeHtml(date(item.created_at)), escapeHtml(date(item.updated_at)), signedInAccount?.profile?.role === 'owner' ? editButton('profiles', item.user_id) : '<span class="muted-copy">Owner only</span>'])),
  audit: async () => table('Audit log', ['Actor', 'Action', 'Target', 'Outcome', 'Changed fields', 'When'], (await load('audit_events')).map(item => [escapeHtml(item.actor?.display_name || 'System'), escapeHtml(friendly(item.action)), escapeHtml(friendly(item.target_type)), tag(item.outcome), escapeHtml((item.metadata?.changed_fields || []).join(', ') || '—'), escapeHtml(dateTime(item.created_at))])),
  settings,
};

function statusSelect(resource, id, field, value, values) {
  return `<select class="inline-status" data-update-resource="${escapeHtml(resource)}" data-update-id="${escapeHtml(id)}" data-update-field="${escapeHtml(field)}">${values.map(option => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(friendly(option))}</option>`).join('')}</select>`;
}

function connection(icon, name, description, variables) {
  const connected = variables === 'Connected';
  return `<article class="connection"><span class="icon">${icon}</span><div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(description)}</p></div>${connected ? '<span class="connection-state connected">Connected</span>' : `<button data-connect="${escapeHtml(name)}" data-vars="${escapeHtml(variables)}">Setup details</button>`}</article>`;
}

function bindBillingForm() {
  const form = $('#billing-form');
  if (!form) return;
  const type = $('#billing-type');
  const syncFields = () => {
    const recurring = type.value !== 'invoice';
    $$('[data-invoice-only]', form).forEach(element => { element.hidden = recurring; });
    $$('[data-recurring]', form).forEach(element => { element.hidden = !recurring; });
    $$('[data-plan-only]', form).forEach(element => { element.hidden = type.value !== 'payment_plan'; });
    $$('[data-retainer-only]', form).forEach(option => { option.hidden = type.value !== 'retainer'; });
    if (type.value !== 'retainer' && form.elements.interval.value === 'year') form.elements.interval.value = 'month';
  };
  type.addEventListener('change', syncFields);
  syncFields();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('[type="submit"]', form);
    const result = $('#billing-result');
    const values = Object.fromEntries(new FormData(form));
    const amount = Number(values.amount);
    const action = values.type === 'invoice' ? 'create_invoice' : `create_${values.type}`;
    submit.disabled = true;
    submit.textContent = 'Creating in Stripe…';
    result.hidden = true;
    try {
      const created = await request('/api/billing', {
        method: 'POST',
        body: JSON.stringify({ ...values, action, amount_cents: Math.round(amount * 100), installment_count: Number(values.installment_count) }),
      });
      result.classList.remove('error');
      result.innerHTML = `<strong>${escapeHtml(created.invoice_number)} is ready.</strong><br><a href="${escapeHtml(created.payment_url)}" target="_blank" rel="noopener">Open the secure Stripe payment page ↗</a>`;
      result.hidden = false;
      setTimeout(() => render('invoices'), 1800);
    } catch (error) {
      result.classList.add('error');
      result.textContent = error.message;
      result.hidden = false;
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Create secure payment link <span>→</span>';
    }
  });
}

function bindCommunicationForm() {
  const form = $('#communication-form');
  if (!form) return;
  const artist = $('#communication-artist');
  const recipient = $('#communication-to');
  const result = $('#communication-result');
  artist.addEventListener('change', () => {
    recipient.value = artist.selectedOptions[0]?.dataset.email || '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('[type="submit"]', form);
    submit.disabled = true;
    submit.textContent = 'Sending through Outlook…';
    result.hidden = true;
    result.classList.remove('error');
    try {
      const sent = await request('/api/microsoft-calendar?action=send_mail', {
        method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      result.innerHTML = `<strong>Email sent to ${escapeHtml(sent.recipient)}.</strong>${sent.activityLogged ? '<br>It was also added to the client activity timeline.' : '<br>The email was sent, but the activity timeline could not be updated.'}`;
      result.hidden = false;
      form.reset();
    } catch (error) {
      result.classList.add('error');
      result.textContent = error.message;
      result.hidden = false;
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Send through Outlook <span>→</span>';
    }
  });
}

async function render(view = 'overview') {
  currentView = view;
  $('#view-content').innerHTML = '<p class="loading">Loading secure workspace…</p>';
  $('#view-title').textContent = view === 'overview' ? 'Workspace overview' : friendly(view);
  $$('.dashboard [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  try {
    $('#view-content').innerHTML = await pages[view]();
    bindBillingForm();
    bindCommunicationForm();
    $$('[data-create]').forEach(button => button.addEventListener('click', () => openRecordForm(button.dataset.create).catch(error => alert(error.message))));
    $$('[data-edit-resource]').forEach(button => button.addEventListener('click', () => openRecordForm(button.dataset.editResource, button.dataset.editId).catch(error => alert(error.message))));
    $$('[data-calendar-shift]').forEach(button => button.addEventListener('click', () => {
      calendarMonthCursor = new Date(calendarMonthCursor.getFullYear(), calendarMonthCursor.getMonth() + Number(button.dataset.calendarShift), 1);
      render('calendar');
    }));
    $('[data-calendar-today]')?.addEventListener('click', () => {
      calendarMonthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      render('calendar');
    });
    $$('[data-update-resource]').forEach(select => select.addEventListener('change', async () => {
      const previous = [...select.options].find(option => option.defaultSelected)?.value || select.value;
      select.disabled = true;
      try {
        await request(`/api/dashboard?resource=${encodeURIComponent(select.dataset.updateResource)}`, {
          method: 'PATCH',
          body: JSON.stringify({ id: select.dataset.updateId, [select.dataset.updateField]: select.value }),
        });
      } catch (error) {
        select.value = previous;
        alert(error.message);
      } finally { select.disabled = false; }
    }));
    $$('[data-inquiry-id]').forEach(select => select.addEventListener('change', async () => {
      select.disabled = true;
      try { await request('/api/dashboard?resource=inquiries', { method: 'PATCH', body: JSON.stringify({ id: select.dataset.inquiryId, status: select.value }) }); }
      catch (error) { alert(error.message); }
      finally { select.disabled = false; }
    }));
    $$('[data-connect]').forEach(button => button.addEventListener('click', () => alert(`${button.dataset.connect} is not connected yet. When you are ready, sign in to that provider directly. The protected values needed are:\n\n${button.dataset.vars.split(', ').join('\n')}\n\nNever paste secret credentials into website forms or commit them to GitHub.`)));
  } catch (error) {
    if (/sign in/i.test(error.message)) {
      $('#dashboard').hidden = true;
      document.body.style.overflow = '';
      openModal($('#admin'));
    } else {
      $('#view-content').innerHTML = `<div class="form-result error">${escapeHtml(error.message)}</div>`;
    }
  }
}

$$('.dashboard [data-view]').forEach(button => button.addEventListener('click', () => render(button.dataset.view)));
$('#global-search')?.addEventListener('input', event => {
  const query = event.currentTarget.value.trim().toLowerCase();
  $$('[data-search-row]', $('#view-content')).forEach(row => { row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query); });
});
$('.mobile-menu')?.addEventListener('click', () => $('#dashboard').classList.toggle('sidebar-open'));
$('#exit-dashboard')?.addEventListener('click', () => {
  if (document.body.dataset.adminPage === 'true') window.location.assign('/');
  else { $('#dashboard').hidden = true; document.body.style.overflow = ''; }
});
$('#logout-dashboard')?.addEventListener('click', async () => {
  await request('/api/auth', { method: 'DELETE' }).catch(() => {});
  $('#dashboard').hidden = true;
  document.body.style.overflow = '';
  if (document.body.dataset.adminPage === 'true') openModal($('#admin'));
});

if (document.body.dataset.adminPage === 'true') {
  request('/api/auth').then(showDashboard).catch(() => openModal($('#admin')));
}
