import { supabase as A } from './js/supabase.js';
import { getSession } from './js/auth.js';
import { requestProfessionalMode } from './js/professionals.js';
import {
  getMembership,
  loadMembership,
  membershipState,
  trialDaysLeft,
} from './js/memberships.js';
import { escapeHtml } from './js/utils.js';

const $ = (id) => document.getElementById(id);
let session = null;
let lastIncomingCount = null;
let notificationTimer = null;

const statusMap = {
  open: 'Aberto',
  matched: 'Com profissionais',
  accepted: 'Aceite',
  in_progress: 'Em curso',
  completed: 'Concluído',
  declined: 'Recusado',
  cancelled: 'Cancelado',
};

function showToast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('on');
  setTimeout(() => element.classList.remove('on'), 3000);
}

function closeAccount() {
  $('accountModal')?.classList.remove('open');
}

function selectTab(name) {
  document.querySelectorAll('.account-tab').forEach((button) => {
    button.classList.toggle('on', button.dataset.accountTab === name);
  });
  document.querySelectorAll('.account-panel').forEach((panel) => {
    panel.classList.toggle('on', panel.dataset.accountPanel === name);
  });

  if (name === 'profile') loadProfile();
  if (name === 'requests') loadRequests();
  if (name === 'professional') loadProfessional();
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
  if (!await ensureSession()) {
    $('authBtn')?.click();
    return;
  }

  $('accountModal')?.classList.add('open');
  selectTab(name);
}

async function loadProfile() {
  if (!session) return;

  const { data, error } = await A
    .from('profiles')
    .select('display_name,phone,account_type')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    $('accountProfileMsg').textContent = 'Não foi possível carregar os teus dados.';
    return;
  }

  const profile = data || {};
  $('accountName').value = profile.display_name || '';
  $('accountPhone').value = profile.phone || '';
  $('accountEmail').textContent = session.user.email || '';
  $('accountType').textContent = profile.account_type === 'both'
    ? 'Cliente + profissional'
    : profile.account_type === 'professional'
      ? 'Profissional'
      : 'Cliente';
}

