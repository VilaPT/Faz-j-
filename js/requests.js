import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import { getSearchContext, resolveSkill } from './search.js';

const $ = (id) => document.getElementById(id);
let targetProfessional = null;

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

export function requestService(professional = null) {
  targetProfessional = professional?.user_id ? professional : null;

  if (!requireAuth('request', 'client')) return false;
  openRequest();
  return true;
}

export function openRequest() {
  const context = getSearchContext();
  const title = $('requestModal')?.querySelector('h2');

  if (title) {
    title.textContent = targetProfessional?.public_name
      ? `Pedir serviço a ${targetProfessional.public_name}`
      : 'Guardar pedido';
  }

  if ($('reqDesc')) $('reqDesc').value = context.query || context.skill?.name || '';
  if ($('reqCity')) $('reqCity').value = context.city || '';

  setMessage(
    targetProfessional?.public_name
      ? `Este pedido será enviado diretamente a ${targetProfessional.public_name}.`
      : '',
    targetProfessional ? 'ok' : '',
  );
  openModal();
}

async function submitRequest(event) {
  event.preventDefault();

  const session = getSession();
  if (!session) {
    requestService(targetProfessional);
    return;
  }

  const description = $('reqDesc')?.value.trim() || '';
  const city = $('reqCity')?.value.trim() || '';
  const context = getSearchContext();
  const skill = context.skill || resolveSkill(description);

  const { error } = await S.from('service_requests').insert({
    client_id: session.user.id,
    professional_id: targetProfessional?.user_id || null,
    skill_id: skill?.id || null,
    raw_query: context.query || description,
    description,
    city,
  });

  if (error) {
    setMessage(error.message, 'err');
    return;
  }

  const professionalName = targetProfessional?.public_name;
  setMessage(
    professionalName ? `Pedido enviado a ${professionalName} ✓` : 'Pedido guardado ✓',
    'ok',
  );
  targetProfessional = null;
  setTimeout(closeModal, 900);
}

export function initRequests() {
  $('saveDemand')?.addEventListener('click', () => requestService(null));
  $('requestForm')?.addEventListener('submit', submitRequest);
}
