const test = require('node:test');
const assert = require('node:assert/strict');
const { adminSupabase } = require('../api/_lib');

test('modern Supabase secret keys are sent only as apikey headers', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_example';
  let headers;
  global.fetch = async (_url, options) => {
    headers = options.headers;
    return new Response('{}', { status: 200 });
  };
  try {
    await adminSupabase('/rest/v1/example');
    assert.equal(headers.apikey, 'sb_secret_example');
    assert.equal(headers.Authorization, undefined);
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSecret;
  }
});
