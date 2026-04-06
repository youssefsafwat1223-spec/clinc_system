/**
 * Format date to Arabic readable format
 */
const formatDateAr = (date) => {
  const d = new Date(date);
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${days[d.getDay()]} ${day}/${month}`;
};

/**
 * Format time to Arabic readable format (12-hour)
 */
const formatTimeAr = (date) => {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12 || 12;
  return `${hours}:${minutes}${period}`;
};

/**
 * Generate available time slots for a given date & doctor's working hours
 */
const generateTimeSlots = (date, workingHours, duration = 30, bookedSlots = []) => {
  const dayOfWeek = new Date(date).getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayNames[dayOfWeek];

  const hours = workingHours[dayKey];
  if (!hours || !hours.start || !hours.end) return [];

  const slots = [];
  const [startH, startM] = hours.start.split(':').map(Number);
  const [endH, endM] = hours.end.split(':').map(Number);

  let current = new Date(date);
  current.setHours(startH, startM, 0, 0);

  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);

  while (current < end) {
    const slotTime = new Date(current);
    const isBooked = bookedSlots.some(
      (booked) => Math.abs(new Date(booked).getTime() - slotTime.getTime()) < duration * 60 * 1000
    );

    if (!isBooked && slotTime > new Date()) {
      slots.push({
        time: slotTime.toISOString(),
        label: `${formatDateAr(slotTime)} ${formatTimeAr(slotTime)}`,
      });
    }

    current.setMinutes(current.getMinutes() + duration);
  }

  return slots;
};

/**
 * Check if two time ranges overlap
 */
const hasConflict = (newTime, existingTimes, duration = 30) => {
  const newStart = new Date(newTime).getTime();
  const newEnd = newStart + duration * 60 * 1000;

  return existingTimes.some((existing) => {
    const existStart = new Date(existing).getTime();
    const existEnd = existStart + duration * 60 * 1000;
    return newStart < existEnd && newEnd > existStart;
  });
};

/**
 * Paginate query results
 */
const paginate = (page = 1, limit = 20) => {
  const skip = (Math.max(1, page) - 1) * limit;
  return { skip, take: limit };
};

module.exports = {
  formatDateAr,
  formatTimeAr,
  generateTimeSlots,
  hasConflict,
  paginate,
};
