import { supabase as A } from './js/supabase.js';
import { getSession } from './js/auth.js';
import { requestProfessionalMode } from './js/professionals.js';
import { getMembership, loadMembership, membershipState, trialDaysLeft } from './js/memberships.js';
import { openServiceChat, initChat } from './js/chat.js';
import { escapeHtml } from './js/utils.js';

const $ = (id) => document.getElementById(id);
let session = null;
let notificationTimer = null;
let notificationChannel = null;
let lastUnreadCount = null;
let currentTab = 'profile';

const statusMap = {
  open: 'Em conversa',
  matched: 'Em conversa',
  accepted: 'Proposta aceite',
  in_progress: 'Em curso',
  awaiting_client_confirmation: 'Confirma a conclusão',
  completed: 'Concluído',
  declined: 'Profissional desistiu',
  cancelled: 'Cancelado',
};
const professionalNotificationKinds = new Set(['new_request', 'proposal_accepted', 'proposal_rejected', 'completed']);
const clientNotificationKinds = new Set(['proposal', 'work_done', 'cancelled', 'message']);

function showToast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('on');
  setTimeout(() => element.classList.remove('on'), 3200);
}
function closeAccount() { $('accountModal')?.classList.remove('open'); }

function applyBadge(ids, count) {
  ids.forEach((id) => {
    const element = $(id);
    if (!element) return;
    let badge = element.querySelector('.notification-badge');
    if (!count) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'notification-badge';
      element.appendChild(badge);
    }
    badge.textContent = count > 9 ? '9+' : String(count);
  });
}

