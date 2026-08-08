const { adminSupabase, json, method } = require('./_lib');
const { stripe } = require('./_stripe');

function scalar(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function data(response, fallback) {
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.message || value?.error || fallback);
  return value;
}

async function getRows(table, query) {
  return data(await adminSupabase(`/rest/v1/${table}?${query}`), `Unable to read ${table}.`);
}

async function patchRows(table, filter, record) {
  return data(await adminSupabase(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record),
  }), `Unable to update ${table}.`);
}

async function upsert(table, record, conflict) {
  return data(await adminSupabase(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(record),
  }), `Unable to save ${table}.`);
}

async function beginEvent(event) {
  const existing = await getRows('stripe_webhook_events', `id=eq.${encodeURIComponent(event.id)}&select=status,attempts&limit=1`);
  if (existing[0]?.status === 'processed') return false;
  if (existing[0]) {
    await patchRows('stripe_webhook_events', `id=eq.${encodeURIComponent(event.id)}`, {
      status: 'processing', attempts: Number(existing[0].attempts || 1) + 1, error: null,
    });
  } else {
    await upsert('stripe_webhook_events', {
      id: event.id, event_type: event.type, object_id: event.data?.object?.id || null,
      livemode: Boolean(event.livemode), status: 'processing', attempts: 1,
    }, 'id');
  }
  return true;
}

async function finishEvent(event, error) {
  await patchRows('stripe_webhook_events', `id=eq.${encodeURIComponent(event.id)}`, error ? {
    status: 'failed', error: String(error.message || error).slice(0, 1000), processed_at: null,
  } : { status: 'processed', error: null, processed_at: new Date().toISOString() });
}

function subscriptionFromInvoice(invoice) {
  return scalar(invoice.subscription) || scalar(invoice.parent?.subscription_details?.subscription);
}

function paymentIntentFromInvoice(invoice) {
  return scalar(invoice.payment_intent)
    || scalar(invoice.payments?.data?.find(item => item.payment?.payment_intent)?.payment?.payment_intent)
    || null;
}

function chargeFromInvoice(invoice) {
  return scalar(invoice.charge)
    || scalar(invoice.payments?.data?.find(item => item.payment?.charge)?.payment?.charge)
    || null;
}

function invoiceStatus(invoice) {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'void') return 'void';
  if (invoice.status === 'uncollectible') return 'uncollectible';
  if (invoice.status === 'open' && Number(invoice.amount_paid || 0) > 0) return 'partially_paid';
  return invoice.status === 'open' ? 'open' : 'draft';
}

async function syncInvoice(invoice, eventType) {
  const subscriptionId = subscriptionFromInvoice(invoice);
  let rows = await getRows('invoices', `stripe_invoice_id=eq.${encodeURIComponent(invoice.id)}&select=id,artist_id,billing_type&limit=1`);
  if (!rows[0] && subscriptionId) {
    rows = await getRows('invoices', `stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,artist_id,billing_type&limit=1`);
  }
  const internal = rows[0];
  if (!internal) return;

  const paymentIntentId = paymentIntentFromInvoice(invoice);
  const chargeId = chargeFromInvoice(invoice);
  const paidAt = invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null;
  const nextStatus = eventType === 'invoice.payment_failed' ? 'past_due' : invoiceStatus(invoice);
  await patchRows('invoices', `id=eq.${internal.id}`, {
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: subscriptionId,
    status: nextStatus,
    paid_cents: Number(invoice.amount_paid || 0),
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf_url: invoice.invoice_pdf || null,
    last_payment_at: paidAt,
    last_error: eventType === 'invoice.payment_failed' ? 'Stripe reported a failed invoice payment.' : null,
  });

  if (eventType === 'invoice.paid' || invoice.status === 'paid') {
    await upsert('payments', {
      invoice_id: internal.id,
      artist_id: internal.artist_id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      stripe_invoice_id: invoice.id,
      amount_cents: Number(invoice.amount_paid || 0),
      currency: invoice.currency || 'usd',
      status: 'succeeded',
      paid_at: paidAt || new Date().toISOString(),
    }, 'stripe_invoice_id');
  }

  if (internal.billing_type === 'payment_plan' && subscriptionId) {
    const plans = await getRows('payment_plans', `invoice_id=eq.${internal.id}&select=id,installment_count,installments_paid,stripe_price_id,stripe_schedule_id&limit=1`);
    if (plans[0]) {
      const plan = plans[0];
      const paid = eventType === 'invoice.paid' ? Math.min(plan.installment_count, Number(plan.installments_paid || 0) + 1) : Number(plan.installments_paid || 0);
      await patchRows('payment_plans', `id=eq.${plan.id}`, {
        stripe_subscription_id: subscriptionId,
        installments_paid: paid,
        status: paid >= plan.installment_count ? 'complete' : (eventType === 'invoice.payment_failed' ? 'past_due' : 'active'),
        completed_at: paid >= plan.installment_count ? new Date().toISOString() : null,
      });
    }
  }
}

