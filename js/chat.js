import { supabase as S } from './supabase.js';
import { getSession } from './auth.js';
import { escapeHtml } from './utils.js';

const $ = (id) => document.getElementById(id);
let currentRequest = null;
let currentProposal = null;
let currentContact = null;
let channel = null;
let onChanged = () => {};
let bound = false;

const statusMap = {
  open: 'Em conversa',
  matched: 'Em conversa',
  accepted: 'Proposta aceite',
  in_progress: 'Em curso',
  completed: 'Concluído',
  declined: 'Profissional desistiu',
  cancelled: 'Cancelado',
};

function closeChat() {
  $('chatModal')?.classList.remove('open');
  if (channel) {
    S.removeChannel(channel);
    channel = null;
  }
  currentRequest = null;
  currentProposal = null;
  currentContact = null;
}

function role() {
  const session = getSession();
  if (!session || !currentRequest) return null;
  return session.user.id === currentRequest.client_id ? 'client' : 'professional';
}

function fullAddress(contact = currentContact) {
  return [
    contact?.service_address_line1,
    contact?.service_address_line2,
    contact?.service_postal_code,
    contact?.service_city,
  ].filter(Boolean).join(', ');
}

function wazeUrl() {
  const address = fullAddress();
  return address ? `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes` : '';
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function renderContact() {
  const box = $('chatPrivateData');
  if (!box || !currentRequest) return;

  if (role() === 'professional') {
    const phone = currentContact?.client_phone;
    const address = fullAddress();
    box.innerHTML = `
      <strong>Dados privados deste pedido</strong>
      <span>Cliente anónimo</span>
      ${phone ? `<a href="tel:${escapeHtml(String(phone).replace(/[^+\d]/g, ''))}">${escapeHtml(phone)}</a>` : '<span>Telefone não indicado</span>'}
      ${address ? `<span>${escapeHtml(address)}</span>` : '<span>Morada ainda não indicada</span>'}
    `;
    return;
  }

  const name = currentContact?.professional_name || 'Profissional Faz Já';
  const phone = currentContact?.professional_phone;
  box.innerHTML = `
    <strong>${escapeHtml(name)}</strong>
    ${phone ? `<a href="tel:${escapeHtml(String(phone).replace(/[^+\d]/g, ''))}">${escapeHtml(phone)}</a>` : '<span>Contacto disponível através do chat</span>'}
  `;
}

function renderProposal() {
  const box = $('chatProposal');
  if (!box) return;

  if (!currentProposal) {
    box.innerHTML = '<div class="chat-empty">Ainda não existe uma proposta formal.</div>';
    return;
  }

  box.innerHTML = `
    <div class="proposal-card">
      <div><small>PROPOSTA</small><strong>${formatMoney(currentProposal.amount_eur)}</strong></div>
      <span class="status-pill">${currentProposal.status === 'pending' ? 'A aguardar decisão' : currentProposal.status === 'accepted' ? 'Aceite' : currentProposal.status === 'rejected' ? 'Recusada' : 'Retirada'}</span>
      ${currentProposal.details ? `<p>${escapeHtml(currentProposal.details)}</p>` : ''}
    </div>
  `;
}

function renderActions() {
  const actions = $('chatActions');
  const proposalForm = $('proposalForm');
  if (!actions || !proposalForm || !currentRequest) return;

  const currentRole = role();
  const terminal = ['completed', 'cancelled', 'declined'].includes(currentRequest.status);
  proposalForm.classList.add('hidden');

  if (terminal) {
    actions.innerHTML = '<span class="chat-terminal">Este pedido está encerrado.</span>';
    $('chatInput').disabled = true;
    $('chatSend').disabled = true;
    return;
  }

  $('chatInput').disabled = false;
  $('chatSend').disabled = false;

  if (currentRole === 'client') {
    const pending = currentProposal?.status === 'pending';
    actions.innerHTML = `
      <button class="chat-action accept" id="acceptProposal" type="button" ${pending ? '' : 'disabled'}>Aceitar proposta</button>
      <button class="chat-action reject" id="rejectProposal" type="button" ${pending ? '' : 'disabled'}>Recusar proposta</button>
      <button class="chat-action danger" id="cancelService" type="button">Desistir do serviço</button>
    `;
    $('acceptProposal')?.addEventListener('click', () => decideProposal('accepted'));
    $('rejectProposal')?.addEventListener('click', () => decideProposal('rejected'));
    $('cancelService')?.addEventListener('click', cancelService);
    return;
  }

  if (currentRequest.status === 'accepted' || currentRequest.status === 'in_progress') {
    const waze = wazeUrl();
    actions.innerHTML = `
      ${waze ? `<a class="chat-action go" href="${waze}" target="_blank" rel="noopener">Ir até</a>` : '<button class="chat-action go" type="button" disabled>Ir até</button>'}
      <button class="chat-action accept" id="completeService" type="button">Pedido concluído</button>
      <button class="chat-action danger" id="withdrawRequest" type="button">Desistir do pedido</button>
    `;
    $('completeService')?.addEventListener('click', completeService);
    $('withdrawRequest')?.addEventListener('click', withdrawRequest);
    return;
  }

  actions.innerHTML = `
    <button class="chat-action proposal" id="showProposalForm" type="button">Enviar proposta</button>
    <button class="chat-action danger" id="withdrawRequest" type="button">Desistir do pedido</button>
  `;
  $('showProposalForm')?.addEventListener('click', () => proposalForm.classList.toggle('hidden'));
  $('withdrawRequest')?.addEventListener('click', withdrawRequest);
}

function renderMessages(messages) {
  const session = getSession();
  const container = $('chatMessages');
  if (!container || !session) return;

  container.innerHTML = messages.length ? messages.map((message) => {
    if (message.kind === 'system') {
      return `<div class="chat-system">${escapeHtml(message.body)}</div>`;
    }
    const mine = message.sender_id === session.user.id;
    const sender = mine ? 'Tu' : role() === 'client' ? 'Profissional' : 'Cliente';
    return `
      <div class="chat-message ${mine ? 'mine' : ''}">
        <small>${sender}</small>
        <p>${escapeHtml(message.body)}</p>
      </div>
    `;
  }).join('') : '<div class="chat-empty">Escreve a primeira mensagem.</div>';

  container.scrollTop = container.scrollHeight;
}

async function refreshChat() {
  if (!currentRequest) return;

  const [requestResult, messageResult, proposalResult, contactResult] = await Promise.all([
    S.from('service_requests')
      .select('id,client_id,professional_id,description,city,status,created_at,skill_id')
      .eq('id', currentRequest.id)
      .single(),
    S.from('service_messages')
      .select('id,sender_id,kind,body,created_at')
      .eq('request_id', currentRequest.id)
      .order('created_at'),
    S.from('service_proposals')
      .select('id,amount_eur,details,status,created_at,decided_at')
      .eq('request_id', currentRequest.id)
      .order('created_at', { ascending: false })
      .limit(1),
    S.rpc('service_request_contact', { p_request_id: currentRequest.id }),
  ]);

  if (requestResult.error) throw requestResult.error;
  if (messageResult.error) throw messageResult.error;
  if (proposalResult.error) throw proposalResult.error;

  currentRequest = requestResult.data;
  currentProposal = proposalResult.data?.[0] || null;
  currentContact = contactResult.error ? null : contactResult.data;

  $('chatTitle').textContent = currentRequest.description || 'Pedido de serviço';
  $('chatStatus').textContent = statusMap[currentRequest.status] || currentRequest.status;
  renderContact();
  renderProposal();
  renderMessages(messageResult.data || []);
  renderActions();
}

async function sendMessage(event) {
  event.preventDefault();
  const session = getSession();
  const input = $('chatInput');
  const body = input?.value.trim();
  if (!session || !currentRequest || !body) return;

  const { error } = await S.from('service_messages').insert({
    request_id: currentRequest.id,
    sender_id: session.user.id,
    kind: 'message',
    body,
  });

  if (error) {
    window.alert('Não foi possível enviar a mensagem.');
    return;
  }
  input.value = '';
}

async function sendProposal(event) {
  event.preventDefault();
  if (!currentRequest) return;
  const amount = Number($('proposalAmount')?.value || 0);
  const details = $('proposalDetails')?.value.trim() || '';
  if (amount < 0) return;

  const { error } = await S.rpc('send_service_proposal', {
    p_request_id: currentRequest.id,
    p_amount: amount,
    p_details: details || null,
  });
  if (error) {
    window.alert(error.message.includes('pending proposal') ? 'Já existe uma proposta à espera de decisão.' : 'Não foi possível enviar a proposta.');
    return;
  }
  $('proposalForm')?.reset();
  $('proposalForm')?.classList.add('hidden');
  await refreshChat();
  onChanged();
}

async function decideProposal(decision) {
  if (!currentProposal) return;
  const { error } = await S.rpc('client_decide_service_proposal', {
    p_proposal_id: currentProposal.id,
    p_decision: decision,
  });
  if (error) {
    window.alert('Não foi possível registar a decisão.');
    return;
  }
  await refreshChat();
  onChanged();
}

async function cancelService() {
  if (!currentRequest || !window.confirm('Desistir deste serviço?')) return;
  const { error } = await S.rpc('client_cancel_service_request', { p_request_id: currentRequest.id });
  if (error) {
    window.alert('Não foi possível desistir do serviço.');
    return;
  }
  await refreshChat();
  onChanged();
}

async function withdrawRequest() {
  if (!currentRequest || !window.confirm('Desistir deste pedido?')) return;
  const { error } = await S.rpc('professional_withdraw_service_request', { p_request_id: currentRequest.id });
  if (error) {
    window.alert('Não foi possível desistir do pedido.');
    return;
  }
  await refreshChat();
  onChanged();
}

async function completeService() {
  if (!currentRequest || !window.confirm('Marcar este serviço como concluído?')) return;
  const { error } = await S.rpc('professional_complete_service_request', { p_request_id: currentRequest.id });
  if (error) {
    window.alert('Não foi possível concluir o serviço.');
    return;
  }
  await refreshChat();
  onChanged();
}

function subscribe() {
  if (!currentRequest) return;
  if (channel) S.removeChannel(channel);

  channel = S.channel(`service-chat-${currentRequest.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_messages', filter: `request_id=eq.${currentRequest.id}` }, () => refreshChat().catch(console.error))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_proposals', filter: `request_id=eq.${currentRequest.id}` }, () => refreshChat().catch(console.error))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${currentRequest.id}` }, () => {
      refreshChat().catch(console.error);
      onChanged();
    })
    .subscribe();
}

function bind() {
  if (bound) return;
  bound = true;
  $('chatClose')?.addEventListener('click', closeChat);
  $('chatForm')?.addEventListener('submit', sendMessage);
  $('proposalForm')?.addEventListener('submit', sendProposal);
}

export function initChat({ onRequestChange = () => {} } = {}) {
  onChanged = onRequestChange;
  bind();
}

export async function openServiceChat(requestId) {
  const session = getSession();
  if (!session || !requestId) return;

  currentRequest = { id: requestId };
  $('chatModal')?.classList.add('open');
  $('chatMessages').innerHTML = '<div class="chat-empty">A carregar conversa…</div>';
  await refreshChat();
  subscribe();
}
