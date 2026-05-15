export const appointmentStatusLabels = {
  ALL: 'كل الحالات',
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  COMPLETED: 'تم الكشف',
  NO_SHOW: 'لم يأت',
  CANCELLED: 'ملغي',
  REJECTED: 'مرفوض',
  EXPIRED: 'منتهي',
  BLOCKED: 'مغلق',
};

export const appointmentStatusTone = {
  PENDING: 'amber',
  CONFIRMED: 'green',
  COMPLETED: 'blue',
  NO_SHOW: 'red',
  CANCELLED: 'red',
  REJECTED: 'red',
  EXPIRED: 'slate',
  BLOCKED: 'slate',
};

export const todayInputValue = () => new Date().toISOString().slice(0, 10);

export const formatDateTime = (value) => {
  if (!value) return '-';
  return (
    new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value)) + ` - ${formatTime(value)}`
  );
};

export const formatDetailedDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
};

export const money = (value) => `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;
