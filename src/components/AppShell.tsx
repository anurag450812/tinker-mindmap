'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import Canvas from './Canvas';

export default function AppShell() {
  const { files, createFile, setActiveFile, activeFileId, theme } = useAppStore();
  const isDark = theme === 'dark';

  /* ensure at least one file exists on first load */
  useEffect(() => {
    if (files.length === 0) {
      const id = createFile('My First Mind Map');
      setActiveFile(id);
    } else if (!activeFileId && files.length > 0) {
      setActiveFile(files[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* sync theme to <html> for global CSS */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors ${
      isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8f9fa] text-gray-900'
    }`}>
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Canvas />
      </div>
    </div>
  );
}
