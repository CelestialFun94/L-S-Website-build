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
  $$('.site-header nav a').forEach(link => link.addEventListener('click', closeNavigation));
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
      'I want to write with someone': 'A co-writing conversation is a strong next move.',
      'I’m still finding the fit': 'A short discovery conversation was made for exactly this moment.',
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
const paymentLink = url => url ? `<a class="billing-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open ↗</a>` : '—';

async function overview() {
  const [artists, projects, inquiries, invoices] = await Promise.all(['artists', 'projects', 'inquiries', 'invoices'].map(load));
  const openProjects = projects.filter(item => !['complete', 'archived'].includes(item.status)).length;
  const newInquiries = inquiries.filter(item => item.status === 'new').length;
  const outstanding = invoices.filter(item => ['open', 'sent', 'partially_paid', 'past_due', 'overdue'].includes(item.status)).reduce((total, item) => total + Math.max(0, item.amount_cents - (item.paid_cents || 0)), 0);
  return `<div class="metrics"><article><p>Active artists</p><strong>${artists.filter(item => item.status === 'active').length}</strong><span>Live workspace records</span></article><article><p>Open projects</p><strong>${openProjects}</strong><span>Planning, active, or blocked</span></article><article><p>New inquiries</p><strong>${newInquiries}</strong><span>Awaiting review</span></article><article><p>Outstanding</p><strong>${money(outstanding)}</strong><span>Sent and overdue invoices</span></article></div>${inquiries.length ? table('Recent inquiries', ['Name', 'Type', 'Status', 'Received'], inquiries.slice(0, 5).map(item => [escapeHtml(item.name), escapeHtml(friendly(item.kind)), tag(item.status), escapeHtml(date(item.created_at))])) : empty('Website inquiries will appear here as soon as they arrive.')}`;
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
  const stripeStatus = await request('/api/billing').catch(() => ({ connected: false, mode: null }));
  return `<p class="integration-note"><strong>Connected now:</strong> Vercel hosting, Supabase database/authentication${stripeStatus.connected ? `, and Stripe ${escapeHtml(stripeStatus.mode)} billing` : ''}. Provider secrets remain protected in server-only environment variables.</p><div class="setup-list">${connection('▣', 'Stripe', stripeStatus.connected ? `Connected in ${stripeStatus.mode} mode for invoices, payment plans, retainers, and signed webhooks` : 'Billing, invoices, and payment links', stripeStatus.connected ? 'Connected' : 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET')}${connection('✉', 'Resend', 'Transactional inquiry and invoice email', 'RESEND_API_KEY, EMAIL_FROM')}${connection('G', 'Google Calendar', 'Availability and booking conflicts', 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET')}${connection('◧', 'Microsoft 365 / Outlook', 'Unified availability', 'MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET')}${connection('☁', 'Protected file storage', 'Private artist and project files', 'Storage provider credentials')}</div>`;
}

const pages = {
  overview,
  artists: async () => table('Artists', ['Name', 'Stage', 'Status', 'Next step'], (await load('artists')).map(item => [escapeHtml(item.name), escapeHtml(item.stage || '—'), tag(item.status), escapeHtml(item.next_step || '—')])),
  projects: async () => table('Projects', ['Project', 'Artist', 'Status', 'Target'], (await load('projects')).map(item => [escapeHtml(item.name), escapeHtml(item.artist?.name || '—'), tag(item.status), escapeHtml(date(item.target_date))])),
  songs: async () => table('Songs & splits', ['Song', 'Project', 'Status', 'Splits'], (await load('songs')).map(item => [escapeHtml(item.title), escapeHtml(item.project?.name || '—'), tag(item.status), tag(item.split_status)])),
  invoices: billing,
  inquiries: async () => {
    const items = await load('inquiries');
    return items.length ? `<section class="table-panel"><div class="panel-heading"><div><p class="eyebrow">Website leads</p><h2>Inquiries</h2></div></div><div class="inquiry-list">${items.map(item => `<article><div><h3>${escapeHtml(item.name)}</h3><p><a href="mailto:${encodeURIComponent(item.email)}">${escapeHtml(item.email)}</a> · ${escapeHtml(friendly(item.kind))} · ${escapeHtml(date(item.created_at))}</p><p>${escapeHtml(item.path || item.idea || 'No additional note.')}</p></div><label>Status<select data-inquiry-id="${escapeHtml(item.id)}">${['new', 'reviewing', 'contacted', 'closed'].map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${friendly(status)}</option>`).join('')}</select></label></article>`).join('')}</div></section>` : empty('New public website inquiries will appear here.');
  },
  files: async () => `<div class="empty"><h2>Public image library ready.</h2><p>Add approved website images to <code>public/images</code> in the GitHub repository. Private artist files require a separate protected storage connection.</p></div>`,
  settings,
};

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

async function render(view = 'overview') {
  $('#view-content').innerHTML = '<p class="loading">Loading secure workspace…</p>';
  $('#view-title').textContent = view === 'overview' ? 'Workspace overview' : friendly(view);
  $$('.dashboard [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  try {
    $('#view-content').innerHTML = await pages[view]();
    bindBillingForm();
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
