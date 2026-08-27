import { supabase as S } from './js/supabase.js';
import {
  normalizeText as norm,
  escapeHtml as esc,
  getOrCreateSessionId,
  daysUntil,
} from './js/utils.js';
import { getSession, initAuth, requireAuth } from './js/auth.js';

const $ = (id) => document.getElementById(id);

let session = null;
let skills = [];
let cats = [];
let chosen = null;
let lastQ = '';
let lastCity = '';
let membership = null;
let plan = null;

const icons = {
  casa: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></svg>',
  automovel: '<svg viewBox="0 0 24 24"><path d="m5 16-1.2-4.2A2 2 0 0 1 5.7 9h12.6a2 2 0 0 1 1.9 2.8L19 16"/><path d="M5 16h14v3H5z"/><circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/><path d="m7 9 1.5-3h7L17 9"/></svg>',
  tecnologia: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  'limpeza e apoio': '<svg viewBox="0 0 24 24"><path d="m14 4 6 6"/><path d="M16.5 6.5 8 15"/><path d="M5 14c3 0 5 2 5 5H4c0-2 .3-3.5 1-5Z"/></svg>',
  'beleza e bem-estar': '<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="m9 9 8 8M15 9l-8 8"/></svg>',
  educacao: '<svg viewBox="0 0 24 24"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.5V15c3 2 7 2 10 0v-4.5M21 8v6"/></svg>',
  eventos: '<svg viewBox="0 0 24 24"><path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3Z"/></svg>',
  animais: '<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M8 18c0-3 2-5 4-5s4 2 4 5c0 2-1.5 3-4 3s-4-1-4-3Z"/></svg>',
  'negocios e profissionais': '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/></svg>',
  transportes: '<svg viewBox="0 0 24 24"><path d="M3 6h12v10H3zM15 10h3l3 3v3h-6z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};

const keywords = [
  ['plumbing', ['torneira', 'cano', 'fuga', 'autoclismo', 'entup']],
  ['electrician', ['eletric', 'tomada', 'disjuntor', 'sem luz']],
  ['appliance-repair', ['máquina de lavar', 'maquina de lavar', 'frigor', 'forno']],
  ['computer-repair', ['computador', 'portátil', 'portatil', 'windows', 'wifi']],
  ['mechanic', ['carro não pega', 'carro nao pega', 'motor', 'travões', 'travoes']],
  ['home-cleaning', ['limpeza', 'limpar casa']],
  ['painting', ['pintar', 'pintura']],
  ['furniture-assembly', ['montar móvel', 'montar movel', 'ikea']],
  ['air-conditioning', ['ar condicionado']],
  ['gardening', ['jardim', 'jardineiro']],
  ['wordpress', ['wordpress', 'woocommerce']],
  ['web-development', ['website', 'site', 'programador web']],
  ['dog-walking', ['passear cão', 'passear cao']],
  ['moving', ['mudança', 'mudanca']],
];

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

function inferSkill(text) {
  const normalized = norm(text);
  for (const [slug, terms] of keywords) {
    if (terms.some((term) => normalized.includes(norm(term)))) {
      return skills.find((skill) => skill.slug === slug);
    }
  }
  return skills.find((skill) => normalized.includes(norm(skill.name))) || chosen;
}

function formatPrice(professional) {
  if (professional.price_unit === 'quote' || professional.base_price == null) {
    return 'Sob orçamento';
  }

  const value = Number(professional.base_price).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  });

  if (professional.price_unit === 'hour') return `${value}/h`;
  if (professional.price_unit === 'visit') return `${value} deslocação`;
  return `Desde ${value}`;
}

function categoryIcon(name) {
  return icons[norm(name)] || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></svg>';
}

function renderCategories() {
  $('categoryGrid').innerHTML = cats.map((category) => `
    <button class="category-card" data-cat="${category.id}">
      <span class="cat-icon">${categoryIcon(category.name)}</span>
      <span class="cat-name">${esc(category.name)}</span>
      <span class="cat-arrow">↗</span>
    </button>
  `).join('');

  document.querySelectorAll('[data-cat]').forEach((button) => {
    button.onclick = () => selectCategory(Number(button.dataset.cat));
  });
}

