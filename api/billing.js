const { randomBytes, randomUUID } = require('node:crypto');
const { adminSupabase, json, method, session } = require('./_lib');
const { siteUrl, stripe, stripeMode } = require('./_stripe');

const MANAGERS = new Set(['owner', 'admin', 'finance']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) throw new Error('Amount must be between $1.00 and $1,000,000.00.');
  return amount;
}

function scalar(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

function integrationIdentifier() {
  const suffix = Array.from(randomBytes(8), byte => String.fromCharCode(97 + (byte % 26))).join('');
  return `love_sunshine_${suffix}`;
}

async function body(response, fallback) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || fallback);
  return data;
}

async function adminGet(table, query) {
  return body(await adminSupabase(`/rest/v1/${table}?${query}`), `Unable to read ${table}.`);
}

async function adminInsert(table, record, conflict) {
  const suffix = conflict ? `?on_conflict=${encodeURIComponent(conflict)}` : '';
  return body(await adminSupabase(`/rest/v1/${table}${suffix}`, {
    method: 'POST',
    headers: { Prefer: `${conflict ? 'resolution=merge-duplicates,' : ''}return=representation` },
    body: JSON.stringify(record),
  }), `Unable to create ${table}.`);
}

async function adminPatch(table, filter, record) {
  return body(await adminSupabase(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record),
  }), `Unable to update ${table}.`);
}

async function artistAndCustomer(artistId) {
  if (!UUID.test(artistId)) throw new Error('Choose a valid artist.');
  const artists = await adminGet('artists', `id=eq.${encodeURIComponent(artistId)}&select=id,name,email&limit=1`);
  const artist = artists[0];
  if (!artist) throw new Error('Artist not found.');

  const livemode = stripeMode() === 'live';
  const existing = await adminGet('stripe_customers', `artist_id=eq.${artist.id}&livemode=eq.${livemode}&select=stripe_customer_id&limit=1`);
  if (existing[0]) return { artist, customerId: existing[0].stripe_customer_id };

  if (!artist.email) throw new Error('Add an email address to this artist before creating billing.');
  const customer = await stripe().customers.create({
    name: artist.name,
    email: artist.email,
    metadata: { artist_id: artist.id, source: 'love_and_sunshine_os' },
  }, { idempotencyKey: `ls-customer-${artist.id}-${livemode}` });
  await adminInsert('stripe_customers', {
    artist_id: artist.id, stripe_customer_id: customer.id, email: artist.email, livemode,
  }, 'artist_id,livemode');
  return { artist, customerId: customer.id };
}

function invoiceIdentity() {
  const id = randomUUID();
  const year = new Date().getUTCFullYear();
  return { id, number: `LS-${year}-${id.slice(0, 8).toUpperCase()}` };
}

async function createInvoice(req, input) {
  const amountCents = money(input.amount_cents);
  const description = cleanText(input.description, 500);
  if (description.length < 2) throw new Error('Add an invoice description.');
  const { artist, customerId } = await artistAndCustomer(String(input.artist_id || ''));
  const identity = invoiceIdentity();
  const dueDate = input.due_date && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : null;
  const daysUntilDue = dueDate ? Math.max(1, Math.min(90, Math.ceil((new Date(`${dueDate}T23:59:59Z`) - Date.now()) / 86400000))) : 14;

  await adminInsert('invoices', {
    id: identity.id, artist_id: artist.id, invoice_number: identity.number, amount_cents: amountCents,
    description, currency: 'usd', billing_type: 'one_time', status: 'draft', due_date: dueDate,
    stripe_customer_id: customerId,
  });

  try {
    const draft = await stripe().invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      auto_advance: false,
      description,
      metadata: { internal_invoice_id: identity.id, invoice_number: identity.number, artist_id: artist.id, billing_type: 'one_time' },
    }, { idempotencyKey: `ls-invoice-${identity.id}` });
    await stripe().invoiceItems.create({
      customer: customerId, invoice: draft.id, amount: amountCents, currency: 'usd', description,
      metadata: { internal_invoice_id: identity.id },
    }, { idempotencyKey: `ls-invoice-item-${identity.id}` });
    const finalized = await stripe().invoices.finalizeInvoice(draft.id, {}, { idempotencyKey: `ls-finalize-${identity.id}` });
    const sent = await stripe().invoices.sendInvoice(finalized.id, {}, { idempotencyKey: `ls-send-${identity.id}` });
    await adminPatch('invoices', `id=eq.${identity.id}`, {
      status: 'sent', stripe_invoice_id: sent.id, hosted_invoice_url: sent.hosted_invoice_url,
      invoice_pdf_url: sent.invoice_pdf, payment_url: sent.hosted_invoice_url, last_error: null,
    });
    return { invoice_id: identity.id, invoice_number: identity.number, payment_url: sent.hosted_invoice_url, mode: stripeMode() };
  } catch (error) {
    await adminPatch('invoices', `id=eq.${identity.id}`, { last_error: cleanText(error.message, 1000) }).catch(() => {});
    throw error;
  }
}

