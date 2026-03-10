import { useEffect, useState } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { wsService } from '@/services/websocket';
import { Header } from '@/sections/Header';
import { Dashboard } from '@/sections/Dashboard';
import { Signals } from '@/sections/Signals';
import { Positions } from '@/sections/Positions';
import { Analytics } from '@/sections/Analytics';
import { Settings } from '@/sections/Settings';
import { ProfileModal } from '@/sections/ProfileModal';
import { Toaster } from '@/components/ui/sonner';
import { ThemeContext, useThemeProvider } from '@/hooks/use-theme';
import { Sun, Moon, User } from 'lucide-react';
import './App.css';

function App() {
  const { activeTab } = useTradingStore();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    // Connect WebSocket on mount
    wsService.connect();

    return () => {
      wsService.disconnect();
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'signals':
        return <Signals />;
      case 'positions':
        return <Positions />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const themeCtx = useThemeProvider();

  return (
    <ThemeContext.Provider value={themeCtx}>
      <div className="min-h-screen bg-slate-950 text-slate-200 transition-colors duration-300">
        <Header />
        <main className="container mx-auto max-w-7xl px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
          {renderContent()}
        </main>
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: 'rgb(var(--slate-900))',
              border: '1px solid rgb(var(--slate-800))',
              color: 'rgb(var(--slate-200))',
            },
          }}
        />

        {/* Floating Profile */}
        <button
          onClick={() => setProfileOpen(true)}
          className="fixed bottom-24 sm:bottom-20 right-3 sm:right-6 z-50 w-12 h-12 rounded-full bg-indigo-600 border border-indigo-500 shadow-lg shadow-indigo-500/20 flex items-center justify-center text-white hover:bg-indigo-500 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
          title="Profile"
          aria-label="Profile"
        >
          <User className="w-5 h-5" />
        </button>

        {/* Profile Modal */}
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

        {/* Floating Theme Toggle */}
        <button
          onClick={themeCtx.toggleTheme}
          className="fixed bottom-6 right-3 sm:right-6 z-50 w-12 h-12 rounded-full bg-slate-800 border border-slate-700 shadow-lg shadow-black/30 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
          title={themeCtx.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {themeCtx.theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
