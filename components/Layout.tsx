import React, { useState, useEffect } from 'react';
import { History, Home, BookOpen, Moon, Sun } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (screen: any) => void;
  currentScreen: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentScreen }) => {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false,
  );
  const [scrolled, setScrolled] = useState(false);

  // Persist dark mode
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ss-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ss-theme', 'light');
    }
  }, [dark]);

  // Restore on mount
  useEffect(() => {
    const saved = localStorage.getItem('ss-theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navBtn = (screen: string, label: string, Icon: React.ElementType) => {
    const active = currentScreen === screen;
    return (
      <button
        onClick={() => onNavigate(screen)}
        className={`
          relative flex items-center space-x-1.5 px-4 py-2 rounded-full text-sm font-semibold
          transition-all duration-200
          ${active
            ? 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
          }
        `}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
        {active && (
          <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* ── Header ── */}
      <header
        className={`
          accent-bar relative w-full sticky top-0 z-40
          bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
          border-b border-slate-200/80 dark:border-slate-800
          transition-shadow duration-200
          ${scrolled ? 'shadow-soft' : ''}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-2.5 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-glow transition-shadow">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              RhemaNotes
            </span>
          </button>

          {/* Nav */}
          <nav className="flex items-center space-x-1">
            {navBtn('home',    'Home',    Home)}
            {navBtn('history', 'History', History)}

            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="ml-2 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="w-full max-w-7xl mx-auto flex-grow px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-600">
        RhemaNotes — capture the spirit of every sermon
      </footer>
    </div>
  );
};
