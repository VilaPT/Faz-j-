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

const statusMap = {
  open: 'Aberto',
  matched: 'Com profissionais',
  accepted: 'Aceite',
  in_progress: 'Em curso',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

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

async function loadRequests() {
  if (!session) return;
  $('accountRequests').innerHTML = '<div class="account-empty">A carregar…</div>';

  const { data, error } = await A
    .from('service_requests')
    .select('id,description,city,status,created_at,skill_id')
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
  const skillResult = skillIds.length
    ? await A.from('skills').select('id,name').in('id', skillIds)
    : { data: [] };
  const skillNames = new Map((skillResult.data || []).map((skill) => [skill.id, skill.name]));

  $('accountRequests').innerHTML = rows.map((row) => `
    <div class="account-item request-item">
      <strong>${escapeHtml(skillNames.get(row.skill_id) || 'Pedido de serviço')}</strong>
      <small>${escapeHtml(row.description)}${row.city ? ` · ${escapeHtml(row.city)}` : ''}</small>
      <div class="request-footer">
        <span class="status-pill">${statusMap[row.status] || row.status}</span>
        ${['open', 'matched'].includes(row.status)
          ? `<button class="request-remove" type="button" data-remove-request="${row.id}">Retirar pedido</button>`
          : ''}
      </div>
    </div>
  `).join('');

  document.querySelectorAll('[data-remove-request]').forEach((button) => {
    button.onclick = () => cancelRequest(button.dataset.removeRequest);
  });
}

async function loadProfessional() {
  if (!session) return;
  $('accountProfessional').innerHTML = '<div class="account-empty">A carregar…</div>';

  const [profileResult, linksResult] = await Promise.all([
    A.from('professional_profiles')
      .select('public_name,headline,city,is_public,is_available')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    A.from('professional_skills')
      .select('skill_id')
      .eq('professional_id', session.user.id),
    loadMembership(session),
  ]);

  if (profileResult.error || linksResult.error) {
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

  const skillIds = (linksResult.data || []).map((item) => item.skill_id);
  const skillResult = skillIds.length
    ? await A.from('skills').select('id,name').in('id', skillIds)
    : { data: [] };
  const skillNames = (skillResult.data || []).map((skill) => skill.name);
  const state = membershipState();
  const membership = getMembership();
  const planLabel = state === 'trial'
    ? `${trialDaysLeft()} dias`
    : state === 'active'
      ? 'Ativo'
      : membership?.status || 'Sem plano';
  const professional = profileResult.data;

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
    <div class="account-item">
      <strong>${escapeHtml(professional.public_name || 'Perfil profissional')}</strong>
      <small>${escapeHtml(professional.headline || '')}${professional.city ? ` · ${escapeHtml(professional.city)}` : ''}</small>
      <div class="pro-skill-list">
        ${skillNames.map((name) => `<span class="pro-skill-chip">${escapeHtml(name)}</span>`).join('')}
      </div>
    </div>
    <button class="btn primary" id="accountEditPro" type="button">Editar perfil profissional</button>
    <h3>Serviços realizados</h3>
    <div class="account-empty">Ainda não existe histórico de trabalhos concluídos porque o Faz Já ainda não associa cada pedido a um profissional. Essa será a próxima peça do fluxo profissional.</div>
  `;

  $('accountEditPro').onclick = () => {
    closeAccount();
    requestProfessionalMode();
  };
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
  $('navPro')?.addEventListener('click', requestProfessionalMode);
  $('navAccount')?.addEventListener('click', () => openAccount('profile'));
}

async function initAccount() {
  bindAccountUi();
  await ensureSession();

  A.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    $('accountCta')?.classList.toggle('on', Boolean(session));
    if (!session) closeAccount();
  });
}

initAccount().catch(console.error);
