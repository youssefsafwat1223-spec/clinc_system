import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Phone, Search, User, X } from 'lucide-react';
import api from '../../api/client';

const QUICK_LINKS = [
  { label: 'مرضى اليوم', path: '/today-patients', keywords: ['اليوم', 'مرضى', 'today'] },
  { label: 'إضافة مريض / موعد', path: '/add-patient', keywords: ['إضافة', 'جديد', 'add'] },
  { label: 'صندوق الوارد', path: '/inbox', keywords: ['رسائل', 'وارد', 'inbox'] },
  { label: 'المواعيد', path: '/appointments', keywords: ['مواعيد', 'appointments'] },
  { label: 'المرضى', path: '/patients', keywords: ['مرضى', 'patients'] },
  { label: 'الإعدادات', path: '/settings', keywords: ['إعدادات', 'settings'] },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_LINKS.slice(0, 5);
    return QUICK_LINKS.filter(
      (link) =>
        link.label.toLowerCase().includes(q) ||
        link.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  }, [query]);

  const allItems = useMemo(() => {
    const patientItems = results.map((p) => ({ type: 'patient', id: p.id, data: p }));
    const linkItems = filteredLinks.map((l) => ({ type: 'link', id: l.path, data: l }));
    return [...patientItems, ...linkItems];
  }, [results, filteredLinks]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setHighlightIndex(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [allItems.length]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/patients', { params: { search: q, limit: 6 } });
        setResults(res.data.patients || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const goTo = useCallback(
    (item) => {
      if (!item) return;
      if (item.type === 'patient') navigate(`/patients/${item.id}`);
      else navigate(item.data.path);
      setOpen(false);
    },
    [navigate]
  );

  const handleInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(allItems.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goTo(allItems[highlightIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
        aria-label="بحث عام"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">بحث...</span>
        <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 md:inline">
          /
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          dir="rtl"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 p-4">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKey}
                placeholder="ابحث عن مريض بالاسم أو الهاتف، أو انتقل لصفحة..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.length > 0 ? (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    المرضى
                  </p>
                  {results.map((patient, i) => {
                    const isHighlight = highlightIndex === i;
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => goTo({ type: 'patient', id: patient.id, data: patient })}
                        onMouseEnter={() => setHighlightIndex(i)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition ${
                          isHighlight ? 'bg-sky-500/15' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2 text-sky-300">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {patient.displayName || patient.name || 'مريض'}
                          </p>
                          {patient.phone ? (
                            <p className="flex items-center gap-1.5 truncate text-xs text-slate-400" dir="ltr">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </p>
                          ) : null}
                        </div>
                        <ArrowLeft className="h-4 w-4 flex-shrink-0 text-slate-500" />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {filteredLinks.length > 0 ? (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    الانتقال السريع
                  </p>
                  {filteredLinks.map((link, i) => {
                    const idx = results.length + i;
                    const isHighlight = highlightIndex === idx;
                    return (
                      <button
                        key={link.path}
                        type="button"
                        onClick={() => goTo({ type: 'link', id: link.path, data: link })}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition ${
                          isHighlight ? 'bg-sky-500/15' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <span className="flex-1 truncate text-sm font-bold text-white">{link.label}</span>
                        <ArrowLeft className="h-4 w-4 flex-shrink-0 text-slate-500" />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {!loading && results.length === 0 && filteredLinks.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  {query.trim().length < 2
                    ? 'اكتب على الأقل حرفين للبحث.'
                    : 'لا توجد نتائج مطابقة.'}
                </p>
              ) : null}

              {loading ? (
                <p className="px-4 py-3 text-center text-xs text-slate-500">جاري البحث...</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2 text-[10px] text-slate-500">
              <span>
                <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">↑↓</kbd>
                {' '}للتنقل
              </span>
              <span>
                <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">Enter</kbd>
                {' '}للفتح
              </span>
              <span>
                <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">Esc</kbd>
                {' '}للإغلاق
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
