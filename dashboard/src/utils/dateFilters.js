const DAY_MS = 24 * 60 * 60 * 1000;

export const calendarFilterOptions = [
  { value: 'all', label: 'كل الفترات' },
  { value: 'today', label: 'اليوم' },
  { value: '2days', label: 'آخر يومين' },
  { value: 'week', label: 'آخر أسبوع' },
  { value: 'month', label: 'آخر شهر' },
  { value: 'day', label: 'يوم محدد' },
  { value: 'specificMonth', label: 'شهر محدد' },
  { value: 'specificWeek', label: 'أسبوع داخل شهر' },
];

export const buildRecentMonthOptions = (count = 12) => {
  const months = [];
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('ar-EG', {
      month: 'long',
      year: 'numeric',
    }).format(date);
    months.push({ value, label });
  }

  return months;
};

export const getMonthWeekOptions = (monthValue) => {
  if (!monthValue) {
    return [
      { value: '1', label: 'الأسبوع 1' },
      { value: '2', label: 'الأسبوع 2' },
      { value: '3', label: 'الأسبوع 3' },
      { value: '4', label: 'الأسبوع 4' },
      { value: '5', label: 'الأسبوع 5' },
    ];
  }

  const [year, month] = monthValue.split('-').map(Number);
  if (!year || !month) return [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = Math.ceil(daysInMonth / 7);

  return Array.from({ length: weeks }, (_, index) => ({
    value: String(index + 1),
    label: `الأسبوع ${index + 1}`,
  }));
};

export const getWeekOfMonth = (date) => Math.floor((date.getDate() - 1) / 7) + 1;

export const isWithinCalendarFilter = (
  value,
  range,
  { exactDate = '', monthValue = '', weekOfMonth = '1' } = {}
) => {
  if (!value || range === 'all') return true;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();

  if (range === 'today') {
    return date.toDateString() === now.toDateString();
  }

  if (range === '2days') {
    return now.getTime() - date.getTime() <= 2 * DAY_MS;
  }

  if (range === 'week') {
    return now.getTime() - date.getTime() <= 7 * DAY_MS;
  }

  if (range === 'month') {
    return now.getTime() - date.getTime() <= 30 * DAY_MS;
  }

  if (range === 'day') {
    return exactDate ? date.toISOString().slice(0, 10) === exactDate : true;
  }

  if (range === 'specificMonth' || range === 'specificWeek') {
    if (!monthValue) return true;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return true;

    const sameMonth = date.getFullYear() === year && date.getMonth() + 1 === month;
    if (!sameMonth) return false;

    if (range === 'specificMonth') return true;

    return getWeekOfMonth(date) === Number(weekOfMonth || 1);
  }

  return true;
};
