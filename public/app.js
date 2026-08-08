const $ = (selector, element = document) => element.querySelector(selector);
const $$ = (selector, element = document) => [...element.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const friendly = value => String(value ?? '—').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const openModal = dialog => {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else { dialog.setAttribute('open', ''); dialog.style.display = 'block'; }
};
const closeModal = dialog => {
  if (typeof dialog.close === 'function') dialog.close();
  else { dialog.removeAttribute('open'); dialog.style.display = ''; }
};

$('#year').textContent = new Date().getFullYear();
$('#dashboard-date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

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
  result.hidden = true;
  submit.disabled = true;
  submit.textContent = 'Sending…';
  try {
    await request('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify({ ...data, kind, consent: data.consent === 'on' }),
    });
    const guidance = {
      'I have songs but no plan': 'An Artist Direction Session is a strong place to start.',
      'I want to write with someone': 'A co-writing conversation is a strong next move.',
      'I’m ready to release something': 'A Release Mapping Session can give the project a clear runway.',
      'I’m not sure yet': 'An Artist Direction Session was made for exactly this moment.',
    };
    result.classList.remove('error');
    result.innerHTML = kind === 'starter'
      ? `<strong>Thank you, ${escapeHtml(data.name)}.</strong><br>${escapeHtml(guidance[data.path])} Your note is safely in the Love & Sunshine workspace.`
      : `<strong>We received your inquiry, ${escapeHtml(data.name)}.</strong><br>We’ll review it with care and follow up before confirming any session.`;
    form.reset();
  } catch (error) {
    result.classList.add('error');
    result.textContent = error.message;
  } finally {
    result.hidden = false;
    submit.disabled = false;
    submit.innerHTML = kind === 'starter' ? 'Send my starting point <span>→</span>' : 'Send inquiry <span>→</span>';
  }
}));

function showDashboard(account) {
  closeModal($('#admin'));
  $('#dashboard').hidden = false;
  document.body.style.overflow = 'hidden';
  const name = account.profile.display_name || 'Team';
  $('#view-title').textContent = `Welcome, ${name}.`;
  $('#account-avatar').textContent = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  render('overview');
}

