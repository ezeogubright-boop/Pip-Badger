import { useEffect, useState, useRef, useCallback } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { wsService } from '@/services/websocket';
import { 
  TrendingUp, 
  DollarSign, 
  Activity,
  Shield,
  Target,
  BarChart3,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ComposedChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { CandlestickChart, LineChart as LineChartIcon, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { 
  getStatus, 
  getRiskMetrics, 
  getPositions, 
  getMarketData,
  getPerformance,
  getMt5Ohlcv,
  getMt5Status,
} from '@/services/api';

// TradingView Chart Component
function TradingViewChart() {
  const { selectedSymbol, marketData } = useTradingStore();
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
  const timeframes: Array<'15m' | '1h' | '4h' | '1d'> = ['15m', '1h', '4h', '1d'];
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mt5Connected, setMt5Connected] = useState(false);
  const [dataSource, setDataSource] = useState<'mt5' | 'simulation'>('simulation');

  // Zoom & pan state
  const [brushRange, setBrushRange] = useState({ start: 0, end: 99 });
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartRange = useRef({ start: 0, end: 99 });

  // Mouse wheel zoom (native listener for preventDefault)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setBrushRange(prev => {
      const range = prev.end - prev.start;
      const delta = e.deltaY > 0 ? Math.max(2, Math.ceil(range * 0.12)) : -Math.max(2, Math.ceil(range * 0.12));
      const newRange = Math.max(10, Math.min(chartData.length - 1, range + delta));
      const center = (prev.start + prev.end) / 2;
      let newStart = Math.round(center - newRange / 2);
      let newEnd = newStart + newRange;
      if (newStart < 0) { newEnd -= newStart; newStart = 0; }
      if (newEnd >= chartData.length) { newEnd = chartData.length - 1; newStart = Math.max(0, newEnd - newRange); }
      return { start: newStart, end: newEnd };
    });
  }, [chartData.length]);

  useEffect(() => {
    const el = chartWrapperRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Drag to pan
  const onChartMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartRange.current = { start: brushRange.start, end: brushRange.end };
  };
  const onChartMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !chartWrapperRef.current) return;
    const dx = e.clientX - dragStartX.current;
    const chartWidth = chartWrapperRef.current.offsetWidth;
    const range = dragStartRange.current.end - dragStartRange.current.start;
    const shift = Math.round((-dx / chartWidth) * range);
    let newStart = dragStartRange.current.start + shift;
    let newEnd = dragStartRange.current.end + shift;
    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
    if (newEnd >= chartData.length) { newStart -= (newEnd - chartData.length + 1); newEnd = chartData.length - 1; }
    newStart = Math.max(0, newStart);
    setBrushRange({ start: newStart, end: newEnd });
  };
  const onChartMouseUp = () => { isDragging.current = false; };

  // Zoom controls
  const zoomIn = useCallback(() => setBrushRange(prev => {
    const range = prev.end - prev.start;
    const newRange = Math.max(10, Math.round(range * 0.7));
    const center = Math.round((prev.start + prev.end) / 2);
    const newStart = Math.max(0, center - Math.round(newRange / 2));
    const newEnd = Math.min(chartData.length - 1, newStart + newRange);
    return { start: newStart, end: newEnd };
  }), [chartData.length]);

  const zoomOut = useCallback(() => setBrushRange(prev => {
    const range = prev.end - prev.start;
    const newRange = Math.min(chartData.length - 1, Math.round(range * 1.4));
    const center = Math.round((prev.start + prev.end) / 2);
    let newStart = Math.max(0, center - Math.round(newRange / 2));
    let newEnd = Math.min(chartData.length - 1, newStart + newRange);
    if (newEnd >= chartData.length) { newEnd = chartData.length - 1; newStart = Math.max(0, newEnd - newRange); }
    return { start: newStart, end: newEnd };
  }), [chartData.length]);

  const resetZoom = useCallback(() => {
    setBrushRange({ start: 0, end: chartData.length - 1 });
  }, [chartData.length]);

  // Fetch chart data from backend (MT5 or simulation)
  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      try {
        const { data } = await getMt5Ohlcv(selectedSymbol, timeframe, 300);
        setDataSource(data.source);
        const formatted = data.data.map((bar: any) => {
          const d = new Date(bar.time);
          const label = timeframe === '1d'
            ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          return {
            time: label,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          };
        });
        setChartData(formatted);
        // Default view: show latest ~80 bars
        const show = Math.min(80, formatted.length);
        setBrushRange({ start: Math.max(0, formatted.length - show), end: formatted.length - 1 });
      } catch {
        // Fallback – keep whatever data we had
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
    // Refresh every 5 seconds for live feel
    const interval = setInterval(fetchChartData, 5000);
    return () => clearInterval(interval);
  }, [selectedSymbol, timeframe]);

  // Check MT5 status once
  useEffect(() => {
    getMt5Status()
      .then(({ data }) => setMt5Connected(data.connected))
      .catch(() => setMt5Connected(false));
  }, []);

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            {selectedSymbol} - {timeframe}
          </CardTitle>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              dataSource === 'mt5'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
            }`}
          >
            {dataSource === 'mt5' ? (mt5Connected ? 'MT5 LIVE' : 'MT5') : 'SIMULATED'}
          </Badge>
          {loading && (
            <span className="text-xs text-slate-500 animate-pulse">Updating...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="flex items-center gap-1 mr-2 border-r border-slate-700 pr-3">
            <Button
              size="sm"
              variant={chartType === 'candlestick' ? 'default' : 'ghost'}
              onClick={() => setChartType('candlestick')}
              className={`text-xs px-2 ${chartType === 'candlestick' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Candlestick Chart"
            >
              <CandlestickChart className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={chartType === 'line' ? 'default' : 'ghost'}
              onClick={() => setChartType('line')}
              className={`text-xs px-2 ${chartType === 'line' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Line Chart"
            >
              <LineChartIcon className="w-4 h-4" />
            </Button>
          </div>
          {/* Timeframe Tabs */}
          {timeframes.map((tf) => (
            <Button
              key={tf}
              size="sm"
              variant={timeframe === tf ? 'default' : 'ghost'}
              onClick={() => setTimeframe(tf)}
              className={`text-xs ${
                timeframe === tf
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf}
            </Button>
          ))}
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-2 border-l border-slate-700 pl-3">
            <Button size="sm" variant="ghost" onClick={zoomIn} className="text-xs px-1.5 text-slate-400 hover:text-white" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={zoomOut} className="text-xs px-1.5 text-slate-400 hover:text-white" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={resetZoom} className="text-xs px-1.5 text-slate-400 hover:text-white" title="Fit All">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={chartWrapperRef}
          className="w-full bg-slate-950/50 rounded-lg p-4 select-none"
          style={{ minHeight: '420px', cursor: isDragging.current ? 'grabbing' : 'grab' }}
          onMouseDown={onChartMouseDown}
          onMouseMove={onChartMouseMove}
          onMouseUp={onChartMouseUp}
          onMouseLeave={onChartMouseUp}
        >
          {chartType === 'candlestick' ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} domain={['auto', 'auto']} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: '12px' }} hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                  cursor={{ stroke: '#6366f1', strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-lg">
                        <p className="text-slate-400 mb-1">{label}</p>
                        <p className="text-slate-200">O: <span className="font-medium">{d?.open}</span></p>
                        <p className="text-slate-200">H: <span className="text-indigo-400 font-medium">{d?.high}</span></p>
                        <p className="text-slate-200">L: <span className="text-red-400 font-medium">{d?.low}</span></p>
                        <p className="text-slate-200">C: <span className={`font-medium ${(d?.close ?? 0) >= (d?.open ?? 0) ? 'text-emerald-400' : 'text-red-400'}`}>{d?.close}</span></p>
                        <p className="text-slate-400 mt-1">Vol: {d?.volume?.toLocaleString()}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="volume" fill="url(#colorVolume)" radius={[4, 4, 0, 0]} yAxisId="right" />
                <Brush
                  dataKey="time"
                  height={25}
                  stroke="#6366f1"
                  fill="#0f172a"
                  tickFormatter={() => ''}
                  startIndex={brushRange.start}
                  endIndex={brushRange.end}
                  onChange={(range: any) => {
                    if (range && range.startIndex !== undefined) {
                      setBrushRange({ start: range.startIndex, end: range.endIndex });
                    }
                  }}
                />
                {/* Candlestick body + wick via custom Bar shape */}
                <Bar
                  dataKey="close"
                  isAnimationActive={false}
                  shape={(props: any) => {
                    const { x, width, payload, background } = props;
                    if (!payload || !background) return <g />;
                    const isUp = payload.close >= payload.open;
                    const color = isUp ? '#10b981' : '#ef4444';
                    const wickColor = isUp ? '#10b981' : '#ef4444';
                    
                    // Calculate Y positions using the background (full bar area)
                    const bgY = background.y;
                    const bgH = background.height;
                    
                    // Get the data range from visible data points only
                    const visible = chartData.slice(brushRange.start, brushRange.end + 1);
                    const yMin = Math.min(...(visible.map((d: any) => d.low)));
                    const yMax = Math.max(...(visible.map((d: any) => d.high)));
                    const yRange = yMax - yMin || 1;
                    
                    const toY = (val: number) => bgY + bgH - ((val - yMin) / yRange) * bgH;
                    
                    const openY = toY(payload.open);
                    const closeY = toY(payload.close);
                    const highY = toY(payload.high);
                    const lowY = toY(payload.low);
                    const bodyTop = Math.min(openY, closeY);
                    const bodyHeight = Math.max(Math.abs(openY - closeY), 1);
                    const barCenter = x + width / 2;
                    const bodyWidth = Math.max(width * 0.6, 4);
                    
                    return (
                      <g>
                        {/* Wick */}
                        <line x1={barCenter} y1={highY} x2={barCenter} y2={lowY} stroke={wickColor} strokeWidth={1} />
                        {/* Body */}
                        <rect
                          x={barCenter - bodyWidth / 2}
                          y={bodyTop}
                          width={bodyWidth}
                          height={bodyHeight}
                          fill={color}
                          rx={1}
                        />
                      </g>
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                  cursor={{ stroke: '#6366f1', strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorClose)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Brush
                  dataKey="time"
                  height={25}
                  stroke="#6366f1"
                  fill="#0f172a"
                  tickFormatter={() => ''}
                  startIndex={brushRange.start}
                  endIndex={brushRange.end}
                  onChange={(range: any) => {
                    if (range && range.startIndex !== undefined) {
                      setBrushRange({ start: range.startIndex, end: range.endIndex });
                    }
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Price</p>
            <p className="text-lg font-bold text-white">
              ${marketData[selectedSymbol]?.price?.toFixed(2) ?? '---'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">24h Change</p>
            <p className={`text-lg font-bold ${
              (marketData[selectedSymbol]?.change24h ?? 0) >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}>
              {(marketData[selectedSymbol]?.change24h ?? 0) >= 0 ? '+' : ''}
              {(marketData[selectedSymbol]?.change24h ?? 0).toFixed(2)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Volume</p>
            <p className="text-lg font-bold text-white">
              ${((marketData[selectedSymbol]?.volume24h ?? 0) / 1e9).toFixed(2)}B
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Source</p>
            <Badge variant="outline" className={`justify-center w-full text-xs ${
              dataSource === 'mt5'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
            }`}>
              {dataSource === 'mt5' ? 'MT5 LIVE' : 'SIMULATED'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


function MarketOverview() {
  const { marketData, selectedSymbol, setSelectedSymbol } = useTradingStore();
  
  const symbols = [
    { id: 'XAUUSD', label: 'XAU/USD', category: 'commodity' },
    { id: 'US30', label: 'US30', category: 'index' },
    { id: 'US500', label: 'US500', category: 'index' },
    { id: 'GBPUSD', label: 'GBP/USD', category: 'forex' },
    { id: 'EURUSD', label: 'EUR/USD', category: 'forex' },
    { id: 'USDJPY', label: 'USD/JPY', category: 'forex' },
    { id: 'AUDUSD', label: 'AUD/USD', category: 'forex' },
  ];

  const categoryColors: Record<string, string> = {
    crypto: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    commodity: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    index: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    forex: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {symbols.map(({ id, label, category }) => {
        const data = marketData[id];
        const isSelected = selectedSymbol === id;
        const change = data?.change24h || 0;
        const isPositive = change >= 0;
        
        return (
          <button
            key={id}
            onClick={() => setSelectedSymbol(id)}
            className={`p-4 rounded-xl border transition-all text-left ${
              isSelected 
                ? 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20' 
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">{label}</span>
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 ${categoryColors[category]}`}
              >
                {category.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-xl font-bold text-white">
                ${data?.price?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '---'}
              </p>
              <Badge 
                variant="outline" 
                className={`text-xs ${isPositive ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}
              >
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Vol: ${((data?.volume24h || 0) / 1e9).toFixed(2)}B
            </p>
          </button>
        );
      })}
    </div>
  );
}

// Account Stats Component
function AccountStats() {
  const { riskMetrics, tradingEnabled, killSwitchTriggered } = useTradingStore();
  
  const stats = [
    {
      label: 'Account Balance',
      value: `$${riskMetrics.accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Equity',
      value: `$${riskMetrics.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: Activity,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
    },
    {
      label: 'Open P&L',
      value: `$${riskMetrics.openPnl.toFixed(2)}`,
      icon: TrendingUp,
      color: riskMetrics.openPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: riskMetrics.openPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Daily P&L',
      value: `$${riskMetrics.dailyPnl.toFixed(2)}`,
      icon: BarChart3,
      color: riskMetrics.dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: riskMetrics.dailyPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <span className="text-sm text-slate-400">{stat.label}</span>
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        );
      })}
      
      {/* Trading Status */}
      <div className={`p-4 rounded-xl border ${
        killSwitchTriggered 
          ? 'bg-red-500/10 border-red-500/30' 
          : tradingEnabled 
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-yellow-500/10 border-yellow-500/30'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            killSwitchTriggered ? 'bg-red-500/20' : tradingEnabled ? 'bg-emerald-500/20' : 'bg-yellow-500/20'
          }`}>
            {killSwitchTriggered ? (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            ) : tradingEnabled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-yellow-400" />
            )}
          </div>
          <span className="text-sm text-slate-400">Trading Status</span>
        </div>
        <p className={`text-lg font-bold ${
          killSwitchTriggered ? 'text-red-400' : tradingEnabled ? 'text-emerald-400' : 'text-yellow-400'
        }`}>
          {killSwitchTriggered ? 'KILL SWITCH' : tradingEnabled ? 'ACTIVE' : 'PAUSED'}
        </p>
      </div>
      
      {/* Risk Level */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            riskMetrics.riskLevel === 'low' ? 'bg-emerald-500/20' :
            riskMetrics.riskLevel === 'medium' ? 'bg-yellow-500/20' :
            riskMetrics.riskLevel === 'high' ? 'bg-orange-500/20' : 'bg-red-500/20'
          }`}>
            <Shield className={`w-4 h-4 ${
              riskMetrics.riskLevel === 'low' ? 'text-emerald-400' :
              riskMetrics.riskLevel === 'medium' ? 'text-yellow-400' :
              riskMetrics.riskLevel === 'high' ? 'text-orange-400' : 'text-red-400'
            }`} />
          </div>
          <span className="text-sm text-slate-400">Risk Level</span>
        </div>
        <p className={`text-lg font-bold capitalize ${
          riskMetrics.riskLevel === 'low' ? 'text-emerald-400' :
          riskMetrics.riskLevel === 'medium' ? 'text-yellow-400' :
          riskMetrics.riskLevel === 'high' ? 'text-orange-400' : 'text-red-400'
        }`}>
          {riskMetrics.riskLevel}
        </p>
      </div>
    </div>
  );
}

// Drawdown Monitor Component
function DrawdownMonitor() {
  const { riskMetrics } = useTradingStore();
  
  const currentDrawdownPercent = riskMetrics.currentDrawdown;
  const maxDrawdownPercent = riskMetrics.maxDrawdown;
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-400" />
          Drawdown Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Current Drawdown</span>
            <span className={`font-medium ${currentDrawdownPercent > 4 ? 'text-red-400' : 'text-slate-300'}`}>
              {currentDrawdownPercent.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={currentDrawdownPercent} 
            max={10}
            className="h-2"
          />
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Max Drawdown</span>
            <span className="font-medium text-slate-300">{maxDrawdownPercent.toFixed(2)}%</span>
          </div>
          <Progress 
            value={maxDrawdownPercent} 
            max={15}
            className="h-2"
          />
        </div>
        
        <div className="pt-2 border-t border-slate-800">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Daily Loss Limit</span>
            <span className="text-slate-300">4.00%</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-400">Weekly Drawdown Limit</span>
            <span className="text-slate-300">8.00%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Performance Metrics Component
function PerformanceMetrics() {
  const [performance, setPerformance] = useState<any>(null);
  
  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const { data } = await getPerformance();
        setPerformance(data);
      } catch (error) {
        console.error('Failed to fetch performance:', error);
      }
    };
    
    fetchPerformance();
    const interval = setInterval(fetchPerformance, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const metrics = [
    { label: 'Total Trades', value: performance?.trade_statistics?.total_trades || 0, icon: Zap },
    { label: 'Win Rate', value: `${(performance?.trade_statistics?.win_rate || 0).toFixed(1)}%`, icon: Target },
    { label: 'Total Return', value: `${(performance?.account_performance?.total_return || 0).toFixed(2)}%`, icon: TrendingUp },
    { label: 'Sharpe Ratio', value: (performance?.account_performance?.sharpe_ratio || 0).toFixed(2), icon: BarChart3 },
  ];
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-slate-400">{metric.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}

// Open Positions Component
function OpenPositions() {
  const { positions } = useTradingStore();
  
  if (positions.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-300">Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-500">No open positions</p>
            <p className="text-xs text-slate-600 mt-1">Signals will appear here when generated</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Open Positions ({positions.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {positions.map((position) => (
            <div 
              key={position.id} 
              className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={position.direction === 'long' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}
                  >
                    {position.direction.toUpperCase()}
                  </Badge>
                  <span className="font-medium text-white">{position.symbol}</span>
                </div>
                <span className={`text-sm font-bold ${position.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Entry</span>
                  <p className="text-slate-300">${position.entryPrice.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Current</span>
                  <p className="text-slate-300">${position.currentPrice.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Risk</span>
                  <p className="text-slate-300">{position.riskPercent.toFixed(2)}%</p>
                </div>
              </div>
              
              <div className="flex gap-2 mt-3">
                <div className="flex-1">
                  <span className="text-xs text-slate-500">SL: ${position.stopLoss.toFixed(2)}</span>
                </div>
                <div className="flex-1 text-right">
                  <span className="text-xs text-slate-500">TP: ${position.takeProfit.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
export function Dashboard() {
  const { setConnected, setRiskMetrics, setPositions, setMarketData } = useTradingStore();
  
  useEffect(() => {
    // Connect WebSocket
    wsService.connect();
    
    // Fetch initial data
    const fetchData = async () => {
      try {
        // Status
        await getStatus();
        setConnected(true);
        
        // Risk metrics
        const { data: risk } = await getRiskMetrics();
        if (risk) {
          setRiskMetrics({
            accountBalance: risk.account.balance,
            equity: risk.account.equity,
            openPnl: risk.account.open_pnl,
            dailyPnl: risk.account.daily_pnl,
            currentDrawdown: risk.risk.current_drawdown,
            maxDrawdown: risk.risk.max_drawdown,
            totalRiskExposed: risk.risk.total_exposed,
            marginUsed: risk.risk.margin_used,
            marginAvailable: risk.risk.margin_available,
            riskLevel: risk.risk.level,
            tradesToday: risk.performance.trades_today,
            consecutiveLosses: risk.performance.consecutive_losses,
            winRate: risk.performance.win_rate,
            sharpeRatio: risk.performance.sharpe_ratio,
          });
        }
        
        // Positions
        const { data: positionsData } = await getPositions();
        if (positionsData?.open_positions) {
          setPositions(positionsData.open_positions.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
            direction: p.direction,
            entryPrice: p.entry_price,
            currentPrice: p.current_price,
            quantity: p.quantity,
            lotSize: p.lot_size ?? p.quantity,
            unrealizedPnl: p.unrealized_pnl,
            stopLoss: p.stop_loss,
            takeProfit: p.take_profit,
            riskPercent: p.risk_percent,
            openTime: p.open_time,
          })));
        }
        
        // Market data
        const { data: market } = await getMarketData();
        if (market) {
          Object.entries(market).forEach(([symbol, data]: [string, any]) => {
            setMarketData(symbol, {
              symbol,
              price: data.price,
              change24h: data.change_24h,
              volume24h: data.volume_24h,
              high24h: data.high_24h,
              low24h: data.low_24h,
            });
          });
        }
        
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        toast.error('Failed to connect to trading server');
      }
    };
    
    fetchData();
    
    // Periodic data refresh
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      clearInterval(interval);
      wsService.disconnect();
    };
  }, []);
  
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Market Overview */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5 text-indigo-400" />
          Market Overview
        </h2>
        <MarketOverview />
      </section>

      {/* TradingView Chart */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          Price Action Chart
        </h2>
        <TradingViewChart />
      </section>
      
      {/* Performance Metrics */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          Performance
        </h2>
        <PerformanceMetrics />
      </section>
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Left Column - Account Stats */}
        <div className="col-span-1 lg:col-span-4 space-y-4 md:space-y-6">
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-400" />
              Account
            </h2>
            <AccountStats />
          </section>
          
          <DrawdownMonitor />
        </div>
        
        {/* Right Column - Positions & Activity */}
        <div className="col-span-1 lg:col-span-8 space-y-4 md:space-y-6">
          <OpenPositions />
          
          {/* Recent Activity Placeholder */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-slate-300">System initialized</span>
                  <span className="text-xs text-slate-500 ml-auto">Just now</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-sm text-slate-300">Connected to market data feed</span>
                  <span className="text-xs text-slate-500 ml-auto">Just now</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm text-slate-300">Risk engine active</span>
                  <span className="text-xs text-slate-500 ml-auto">Just now</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
