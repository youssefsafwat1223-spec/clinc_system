// Single source of truth for tooth status → color, shared by the 2D SVG
// chart, the 3D chart and the legend so they never drift apart.

export function toothState(entry) {
  if (!entry) return 'empty';
  if (entry.done || entry.status === 'DONE') return 'done';
  if (entry.serviceId) return 'service';
  if (entry.note && String(entry.note).trim()) return 'note';
  return 'empty';
}

// Hex colors for the 3D meshes.
export const TOOTH_COLOR = {
  empty: '#f8fafc',
  note: '#fbbf24',
  service: '#38bdf8',
  done: '#34d399',
  selected: '#0ea5e9',
};

// Tailwind fill/stroke classes for the 2D SVG teeth.
export const TOOTH_2D_CLASS = {
  empty: 'fill-white stroke-slate-400',
  note: 'fill-amber-100 stroke-amber-500',
  service: 'fill-sky-100 stroke-sky-500',
  done: 'fill-emerald-100 stroke-emerald-500',
  selected: 'fill-sky-500 stroke-sky-700',
};

export const TOOTH_LEGEND = [
  { state: 'empty', label: 'بدون', dot: 'bg-white border border-slate-400' },
  { state: 'note', label: 'ملاحظة', dot: 'bg-amber-400' },
  { state: 'service', label: 'خدمة', dot: 'bg-sky-400' },
  { state: 'done', label: 'تمت', dot: 'bg-emerald-400' },
];

// Universal numbering → anatomical tooth type for shape selection.
// Per quadrant of 8: central/lateral incisors, canine, 2 premolars, 3 molars.
export function toothType(toothNumber) {
  const n = Number(toothNumber);
  const posInQuadrant = ((n - 1) % 8) + 1; // 1..8 from back molar to front
  // Universal: 1 & 16 are upper molars (back). pos 1-3 molar, 4-5 premolar,
  // 6 canine, 7-8 incisor.
  if (posInQuadrant <= 3) return 'molar';
  if (posInQuadrant <= 5) return 'premolar';
  return 'incisor';
}