$('#login-form').addEventListener('submit', async event => {
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

function table(title, headings, rows) {
  if (!rows.length) return empty(`New ${title.toLowerCase()} will appear here.`);
  return `<section class="table-panel"><div class="panel-heading"><div><p class="eyebrow">Love & Sunshine</p><h2>${escapeHtml(title)}</h2></div></div><div class="table-scroll"><table><thead><tr>${headings.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

const tag = value => `<span class="tag ${['active', 'paid', 'confirmed', 'complete'].includes(String(value).toLowerCase()) ? 'green' : ''}">${escapeHtml(friendly(value))}</span>`;
const date = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

async function overview() {
  const [artists, projects, inquiries, invoices] = await Promise.all(['artists', 'projects', 'inquiries', 'invoices'].map(load));
  const openProjects = projects.filter(item => !['complete', 'archived'].includes(item.status)).length;
  const newInquiries = inquiries.filter(item => item.status === 'new').length;
  const outstanding = invoices.filter(item => ['sent', 'overdue'].includes(item.status)).reduce((total, item) => total + item.amount_cents, 0);
  return `<div class="metrics"><article><p>Active artists</p><strong>${artists.filter(item => item.status === 'active').length}</strong><span>Live workspace records</span></article><article><p>Open projects</p><strong>${openProjects}</strong><span>Planning, active, or blocked</span></article><article><p>New inquiries</p><strong>${newInquiries}</strong><span>Awaiting review</span></article><article><p>Outstanding</p><strong>${money(outstanding)}</strong><span>Sent and overdue invoices</span></article></div>${inquiries.length ? table('Recent inquiries', ['Name', 'Type', 'Status', 'Received'], inquiries.slice(0, 5).map(item => [escapeHtml(item.name), escapeHtml(friendly(item.kind)), tag(item.status), escapeHtml(date(item.created_at))])) : empty('Website inquiries will appear here as soon as they arrive.')}`;
}

const pages = {
  overview,
  artists: async () => table('Artists', ['Name', 'Stage', 'Status', 'Next step'], (await load('artists')).map(item => [escapeHtml(item.name), escapeHtml(item.stage || '—'), tag(item.status), escapeHtml(item.next_step || '—')])),
  projects: async () => table('Projects', ['Project', 'Artist', 'Status', 'Target'], (await load('projects')).map(item => [escapeHtml(item.name), escapeHtml(item.artist?.name || '—'), tag(item.status), escapeHtml(date(item.target_date))])),
  songs: async () => table('Songs & splits', ['Song', 'Project', 'Status', 'Splits'], (await load('songs')).map(item => [escapeHtml(item.title), escapeHtml(item.project?.name || '—'), tag(item.status), tag(item.split_status)])),
  invoices: async () => table('Billing', ['Invoice', 'Artist', 'Amount', 'Status'], (await load('invoices')).map(item => [escapeHtml(item.invoice_number), escapeHtml(item.artist?.name || '—'), escapeHtml(money(item.amount_cents)), tag(item.status)])),
  inquiries: async () => {
    const items = await load('inquiries');
    return items.length ? `<section class="table-panel"><div class="panel-heading"><div><p class="eyebrow">Website leads</p><h2>Inquiries</h2></div></div><div class="inquiry-list">${items.map(item => `<article><div><h3>${escapeHtml(item.name)}</h3><p><a href="mailto:${encodeURIComponent(item.email)}">${escapeHtml(item.email)}</a> · ${escapeHtml(friendly(item.kind))} · ${escapeHtml(date(item.created_at))}</p><p>${escapeHtml(item.path || item.idea || 'No additional note.')}</p></div><label>Status<select data-inquiry-id="${escapeHtml(item.id)}">${['new', 'reviewing', 'contacted', 'closed'].map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${friendly(status)}</option>`).join('')}</select></label></article>`).join('')}</div></section>` : empty('New public website inquiries will appear here.');
  },
  files: async () => `<div class="empty"><h2>Public image library ready.</h2><p>Add approved website images to <code>public/images</code> in the GitHub repository. Private artist files require a separate protected storage connection.</p></div>`,
  settings: async () => `<p class="integration-note"><strong>Connected now:</strong> Vercel hosting and Supabase database/authentication. Provider secrets belong only in protected environment variables.</p><div class="setup-list">${connection('▣', 'Stripe', 'Billing, invoices, and payment links', 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET')}${connection('✉', 'Resend', 'Transactional inquiry and invoice email', 'RESEND_API_KEY, EMAIL_FROM')}${connection('G', 'Google Calendar', 'Availability and booking conflicts', 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET')}${connection('◧', 'Microsoft 365 / Outlook', 'Unified availability', 'MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET')}${connection('☁', 'Protected file storage', 'Private artist and project files', 'Storage provider credentials')}</div>`,
};

function connection(icon, name, description, variables) {
  return `<article class="connection"><span class="icon">${icon}</span><div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(description)}</p></div><button data-connect="${escapeHtml(name)}" data-vars="${escapeHtml(variables)}">Setup details</button></article>`;
}

async function render(view = 'overview') {
  $('#view-content').innerHTML = '<p class="loading">Loading secure workspace…</p>';
  $('#view-title').textContent = view === 'overview' ? 'Workspace overview' : friendly(view);
  $$('.dashboard [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  try {
    $('#view-content').innerHTML = await pages[view]();
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
$('#exit-dashboard').addEventListener('click', () => { $('#dashboard').hidden = true; document.body.style.overflow = ''; });
$('#logout-dashboard').addEventListener('click', async () => {
  await request('/api/auth', { method: 'DELETE' }).catch(() => {});
  $('#dashboard').hidden = true;
  document.body.style.overflow = '';
});
