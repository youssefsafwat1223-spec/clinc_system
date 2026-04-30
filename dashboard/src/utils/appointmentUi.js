export const appointmentStatusLabels = {
  ALL: 'كل الحالات',
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  COMPLETED: 'تم الكشف',
  CANCELLED: 'ملغي',
  REJECTED: 'مرفوض',
  EXPIRED: 'منتهي',
  BLOCKED: 'مغلق',
};

export const appointmentStatusTone = {
  PENDING: 'amber',
  CONFIRMED: 'green',
  COMPLETED: 'blue',
  CANCELLED: 'red',
  REJECTED: 'red',
  EXPIRED: 'slate',
  BLOCKED: 'slate',
};

export const todayInputValue = () => new Date().toISOString().slice(0, 10);

export const formatDateTime = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
  }).format(new Date(value));
};

export const formatTime = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

export const money = (value) => `${Number(value || 0).toLocaleString('ar-EG')} ج.م`;
