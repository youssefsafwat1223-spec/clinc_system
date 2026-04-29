import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children, noPadding = false }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-shell flex min-h-screen overflow-hidden bg-[#0a0f1e] text-white antialiased" dir="rtl">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex h-screen w-full flex-1 flex-col overflow-hidden bg-[#0a0f1e]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute right-[-12rem] top-10 h-[34rem] w-[34rem] rounded-full bg-sky-600/10 blur-[140px]" />
          <div className="absolute bottom-[-10rem] left-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-600/10 blur-[120px]" />
        </div>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className={`relative flex-1 ${noPadding ? 'overflow-hidden' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'}`}>
          <div className={`mx-auto w-full ${noPadding ? 'h-full flex flex-col relative' : 'max-w-7xl pb-12'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
