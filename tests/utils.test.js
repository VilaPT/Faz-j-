import test from 'node:test';
import assert from 'node:assert/strict';

import {
  daysUntil,
  escapeHtml,
  normalizeText,
} from '../js/utils.js';

test('normalizeText removes accents, trims and lowercases text', () => {
  assert.equal(normalizeText('  Automóvel  '), 'automovel');
  assert.equal(normalizeText('PINTURA'), 'pintura');
});

test('escapeHtml encodes characters that could inject markup', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
  );
  assert.equal(escapeHtml("O'Reilly & Filhos"), 'O&#39;Reilly &amp; Filhos');
});

test('daysUntil rounds partial days up and never returns a negative value', () => {
  const now = new Date('2026-08-27T12:00:00Z').getTime();
  assert.equal(daysUntil('2026-08-28T12:00:00Z', now), 1);
  assert.equal(daysUntil('2026-08-28T12:00:01Z', now), 2);
  assert.equal(daysUntil('2026-08-26T12:00:00Z', now), 0);
  assert.equal(daysUntil(null, now), 0);
});