async function refreshNotificationBadges(notify = false) {
  if (!session) {
    applyBadge(['navRequests'], 0);
    applyBadge(['navPro', 'proCta'], 0);
    return;
  }
  const { data, error } = await A.from('service_notifications')
    .select('id,kind,title,created_at')
    .eq('user_id', session.user.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return;

  const rows = data || [];
  const proCount = rows.filter((item) => professionalNotificationKinds.has(item.kind)).length;
  const clientCount = rows.filter((item) => clientNotificationKinds.has(item.kind)).length;
  applyBadge(['navPro', 'proCta'], proCount);
  applyBadge(['navRequests'], clientCount);

  if (notify && lastUnreadCount !== null && rows.length > lastUnreadCount && rows[0]?.title) showToast(rows[0].title);
  lastUnreadCount = rows.length;
}

async function markNotificationsRead(scope) {
  if (!session) return;
  const kinds = scope === 'professional' ? professionalNotificationKinds : clientNotificationKinds;
  const { data } = await A.from('service_notifications')
    .select('id,kind')
    .eq('user_id', session.user.id)
    .is('read_at', null);
  const ids = (data || []).filter((item) => kinds.has(item.kind)).map((item) => item.id);
  if (ids.length) await A.from('service_notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  await refreshNotificationBadges(false);
}

function selectTab(name) {
  currentTab = name;
  document.querySelectorAll('.account-tab').forEach((button) => button.classList.toggle('on', button.dataset.accountTab === name));
  document.querySelectorAll('.account-panel').forEach((panel) => panel.classList.toggle('on', panel.dataset.accountPanel === name));
  if (name === 'profile') loadProfile();
  if (name === 'requests') loadRequests().then(() => markNotificationsRead('client'));
  if (name === 'professional') loadProfessional().then(() => markNotificationsRead('professional'));
}

async function ensureSession() {
  session = getSession();
  if (!session) {
    const { data } = await A.auth.getSession();
    session = data.session;
  }
  $('accountCta')?.classList.toggle('on', Boolean(session));
  return session;
}

async function openAccount(name = 'profile') {
  if (!await ensureSession()) { $('authBtn')?.click(); return; }
  $('accountModal')?.classList.add('open');
  selectTab(name);
}

async function loadProfile() {
  if (!session) return;
  const { data, error } = await A.from('profiles')
    .select('display_name,phone,account_type,address_line1,address_line2,postal_code,address_city')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) { $('accountProfileMsg').textContent = 'Não foi possível carregar os teus dados.'; return; }
  const profile = data || {};
  $('accountName').value = profile.display_name || '';
  $('accountPhone').value = profile.phone || '';
  $('accountAddress1').value = profile.address_line1 || '';
  $('accountAddress2').value = profile.address_line2 || '';
  $('accountPostalCode').value = profile.postal_code || '';
  $('accountAddressCity').value = profile.address_city || '';
  $('accountEmail').textContent = session.user.email || '';
  $('accountType').textContent = profile.account_type === 'both' ? 'Cliente + profissional' : profile.account_type === 'professional' ? 'Profissional' : 'Cliente';
}

async function saveProfile(event) {
  event.preventDefault();
  if (!session) return;
  const name = $('accountName').value.trim();
  if (name.length < 2) { $('accountProfileMsg').textContent = 'Indica um nome válido.'; return; }
  const { error } = await A.from('profiles').update({
    display_name: name,
    phone: $('accountPhone').value.trim() || null,
    address_line1: $('accountAddress1').value.trim() || null,
    address_line2: $('accountAddress2').value.trim() || null,
    postal_code: $('accountPostalCode').value.trim() || null,
    address_city: $('accountAddressCity').value.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', session.user.id);
  $('accountProfileMsg').textContent = error ? 'Não foi possível guardar os dados.' : 'Dados guardados ✓';
}

async function removeSavedRequest(id) {
  if (!session || !id || !window.confirm('Retirar este pedido guardado?')) return;
  const { error } = await A.from('service_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', session.user.id)
    .is('professional_id', null)
    .in('status', ['open', 'matched']);
  if (error) window.alert('Não foi possível retirar o pedido.');
  else loadRequests();
}

async function loadRequests() {
  if (!session) return;
  $('accountRequests').innerHTML = '<div class="account-empty">A carregar…</div>';
  const { data, error } = await A.from('service_requests')
    .select('id,description,city,status,created_at,skill_id,professional_id')
    .eq('client_id', session.user.id)
    .not('status', 'in', '(cancelled,declined)')
    .order('created_at', { ascending: false });
  if (error) { $('accountRequests').innerHTML = '<div class="account-empty">Não foi possível carregar os pedidos.</div>'; return; }
  const rows = data || [];
  if (!rows.length) { $('accountRequests').innerHTML = '<div class="account-empty">Ainda não tens pedidos ativos.</div>'; return; }

  const skillIds = [...new Set(rows.map((row) => row.skill_id).filter(Boolean))];
  const professionalIds = [...new Set(rows.map((row) => row.professional_id).filter(Boolean))];
  const [skillResult, professionalResult] = await Promise.all([
    skillIds.length ? A.from('skills').select('id,name').in('id', skillIds) : Promise.resolve({ data: [] }),
    professionalIds.length ? A.from('professional_profiles').select('user_id,public_name').in('user_id', professionalIds) : Promise.resolve({ data: [] }),
  ]);
  const skills = new Map((skillResult.data || []).map((item) => [item.id, item.name]));
  const professionals = new Map((professionalResult.data || []).map((item) => [item.user_id, item.public_name]));

  $('accountRequests').innerHTML = rows.map((row) => `
    <div class="account-item request-item ${row.status === 'awaiting_client_confirmation' ? 'needs-action' : ''}">
      <div class="received-head"><strong>${escapeHtml(skills.get(row.skill_id) || 'Pedido de serviço')}</strong><span class="status-pill">${statusMap[row.status] || row.status}</span></div>
      <small>${escapeHtml(row.description)}${row.city ? ` · ${escapeHtml(row.city)}` : ''}</small>
      ${row.professional_id ? `<small class="request-party">Profissional: ${escapeHtml(professionals.get(row.professional_id) || 'Profissional escolhido')}</small>` : ''}
      ${row.status === 'awaiting_client_confirmation' ? '<div class="action-notice">O profissional marcou o trabalho como terminado. Abre a conversa para confirmar e avaliar.</div>' : ''}
      <div class="request-actions">
        ${row.professional_id ? `<button class="request-action accept" type="button" data-chat-request="${row.id}">${row.status === 'awaiting_client_confirmation' ? 'Confirmar e avaliar' : 'Abrir conversa'}</button>` : ''}
        ${!row.professional_id && ['open','matched'].includes(row.status) ? `<button class="request-action decline" type="button" data-remove-request="${row.id}">Retirar pedido</button>` : ''}
      </div>
    </div>
  `).join('');
  document.querySelectorAll('[data-chat-request]').forEach((button) => { button.onclick = () => { closeAccount(); openServiceChat(button.dataset.chatRequest).catch(console.error); }; });
  document.querySelectorAll('[data-remove-request]').forEach((button) => { button.onclick = () => removeSavedRequest(button.dataset.removeRequest); });
}

async function loadProfessional() {
  if (!session) return;
  $('accountProfessional').innerHTML = '<div class="account-empty">A carregar…</div>';
  await loadMembership(session);
  const [profileResult, linksResult, requestsResult] = await Promise.all([
    A.from('professional_profiles').select('public_name,headline,city,is_public,is_available,rating_average,rating_count').eq('user_id', session.user.id).maybeSingle(),
    A.from('professional_skills').select('skill_id').eq('professional_id', session.user.id),
    A.from('service_requests').select('id,description,city,status,created_at,skill_id').eq('professional_id', session.user.id).not('status', 'in', '(cancelled,declined)').order('created_at', { ascending: false }).limit(30),
  ]);
  if (profileResult.error || linksResult.error || requestsResult.error) { $('accountProfessional').innerHTML = '<div class="account-empty">Não foi possível carregar a área profissional.</div>'; return; }
  if (!profileResult.data) {
    $('accountProfessional').innerHTML = '<div class="account-empty">Ainda não tens perfil profissional. Os 60 dias gratuitos só começam quando criares o primeiro perfil.</div><button class="btn primary" id="accountMakePro" type="button">Tornar-me profissional</button>';
    $('accountMakePro').onclick = () => { closeAccount(); requestProfessionalMode(); };
    return;
  }

  const incoming = requestsResult.data || [];
  const skillIds = [...new Set([...(linksResult.data || []).map((item) => item.skill_id), ...incoming.map((row) => row.skill_id).filter(Boolean)])];
  const skillResult = skillIds.length ? await A.from('skills').select('id,name').in('id', skillIds) : { data: [] };
  const skills = new Map((skillResult.data || []).map((item) => [item.id, item.name]));
  const professionalSkills = (linksResult.data || []).map((item) => skills.get(item.skill_id)).filter(Boolean);
  const active = incoming.filter((row) => row.status !== 'completed');
  const completed = incoming.filter((row) => row.status === 'completed');
  const membership = getMembership();
  const state = membershipState();
  const planLabel = state === 'trial' ? `${trialDaysLeft()} dias` : state === 'active' ? 'Ativo' : membership?.status || 'Sem plano';
  const profile = profileResult.data;
  const ratingLabel = Number(profile.rating_count || 0) > 0 ? `${Number(profile.rating_average).toFixed(1)} ★` : 'Novo';

  $('accountProfessional').innerHTML = `
    <div class="account-summary">
      <div class="summary-card"><strong>${profile.is_public ? 'Publicado' : 'Privado'}</strong><span>Estado do perfil</span></div>
      <div class="summary-card"><strong>${escapeHtml(planLabel)}</strong><span>Plano profissional</span></div>
      <div class="summary-card"><strong>${ratingLabel}</strong><span>${Number(profile.rating_count || 0)} avaliação(ões)</span></div>
    </div>
    <div class="account-item"><strong>${escapeHtml(profile.public_name || 'Perfil profissional')}</strong><small>${escapeHtml(profile.headline || '')}${profile.city ? ` · ${escapeHtml(profile.city)}` : ''}</small><div class="pro-skill-list">${professionalSkills.map((name) => `<span class="pro-skill-chip">${escapeHtml(name)}</span>`).join('')}</div></div>
    <button class="btn primary" id="accountEditPro" type="button">Editar perfil profissional</button>
    <h3>Pedidos recebidos${active.length ? ` (${active.length})` : ''}</h3>
    <div class="account-list">
      ${active.length ? active.map((row) => `<div class="account-item received-request"><div class="received-head"><strong>${escapeHtml(skills.get(row.skill_id) || 'Pedido de serviço')}</strong><span class="status-pill">${statusMap[row.status] || row.status}</span></div><small>${escapeHtml(row.description)}${row.city ? ` · ${escapeHtml(row.city)}` : ''}</small><button class="request-action accept" type="button" data-chat-request="${row.id}">Abrir conversa</button></div>`).join('') : '<div class="account-empty">Não tens pedidos ativos neste momento.</div>'}
    </div>
    <h3>Serviços concluídos</h3>
    <div class="account-empty">${completed.length ? `${completed.length} serviço(s) concluído(s) e confirmado(s) pelo cliente.` : 'Ainda não tens serviços concluídos e confirmados.'}</div>
  `;
  $('accountEditPro').onclick = () => { closeAccount(); requestProfessionalMode(); };
  document.querySelectorAll('[data-chat-request]').forEach((button) => { button.onclick = () => { closeAccount(); openServiceChat(button.dataset.chatRequest).catch(console.error); }; });
}

async function refreshVisibleArea() {
  await refreshNotificationBadges(false);
  if (!$('accountModal')?.classList.contains('open')) return;
  if (currentTab === 'requests') await loadRequests();
  if (currentTab === 'professional') await loadProfessional();
}

function stopNotifications() {
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = null;
  if (notificationChannel) A.removeChannel(notificationChannel);
  notificationChannel = null;
}

function startNotifications() {
  stopNotifications();
  if (!session) return;
  refreshNotificationBadges(false).catch(console.error);
  notificationTimer = setInterval(() => refreshNotificationBadges(true).catch(console.error), 20000);
  notificationChannel = A.channel(`user-notifications-${session.user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_notifications', filter: `user_id=eq.${session.user.id}` }, (payload) => {
      showToast(payload.new?.title || 'Nova atualização no Faz Já');
      refreshNotificationBadges(false).catch(console.error);
      refreshVisibleArea().catch(console.error);
    })
    .subscribe();
}

function bindAccountUi() {
  $('accountCta')?.addEventListener('click', () => openAccount('profile'));
  $('accountForm')?.addEventListener('submit', saveProfile);
  $('accountClose')?.addEventListener('click', closeAccount);
  document.querySelectorAll('.account-tab').forEach((button) => { button.onclick = () => selectTab(button.dataset.accountTab); });
  $('navHome')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  $('navRequests')?.addEventListener('click', () => openAccount('requests'));
  $('navPro')?.addEventListener('click', () => openAccount('professional'));
  $('navAccount')?.addEventListener('click', () => openAccount('profile'));
}

async function initAccount() {
  bindAccountUi();
  initChat({ onRequestChange: () => refreshVisibleArea().catch(console.error) });
  await ensureSession();
  if (session) startNotifications();

  A.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    lastUnreadCount = null;
    $('accountCta')?.classList.toggle('on', Boolean(session));
    if (!session) {
      closeAccount();
      stopNotifications();
      applyBadge(['navRequests', 'navPro', 'proCta'], 0);
    } else startNotifications();
  });
}

initAccount().catch(console.error);
