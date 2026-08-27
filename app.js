import { supabase as S } from './js/supabase.js';
import { daysUntil, escapeHtml as esc } from './js/utils.js';
import { getSession, initAuth, requireAuth } from './js/auth.js';
import {
  getSearchContext,
  initSearch,
  resolveSkill,
} from './js/search.js';

const $ = (id) => document.getElementById(id);

let session = null;
let membership = null;
let plan = null;

function open(id) {
  $(id)?.classList.add('open');
}

function close(id) {
  $(id)?.classList.remove('open');
}

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('on');
  setTimeout(() => element.classList.remove('on'), 2600);
}

async function loadMembership() {
  membership = null;
  if (!session) return;

  const { data } = await S
    .from('professional_memberships')
    .select('user_id,status,trial_started_at,trial_ends_at,current_period_end,cancel_at_period_end')
    .eq('user_id', session.user.id)
    .maybeSingle();

  membership = data || null;
}

function membershipState() {
  if (!membership) return 'none';
  if (membership.status === 'trial' && new Date(membership.trial_ends_at) > new Date()) return 'trial';
  if (
    membership.status === 'active'
    && (!membership.current_period_end || new Date(membership.current_period_end) > new Date())
  ) return 'active';
  return 'expired';
}

function daysLeft() {
  return daysUntil(membership?.trial_ends_at);
}

function renderPlan() {
  const state = membershipState();
  const element = $('planStatus');
  if (!element) return;

  if (state === 'trial') {
    element.innerHTML = `<strong>Período gratuito ativo</strong><span>Restam cerca de ${daysLeft()} dias. O teu perfil pode aparecer nas pesquisas enquanto o período estiver ativo.</span>`;
  } else if (state === 'active') {
    element.innerHTML = '<strong>Plano profissional ativo</strong><span>O teu perfil pode aparecer nas pesquisas.</span>';
  } else if (state === 'expired') {
    element.innerHTML = '<strong>Período gratuito terminado</strong><span>O perfil fica guardado, mas deixa de aparecer publicamente até existir uma subscrição ativa.</span>';
  } else {
    element.innerHTML = '<strong>2 meses grátis</strong><span>O período começa quando criares o primeiro perfil profissional.</span>';
  }
}

function renderSessionUi() {
  const state = membershipState();
  $('authBtn').textContent = session ? 'Sair' : 'Entrar';
  $('proCta').textContent = !session
    ? 'Quero prestar serviços'
    : state === 'trial' || state === 'active'
      ? 'Área profissional'
      : state === 'expired'
        ? 'Reativar profissional'
        : 'Tornar-me profissional';
}

async function refreshSessionUi(nextSession) {
  session = nextSession;
  await loadMembership();
  renderSessionUi();
}

async function init() {
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.onclick = () => button.closest('.modal')?.classList.remove('open');
  });
  $('homeBtn').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  session = await initAuth({
    onSessionChange: (nextSession) => {
      refreshSessionUi(nextSession).catch(console.error);
    },
    onIntentReady: async (intent, nextSession) => {
      await refreshSessionUi(nextSession);
      if (intent === 'pro') await openPro();
      if (intent === 'request') openRequest();
    },
    onToast: toast,
  });

  const [searchData, planResult] = await Promise.all([
    initSearch({
      getSession,
      onRequest: () => need('request'),
    }),
    S.from('professional_plan')
      .select('id,name,trial_days,monthly_price_eur,billing_enabled')
      .eq('id', 'standard')
      .maybeSingle(),
  ]);

  plan = planResult.data || null;

  await loadMembership();
  renderSessionUi();
  $('pskills').innerHTML = searchData.skills.map((skill) => (
    `<option value="${skill.id}">${esc(skill.name)}</option>`
  )).join('');
}

function need(action) {
  const accountType = action === 'pro' ? 'professional' : 'client';
  if (!requireAuth(action, accountType)) return;

  session = getSession();
  if (action === 'pro') openPro();
  if (action === 'request') openRequest();
}

$('saveDemand').onclick = () => need('request');
$('proCta').onclick = () => need('pro');

function openRequest() {
  const context = getSearchContext();
  $('reqDesc').value = context.query || context.skill?.name || '';
  $('reqCity').value = context.city;
  open('requestModal');
}

