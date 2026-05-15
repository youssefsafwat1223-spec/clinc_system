import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DangerButton, PrimaryButton, SecondaryButton, inputClass } from './ui';

/* ─────────────────────────────────────────────────────────────
   Dialog store — module-level subscribe/notify
   ───────────────────────────────────────────────────────────── */

let listeners = [];
let nextId = 1;

function emit(dialog) {
  listeners.forEach((listener) => listener(dialog));
}

function openDialog(dialog) {
  return new Promise((resolve) => {
    emit({ ...dialog, id: nextId++, resolve });
  });
}

export function confirmDialog({
  title = 'تأكيد',
  message = '',
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  tone = 'danger',
} = {}) {
  return openDialog({ kind: 'confirm', title, message, confirmLabel, cancelLabel, tone });
}

export function promptDialog({
  title = 'يرجى إدخال البيان',
  message = '',
  placeholder = '',
  initialValue = '',
  required = false,
  multiline = false,
  confirmLabel = 'متابعة',
  cancelLabel = 'إلغاء',
  tone = 'primary',
} = {}) {
  return openDialog({
    kind: 'prompt',
    title,
    message,
    placeholder,
    initialValue,
    required,
    multiline,
    confirmLabel,
    cancelLabel,
    tone,
  });
}

/* ─────────────────────────────────────────────────────────────
   DialogHost — mounted once at the app root
   ───────────────────────────────────────────────────────────── */

export function DialogHost() {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const listener = (next) => {
      setDialog(next);
      setValue(next?.initialValue || '');
      setError('');
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (dialog?.kind === 'prompt' && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleCancel();
      if (e.key === 'Enter' && dialog.kind !== 'prompt') {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!dialog) return null;

  function close(result) {
    dialog.resolve(result);
    setDialog(null);
    setValue('');
    setError('');
  }

  function handleCancel() {
    close(dialog.kind === 'prompt' ? null : false);
  }

  function handleConfirm() {
    if (dialog.kind === 'prompt') {
      const trimmed = value.trim();
      if (dialog.required && !trimmed) {
        setError('هذا الحقل مطلوب');
        return;
      }
      close(trimmed || value);
    } else {
      close(true);
    }
  }

  const ConfirmBtn = dialog.tone === 'danger' ? DangerButton : PrimaryButton;
  const InputTag = dialog.multiline ? 'textarea' : 'input';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-start gap-3">
            {dialog.tone === 'danger' ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
            ) : null}
            <div>
              <h2 className="text-lg font-black text-white">{dialog.title}</h2>
              {dialog.message ? (
                <p className="mt-1 text-sm leading-6 text-slate-400">{dialog.message}</p>
              ) : null}
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {dialog.kind === 'prompt' ? (
          <div className="p-5">
            <InputTag
              ref={inputRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !dialog.multiline) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              placeholder={dialog.placeholder}
              className={`${inputClass} ${dialog.multiline ? 'min-h-[100px]' : ''}`}
              rows={dialog.multiline ? 4 : undefined}
            />
            {error ? <p className="mt-2 text-xs font-bold text-rose-400">{error}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-white/10 p-5 sm:flex-row sm:justify-end">
          <SecondaryButton type="button" onClick={handleCancel}>
            {dialog.cancelLabel}
          </SecondaryButton>
          <ConfirmBtn type="button" onClick={handleConfirm}>
            {dialog.confirmLabel}
          </ConfirmBtn>
        </div>
      </div>
    </div>
  );
}