async function saveProfile(event) {
  event.preventDefault();
  if (!session) return;

  const name = $('accountName').value.trim();
  if (name.length < 2) {
    $('accountProfileMsg').textContent = 'Indica um nome válido.';
    return;
  }

  const { error } = await A
    .from('profiles')
    .update({
      display_name: name,
      phone: $('accountPhone').value.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.user.id);

  $('accountProfileMsg').textContent = error ? error.message : 'Dados guardados ✓';
  if (!error) refreshProfessionalBadge(false).catch(console.error);
}

async function cancelRequest(id) {
  if (!session || !id) return;
  if (!window.confirm('Retirar este pedido? Ele deixará de aparecer nos pedidos ativos.')) return;

  const { error } = await A
    .from('service_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', session.user.id)
    .in('status', ['open', 'matched']);

  if (error) {
    window.alert('Não foi possível retirar o pedido.');
    return;
  }

  await loadRequests();
}

function contactLink(phone, label = 'Ligar') {
  if (!phone) return '<span class="contact-missing">Telefone ainda não indicado.</span>';
  const safePhone = String(phone).replace(/[^+\d]/g, '');
  return `<a class="contact-link" href="tel:${escapeHtml(safePhone)}">${escapeHtml(label)} · ${escapeHtml(phone)}</a>`;
}

async function loadContacts(rows) {
  const contacts = new Map();
  const visible = rows.filter((row) => ['accepted', 'in_progress', 'completed'].includes(row.status));

  await Promise.all(visible.map(async (row) => {
    const { data, error } = await A.rpc('service_request_contact', { p_request_id: row.id });
    if (!error && data) contacts.set(row.id, data);
  }));

  return contacts;
}

async function loadRequests() {
  if (!session) return;
  $('accountRequests').innerHTML = '<div class="account-empty">A carregar…</div>';

  const { data, error } = await A
    .from('service_requests')
    .select('id,description,city,status,created_at,skill_id,professional_id')
    .eq('client_id', session.user.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) {
    $('accountRequests').innerHTML = '<div class="account-empty">Não foi possível carregar os pedidos.</div>';
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    $('accountRequests').innerHTML = '<div class="account-empty">Não tens pedidos ativos. Quando guardares um pedido, ele aparece aqui.</div>';
    return;
  }

  const skillIds = [...new Set(rows.map((row) => row.skill_id).filter(Boolean))];
  const professionalIds = [...new Set(rows.map((row) => row.professional_id).filter(Boolean))];

  const [skillResult, professionalResult, contacts] = await Promise.all([
    skillIds.length ? A.from('skills').select('id,name').in('id', skillIds) : Promise.resolve({ data: [] }),
    professionalIds.length
      ? A.from('professional_profiles').select('user_id,public_name').in('user_id', professionalIds)
      : Promise.resolve({ data: [] }),
    loadContacts(rows),
  ]);

  const skillNames = new Map((skillResult.data || []).map((skill) => [skill.id, skill.name]));
  const professionalNames = new Map((professionalResult.data || []).map((professional) => [professional.user_id, professional.public_name]));

  $('accountRequests').innerHTML = rows.map((row) => {
    const contact = contacts.get(row.id);
    const professionalName = contact?.professional_name
      || professionalNames.get(row.professional_id)
      || (row.professional_id ? 'Profissional escolhido' : null);

    return `
      <div class="account-item request-item">
        <strong>${escapeHtml(skillNames.get(row.skill_id) || 'Pedido de serviço')}</strong>
        <small>${escapeHtml(row.description)}${row.city ? ` · ${escapeHtml(row.city)}` : ''}</small>
        ${professionalName ? `<small class="request-party">Profissional: ${escapeHtml(professionalName)}</small>` : ''}
        <div class="request-footer">
          <span class="status-pill">${statusMap[row.status] || row.status}</span>
          ${['open', 'matched'].includes(row.status)
            ? `<button class="request-remove" type="button" data-remove-request="${row.id}">Retirar pedido</button>`
            : ''}
        </div>
        ${['accepted', 'in_progress', 'completed'].includes(row.status)
          ? `<div class="contact-box"><strong>Contacto do profissional</strong>${contactLink(contact?.professional_phone)}</div>`
          : row.professional_id && row.status === 'open'
            ? '<div class="request-note">O contacto fica disponível quando o profissional aceitar o pedido.</div>'
            : ''}
      </div>
    `;
  }).join('');

  document.querySelectorAll('[data-remove-request]').forEach((button) => {
    button.onclick = () => cancelRequest(button.dataset.removeRequest);
  });
}

async function updateProfessionalRequest(id, nextStatus) {
  const { error } = await A.rpc('professional_set_request_status', {
    p_request_id: id,
    p_status: nextStatus,
  });

  if (error) {
    window.alert('Não foi possível atualizar o pedido.');
    return;
  }

  await Promise.all([
    loadProfessional(),
    refreshProfessionalBadge(false),
  ]);
}

function professionalActions(row) {
  if (['open', 'matched'].includes(row.status)) {
    return `
      <div class="request-actions">
        <button class="request-action accept" type="button" data-request-status="accepted" data-request-id="${row.id}">Aceitar</button>
        <button class="request-action decline" type="button" data-request-status="declined" data-request-id="${row.id}">Recusar</button>
      </div>
    `;
  }

  if (row.status === 'accepted') {
    return `<button class="request-action accept" type="button" data-request-status="in_progress" data-request-id="${row.id}">Iniciar serviço</button>`;
  }

  if (row.status === 'in_progress') {
    return `<button class="request-action accept" type="button" data-request-status="completed" data-request-id="${row.id}">Marcar concluído</button>`;
  }

  return '';
}

async function loadProfessional() {
  if (!session) return;
  $('accountProfessional').innerHTML = '<div class="account-empty">A carregar…</div>';

  await loadMembership(session);

  const [profileResult, linksResult, ownProfileResult, requestsResult] = await Promise.all([
    A.from('professional_profiles')
      .select('public_name,headline,city,is_public,is_available')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    A.from('professional_skills')
      .select('skill_id')
      .eq('professional_id', session.user.id),
    A.from('profiles')
      .select('phone')
      .eq('id', session.user.id)
      .maybeSingle(),
    A.from('service_requests')
      .select('id,description,city,status,created_at,skill_id')
      .eq('professional_id', session.user.id)
      .in('status', ['open', 'matched', 'accepted', 'in_progress', 'completed'])
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (profileResult.error || linksResult.error || ownProfileResult.error || requestsResult.error) {
    $('accountProfessional').innerHTML = '<div class="account-empty">Não foi possível carregar a área profissional.</div>';
    return;
  }

  if (!profileResult.data) {
    $('accountProfessional').innerHTML = `
      <div class="account-empty">Ainda tens apenas conta de cliente. Podes ativar o modo profissional quando quiseres e os 60 dias gratuitos só começam quando guardares o primeiro perfil.</div>
      <button class="btn primary" id="accountMakePro" type="button">Tornar-me profissional</button>
    `;
    $('accountMakePro').onclick = () => {
      closeAccount();
      requestProfessionalMode();
    };
    return;
  }

  const profileSkillIds = (linksResult.data || []).map((item) => item.skill_id);
  const incomingRows = requestsResult.data || [];
  const allSkillIds = [...new Set([...profileSkillIds, ...incomingRows.map((row) => row.skill_id).filter(Boolean)])];
  const [skillResult, contacts] = await Promise.all([
    allSkillIds.length ? A.from('skills').select('id,name').in('id', allSkillIds) : Promise.resolve({ data: [] }),
    loadContacts(incomingRows),
  ]);

  const skillNames = new Map((skillResult.data || []).map((skill) => [skill.id, skill.name]));
  const profileSkills = profileSkillIds.map((id) => skillNames.get(id)).filter(Boolean);
  const state = membershipState();
  const membership = getMembership();
  const planLabel = state === 'trial'
    ? `${trialDaysLeft()} dias`
    : state === 'active'
      ? 'Ativo'
      : membership?.status || 'Sem plano';
  const professional = profileResult.data;
  const activeIncoming = incomingRows.filter((row) => ['open', 'matched', 'accepted', 'in_progress'].includes(row.status));
  const completedIncoming = incomingRows.filter((row) => row.status === 'completed');

  const inboxHtml = activeIncoming.length
    ? activeIncoming.map((row) => {
      const contact = contacts.get(row.id);
      return `
        <div class="account-item received-request">
          <div class="received-head">
            <strong>${escapeHtml(skillNames.get(row.skill_id) || 'Pedido de serviço')}</strong>
            <span class="status-pill">${statusMap[row.status] || row.status}</span>
          </div>
          <small>${escapeHtml(row.description)}${row.city ? ` · ${escapeHtml(row.city)}` : ''}</small>
          ${['accepted', 'in_progress'].includes(row.status)
            ? `<div class="contact-box"><strong>Contacto do cliente</strong>${contactLink(contact?.client_phone)}</div>`
            : '<div class="request-note">Aceita o pedido para desbloquear o contacto do cliente.</div>'}
          ${professionalActions(row)}
        </div>
      `;
    }).join('')
    : '<div class="account-empty">Não tens pedidos novos neste momento.</div>';

  $('accountProfessional').innerHTML = `
    <div class="account-summary">
      <div class="summary-card">
        <strong>${professional.is_public ? 'Publicado' : 'Privado'}</strong>
        <span>Estado do perfil</span>
      </div>
      <div class="summary-card">
        <strong>${escapeHtml(planLabel)}</strong>
        <span>Plano profissional</span>
      </div>
    </div>
    ${ownProfileResult.data?.phone
      ? ''
      : '<div class="contact-warning">Adiciona um telefone no separador Perfil. Depois de aceitares um pedido, o cliente poderá usar esse contacto para falar contigo.</div>'}
    <div class="account-item">
      <strong>${escapeHtml(professional.public_name || 'Perfil profissional')}</strong>
      <small>${escapeHtml(professional.headline || '')}${professional.city ? ` · ${escapeHtml(professional.city)}` : ''}</small>
      <div class="pro-skill-list">
        ${profileSkills.map((name) => `<span class="pro-skill-chip">${escapeHtml(name)}</span>`).join('')}
      </div>
    </div>
    <button class="btn primary" id="accountEditPro" type="button">Editar perfil profissional</button>
    <h3>Pedidos recebidos${activeIncoming.length ? ` (${activeIncoming.length})` : ''}</h3>
    <div class="account-list">${inboxHtml}</div>
    <h3>Serviços concluídos</h3>
    <div class="account-empty">${completedIncoming.length ? `${completedIncoming.length} serviço(s) concluído(s).` : 'Ainda não tens serviços concluídos.'}</div>
  `;

  $('accountEditPro').onclick = () => {
    closeAccount();
    requestProfessionalMode();
  };

  document.querySelectorAll('[data-request-status]').forEach((button) => {
    button.onclick = () => updateProfessionalRequest(
      button.dataset.requestId,
      button.dataset.requestStatus,
    );
  });
}

function applyProfessionalBadge(count) {
  const value = Number(count) || 0;
  for (const element of [$('navPro'), $('proCta')]) {
    if (!element) continue;
    if (value > 0) element.dataset.count = String(value > 9 ? '9+' : value);
    else delete element.dataset.count;
  }
}

async function refreshProfessionalBadge(notify = false) {
  const currentSession = getSession() || session;
  if (!currentSession) {
    lastIncomingCount = null;
    applyProfessionalBadge(0);
    return;
  }

  const { count, error } = await A
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', currentSession.user.id)
    .in('status', ['open', 'matched']);

  if (error) return;
  const nextCount = count || 0;

  if (notify && lastIncomingCount !== null && nextCount > lastIncomingCount) {
    showToast(nextCount - lastIncomingCount === 1 ? 'Novo pedido recebido ✓' : 'Recebeste novos pedidos ✓');
  }

  lastIncomingCount = nextCount;
  applyProfessionalBadge(nextCount);
}

function bindAccountUi() {
  $('accountCta')?.addEventListener('click', () => openAccount('profile'));
  $('accountForm')?.addEventListener('submit', saveProfile);
  $('accountClose')?.addEventListener('click', closeAccount);

  document.querySelectorAll('.account-tab').forEach((button) => {
    button.onclick = () => selectTab(button.dataset.accountTab);
  });

  $('navHome')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  $('navRequests')?.addEventListener('click', () => openAccount('requests'));
  $('navPro')?.addEventListener('click', () => {
    if (session) openAccount('professional');
    else requestProfessionalMode();
  });
  $('navAccount')?.addEventListener('click', () => openAccount('profile'));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshProfessionalBadge(true).catch(console.error);
  });
}

async function initAccount() {
  bindAccountUi();
  await ensureSession();
  await refreshProfessionalBadge(false);

  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = setInterval(() => {
    refreshProfessionalBadge(true).catch(console.error);
  }, 30000);

  A.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    lastIncomingCount = null;
    $('accountCta')?.classList.toggle('on', Boolean(session));
    if (!session) closeAccount();
    refreshProfessionalBadge(false).catch(console.error);
  });
}

initAccount().catch(console.error);
