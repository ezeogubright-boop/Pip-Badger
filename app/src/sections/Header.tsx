import { useState } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { 
  Activity, 
  Shield, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  Bell,
  Menu,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { 
    wsConnected, 
    tradingEnabled, 
    killSwitchTriggered, 
    riskMetrics,
    activeTab,
    setActiveTab 
  } = useTradingStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'positions', label: 'Positions', icon: TrendingUp },
    { id: 'signals', label: 'Signals', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-emerald-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
              <div className="relative w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white tracking-tight">
              Pip<span className="text-indigo-400">Badger</span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Forex Trading</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Status Indicators - Responsive */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            {/* Connection Status - Hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              {wsConnected ? (
                <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
              )}
              <span className={`text-xs font-medium hidden sm:inline ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {wsConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Trading Status - Hidden on small screens, show icon only on tiny */}
            <div className="hidden md:block">
              <Badge 
                variant={tradingEnabled ? 'default' : 'destructive'}
                className={`text-xs ${
                  tradingEnabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {tradingEnabled ? (
                  <><Zap className="w-3 h-3 mr-1" /> Trading</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 mr-1" /> Halted</>
                )}
              </Badge>
            </div>

            {/* Risk Level - Compact on mobile */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <Shield className={`w-3 h-3 sm:w-4 sm:h-4 ${getRiskColor(riskMetrics.riskLevel).replace('bg-', 'text-')}`} />
              <span className="text-xs font-medium text-slate-300 capitalize hidden sm:inline">
                {riskMetrics.riskLevel}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${getRiskColor(riskMetrics.riskLevel)}`} />
            </div>

            {/* Account Balance - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-right">
                <p className="text-xs text-slate-400">Balance</p>
                <p className="text-sm font-bold text-white">
                  ${(riskMetrics.equity / 1000).toFixed(0)}K
                </p>
              </div>
            </div>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white h-10 w-10">
                  <Bell className="w-5 h-5" />
                  {killSwitchTriggered && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-slate-900 border-slate-800">
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-white mb-2">Notifications</h4>
                  {killSwitchTriggered ? (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-400">Kill Switch Activated</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Trading has been halted due to risk limits. Review and reset to resume.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No new notifications</p>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center w-10 h-10 text-slate-400 hover:text-white hover:bg-slate-800/50 active:bg-slate-700/50 transition-colors rounded-lg"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-900/50">
            <nav className="flex flex-col p-3 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all w-full text-left ${
                      activeTab === item.id
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
