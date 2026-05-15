import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
        <Icon className="h-12 w-12 text-slate-500" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
      {description ? (
        <p className="mb-6 max-w-md text-center text-sm leading-7 text-slate-400">{description}</p>
      ) : null}
      {action ? (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
