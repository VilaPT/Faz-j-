import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import { getSearchContext, resolveSkill } from './search.js';

const $ = (id) => document.getElementById(id);

function openModal() {
  $('requestModal')?.classList.add('open');
}

function closeModal() {
  $('requestModal')?.classList.remove('open');
}

function setMessage(text = '', type = '') {
  const element = $('reqMsg');
  if (!element) return;
  element.className = `msg${type ? ` ${type}` : ''}`;
  element.textContent = text;
}

export function requestService() {
  if (!requireAuth('request', 'client')) return false;
  openRequest();
  return true;
}

export function openRequest() {
  const context = getSearchContext();

  if ($('reqDesc')) $('reqDesc').value = context.query || context.skill?.name || '';
  if ($('reqCity')) $('reqCity').value = context.city || '';
  setMessage();
  openModal();
}

async function submitRequest(event) {
  event.preventDefault();

  const session = getSession();
  if (!session) {
    requestService();
    return;
  }

  const description = $('reqDesc')?.value.trim() || '';
  const city = $('reqCity')?.value.trim() || '';
  const context = getSearchContext();
  const skill = context.skill || resolveSkill(description);

  const { error } = await S.from('service_requests').insert({
    client_id: session.user.id,
    skill_id: skill?.id || null,
    raw_query: context.query || description,
    description,
    city,
  });

  if (error) {
    setMessage(error.message, 'err');
    return;
  }

  setMessage('Pedido guardado ✓', 'ok');
  setTimeout(closeModal, 700);
}

export function initRequests() {
  $('saveDemand')?.addEventListener('click', requestService);
  $('requestForm')?.addEventListener('submit', submitRequest);
}
