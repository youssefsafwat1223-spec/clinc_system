/**
 * One-off: fully delete a patient + ALL related rows (safe FK order).
 * Usage:  cd server && node scripts/deletePatientByPhone.js <phone>
 * Example: node scripts/deletePatientByPhone.js 201203628493
 */
const prisma = require('../src/lib/prisma');

async function main() {
  const phone = (process.argv[2] || '').trim();
  if (!phone) {
    console.error('Provide a phone. e.g. node scripts/deletePatientByPhone.js 201203628493');
    process.exit(1);
  }

  let patient = await prisma.patient.findFirst({ where: { phone } });
  if (!patient) {
    const tail = phone.replace(/\D/g, '').slice(-9);
    patient = await prisma.patient.findFirst({ where: { phone: { contains: tail } } });
  }
  if (!patient) {
    console.error(`No patient found for phone "${phone}".`);
    process.exit(1);
  }

  console.log(`Deleting patient: ${patient.displayName || patient.name} (${patient.phone}) [${patient.id}]`);

  const appointments = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    select: { id: true },
  });
  const appointmentIds = appointments.map((a) => a.id);

  const result = await prisma.$transaction(async (tx) => {
    const out = {};
    if (appointmentIds.length) {
      out.notifications = (
        await tx.notification.deleteMany({ where: { appointmentId: { in: appointmentIds } } })
      ).count;
    }
    out.reviews = (await tx.review.deleteMany({ where: { patientId: patient.id } })).count;
    out.prescriptions = (await tx.prescription.deleteMany({ where: { patientId: patient.id } })).count;
    out.consultations = (await tx.consultation.deleteMany({ where: { patientId: patient.id } })).count;
    out.messages = (await tx.message.deleteMany({ where: { patientId: patient.id } })).count;
    out.payments = (await tx.payment.deleteMany({ where: { patientId: patient.id } })).count;
    out.extraCharges = (await tx.extraCharge.deleteMany({ where: { patientId: patient.id } })).count;
    out.offerLogs = (await tx.offerLog.deleteMany({ where: { patientId: patient.id } })).count;
    out.groupLinks = (await tx.patientGroupMember.deleteMany({ where: { patientId: patient.id } })).count;
    // CallbackRequest.patientId is nullable (SetNull) — detach instead of delete.
    out.callbackRequests = (
      await tx.callbackRequest.updateMany({ where: { patientId: patient.id }, data: { patientId: null } })
    ).count;
    out.appointments = (await tx.appointment.deleteMany({ where: { patientId: patient.id } })).count;
    await tx.patient.delete({ where: { id: patient.id } });
    return out;
  });

  console.log('Deleted related rows:', result);
  console.log('Patient deleted successfully.');
}

main()
  .catch((error) => {
    console.error('FAILED (nothing was deleted — transaction rolled back):', error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
