export const STATUSES = [
  'prospect',
  'proposing',
  'tour_scheduled',
  'offer',
  'active',
  'leave_notice',
  'left',
  'invalid',
];

export const CASE_TYPES = ['新規案件', '再稼働案件', '見込みになっていない提案中の方'];

export function computeFiscalMonths(baseDate = new Date()) {
  const y = baseDate.getMonth() >= 3 ? baseDate.getFullYear() : baseDate.getFullYear() - 1;
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(y, 3 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function normalizeJinSection(status, targetMonth, activeMonth) {
  if (status === 'leave_notice' || status === 'left') {
    return targetMonth > activeMonth ? 'leave_next' : 'leave';
  }
  if (status === 'offer' || status === 'active') return 'join_confirmed';
  if (status === 'prospect' || status === 'proposing' || status === 'tour_scheduled') {
    return targetMonth > activeMonth ? 'prospect_next' : 'prospect_current';
  }
  return 'prospect_current';
}

export function statusLabel(status) {
  const m = {
    prospect: '見込み',
    proposing: '提案中',
    tour_scheduled: '見学設定済',
    offer: '入職確定',
    active: '稼働中',
    leave_notice: '退職予定',
    left: '退職確定',
    invalid: '失注/無効',
  };
  return m[status] || status;
}