async function createRecurring(req, input, kind) {
  const amountCents = money(input.amount_cents);
  const description = cleanText(input.description, 500);
  if (description.length < 2) throw new Error('Add a billing description.');
  const interval = String(input.interval || 'month');
  const allowedIntervals = kind === 'payment_plan' ? ['week', 'month'] : ['week', 'month', 'year'];
  if (!allowedIntervals.includes(interval)) throw new Error('Choose a valid billing interval.');
  const installmentCount = kind === 'payment_plan' ? Number(input.installment_count) : null;
  if (kind === 'payment_plan' && (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 36)) {
    throw new Error('Payment plans must have between 2 and 36 installments.');
  }

  const { artist, customerId } = await artistAndCustomer(String(input.artist_id || ''));
  const identity = invoiceIdentity();
  const recordId = randomUUID();
  const totalCents = kind === 'payment_plan' ? amountCents * installmentCount : amountCents;
  await adminInsert('invoices', {
    id: identity.id, artist_id: artist.id, invoice_number: identity.number, amount_cents: totalCents,
    description, currency: 'usd', billing_type: kind, status: 'draft', stripe_customer_id: customerId,
  });

  const product = await stripe().products.create({
    name: `${kind === 'payment_plan' ? 'Payment plan' : 'Retainer'} — ${artist.name}`,
    description,
    metadata: { artist_id: artist.id, internal_invoice_id: identity.id, billing_kind: kind },
  }, { idempotencyKey: `ls-product-${recordId}` });
  const price = await stripe().prices.create({
    product: product.id, unit_amount: amountCents, currency: 'usd', recurring: { interval },
    metadata: { billing_record_id: recordId, internal_invoice_id: identity.id, billing_kind: kind },
  }, { idempotencyKey: `ls-price-${recordId}` });

  if (kind === 'payment_plan') {
    await adminInsert('payment_plans', {
      id: recordId, invoice_id: identity.id, artist_id: artist.id, installment_amount_cents: amountCents,
      installment_count: installmentCount, interval, currency: 'usd', stripe_price_id: price.id,
    });
  } else {
    await adminInsert('retainers', {
      id: recordId, invoice_id: identity.id, artist_id: artist.id, description, amount_cents: amountCents,
      interval, currency: 'usd', stripe_price_id: price.id,
    });
  }

  const baseUrl = siteUrl(req);
  const checkout = await stripe().checkout.sessions.create({
    integration_identifier: integrationIdentifier(),
    mode: 'subscription', customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    billing_address_collection: 'auto',
    success_url: `${baseUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?billing=canceled`,
    metadata: { billing_kind: kind, billing_record_id: recordId, internal_invoice_id: identity.id, artist_id: artist.id },
    subscription_data: { metadata: { billing_kind: kind, billing_record_id: recordId, internal_invoice_id: identity.id, artist_id: artist.id } },
  }, { idempotencyKey: `ls-checkout-${recordId}` });

  const table = kind === 'payment_plan' ? 'payment_plans' : 'retainers';
  await adminPatch(table, `id=eq.${recordId}`, { stripe_checkout_session_id: checkout.id, checkout_url: checkout.url });
  await adminPatch('invoices', `id=eq.${identity.id}`, {
    status: 'sent', stripe_checkout_session_id: checkout.id, payment_url: checkout.url,
  });
  return { invoice_id: identity.id, invoice_number: identity.number, billing_record_id: recordId, payment_url: checkout.url, mode: stripeMode() };
}

async function createPortal(req, input) {
  const { customerId } = await artistAndCustomer(String(input.artist_id || ''));
  const portal = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${siteUrl(req)}/?admin=1` });
  return { url: portal.url };
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const current = await session(req, res);
    if (!current) return json(res, 401, { error: 'Sign in required.' });
    if (req.method === 'GET') {
      return json(res, 200, { connected: Boolean(process.env.STRIPE_SECRET_KEY), mode: process.env.STRIPE_SECRET_KEY ? stripeMode() : null });
    }
    if (!MANAGERS.has(current.profile.role)) return json(res, 403, { error: 'Owner, admin, or finance access is required.' });
    const action = String(req.body?.action || '');
    let result;
    if (action === 'create_invoice') result = await createInvoice(req, req.body || {});
    else if (action === 'create_payment_plan') result = await createRecurring(req, req.body || {}, 'payment_plan');
    else if (action === 'create_retainer') result = await createRecurring(req, req.body || {}, 'retainer');
    else if (action === 'customer_portal') result = await createPortal(req, req.body || {});
    else return json(res, 400, { error: 'Unknown billing action.' });
    return json(res, 201, result);
  } catch (error) {
    const status = /not configured/i.test(error.message) ? 503 : 400;
    return json(res, status, { error: cleanText(error.message, 1000) || 'Billing request failed.' });
  }
};

module.exports._test = { cleanText, integrationIdentifier, money, scalar };
