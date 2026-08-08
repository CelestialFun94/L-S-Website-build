const Stripe = require('stripe');

let client;

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured.');
  if (!client) {
    client = new Stripe(key, {
      apiVersion: '2026-07-29.dahlia',
      appInfo: { name: 'Love & Sunshine Business OS', version: '1.0.0' },
      maxNetworkRetries: 2,
      timeout: 20000,
    });
  }
  return client;
}

function stripeMode() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test';
}

function siteUrl(req) {
  const configured = process.env.PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

module.exports = { siteUrl, stripe, stripeMode };
