import { getSession, initAuth } from './js/auth.js';
import { initSearch } from './js/search.js';
import { initRequests, openRequest, requestService } from './js/requests.js';
import {
  initProfessionals,
  openProfessionalProfile,
} from './js/professionals.js';
import {
  loadMembership,
  loadPlan,
  membershipState,
} from './js/memberships.js';

const $ = (id) => document.getElementById(id);
let session = null;

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('on');
  setTimeout(() => element.classList.remove('on'), 2600);
}

function renderSessionUi() {
  const state = membershipState();

  if ($('authBtn')) $('authBtn').textContent = session ? 'Sair' : 'Entrar';
  if ($('proCta')) {
    $('proCta').textContent = !session
      ? 'Quero prestar serviços'
      : state === 'trial' || state === 'active'
        ? 'Área profissional'
        : state === 'expired'
          ? 'Reativar profissional'
          : 'Tornar-me profissional';
  }
}

async function refreshSessionUi(nextSession) {
  session = nextSession;
  await loadMembership(session);
  renderSessionUi();
}

function bindGlobalUi() {
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.onclick = () => button.closest('.modal')?.classList.remove('open');
  });

  $('homeBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function bindLegalUi() {
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
      if (!content) return;
      $('legalTitle').textContent = content.title;
      $('legalBody').textContent = content.body;
      $('legalModal')?.classList.add('open');
    };
  });
}

async function init() {
  bindGlobalUi();
  bindLegalUi();
  initRequests();

  session = await initAuth({
    onSessionChange: (nextSession) => {
      refreshSessionUi(nextSession).catch(console.error);
    },
    onIntentReady: async (intent, nextSession) => {
      await refreshSessionUi(nextSession);
      if (intent === 'pro') await openProfessionalProfile();
      if (intent === 'request') openRequest();
    },
    onToast: toast,
  });

  const [searchData] = await Promise.all([
    initSearch({
      getSession,
      onRequest: requestService,
    }),
    loadPlan(),
  ]);

  initProfessionals({
    skills: searchData.skills,
    onMembershipChange: refreshSessionUi,
  });

  await loadMembership(session);
  renderSessionUi();
}

init().catch((error) => {
  console.error(error);
  if ($('categoryGrid')) {
    $('categoryGrid').innerHTML = '<div class="loading-card">Não foi possível carregar os serviços. Recarrega a página.</div>';
  }
});
