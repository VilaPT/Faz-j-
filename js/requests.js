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

async function hasPrivateRequestData() {
  const session = getSession();
  if (!session) return false;
  const { data, error } = await S.from('profiles')
    .select('phone,address_line1,postal_code,address_city')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error || !data) return false;
  return Boolean(data.phone && data.address_line1 && data.postal_code && data.address_city);
}

export function requestService(professional = null) {
  targetProfessional = professional?.user_id ? professional : null;
  if (!requireAuth('request', 'client')) return false;
  openRequest();
  return true;
}

export async function openRequest() {
  const context = getSearchContext();
  const title = $('requestModal')?.querySelector('h2');

  if (targetProfessional && !await hasPrivateRequestData()) {
    window.alert('Antes de pedires um serviço diretamente a um profissional, completa o telefone e a morada na tua Conta. Estes dados só serão partilhados com o profissional escolhido.');
    $('navAccount')?.click();
    return;
  }

  if (title) {
    title.textContent = targetProfessional?.public_name
      ? `Pedir serviço a ${targetProfessional.public_name}`
      : 'Guardar pedido';
  }

  if ($('reqDesc')) $('reqDesc').value = context.query || context.skill?.name || '';
  if ($('reqCity')) $('reqCity').value = context.city || '';

  setMessage(
    targetProfessional?.public_name
      ? `O pedido abre uma conversa privada com ${targetProfessional.public_name}. O teu telefone e morada ficam visíveis apenas para este profissional.`
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

  if (targetProfessional && !await hasPrivateRequestData()) {
    setMessage('Completa primeiro o telefone e a morada na tua Conta.', 'err');
    return;
  }

  const description = $('reqDesc')?.value.trim() || '';
  const city = $('reqCity')?.value.trim() || '';
  const context = getSearchContext();
  const skill = context.skill || resolveSkill(description);

  const { data, error } = await S.from('service_requests').insert({
    client_id: session.user.id,
    professional_id: targetProfessional?.user_id || null,
    skill_id: skill?.id || null,
    raw_query: context.query || description,
    description,
    city,
  }).select('id').single();

  if (error) {
    setMessage(error.message.includes('complete phone and address')
      ? 'Completa primeiro o telefone e a morada na tua Conta.'
      : 'Não foi possível enviar o pedido.', 'err');
    return;
  }

  const professionalName = targetProfessional?.public_name;
  setMessage(
    professionalName ? `Pedido enviado a ${professionalName} ✓ A conversa já está aberta.` : 'Pedido guardado ✓',
    'ok',
  );

  if (targetProfessional && data?.id) {
    const requestId = data.id;
    targetProfessional = null;
    setTimeout(() => {
      closeModal();
      window.dispatchEvent(new CustomEvent('fazja:open-chat', { detail: { requestId } }));
    }, 700);
    return;
  }

  targetProfessional = null;
  setTimeout(closeModal, 900);
}

export function initRequests() {
  $('saveDemand')?.addEventListener('click', () => requestService(null));
  $('requestForm')?.addEventListener('submit', submitRequest);
}
