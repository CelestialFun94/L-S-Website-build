const test = require('node:test');
const assert = require('node:assert/strict');
const { payload, resources } = require('../api/dashboard')._test;

test('dashboard payload keeps only allowlisted CRM fields', () => {
  const config = {
    create: ['name', 'email', 'status'],
    required: ['name'],
  };
  const result = payload(config, { name: '  Ada Artist  ', email: 'ada@example.com', status: 'active', role: 'owner' }, 'create');
  assert.deepEqual(result, { name: 'Ada Artist', email: 'ada@example.com', status: 'active' });
});

test('dashboard payload requires required fields and validates relationship ids', () => {
  assert.throws(() => payload({ create: ['title'], required: ['title'] }, {}, 'create'), /title is required/i);
  assert.throws(() => payload({ create: ['artist_id'] }, { artist_id: 'not-an-id' }, 'create'), /invalid artist id/i);
});

test('dashboard payload normalizes profile access booleans', () => {
  assert.deepEqual(payload({ update: ['display_name', 'active'] }, { display_name: 'Becca', active: 'false' }, 'update'), { display_name: 'Becca', active: false });
  assert.throws(() => payload({ update: ['active'] }, { active: 'maybe' }, 'update'), /active must be true or false/i);
});

test('song payload accepts the songwriter and split workspace fields only', () => {
  const result = payload(resources.songs, {
    title: '  Built Around the Song  ',
    songwriter_name: 'Becca',
    songwriter_pro: 'BMI',
    project_name: 'Summer EP',
    song_split: 'Becca 50 / Alex 50',
    date_written: '2026-08-14',
    alternate_title: 'Legacy title',
    split_status: 'confirmed',
    iswc: 'T-000000000-0',
    release_date: '2026-09-01',
  }, 'create');

  assert.deepEqual(result, {
    title: 'Built Around the Song',
    songwriter_name: 'Becca',
    songwriter_pro: 'BMI',
    project_name: 'Summer EP',
    song_split: 'Becca 50 / Alex 50',
    date_written: '2026-08-14',
  });
});
