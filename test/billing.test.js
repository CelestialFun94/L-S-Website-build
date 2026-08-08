const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const billing = require('../api/billing')._test;
const webhook = require('../api/stripe-webhook')._test;

test('billing validation accepts cents and rejects unsafe amounts', () => {
  assert.equal(billing.money(12500), 12500);
  assert.throws(() => billing.money(99), /between/);
  assert.throws(() => billing.money(100000001), /between/);
});

test('invoice status and modern Stripe relationships are normalized', () => {
  assert.equal(webhook.invoiceStatus({ status: 'open', amount_paid: 500 }), 'partially_paid');
  assert.equal(webhook.invoiceStatus({ status: 'paid', amount_paid: 500 }), 'paid');
  assert.equal(webhook.subscriptionFromInvoice({ parent: { subscription_details: { subscription: 'sub_123' } } }), 'sub_123');
  assert.equal(webhook.paymentIntentFromInvoice({ payments: { data: [{ payment: { payment_intent: 'pi_123' } }] } }), 'pi_123');
  assert.equal(webhook.chargeFromInvoice({ payments: { data: [{ payment: { charge: 'ch_123' } }] } }), 'ch_123');
});

test('checkout integration identifiers have an eight-character suffix', () => {
  assert.match(billing.integrationIdentifier(), /^love_sunshine_[a-z]{8}$/);
});

test('subscription states map to internal billing states', () => {
  assert.equal(webhook.subscriptionStatus('trialing'), 'active');
  assert.equal(webhook.subscriptionStatus('past_due'), 'past_due');
  assert.equal(webhook.subscriptionStatus('canceled'), 'canceled');
});

test('webhook raw body is preserved byte-for-byte', async () => {
  const payload = '{"id":"evt_test","type":"invoice.paid"}';
  const req = Readable.from([Buffer.from(payload.slice(0, 12)), Buffer.from(payload.slice(12))]);
  assert.equal((await webhook.rawBody(req)).toString('utf8'), payload);
});
