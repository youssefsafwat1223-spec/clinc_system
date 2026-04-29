import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children, noPadding = false }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex font-sans antialiased overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col relative h-screen w-full overflow-hidden bg-gray-50">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className={`flex-1 relative ${noPadding ? 'overflow-hidden' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'}`}>
          <div className={`mx-auto w-full ${noPadding ? 'h-full flex flex-col relative' : 'max-w-7xl pb-12'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
