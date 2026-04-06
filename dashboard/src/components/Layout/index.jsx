import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children, noPadding = false }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex font-sans antialiased overflow-hidden selection:bg-primary-500/30 selection:text-primary-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col relative h-screen w-full overflow-hidden bg-gradient-to-br from-dark-bg via-[#0b1325] to-dark-bg">
        {/* Subtle background ambient light */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-900/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none"></div>
        
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className={`flex-1 relative z-10 ${noPadding ? 'overflow-hidden' : 'overflow-y-auto scroll-smooth p-4 sm:p-6 lg:p-8'}`}>
          <div className={`mx-auto w-full fade-in ${noPadding ? 'h-full flex flex-col relative' : 'max-w-7xl pb-12'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
