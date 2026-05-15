import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const GO_TO = {
  d: { path: '/dashboard', label: 'الرئيسية' },
  p: { path: '/patients', label: 'المرضى' },
  i: { path: '/inbox', label: 'صندوق الوارد' },
  a: { path: '/appointments', label: 'المواعيد' },
  t: { path: '/today-patients', label: 'مرضى اليوم' },
};

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const awaitingGoto = useRef(false);
  const gotoTimer = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(document.activeElement)) return;
      // A dialog/search overlay is open — let it own the keyboard.
      if (document.querySelector('[role="dialog"]')) return;

      const key = e.key.toLowerCase();

      if (awaitingGoto.current) {
        awaitingGoto.current = false;
        if (gotoTimer.current) clearTimeout(gotoTimer.current);
        const target = GO_TO[key];
        if (target) {
          e.preventDefault();
          navigate(target.path);
        }
        return;
      }

      if (key === 'g') {
        awaitingGoto.current = true;
        gotoTimer.current = setTimeout(() => {
          awaitingGoto.current = false;
        }, 1200);
        return;
      }

      if (key === 'n') {
        e.preventDefault();
        navigate('/add-patient');
        return;
      }

      if (key === '?') {
        e.preventDefault();
        toast.info(
          'اختصارات: g ثم d/p/i/a/t للتنقل • n لإضافة مريض • / للبحث • Esc للإغلاق',
          { autoClose: 6000 }
        );
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (gotoTimer.current) clearTimeout(gotoTimer.current);
    };
  }, [navigate]);
}
