/**
 * Change a single appointment's status (e.g. EXPIRED → PENDING / CONFIRMED).
 *
 * Usage:
 *   cd server && node scripts/changeAppointmentStatus.js <bookingRefOrId> <NEW_STATUS>
 *
 * Examples:
 *   node scripts/changeAppointmentStatus.js B-AAAA11 CONFIRMED
 *   node scripts/changeAppointmentStatus.js B-AAAA11 PENDING
 *
 * Allowed status values (Prisma enum AppointmentStatus):
 *   PENDING · CONFIRMED · COMPLETED · NO_SHOW · CANCELLED · REJECTED · EXPIRED · BLOCKED
 */
const prisma = require('../src/lib/prisma');

const ALLOWED = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'REJECTED', 'EXPIRED', 'BLOCKED'];

async function main() {
  const ref = (process.argv[2] || '').trim();
  const nextStatus = String(process.argv[3] || '').trim().toUpperCase();

  if (!ref || !nextStatus) {
    console.error('Usage: node scripts/changeAppointmentStatus.js <bookingRefOrId> <NEW_STATUS>');
    console.error('Allowed status:', ALLOWED.join(' / '));
    process.exit(1);
  }
  if (!ALLOWED.includes(nextStatus)) {
    console.error(`Unknown status "${nextStatus}". Allowed:`, ALLOWED.join(' / '));
    process.exit(1);
  }

  // Find by booking ref first, then by id.
  let appointment =
    (await prisma.appointment.findFirst({ where: { bookingRef: ref } })) ||
    (await prisma.appointment.findUnique({ where: { id: ref } }).catch(() => null));

  if (!appointment) {
    console.error(`No appointment found for "${ref}".`);
    process.exit(1);
  }

  const before = appointment.status;
  const data = { status: nextStatus };

  // Keep completedAt consistent with the status so the UI/reports don't lie.
  if (nextStatus === 'COMPLETED' && !appointment.completedAt) data.completedAt = new Date();
  if (nextStatus !== 'COMPLETED' && appointment.completedAt) data.completedAt = null;

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data,
    include: { patient: true, doctor: true, service: true },
  });

  console.log(
    `OK · ${updated.bookingRef || updated.id} · ${updated.patient?.displayName || updated.patient?.name || ''}` +
      `\n   ${before}  →  ${updated.status}`
  );
}

main()
  .catch((error) => {
    console.error('FAILED:', error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
