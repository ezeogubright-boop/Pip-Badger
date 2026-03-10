import { useState, useEffect } from 'react';
import { getPerformance } from '@/services/api';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  PieChart,
  Activity,
  Target,
  Calendar,
  DollarSign,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

// ----- helpers to derive chart data from real trade history -----

interface TradeRecord {
  position_id: string;
  symbol: string;
  direction: string;
  entry: number;
  exit: number;
  pnl: number;
  pnl_percent: number;
  reason: string;
  time: string;
}

function buildEquityCurve(trades: TradeRecord[], initialBalance: number) {
  const points = [{ date: 'Start', equity: initialBalance }];
  let running = initialBalance;
  trades.forEach((t) => {
    running += t.pnl;
    const d = new Date(t.time);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    points.push({ date: label, equity: Math.round(running * 100) / 100 });
  });
  return points;
}

function buildMonthlyReturns(trades: TradeRecord[]) {
  const map: Record<string, number> = {};
  trades.forEach((t) => {
    const d = new Date(t.time);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    map[key] = (map[key] || 0) + (t.pnl_percent ?? 0);
  });
  return Object.entries(map).map(([month, ret]) => ({ month, return: Math.round(ret * 100) / 100 }));
}

function buildTradeDistribution(wins: number, losses: number) {
  return [
    { name: 'Winning Trades', value: wins, color: '#10b981' },
    { name: 'Losing Trades', value: losses, color: '#ef4444' },
  ];
}

function buildWinRateBySetup(trades: TradeRecord[]) {
  const buckets: Record<string, { wins: number; total: number }> = {};
  trades.forEach((t) => {
    const key = t.reason || 'manual';
    if (!buckets[key]) buckets[key] = { wins: 0, total: 0 };
    buckets[key].total += 1;
    if (t.pnl >= 0) buckets[key].wins += 1;
  });
  return Object.entries(buckets).map(([setup, { wins, total }]) => ({
    setup,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    count: total,
  }));
}

// Performance Metrics Component
function PerformanceMetrics({ data }: { data: any }) {
  const totalTrades = data?.trade_statistics?.total_trades ?? 0;
  const totalReturn = data?.account_performance?.total_return ?? 0;
  const winRate = data?.trade_statistics?.win_rate ?? 0;
  const maxDD = data?.account_performance?.max_drawdown ?? 0;

  // Compute profit factor from recent trades
  const recentTrades: TradeRecord[] = data?.recent_trades ?? [];
  const grossProfit = recentTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(recentTrades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? Infinity : 0;

  // Avg trade PnL
  const avgTrade = totalTrades > 0
    ? recentTrades.reduce((s, t) => s + t.pnl, 0) / recentTrades.length
    : 0;

  const metrics = [
    {
      label: 'Total Return',
      value: `${totalReturn.toFixed(2)}%`,
      icon: TrendingUp,
      color: totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: totalReturn >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
    },
    {
      label: 'Profit Factor',
      value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
      icon: BarChart3,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Sharpe Ratio',
      value: (data?.account_performance?.sharpe_ratio ?? 0).toFixed(2),
      icon: Activity,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Max Drawdown',
      value: `${maxDD.toFixed(2)}%`,
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Avg Trade',
      value: `${avgTrade >= 0 ? '+' : ''}$${avgTrade.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
  ];
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <span className="text-sm text-slate-400">{metric.label}</span>
            </div>
            <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}

// Equity Curve Chart
function EquityCurveChart({ data }: { data: { date: string; equity: number }[] }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          Equity Curve
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#475569" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#475569" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #1e293b',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#equityGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Monthly Returns Chart
function MonthlyReturnsChart({ data }: { data: { month: string; return: number }[] }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          Monthly Returns
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="month" 
                stroke="#475569" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#475569" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #1e293b',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value}%`, 'Return']}
              />
              <Bar dataKey="return" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Trade Distribution Chart
function TradeDistributionChart({ wins, losses, winRate }: { wins: number; losses: number; winRate: number }) {
  const chartData = buildTradeDistribution(wins, losses);
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-400" />
          Trade Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #1e293b',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
              />
            </RePieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{wins}</p>
            <p className="text-xs text-slate-500">Winners</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{losses}</p>
            <p className="text-xs text-slate-500">Losers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-400">{winRate.toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Win Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Win Rate by Setup Chart
function WinRateBySetupChart({ data }: { data: { setup: string; winRate: number; count: number }[] }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          Win Rate by Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="#475569" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis 
                type="category" 
                dataKey="setup" 
                stroke="#475569" 
                fontSize={12}
                tickLine={false}
                width={100}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #1e293b',
                  borderRadius: '8px'
                }}
                formatter={(value: number, _name: string, props: any) => [
                  `${value}% (${props.payload.count} trades)`,
                  'Win Rate'
                ]}
              />
              <Bar dataKey="winRate" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Trade History Table
function TradeHistoryTable({ trades }: { trades: TradeRecord[] }) {
  const recentTrades = trades.map((t, i) => ({
    id: t.position_id || String(i),
    symbol: t.symbol,
    direction: t.direction,
    entry: t.entry,
    exit: t.exit,
    pnl: t.pnl,
    date: new Date(t.time).toLocaleDateString('en-CA'),
  }));
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          Recent Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Symbol</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Direction</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Entry</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Exit</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400">P&L</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-3 px-4 text-sm text-slate-300">{trade.date}</td>
                  <td className="py-3 px-4 text-sm text-white font-medium">{trade.symbol}</td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant="outline" 
                      className={trade.direction === 'long' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}
                    >
                      {trade.direction.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-300 text-right">${trade.entry.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm text-slate-300 text-right">${trade.exit.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-sm font-medium text-right ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Analytics Component
export function Analytics() {
  const [performance, setPerformance] = useState<any>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await getPerformance();
        setPerformance(data);
        setTrades(data?.recent_trades ?? []);
      } catch (error) {
        console.error('Failed to fetch performance:', error);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const initialBalance = performance?.account_performance?.initial_balance ?? 100000;
  const wins = performance?.trade_statistics?.winning_trades ?? 0;
  const losses = performance?.trade_statistics?.losing_trades ?? 0;
  const winRate = performance?.trade_statistics?.win_rate ?? 0;

  const equityCurveData = buildEquityCurve(trades, initialBalance);
  const monthlyData = buildMonthlyReturns(trades);
  const setupData = buildWinRateBySetup(trades);
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Performance Analytics
          </h2>
          <p className="text-slate-400 mt-1">
            Comprehensive trading performance analysis
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-slate-400 border-slate-700">
            <Calendar className="w-3 h-3 mr-1" />
            {trades.length} Trade{trades.length !== 1 ? 's' : ''} Recorded
          </Badge>
        </div>
      </div>
      
      {/* Performance Metrics */}
      <PerformanceMetrics data={performance} />
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <EquityCurveChart data={equityCurveData} />
        <MonthlyReturnsChart data={monthlyData} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <TradeDistributionChart wins={wins} losses={losses} winRate={winRate} />
        <WinRateBySetupChart data={setupData} />
      </div>
      
      {/* Trade History */}
      <TradeHistoryTable trades={trades} />
    </div>
  );
}
