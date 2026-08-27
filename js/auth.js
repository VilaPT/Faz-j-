import { PUBLIC_APP_URL } from './config.js';
import { supabase } from './supabase.js';

let session = null;
let mode = 'login';
let pendingIntent = null;
let initialized = false;
let callbacks = {
  onSessionChange: null,
  onIntentReady: null,
  onToast: null,
};

const $ = (id) => document.getElementById(id);

function openModal() {
  $('authModal')?.classList.add('open');
}

function closeModal() {
  $('authModal')?.classList.remove('open');
}

function setMessage(text = '', type = '') {
  const element = $('authMsg');
  if (!element) return;
  element.className = `msg${type ? ` ${type}` : ''}`;
  element.textContent = text;
}

function friendlyAuthMessage(error) {
  const text = String(error?.message || error || '').trim();
  const normalized = text.toLowerCase();

  if (normalized.includes('email rate limit exceeded')) {
    return 'Foram enviados demasiados emails de confirmação num curto período. Aguarda um pouco e tenta novamente.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Email ou palavra-passe incorretos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirma primeiro o teu email através da mensagem que recebeste.';
  }
  return text || 'Não foi possível concluir a autenticação.';
}

function setSubmitting(isSubmitting) {
  const button = $('authSubmit');
  if (!button) return;
  button.disabled = isSubmitting;
  button.style.opacity = isSubmitting ? '.72' : '';
  button.style.pointerEvents = isSubmitting ? 'none' : '';
}

export function setAuthMode(nextMode) {
  mode = nextMode === 'signup' ? 'signup' : 'login';

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('on', button.dataset.mode === mode);
  });
  document.querySelectorAll('.signup').forEach((element) => {
    element.classList.toggle('hidden', mode !== 'signup');
  });

  if ($('authTitle')) $('authTitle').textContent = mode === 'signup' ? 'Criar conta' : 'Entrar';
  if ($('authSubmit')) $('authSubmit').textContent = mode === 'signup' ? 'Criar conta' : 'Entrar';
  setMessage();
}

export function getSession() {
  return session;
}

export function requireAuth(intent, accountType = 'client') {
  if (session) return true;

  pendingIntent = intent || null;
  setAuthMode('signup');
  if ($('type')) $('type').value = accountType;
  openModal();
  return false;
}

async function submitAuth(event) {
  event.preventDefault();
  setSubmitting(true);
  setMessage();

  try {
    const email = $('email')?.value.trim() || '';
    const password = $('password')?.value || '';

    if (mode === 'signup') {
      const name = $('name')?.value.trim() || '';
      const accountType = $('type')?.value || 'client';

      if (name.length < 2) {
        setMessage('Indica o teu nome.', 'err');
        return;
      }
      if (!$('consent')?.checked) {
        setMessage('Aceita os Termos e a Política de Privacidade.', 'err');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: PUBLIC_APP_URL,
          data: {
            display_name: name,
            account_type: accountType,
            beta_terms_version: '2026-08-27',
          },
        },
      });

      if (error) {
        setMessage(friendlyAuthMessage(error), 'err');
        return;
      }

      if (!data.session) {
        pendingIntent = null;
        setMessage(
          accountType === 'professional'
            ? 'Conta criada. Confirma o email e depois completa o perfil profissional para iniciar os 60 dias gratuitos.'
            : 'Conta criada. Confirma o email e depois volta aqui para entrar.',
          'ok',
        );
        return;
      }

      closeModal();
      callbacks.onToast?.('Bem-vindo ao Faz Já');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(friendlyAuthMessage(error), 'err');
      return;
    }

    closeModal();
    callbacks.onToast?.('Bem-vindo ao Faz Já');
  } finally {
    setSubmitting(false);
  }
}

async function handleAuthButton() {
  if (session) {
    await supabase.auth.signOut();
    callbacks.onToast?.('Sessão terminada');
    return;
  }

  setAuthMode('login');
  openModal();
}

function notifySessionChange(nextSession) {
  callbacks.onSessionChange?.(nextSession);

  if (nextSession && pendingIntent) {
    const intent = pendingIntent;
    pendingIntent = null;
    closeModal();
    callbacks.onIntentReady?.(intent, nextSession);
  }
}

function bindUi() {
  if (initialized) return;
  initialized = true;

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setAuthMode(button.dataset.mode));
  });
  $('authForm')?.addEventListener('submit', submitAuth);
  $('authBtn')?.addEventListener('click', handleAuthButton);
}

export async function initAuth(options = {}) {
  callbacks = { ...callbacks, ...options };
  bindUi();

  const { data } = await supabase.auth.getSession();
  session = data.session;

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    queueMicrotask(() => notifySessionChange(nextSession));
  });

  return session;
}
