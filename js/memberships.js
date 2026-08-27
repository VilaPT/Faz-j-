import { supabase as S } from './supabase.js';
import { daysUntil } from './utils.js';

let membership = null;
let plan = null;

export async function loadPlan() {
  const { data, error } = await S
    .from('professional_plan')
    .select('id,name,trial_days,monthly_price_eur,billing_enabled')
    .eq('id', 'standard')
    .maybeSingle();

  if (error) throw error;
  plan = data || null;
  return plan;
}

export async function loadMembership(session) {
  membership = null;
  if (!session) return null;

  const { data, error } = await S
    .from('professional_memberships')
    .select('user_id,status,trial_started_at,trial_ends_at,current_period_end,cancel_at_period_end')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  membership = data || null;
  return membership;
}

export function getMembership() {
  return membership;
}

export function getPlan() {
  return plan;
}

export function membershipState() {
  if (!membership) return 'none';

  if (
    membership.status === 'trial'
    && membership.trial_ends_at
    && new Date(membership.trial_ends_at) > new Date()
  ) return 'trial';

  if (
    membership.status === 'active'
    && (!membership.current_period_end || new Date(membership.current_period_end) > new Date())
  ) return 'active';

  return 'expired';
}

export function trialDaysLeft() {
  return daysUntil(membership?.trial_ends_at);
}

export function renderMembershipPlan(element) {
  if (!element) return;

  const state = membershipState();

  if (state === 'trial') {
    element.innerHTML = `<strong>Período gratuito ativo</strong><span>Restam cerca de ${trialDaysLeft()} dias. O teu perfil pode aparecer nas pesquisas enquanto o período estiver ativo.</span>`;
    return;
  }

  if (state === 'active') {
    element.innerHTML = '<strong>Plano profissional ativo</strong><span>O teu perfil pode aparecer nas pesquisas.</span>';
    return;
  }

  if (state === 'expired') {
    element.innerHTML = '<strong>Período gratuito terminado</strong><span>O perfil fica guardado, mas deixa de aparecer publicamente até existir uma subscrição ativa.</span>';
    return;
  }

  const trialDays = plan?.trial_days || 60;
  element.innerHTML = `<strong>${trialDays} dias grátis</strong><span>O período começa quando criares o primeiro perfil profissional.</span>`;
}
