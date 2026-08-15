const test = require('node:test');
const assert = require('node:assert/strict');
const { questionnaire } = require('../api/_intake-questionnaire');
const { hashToken, validateResponses } = require('../api/intake')._test;

test('client intake excludes internal-only prompts and keeps client sections', () => {
  const labels = questionnaire.flatMap(section => section.questions.map(question => question.label));
  assert.equal(questionnaire.length, 35);
  assert.equal(labels.includes('Management Concerns / Questions'), false);
  assert.equal(labels.includes('Manager Name'), false);
  assert.equal(labels.includes('Witness Name'), false);
  assert.ok(labels.includes('Why are you seeking management now?'));
});

test('client intake validates radio values and ignores unknown fields', () => {
  const yesNo = questionnaire.flatMap(section => section.questions).find(question => question.type === 'yesno');
  assert.deepEqual(validateResponses({ [yesNo.id]: 'na', attacker_controlled: 'ignored' }), { [yesNo.id]: 'na' });
  assert.throws(() => validateResponses({ [yesNo.id]: 'sometimes' }), /Yes, No, or N\/A/);
});

test('intake links are stored as irreversible deterministic hashes', () => {
  const token = 'a'.repeat(43);
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token).length, 64);
});
