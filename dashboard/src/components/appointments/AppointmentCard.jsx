import { useState } from 'react';
import { CalendarDays, CheckCircle, Clock3, Hash, Stethoscope, User, XCircle } from 'lucide-react';
import { DataCard, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../ui';
import {
  appointmentStatusLabels,
  appointmentStatusTone,
  formatDetailedDate,
  formatTime,
} from '../../utils/appointmentUi';

export default function AppointmentCard({
  appointment,
  onConfirm,
  onCheckIn,
  onEnterRoom,
  onReject,
  onComplete,
  onNoShow,
  onCancel,
  onOpenPatientProfile,
  onCreatePrescription,
  onQueueChange,
  compact = false,
}) {
  const patientName = appointment.patient?.displayName || appointment.patient?.name || 'مريض غير محدد';
  const serviceName = appointment.service?.nameAr || appointment.service?.name || 'خدمة غير محددة';
  const doctorName = appointment.doctor?.name || 'طبيب غير محدد';
  const isWalkIn = appointment.appointmentType === 'WALK_IN';
  const hasQueue = appointment.queuePosition != null;
  const canCheckIn = ['PENDING', 'CONFIRMED'].includes(appointment.status) && onCheckIn;
  const canEnterRoom = appointment.status === 'CHECKED_IN' && onEnterRoom;
  const canEditQueue = hasQueue && ['CHECKED_IN', 'IN_ROOM'].includes(appointment.status) && onQueueChange;

  const [editingQueue, setEditingQueue] = useState(false);
  const [queueDraft, setQueueDraft] = useState(String(appointment.queuePosition ?? ''));
  const [savingQueue, setSavingQueue] = useState(false);

  const submitQueue = async (mode) => {
    const next = Number(queueDraft);
    if (!Number.isInteger(next) || next < 1) return;
    setSavingQueue(true);
    try {
      await onQueueChange?.(appointment, next, mode);
      setEditingQueue(false);
    } finally {
      setSavingQueue(false);
    }
  };

  return (
    <DataCard className={compact ? 'p-4' : undefined}>
      <div className="grid gap-4 xl:grid-cols-[auto_1fr_auto] xl:items-center">
        {hasQueue ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-sky-500/30 bg-sky-500/15 px-5 py-4 text-sky-100">
            <span className="text-[10px] font-bold tracking-wide text-sky-300/80">الدور</span>
            <span className="text-4xl font-black leading-none text-white">{appointment.queuePosition}</span>
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
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

          <h3 className="truncate text-2xl font-black text-white">{patientName}</h3>

          {canEditQueue ? (
            <div className="mt-3">
              {editingQueue ? (
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <label className="text-xs font-bold text-slate-300">
                    رقم الدور الجديد
                    <input
                      type="number"
                      min="1"
                      value={queueDraft}
                      onChange={(event) => setQueueDraft(event.target.value)}
                      className={`${inputClass} mt-1 w-24`}
                    />
                  </label>
                  <PrimaryButton
                    type="button"
                    onClick={() => submitQueue('swap')}
                    disabled={savingQueue}
                    className="px-3 py-2 text-xs"
                  >
                    تبديل
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => submitQueue('shift')}
                    disabled={savingQueue}
                    className="px-3 py-2 text-xs"
                  >
                    إزاحة
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setEditingQueue(false);
                      setQueueDraft(String(appointment.queuePosition ?? ''));
                    }}
                    disabled={savingQueue}
                    className="px-3 py-2 text-xs"
                  >
                    إلغاء
                  </SecondaryButton>
                  <p className="w-full text-[11px] leading-5 text-slate-400">
                    تبديل: يتبادل الرقم مع صاحب نفس الدور. إزاحة: يدخل في هذا الترتيب ويتحرك الباقي.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQueueDraft(String(appointment.queuePosition ?? ''));
                    setEditingQueue(true);
                  }}
                  className="text-xs font-bold text-sky-300 transition hover:text-sky-200"
                >
                  تعديل الدور
                </button>
              )}
            </div>
          ) : null}

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
              {onConfirm ? (
                <PrimaryButton type="button" onClick={() => onConfirm?.(appointment)}>
                  <CheckCircle className="h-4 w-4" />
                  قبول
                </PrimaryButton>
              ) : null}
              {onReject ? (
                <SecondaryButton
                  type="button"
                  onClick={() => onReject?.(appointment)}
                  className="hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <XCircle className="h-4 w-4" />
                  رفض
                </SecondaryButton>
              ) : null}
            </>
          ) : null}

          {canCheckIn ? (
            <>
              <PrimaryButton
                type="button"
                onClick={() => onCheckIn?.(appointment)}
                className="w-full px-6 py-3 text-base xl:w-auto"
              >
                <Hash className="h-5 w-5" />
                تم الحضور
              </PrimaryButton>
              {appointment.status === 'CONFIRMED' ? (
                <SecondaryButton
                  type="button"
                  onClick={() => onNoShow?.(appointment)}
                  className="hover:bg-amber-500/10 hover:text-amber-200"
                >
                  <XCircle className="h-4 w-4" />
                  لم يأت
                </SecondaryButton>
              ) : null}
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

          {canEnterRoom ? (
            <PrimaryButton
              type="button"
              onClick={() => onEnterRoom?.(appointment)}
              className="w-full px-6 py-3 text-base xl:w-auto"
            >
              <Stethoscope className="h-5 w-5" />
              تم الدخول للطبيب
            </PrimaryButton>
          ) : null}

          {appointment.status === 'IN_ROOM' ? (
            <>
              <PrimaryButton
                type="button"
                onClick={() => onComplete?.(appointment)}
                className="w-full px-6 py-3 text-base xl:w-auto"
              >
                <CheckCircle className="h-5 w-5" />
                تم الكشف
              </PrimaryButton>
            </>
          ) : null}
        </div>
      </div>
    </DataCard>
  );
}
