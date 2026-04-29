import { CheckCircle, Stethoscope, User, XCircle } from 'lucide-react';
import { DataCard, PrimaryButton, SecondaryButton, StatusBadge } from '../ui';
import { appointmentStatusLabels, appointmentStatusTone, formatTime } from '../../utils/appointmentUi';

export default function AppointmentCard({ appointment, onConfirm, onReject, onComplete, onCancel, compact = false }) {
  const patientName = appointment.patient?.displayName || appointment.patient?.name || 'مريض غير محدد';
  const serviceName = appointment.service?.nameAr || appointment.service?.name || 'خدمة غير محددة';
  const doctorName = appointment.doctor?.name || 'طبيب غير محدد';

  return (
    <DataCard className={compact ? 'p-4' : undefined}>
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-white">
              {formatTime(appointment.scheduledTime)}
            </span>
            <StatusBadge tone={appointmentStatusTone[appointment.status]}>
              {appointmentStatusLabels[appointment.status] || appointment.status}
            </StatusBadge>
            <span className="rounded-full border border-white/10 bg-[#0d1225] px-3 py-1 text-xs font-mono text-slate-400" dir="ltr">
              {appointment.bookingRef || appointment.id}
            </span>
          </div>

          <h3 className="truncate text-lg font-black text-white">{patientName}</h3>
          <div className="mt-2 grid gap-2 text-sm text-slate-400 md:grid-cols-3">
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4 text-sky-300" />
              {appointment.patient?.phone || '-'}
            </span>
            <span className="inline-flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-emerald-300" />
              د. {doctorName}
            </span>
            <span>{serviceName}</span>
          </div>

          {appointment.notes ? <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-slate-300">{appointment.notes}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {appointment.status === 'PENDING' ? (
            <>
              <PrimaryButton type="button" onClick={() => onConfirm?.(appointment)}>
                <CheckCircle className="h-4 w-4" />
                قبول
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => onReject?.(appointment)} className="hover:bg-rose-500/10 hover:text-rose-200">
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
              <SecondaryButton type="button" onClick={() => onCancel?.(appointment)} className="hover:bg-rose-500/10 hover:text-rose-200">
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
