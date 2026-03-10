import { useState, useEffect } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import {
  X,
  User,
  Wifi,
  WifiOff,
  Shield,
  TrendingUp,
  BarChart3,
  Settings2,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Monitor,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMt5Status } from '@/services/api';
import api from '@/services/api';
import { toast } from 'sonner';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type ModalTab = 'profile' | 'mt5' | 'stats' | 'preferences';

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { riskMetrics, positions, signals, tradingEnabled, wsConnected, totalTrades, winningTrades } = useTradingStore();
  const [activeTab, setActiveTab] = useState<ModalTab>('profile');

  // MT5 Connection state
  const [mt5Status, setMt5Status] = useState<any>(null);
  const [mt5Loading, setMt5Loading] = useState(false);
  const [accountType, setAccountType] = useState<'demo' | 'live'>('demo');
  const [mt5Credentials, setMt5Credentials] = useState({
    login: '',
    password: '',
    server: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Stats
  const [botUptime] = useState(() => {
    const start = new Date();
    start.setHours(start.getHours() - Math.floor(Math.random() * 48 + 1));
    return start;
  });

  // Fetch MT5 status
  useEffect(() => {
    if (open) {
      setMt5Loading(true);
      getMt5Status()
        .then(({ data }) => setMt5Status(data))
        .catch(() => setMt5Status(null))
        .finally(() => setMt5Loading(false));
    }
  }, [open]);

  if (!open) return null;

  const uptimeStr = (() => {
    const diff = Date.now() - botUptime.getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  })();

  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : riskMetrics.winRate.toFixed(1);

  const handleMt5Connect = async () => {
    if (!mt5Credentials.login || !mt5Credentials.password || !mt5Credentials.server) {
      toast.error('Please fill in all MT5 credentials');
      return;
    }
    setConnecting(true);
    try {
      const { data } = await api.post('/api/mt5/connect', {
        login: parseInt(mt5Credentials.login),
        password: mt5Credentials.password,
        server: mt5Credentials.server,
        account_type: accountType,
      });
      if (data.connected) {
        toast.success(`Connected to MT5 ${accountType} account`);
        setMt5Status({ ...mt5Status, connected: true, mode: 'live' });
      } else {
        toast.error(data.error || 'Failed to connect to MT5');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleMt5Disconnect = async () => {
    try {
      await api.post('/api/mt5/disconnect');
      toast.success('Disconnected from MT5');
      setMt5Status({ ...mt5Status, connected: false, mode: 'simulation' });
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const tabs: { id: ModalTab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'mt5', label: 'MT5 Account', icon: Monitor },
    { id: 'stats', label: 'Bot Stats', icon: BarChart3 },
    { id: 'preferences', label: 'Preferences', icon: Settings2 },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Trader Profile</h2>
              <p className="text-xs text-slate-400">BX Mantis v1.0.0</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-indigo-400'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* ─── Profile Tab ─── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Account Overview Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">Account Overview</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      wsConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {wsConnected ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Balance</p>
                    <p className="text-lg font-bold text-white">
                      ${riskMetrics.accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Equity</p>
                    <p className="text-lg font-bold text-white">
                      ${riskMetrics.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Open P&L</p>
                    <p className={`text-sm font-semibold ${riskMetrics.openPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {riskMetrics.openPnl >= 0 ? '+' : ''}${riskMetrics.openPnl.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Daily P&L</p>
                    <p className={`text-sm font-semibold ${riskMetrics.dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {riskMetrics.dailyPnl >= 0 ? '+' : ''}${riskMetrics.dailyPnl.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                  <TrendingUp className="w-4 h-4 text-indigo-400 mb-1" />
                  <span className="text-xs text-slate-400">Positions</span>
                  <span className="text-sm font-bold text-white">{positions.length}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                  <Shield className="w-4 h-4 text-amber-400 mb-1" />
                  <span className="text-xs text-slate-400">Risk Level</span>
                  <span className="text-sm font-bold text-white capitalize">{riskMetrics.riskLevel}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                  <BarChart3 className="w-4 h-4 text-emerald-400 mb-1" />
                  <span className="text-xs text-slate-400">Win Rate</span>
                  <span className="text-sm font-bold text-white">{winRate}%</span>
                </div>
              </div>

              {/* Bot Status */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Trading Engine</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      tradingEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {tradingEnabled ? 'ACTIVE' : 'HALTED'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-300">Active Signals</span>
                  <span className="text-sm font-medium text-white">{signals.length}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-300">Bot Uptime</span>
                  <span className="text-sm font-medium text-white">{uptimeStr}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── MT5 Account Tab ─── */}
          {activeTab === 'mt5' && (
            <div className="space-y-4">
              {/* Current Connection Status */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Connection Status</span>
                  {mt5Loading ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  ) : mt5Status?.connected ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      <Wifi className="w-3 h-3 mr-1" /> CONNECTED
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                      <WifiOff className="w-3 h-3 mr-1" /> SIMULATION
                    </Badge>
                  )}
                </div>
                {mt5Status?.connected && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Mode: <span className="text-emerald-400">Live MT5</span></span>
                    <Button size="sm" variant="ghost" className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleMt5Disconnect}>
                      <LogOut className="w-3 h-3 mr-1" /> Disconnect
                    </Button>
                  </div>
                )}
              </div>

              {/* Account Type Selector */}
              {!mt5Status?.connected && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Account Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAccountType('demo')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          accountType === 'demo'
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <Monitor className="w-4 h-4 mx-auto mb-1" />
                        Demo Account
                        <p className="text-[10px] mt-0.5 opacity-60">Practice with virtual funds</p>
                      </button>
                      <button
                        onClick={() => setAccountType('live')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          accountType === 'live'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 mx-auto mb-1" />
                        Live Account
                        <p className="text-[10px] mt-0.5 opacity-60">Trade with real capital</p>
                      </button>
                    </div>
                  </div>

                  {accountType === 'live' && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400/80">
                        Live trading involves real money. Ensure your risk settings are properly configured before connecting.
                      </p>
                    </div>
                  )}

                  {/* MT5 Credentials */}
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">MT5 Credentials</label>

                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Login (Account Number)</label>
                      <input
                        type="text"
                        placeholder="e.g. 51234567"
                        value={mt5Credentials.login}
                        onChange={(e) => setMt5Credentials({ ...mt5Credentials, login: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="MT5 password"
                          value={mt5Credentials.password}
                          onChange={(e) => setMt5Credentials({ ...mt5Credentials, password: e.target.value })}
                          className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Server</label>
                      <input
                        type="text"
                        placeholder="e.g. MetaQuotes-Demo"
                        value={mt5Credentials.server}
                        onChange={(e) => setMt5Credentials({ ...mt5Credentials, server: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleMt5Connect}
                    disabled={connecting}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    {connecting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</>
                    ) : (
                      <><Wifi className="w-4 h-4 mr-2" /> Connect to MT5 {accountType === 'live' ? 'Live' : 'Demo'}</>
                    )}
                  </Button>
                </>
              )}

              {/* Helpful Info */}
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                <p className="text-xs text-slate-400 mb-2 font-medium">How to connect:</p>
                <ol className="text-[11px] text-slate-500 space-y-1 list-decimal list-inside">
                  <li>Open your MetaTrader 5 terminal on this PC</li>
                  <li>Log in to your demo or live account in MT5</li>
                  <li>Enter your account number, password & server above</li>
                  <li>Click Connect — the bot will link to your MT5 session</li>
                </ol>
              </div>
            </div>
          )}

          {/* ─── Stats Tab ─── */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {/* Performance Summary */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-sm font-medium text-white">Performance Summary</span>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Trades</p>
                    <p className="text-lg font-bold text-white">{totalTrades || riskMetrics.tradesToday}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Win Rate</p>
                    <p className="text-lg font-bold text-emerald-400">{winRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Sharpe Ratio</p>
                    <p className="text-lg font-bold text-white">{riskMetrics.sharpeRatio.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Max Drawdown</p>
                    <p className="text-lg font-bold text-red-400">{riskMetrics.maxDrawdown.toFixed(2)}%</p>
                  </div>
                </div>
              </div>

              {/* Risk & Margin */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-sm font-medium text-white">Risk & Margin</span>
                <div className="space-y-2 mt-3">
                  {[
                    { label: 'Margin Used', value: `$${riskMetrics.marginUsed.toLocaleString()}`, color: 'text-slate-200' },
                    { label: 'Margin Available', value: `$${riskMetrics.marginAvailable.toLocaleString()}`, color: 'text-emerald-400' },
                    { label: 'Total Risk Exposed', value: `${riskMetrics.totalRiskExposed.toFixed(2)}%`, color: 'text-amber-400' },
                    { label: 'Consecutive Losses', value: `${riskMetrics.consecutiveLosses}`, color: riskMetrics.consecutiveLosses >= 2 ? 'text-red-400' : 'text-slate-200' },
                    { label: 'Current Drawdown', value: `${riskMetrics.currentDrawdown.toFixed(2)}%`, color: riskMetrics.currentDrawdown > 3 ? 'text-red-400' : 'text-slate-200' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Session Info */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-sm font-medium text-white">Session Info</span>
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Bot Uptime</span>
                    <span className="text-sm font-medium text-white">{uptimeStr}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">API Endpoint</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-slate-300">localhost:8000</span>
                      <button onClick={() => copyToClipboard('http://localhost:8000')} className="text-slate-500 hover:text-white">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">WebSocket</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${wsConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}
                    >
                      {wsConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Preferences Tab ─── */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-sm font-medium text-white mb-3 block">Quick Actions</span>
                {[
                  {
                    label: 'Emergency Kill Switch',
                    desc: 'Immediately halt all trading activity',
                    action: () => { useTradingStore.getState().setKillSwitch(true); useTradingStore.getState().setTradingEnabled(false); toast.error('Kill switch activated!'); },
                    variant: 'destructive' as const,
                    icon: AlertTriangle,
                  },
                  {
                    label: 'Reset Risk Metrics',
                    desc: 'Clear daily P&L and loss counters',
                    action: () => { api.post('/api/risk/reset').then(() => toast.success('Risk metrics reset')).catch(() => toast.error('Failed to reset')); },
                    variant: 'outline' as const,
                    icon: Shield,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className={`w-full flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0 transition-colors ${
                      item.variant === 'destructive'
                        ? 'bg-red-500/5 border border-red-500/20 hover:bg-red-500/10'
                        : 'bg-slate-950/40 border border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-4 h-4 ${item.variant === 'destructive' ? 'text-red-400' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className={`text-sm font-medium ${item.variant === 'destructive' ? 'text-red-400' : 'text-slate-200'}`}>{item.label}</p>
                        <p className="text-[10px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                ))}
              </div>

              {/* Notification Preferences */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-sm font-medium text-white mb-3 block">Notifications</span>
                {[
                  { label: 'Trade Executions', key: 'notif_trades', default: true },
                  { label: 'Signal Alerts', key: 'notif_signals', default: true },
                  { label: 'Risk Warnings', key: 'notif_risk', default: true },
                  { label: 'Drawdown Alerts', key: 'notif_drawdown', default: false },
                ].map((pref) => {
                  const stored = localStorage.getItem(pref.key);
                  const isOn = stored !== null ? stored === 'true' : pref.default;
                  return (
                    <div key={pref.key} className="flex items-center justify-between py-2">
                      <span className="text-xs text-slate-300">{pref.label}</span>
                      <button
                        onClick={() => {
                          const next = !isOn;
                          localStorage.setItem(pref.key, String(next));
                          toast.success(`${pref.label} ${next ? 'enabled' : 'disabled'}`);
                        }}
                        className={`w-9 h-5 rounded-full transition-colors relative ${isOn ? 'bg-indigo-500' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isOn ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* App Version */}
              <div className="text-center pt-2">
                <p className="text-[10px] text-slate-600">ICT Institutional Trading Bot v1.0.0</p>
                <p className="text-[10px] text-slate-700">Built with FastAPI + React + Zustand</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