async function ensurePaymentPlanSchedule(recordId, subscriptionId) {
  const plans = await getRows('payment_plans', `id=eq.${encodeURIComponent(recordId)}&select=id,installment_count,stripe_price_id,stripe_schedule_id&limit=1`);
  const plan = plans[0];
  if (!plan || plan.stripe_schedule_id) return;
  const schedule = await stripe().subscriptionSchedules.create({ from_subscription: subscriptionId }, {
    idempotencyKey: `ls-schedule-${plan.id}`,
  });
  const first = schedule.phases[0];
  const configured = await stripe().subscriptionSchedules.update(schedule.id, {
    end_behavior: 'cancel',
    phases: [{
      items: [{ price: plan.stripe_price_id || scalar(first?.items?.[0]?.price), quantity: 1 }],
      start_date: first.start_date,
      iterations: plan.installment_count,
      metadata: { billing_kind: 'payment_plan', billing_record_id: plan.id },
    }],
  });
  await patchRows('payment_plans', `id=eq.${plan.id}`, {
    stripe_schedule_id: configured.id, stripe_subscription_id: subscriptionId,
    status: 'active', started_at: new Date().toISOString(),
  });
}

async function checkoutCompleted(checkout) {
  const kind = checkout.metadata?.billing_kind;
  const recordId = checkout.metadata?.billing_record_id;
  const invoiceId = checkout.metadata?.internal_invoice_id;
  const subscriptionId = scalar(checkout.subscription);
  if (!recordId || !invoiceId || !subscriptionId) return;
  const table = kind === 'payment_plan' ? 'payment_plans' : kind === 'retainer' ? 'retainers' : null;
  if (!table) return;
  await patchRows(table, `id=eq.${encodeURIComponent(recordId)}`, {
    stripe_checkout_session_id: checkout.id, stripe_subscription_id: subscriptionId,
    status: 'active', ...(kind === 'payment_plan' ? { started_at: new Date().toISOString() } : {}),
  });
  await patchRows('invoices', `id=eq.${encodeURIComponent(invoiceId)}`, {
    stripe_checkout_session_id: checkout.id, stripe_subscription_id: subscriptionId, status: 'open',
  });
  if (kind === 'payment_plan') await ensurePaymentPlanSchedule(recordId, subscriptionId);
}

function subscriptionStatus(status) {
  if (['active', 'trialing'].includes(status)) return 'active';
  if (['past_due', 'unpaid', 'incomplete'].includes(status)) return 'past_due';
  if (['canceled', 'incomplete_expired'].includes(status)) return 'canceled';
  return 'pending';
}

async function syncSubscription(subscription) {
  const kind = subscription.metadata?.billing_kind;
  const recordId = subscription.metadata?.billing_record_id;
  if (!recordId || !['payment_plan', 'retainer'].includes(kind)) return;
  const table = kind === 'payment_plan' ? 'payment_plans' : 'retainers';
  const record = {
    stripe_subscription_id: subscription.id,
    status: subscriptionStatus(subscription.status),
  };
  if (kind === 'retainer') {
    const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;
    record.current_period_end = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    record.canceled_at = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;
  }
  await patchRows(table, `id=eq.${encodeURIComponent(recordId)}`, record);
}

async function syncRefund(charge) {
  if (!charge.id) return;
  const refunded = Number(charge.amount_refunded || 0);
  const paymentIntentId = scalar(charge.payment_intent);
  const filter = paymentIntentId
    ? `or=(stripe_charge_id.eq.${encodeURIComponent(charge.id)},stripe_payment_intent_id.eq.${encodeURIComponent(paymentIntentId)})`
    : `stripe_charge_id=eq.${encodeURIComponent(charge.id)}`;
  await patchRows('payments', filter, {
    stripe_charge_id: charge.id,
    refunded_cents: refunded,
    status: refunded >= Number(charge.amount || 0) ? 'refunded' : 'partially_refunded',
  });
}

async function syncCharge(charge) {
  const paymentIntentId = scalar(charge.payment_intent);
  if (!charge.id || !paymentIntentId) return;
  await patchRows('payments', `stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}`, {
    stripe_charge_id: charge.id,
  });
}

async function processEvent(event) {
  const object = event.data.object;
  if (event.type === 'checkout.session.completed') return checkoutCompleted(object);
  if (event.type.startsWith('invoice.')) return syncInvoice(object, event.type);
  if (event.type.startsWith('customer.subscription.')) return syncSubscription(object);
  if (event.type === 'charge.succeeded') return syncCharge(object);
  if (event.type === 'charge.refunded') return syncRefund(object);
  if (event.type === 'subscription_schedule.completed') {
    return patchRows('payment_plans', `stripe_schedule_id=eq.${encodeURIComponent(object.id)}`, { status: 'complete', completed_at: new Date().toISOString() });
  }
  if (['subscription_schedule.canceled', 'subscription_schedule.aborted'].includes(event.type)) {
    return patchRows('payment_plans', `stripe_schedule_id=eq.${encodeURIComponent(object.id)}`, { status: 'canceled' });
  }
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return json(res, 503, { error: 'Stripe webhook verification is not configured.' });

  let event;
  try {
    event = stripe().webhooks.constructEvent(await rawBody(req), signature, secret);
  } catch (error) {
    return json(res, 400, { error: 'Invalid Stripe webhook signature.' });
  }

  try {
    if (!await beginEvent(event)) return json(res, 200, { received: true, duplicate: true });
    await processEvent(event);
    await finishEvent(event);
    return json(res, 200, { received: true });
  } catch (error) {
    await finishEvent(event, error).catch(() => {});
    return json(res, 500, { error: 'Webhook processing failed.' });
  }
};

module.exports._test = { chargeFromInvoice, invoiceStatus, paymentIntentFromInvoice, rawBody, subscriptionFromInvoice, subscriptionStatus };