$('requestForm').onsubmit = async (event) => {
  event.preventDefault();
  session = getSession();
  if (!session) return need('request');

  const description = $('reqDesc').value.trim();
  const city = $('reqCity').value.trim();
  const context = getSearchContext();
  const skill = context.skill || resolveSkill(description);

  const { error } = await S.from('service_requests').insert({
    client_id: session.user.id,
    skill_id: skill?.id || null,
    raw_query: context.query || description,
    description,
    city,
  });

  $('reqMsg').className = `msg ${error ? 'err' : 'ok'}`;
  $('reqMsg').textContent = error ? error.message : 'Pedido guardado ✓';
  if (!error) setTimeout(() => close('requestModal'), 700);
};

async function openPro() {
  session = getSession();
  if (!session) return need('pro');

  await loadMembership();
  renderPlan();

  const uid = session.user.id;
  const [profileResult, skillsResult] = await Promise.all([
    S.from('professional_profiles').select('*').eq('user_id', uid).maybeSingle(),
    S.from('professional_skills').select('skill_id').eq('professional_id', uid),
  ]);

  const professional = profileResult.data || {};
  $('pname').value = professional.public_name || '';
  $('headline').value = professional.headline || '';
  $('bio').value = professional.bio || '';
  $('pcity').value = professional.city || '';
  $('price').value = professional.base_price ?? '';
  $('available').checked = Boolean(professional.is_available);
  $('public').checked = Boolean(professional.is_public);

  const selectedIds = (skillsResult.data || []).map((item) => String(item.skill_id));
  [...$('pskills').options].forEach((option) => {
    option.selected = selectedIds.includes(option.value);
  });

  open('proModal');
}

$('proForm').onsubmit = async (event) => {
  event.preventDefault();
  session = getSession();
  if (!session) return need('pro');

  const selectedIds = [...$('pskills').selectedOptions].map((option) => Number(option.value));
  if (!selectedIds.length) {
    $('proMsg').className = 'msg err';
    $('proMsg').textContent = 'Escolhe pelo menos um serviço.';
    return;
  }

  const uid = session.user.id;
  const alreadyHadMembership = Boolean(membership);
  const payload = {
    user_id: uid,
    public_name: $('pname').value.trim(),
    headline: $('headline').value.trim() || null,
    bio: $('bio').value.trim() || null,
    city: $('pcity').value.trim(),
    service_radius_km: 15,
    base_price: $('price').value === '' ? null : Number($('price').value),
    price_unit: 'from',
    is_available: $('available').checked,
    is_public: $('public').checked,
    updated_at: new Date().toISOString(),
  };

  const profileResult = await S
    .from('professional_profiles')
    .upsert(payload, { onConflict: 'user_id' });

  if (profileResult.error) {
    $('proMsg').className = 'msg err';
    $('proMsg').textContent = profileResult.error.message;
    return;
  }

  await S.from('professional_skills').delete().eq('professional_id', uid);
  const skillsInsert = await S.from('professional_skills').insert(
    selectedIds.map((skillId, index) => ({
      professional_id: uid,
      skill_id: skillId,
      is_primary: index === 0,
    })),
  );

  await loadMembership();
  renderSessionUi();
  renderPlan();

  $('proMsg').className = `msg ${skillsInsert.error ? 'err' : 'ok'}`;
  $('proMsg').textContent = skillsInsert.error
    ? skillsInsert.error.message
    : !alreadyHadMembership && membershipState() === 'trial'
      ? `Perfil criado ✓ Tens cerca de ${daysLeft()} dias gratuitos.`
      : $('public').checked
        ? 'Perfil publicado ✓'
        : 'Perfil guardado ✓';
};

const legal = {
  privacy: {
    title: 'Política de Privacidade',
    body: 'O Faz Já utiliza os dados necessários para criar contas, apresentar perfis profissionais, guardar pedidos e melhorar a pesquisa de serviços. A autenticação e a base de dados usam infraestrutura Supabase. Não vendemos dados pessoais a anunciantes.',
  },
  terms: {
    title: 'Termos de Utilização',
    body: 'A conta de utilizador é gratuita. O modo profissional inclui 60 dias gratuitos a partir da criação do primeiro perfil profissional. Depois desse período, o perfil profissional deixa de aparecer publicamente sem uma subscrição ativa. O valor da mensalidade será apresentado antes da ativação do pagamento. Cada profissional é responsável pela informação do perfil, qualificações, preços e execução do serviço.',
  },
};

document.querySelectorAll('[data-legal]').forEach((button) => {
  button.onclick = () => {
    const content = legal[button.dataset.legal];
    $('legalTitle').textContent = content.title;
    $('legalBody').textContent = content.body;
    open('legalModal');
  };
});

init().catch((error) => {
  console.error(error);
  $('categoryGrid').innerHTML = '<div class="loading-card">Não foi possível carregar os serviços. Recarrega a página.</div>';
});
