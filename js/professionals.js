import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import {
  getMembership,
  loadMembership,
  membershipState,
  renderMembershipPlan,
  trialDaysLeft,
} from './memberships.js';
import { escapeHtml } from './utils.js';

const $ = (id) => document.getElementById(id);
let membershipChanged = () => {};

function openModal() {
  $('proModal')?.classList.add('open');
}

function setMessage(text = '', type = '') {
  const element = $('proMsg');
  if (!element) return;
  element.className = `msg${type ? ` ${type}` : ''}`;
  element.textContent = text;
}

export function requestProfessionalMode() {
  if (!requireAuth('pro', 'professional')) return false;
  openProfessionalProfile();
  return true;
}

export async function openProfessionalProfile() {
  const session = getSession();
  if (!session) {
    requestProfessionalMode();
    return;
  }

  await loadMembership(session);
  renderMembershipPlan($('planStatus'));
  setMessage();

  const uid = session.user.id;
  const [profileResult, skillsResult] = await Promise.all([
    S.from('professional_profiles').select('*').eq('user_id', uid).maybeSingle(),
    S.from('professional_skills').select('skill_id').eq('professional_id', uid),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (skillsResult.error) throw skillsResult.error;

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

  openModal();
}

async function submitProfessionalProfile(event) {
  event.preventDefault();

  const session = getSession();
  if (!session) {
    requestProfessionalMode();
    return;
  }

  const selectedIds = [...$('pskills').selectedOptions].map((option) => Number(option.value));
  if (!selectedIds.length) {
    setMessage('Escolhe pelo menos um serviço.', 'err');
    return;
  }

  const uid = session.user.id;
  const alreadyHadMembership = Boolean(getMembership());
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
    setMessage(profileResult.error.message, 'err');
    return;
  }

  const deleteResult = await S
    .from('professional_skills')
    .delete()
    .eq('professional_id', uid);

  if (deleteResult.error) {
    setMessage(deleteResult.error.message, 'err');
    return;
  }

  const skillsInsert = await S.from('professional_skills').insert(
    selectedIds.map((skillId, index) => ({
      professional_id: uid,
      skill_id: skillId,
      is_primary: index === 0,
    })),
  );

  if (skillsInsert.error) {
    setMessage(skillsInsert.error.message, 'err');
    return;
  }

  await loadMembership(session);
  renderMembershipPlan($('planStatus'));
  await membershipChanged(session);

  const message = !alreadyHadMembership && membershipState() === 'trial'
    ? `Perfil criado ✓ Tens cerca de ${trialDaysLeft()} dias gratuitos.`
    : $('public').checked
      ? 'Perfil publicado ✓'
      : 'Perfil guardado ✓';

  setMessage(message, 'ok');
}

export function initProfessionals({ skills = [], onMembershipChange = () => {} } = {}) {
  membershipChanged = onMembershipChange;

  $('pskills').innerHTML = skills.map((skill) => (
    `<option value="${skill.id}">${escapeHtml(skill.name)}</option>`
  )).join('');

  $('proCta')?.addEventListener('click', requestProfessionalMode);
  $('proForm')?.addEventListener('submit', submitProfessionalProfile);
}