function selectCategory(id) {
  chosen = null;
  document.querySelectorAll('[data-cat]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.cat) === id);
  });

  const category = cats.find((item) => item.id === id);
  const categorySkills = skills.filter((skill) => skill.category_id === id);

  $('servicesTitle').textContent = category?.name || 'Serviços';
  $('serviceChips').innerHTML = categorySkills.map((skill) => `
    <button class="service-chip" data-skill="${skill.id}">${esc(skill.name)}</button>
  `).join('');
  $('servicesPanel').classList.remove('hidden');

  document.querySelectorAll('[data-skill]').forEach((button) => {
    button.onclick = () => pickSkill(Number(button.dataset.skill));
  });
  $('servicesPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function pickSkill(id) {
  chosen = skills.find((skill) => skill.id === id);
  document.querySelectorAll('[data-skill]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.skill) === id);
  });

  if (chosen) {
    $('problem').value = chosen.name;
    $('problem').focus();
  }
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

  const [categoriesResult, skillsResult, planResult] = await Promise.all([
    S.from('service_categories').select('id,name,sort_order').order('sort_order'),
    S.from('skills').select('id,category_id,slug,name').order('name'),
    S.from('professional_plan')
      .select('id,name,trial_days,monthly_price_eur,billing_enabled')
      .eq('id', 'standard')
      .maybeSingle(),
  ]);

  if (categoriesResult.error || skillsResult.error) {
    throw new Error('Falha ao carregar serviços');
  }

  cats = categoriesResult.data || [];
  skills = skillsResult.data || [];
  plan = planResult.data || null;

  await loadMembership();
  renderSessionUi();
  renderCategories();
  $('pskills').innerHTML = skills.map((skill) => (
    `<option value="${skill.id}">${esc(skill.name)}</option>`
  )).join('');
}

$('searchForm').onsubmit = async (event) => {
  event.preventDefault();
  lastQ = $('problem').value.trim();
  lastCity = $('city').value.trim();
  chosen = inferSkill(lastQ);

  $('results').classList.remove('hidden');
  $('cards').innerHTML = '';
  $('empty').classList.add('hidden');

  if (!chosen) {
    $('matchText').textContent = 'Escolhe uma categoria ou descreve melhor o que precisas';
    $('empty').classList.remove('hidden');
    await logSearch(0);
    return;
  }

  $('matchText').textContent = chosen.name;

  const linked = await S
    .from('professional_skills')
    .select('professional_id')
    .eq('skill_id', chosen.id);

  const professionalIds = [...new Set((linked.data || []).map((item) => item.professional_id))];
  let professionals = [];

  if (professionalIds.length) {
    let query = S
      .from('professional_profiles')
      .select('user_id,public_name,headline,bio,city,base_price,price_unit,is_available,verification_status')
      .in('user_id', professionalIds)
      .eq('is_public', true);

    if (lastCity) query = query.ilike('city', lastCity);
    const result = await query.order('is_available', { ascending: false });
    professionals = result.data || [];
  }

  await logSearch(professionals.length);

  if (!professionals.length) {
    $('empty').classList.remove('hidden');
  } else {
    $('cards').innerHTML = professionals.map((professional) => `
      <article class="pro-card">
        <div class="pro-top">
          <div class="avatar">${esc((professional.public_name || 'F').charAt(0).toUpperCase())}</div>
          <div>
            <h3>${esc(professional.public_name || 'Profissional Faz Já')}</h3>
            <div class="meta">${esc(professional.headline || chosen.name)} · ${esc(professional.city || 'Zona por indicar')}</div>
          </div>
        </div>
        <div class="badges">
          <span class="badge ${professional.is_available ? 'on' : ''}">${professional.is_available ? '● Disponível agora' : 'A combinar'}</span>
          <span class="badge">${professional.verification_status === 'verified' ? '✓ Verificado' : 'Novo na plataforma'}</span>
        </div>
        <p class="bio">${esc(professional.bio || 'Sem apresentação ainda.')}</p>
        <div class="pro-foot">
          <strong>${formatPrice(professional)}</strong>
          <button class="btn primary ask">Pedir serviço</button>
        </div>
      </article>
    `).join('');

    document.querySelectorAll('.ask').forEach((button) => {
      button.onclick = () => need('request');
    });
  }

  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

async function logSearch(resultCount) {
  await S.from('search_events').insert({
    session_id: getOrCreateSessionId(),
    user_id: session?.user?.id || null,
    query: lastQ || chosen?.name || 'Pesquisa',
    resolved_skill_id: chosen?.id || null,
    city: lastCity || null,
    result_count: resultCount,
  });
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
  $('reqDesc').value = lastQ || chosen?.name || '';
  $('reqCity').value = lastCity;
  open('requestModal');
}

$('requestForm').onsubmit = async (event) => {
  event.preventDefault();
  session = getSession();
  if (!session) return need('request');

  const description = $('reqDesc').value.trim();
  const city = $('reqCity').value.trim();
  const { error } = await S.from('service_requests').insert({
    client_id: session.user.id,
    skill_id: chosen?.id || inferSkill(description)?.id || null,
    raw_query: lastQ || description,
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
