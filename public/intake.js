const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const token = new URLSearchParams(location.search).get('token') || '';
let intake = null;

async function api(options = {}) {
  const response = await fetch(options.method === 'POST' ? '/api/intake' : `/api/intake?token=${encodeURIComponent(token)}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The questionnaire could not be loaded.');
  return data;
}

function field(question, value) {
  const id = escapeHtml(question.id);
  const label = escapeHtml(question.label);
  if (question.type === 'yesno') {
    return `<fieldset class="question"><legend>${label}</legend><div class="choice-row">${[['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']].map(([option, text]) => `<label><input type="radio" name="${id}" value="${option}" ${value === option ? 'checked' : ''} />${text}</label>`).join('')}</div></fieldset>`;
  }
  if (question.type === 'certify') return `<div class="question"><label class="certify-row"><input type="checkbox" name="${id}" ${value === true ? 'checked' : ''} /><span>${label}</span></label></div>`;
  if (question.type === 'long') return `<div class="question"><label for="${id}">${label}</label><textarea id="${id}" name="${id}" maxlength="5000">${escapeHtml(value || '')}</textarea></div>`;
  return `<div class="question"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${escapeHtml(question.type || 'text')}" maxlength="5000" value="${escapeHtml(value || '')}" /></div>`;
}

function answers() {
  const values = {};
  const data = new FormData($('#intake-form'));
  for (const section of intake.questionnaire) for (const question of section.questions) {
    if (question.type === 'certify') values[question.id] = data.has(question.id);
    else values[question.id] = data.get(question.id) || '';
  }
  return values;
}

function updateProgress() {
  if (!intake) return;
  const values = answers();
  const questions = intake.questionnaire.flatMap(section => section.questions);
  const answered = questions.filter(question => question.type === 'certify' ? values[question.id] === true : String(values[question.id] || '').trim()).length;
  const percent = Math.round(answered / questions.length * 100);
  $('#intake-progress').value = percent;
  $('#intake-progress').textContent = `${percent}%`;
  $('#progress-label').textContent = `${percent}% answered`;
}

async function save(finalize) {
  const button = finalize ? $('#intake-form [type="submit"]') : $('#save-intake');
  const result = $('#intake-result');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = finalize ? 'Submitting…' : 'Saving…';
  result.hidden = true;
  result.classList.remove('error');
  try {
    const saved = await api({ method: 'POST', body: JSON.stringify({ token, responses: answers(), finalize }) });
    if (saved.completed) {
      $('#intake-form').innerHTML = '<section class="completed-card"><h2>Thank you—your intake is complete.</h2><p>Your answers were delivered securely to the Love & Sunshine team. We’ll review them with care.</p></section>';
      scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    $('#save-state').textContent = `Saved ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(saved.savedAt))}`;
    result.textContent = 'Your progress is saved. You can safely return through the same email link.';
    result.hidden = false;
  } catch (error) {
    result.textContent = error.message;
    result.classList.add('error');
    result.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function load() {
  const status = $('#intake-status');
  try {
    intake = await api();
    if (intake.completed) {
      status.innerHTML = '<div class="completed-card"><h2>This intake is complete.</h2><p>Thank you. Your responses have already been delivered securely to Love & Sunshine.</p></div>';
      return;
    }
    $('#intake-sections').innerHTML = intake.questionnaire.map((section, index) => `<details class="intake-section" ${index === 0 ? 'open' : ''}><summary><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(section.title)}</summary><div class="section-body">${section.intro ? `<p class="section-intro">${escapeHtml(section.intro)}</p>` : ''}${section.questions.map(question => field(question, intake.responses[question.id])).join('')}</div></details>`).join('');
    $('#intake-form').hidden = false;
    status.hidden = true;
    if (intake.savedAt) $('#save-state').textContent = `Last saved ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(intake.savedAt))}`;
    $('#intake-form').addEventListener('input', updateProgress);
    $('#save-intake').addEventListener('click', () => save(false));
    $('#intake-form').addEventListener('submit', event => { event.preventDefault(); save(true); });
    updateProgress();
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
  }
}

load();
