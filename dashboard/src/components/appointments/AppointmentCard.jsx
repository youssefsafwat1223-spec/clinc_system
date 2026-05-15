import { CalendarDays, CheckCircle, Clock3, Stethoscope, User, XCircle } from 'lucide-react';
import { DataCard, PrimaryButton, SecondaryButton, StatusBadge } from '../ui';
import {
  appointmentStatusLabels,
  appointmentStatusTone,
  formatDetailedDate,
  formatTime,
} from '../../utils/appointmentUi';

export default function AppointmentCard({
  appointment,
  onConfirm,
  onReject,
  onComplete,
  onNoShow,
  onCancel,
  onOpenPatientProfile,
  onCreatePrescription,
  compact = false,
}) {
  const patientName = appointment.patient?.displayName || appointment.patient?.name || 'مريض غير محدد';
  const serviceName = appointment.service?.nameAr || appointment.service?.name || 'خدمة غير محددة';
  const doctorName = appointment.doctor?.name || 'طبيب غير محدد';
  const isWalkIn = appointment.appointmentType === 'WALK_IN';

  return (
    <DataCard className={compact ? 'p-4' : undefined}>
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge tone={appointmentStatusTone[appointment.status]}>
              {appointmentStatusLabels[appointment.status] || appointment.status}
            </StatusBadge>
            <span
              className="rounded-full border border-white/10 bg-[#0d1225] px-3 py-1 text-xs font-mono text-slate-400"
              dir="ltr"
            >
              {appointment.bookingRef || appointment.id}
            </span>
            {isWalkIn ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">
                دخول حسب الحضور
              </span>
            ) : null}
          </div>

          <h3 className="truncate text-lg font-black text-white">{patientName}</h3>

          <div className={`mt-3 grid gap-2 text-sm text-slate-300 ${isWalkIn ? 'md:grid-cols-3 xl:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4 text-sky-300" />
              {appointment.patient?.phone || '-'}
            </span>
            <span className="inline-flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-emerald-300" />
              د. {doctorName}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-300" />
              {formatDetailedDate(appointment.scheduledTime)}
            </span>
            {!isWalkIn ? (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                {formatTime(appointment.scheduledTime)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            {serviceName}
          </div>

          {appointment.notes ? (
            <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-slate-300">{appointment.notes}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {onOpenPatientProfile ? (
            <SecondaryButton type="button" onClick={() => onOpenPatientProfile(appointment)}>
              <User className="h-4 w-4" />
              ملف المريض
            </SecondaryButton>
          ) : null}

          {onCreatePrescription ? (
            <SecondaryButton type="button" onClick={() => onCreatePrescription(appointment)}>
              <Stethoscope className="h-4 w-4" />
              إنشاء روشتة
            </SecondaryButton>
          ) : null}

          {appointment.status === 'PENDING' ? (
            <>
              <PrimaryButton type="button" onClick={() => onConfirm?.(appointment)}>
                <CheckCircle className="h-4 w-4" />
                قبول
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => onReject?.(appointment)}
                className="hover:bg-rose-500/10 hover:text-rose-200"
              >
                <XCircle className="h-4 w-4" />
                رفض
              </SecondaryButton>
            </>
          ) : null}

          {appointment.status === 'CONFIRMED' ? (
            <>
              <PrimaryButton type="button" onClick={() => onComplete?.(appointment)}>
                <CheckCircle className="h-4 w-4" />
                تم الكشف
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => onNoShow?.(appointment)}
                className="hover:bg-amber-500/10 hover:text-amber-200"
              >
                <XCircle className="h-4 w-4" />
                لم يأت
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => onCancel?.(appointment)}
                className="hover:bg-rose-500/10 hover:text-rose-200"
              >
                <XCircle className="h-4 w-4" />
                إلغاء
              </SecondaryButton>
            </>
          ) : null}
        </div>
      </div>
    </DataCard>
  );
}
