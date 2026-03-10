import { useState, useEffect, useCallback, useRef } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { scanAllMarkets, confirmSignal, executeTrade } from '@/services/api';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  Clock,
  Filter,
  Play,
  BarChart3,
  RefreshCw,
  Layers,
  ArrowUpDown,
  Activity,
  ShieldAlert,
  Crosshair,
  ChevronDown,
  ChevronRight,
  Minus,
  AlertTriangle,
  Gem,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

/* ============================================================
   Type definitions matching the backend response shape
   ============================================================ */
interface SMCFullResponse {
  symbol: string;
  timeframe: string;
  htf_timeframe: string;
  timestamp: string;
  market_structure: {
    trend: string;
    htf_bias: string;
    mss_signals: MSSSignal[];
  };
  order_blocks: OrderBlock[];
  fair_value_gaps: FVG[];
  liquidity_pools: LiquidityPool[];
  kill_zones: { active: boolean; session: string };
  pivots: { daily: Record<string, number> | null; weekly: Record<string, number> | null };
  judas_swing: { direction: string; price: number } | null;
  po3_phase: string | null;
  signals: RawSignal[];
  volatility_regime: string;
}

interface RawSignal {
  type: string;
  direction: 'long' | 'short';
  price: number;
  confidence: number;
  confluence_factors: string[];
  timestamp: string;
  metadata?: Record<string, any>;
  symbol?: string;
}

interface ScanAllResponse {
  timestamp: string;
  timeframe: string;
  htf_timeframe: string;
  symbols_scanned: string[];
  total_signals: number;
  signals: RawSignal[];
  symbol_summaries: Record<string, SymbolSummary>;
  per_symbol: Record<string, SMCFullResponse>;
}

interface SymbolSummary {
  trend: string;
  htf_bias: string;
  session: string;
  kill_zone_active: boolean;
  volatility: string;
  signal_count: number;
  fresh_obs: number;
  fresh_fvgs: number;
  liquidity_pools: number;
  error?: string;
}

interface MSSSignal {
  direction: string;
  price: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface OrderBlock {
  type: string;
  high: number;
  low: number;
  index: number;
  volume: number;
  displacement_ratio?: number;
  mitigated?: boolean;
  is_breaker?: boolean;
}

interface FVG {
  type: string;
  high: number;
  low: number;
  index: number;
  mitigated: boolean;
  displacement_strong: boolean;
  ce_level?: number;
  is_inverse?: boolean;
}

interface LiquidityPool {
  type: string;
  price: number;
  touches?: number;
  label?: string;
}

/* ============================================================
   Confluence factor label map
   ============================================================ */
const FACTOR_LABELS: Record<string, { label: string; icon: string }> = {
  htf_bias_aligned: { label: 'HTF Bias', icon: '📊' },
  liquidity_sweep: { label: 'Liq. Sweep', icon: '💧' },
  fvg_confluence: { label: 'FVG', icon: '📐' },
  order_block_aligned: { label: 'Order Block', icon: '🧱' },
  breaker_block_aligned: { label: 'Breaker', icon: '💥' },
  ote_zone: { label: 'OTE Zone', icon: '🎯' },
  kill_zone: { label: 'Kill Zone', icon: '⏰' },
  mss_confirmed: { label: 'MSS', icon: '🔄' },
  judas_swing_aligned: { label: 'Judas Swing', icon: '🃏' },
  po3_distribution: { label: 'PO3', icon: '⚡' },
  market_structure_shift: { label: 'MSS', icon: '🔄' },
  judas_swing: { label: 'Judas Swing', icon: '🃏' },
  london_open: { label: 'London Open', icon: '🇬🇧' },
  new_york_open: { label: 'NY Open', icon: '🇺🇸' },
  power_of_three: { label: 'PO3', icon: '⚡' },
};

/* ============================================================
   Signal Card — renders one trade signal
   ============================================================ */
function SignalCard({
  signal,
  index,
  onExecute,
}: {
  signal: RawSignal;
  index: number;
  onExecute: (signal: RawSignal) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isHighConfidence = signal.confidence >= 0.75;

  const confidenceColor =
    signal.confidence >= 0.8
      ? 'text-emerald-400'
      : signal.confidence >= 0.7
        ? 'text-yellow-400'
        : 'text-orange-400';

  const borderColor =
    signal.confidence >= 0.8
      ? 'border-emerald-500/30'
      : signal.confidence >= 0.7
        ? 'border-yellow-500/30'
        : 'border-orange-500/30';

  const bgColor =
    signal.confidence >= 0.8
      ? 'bg-emerald-500/5'
      : signal.confidence >= 0.7
        ? 'bg-yellow-500/5'
        : 'bg-orange-500/5';

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const { data } = await confirmSignal(signal);
      if (data.signal_confirmed) {
        toast.success('Signal confirmed — Ready to execute');
        onExecute(signal);
      }
    } catch {
      toast.error('Failed to confirm signal');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${bgColor} ${borderColor} ${expanded ? 'ring-1 ring-indigo-500/30' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              signal.direction === 'long' ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}
          >
            {signal.direction === 'long' ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              {signal.symbol && (
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                  {signal.symbol}
                </Badge>
              )}
              <span className="font-semibold text-white">Signal #{index + 1}</span>
              <Badge
                variant="outline"
                className={
                  signal.direction === 'long'
                    ? 'text-emerald-400 border-emerald-500/30'
                    : 'text-red-400 border-red-500/30'
                }
              >
                {signal.direction.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-slate-400 border-slate-700 text-[10px]">
                {signal.type.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {signal.confluence_factors.length} confluence layers
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className={`text-lg font-bold ${confidenceColor}`}>
            {(signal.confidence * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Confidence</p>
        </div>
      </div>

      {/* Confluence Factors */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {signal.confluence_factors.map((factor) => {
          const info = FACTOR_LABELS[factor];
          return (
            <span
              key={factor}
              className="px-2 py-1 text-xs rounded-full bg-slate-800/80 text-slate-300 border border-slate-700"
            >
              {info ? `${info.icon} ${info.label}` : factor.replace(/_/g, ' ')}
            </span>
          );
        })}
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-3 p-2 sm:p-3 rounded-lg bg-slate-950/50">
        <div>
          <span className="text-xs text-slate-500">Entry Price</span>
          <p className="text-sm font-medium text-white">${signal.price.toLocaleString()}</p>
        </div>
        {signal.metadata?.ote_zone && (
          <>
            <div>
              <span className="text-xs text-slate-500">OTE Zone</span>
              <p className="text-sm font-medium text-white">
                ${signal.metadata.ote_zone.bottom?.toLocaleString()} –{' '}
                ${signal.metadata.ote_zone.top?.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Optimal</span>
              <p className="text-sm font-medium text-indigo-400">
                ${signal.metadata.ote_zone.optimal?.toLocaleString()}
              </p>
            </div>
          </>
        )}
        {signal.metadata?.sweep_price && !signal.metadata?.ote_zone && (
          <div>
            <span className="text-xs text-slate-500">Sweep Price</span>
            <p className="text-sm font-medium text-amber-400">
              ${signal.metadata.sweep_price.toLocaleString()}
            </p>
          </div>
        )}
        {signal.metadata?.pool_price && !signal.metadata?.ote_zone && (
          <div>
            <span className="text-xs text-slate-500">Pool Price</span>
            <p className="text-sm font-medium text-cyan-400">
              ${signal.metadata.pool_price.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          onClick={() => setExpanded(!expanded)}
        >
          <Eye className="w-4 h-4 mr-2" />
          {expanded ? 'Hide Details' : 'View Details'}
        </Button>

        {isHighConfidence && (
          <Button
            size="sm"
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={handleConfirm}
            disabled={confirming}
          >
            <Play className="w-4 h-4 mr-2" />
            {confirming ? 'Confirming...' : 'Execute Trade'}
          </Button>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
          <h4 className="text-sm font-medium text-slate-300">Confluence Breakdown</h4>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Confluence Score</span>
              <span className="text-slate-300">
                {signal.confluence_factors.length}/11 layers
              </span>
            </div>
            <Progress
              value={(signal.confluence_factors.length / 11) * 100}
              className="h-2"
            />
          </div>

          <div className="space-y-1.5">
            {signal.confluence_factors.map((factor) => {
              const info = FACTOR_LABELS[factor];
              return (
                <div key={factor} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-300 capitalize">
                    {info ? info.label : factor.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>

          {signal.metadata?.pivot_confluence && (
            <div className="p-3 rounded-lg bg-slate-800/50">
              <span className="text-xs text-slate-500">Pivot Confluence</span>
              <p className="text-sm text-slate-300">
                {signal.metadata.pivot_confluence.level_name} @ $
                {signal.metadata.pivot_confluence.price?.toLocaleString()}
              </p>
            </div>
          )}

          {signal.metadata?.po3_phase && (
            <div className="p-3 rounded-lg bg-slate-800/50">
              <span className="text-xs text-slate-500">PO3 Phase</span>
              <p className="text-sm text-purple-400 capitalize">{signal.metadata.po3_phase}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Market Context Panel – shows the full SMC landscape
   ============================================================ */
function MarketContextPanel({ smc }: { smc: SMCFullResponse }) {
  const [showOBs, setShowOBs] = useState(false);
  const [showFVGs, setShowFVGs] = useState(false);
  const [showLiquidity, setShowLiquidity] = useState(false);

  const trendIcon =
    smc.market_structure.trend === 'bullish' ? (
      <TrendingUp className="w-4 h-4 text-emerald-400" />
    ) : smc.market_structure.trend === 'bearish' ? (
      <TrendingDown className="w-4 h-4 text-red-400" />
    ) : (
      <Minus className="w-4 h-4 text-slate-400" />
    );

  const trendColor =
    smc.market_structure.trend === 'bullish'
      ? 'text-emerald-400'
      : smc.market_structure.trend === 'bearish'
        ? 'text-red-400'
        : 'text-slate-400';

  const biasColor =
    smc.market_structure.htf_bias === 'long'
      ? 'text-emerald-400'
      : smc.market_structure.htf_bias === 'short'
        ? 'text-red-400'
        : 'text-slate-400';

  const volatilityColor =
    smc.volatility_regime === 'high'
      ? 'text-red-400'
      : smc.volatility_regime === 'low'
        ? 'text-blue-400'
        : 'text-yellow-400';

  const freshOBs = smc.order_blocks.filter((ob) => !ob.mitigated);
  const freshFVGs = smc.fair_value_gaps.filter((fvg) => !fvg.mitigated);

  return (
    <div className="space-y-4">
      {/* Market Structure Overview */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Market Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Trend + HTF Bias row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-950/60">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                Structure
              </span>
              <div className="flex items-center gap-1.5">
                {trendIcon}
                <span className={`text-sm font-semibold capitalize ${trendColor}`}>
                  {smc.market_structure.trend}
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                HTF Bias
              </span>
              <div className="flex items-center gap-1.5">
                {smc.market_structure.htf_bias === 'long' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : smc.market_structure.htf_bias === 'short' ? (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-400" />
                )}
                <span className={`text-sm font-semibold uppercase ${biasColor}`}>
                  {smc.market_structure.htf_bias}
                </span>
              </div>
            </div>
          </div>

          {/* Session + Volatility row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-950/60">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                Session
              </span>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-slate-200 capitalize">
                  {smc.kill_zones.session.replace(/_/g, ' ')}
                </span>
                {smc.kill_zones.active && (
                  <Badge className="text-[9px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto">
                    ACTIVE
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                Volatility
              </span>
              <div className="flex items-center gap-1.5">
                <Activity className={`w-3.5 h-3.5 ${volatilityColor}`} />
                <span className={`text-sm font-semibold capitalize ${volatilityColor}`}>
                  {smc.volatility_regime}
                </span>
              </div>
            </div>
          </div>

          {/* PO3 Phase + Judas Swing */}
          <div className="grid grid-cols-2 gap-2">
            {smc.po3_phase && (
              <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                  PO3 Phase
                </span>
                <div className="flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-sm font-semibold capitalize text-purple-300">
                    {smc.po3_phase}
                  </span>
                </div>
              </div>
            )}
            {smc.judas_swing && (
              <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                  Judas Swing
                </span>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span
                    className={`text-sm font-semibold uppercase ${
                      smc.judas_swing.direction === 'long' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {smc.judas_swing.direction}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">
                    @ ${smc.judas_swing.price.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* MSS Signals */}
          {smc.market_structure.mss_signals.length > 0 && (
            <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                Market Structure Shifts
              </span>
              <div className="space-y-1">
                {smc.market_structure.mss_signals.slice(0, 3).map((mss, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    <span
                      className={
                        mss.direction === 'long' ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {mss.direction.toUpperCase()}
                    </span>
                    <span className="text-slate-500">@ ${Number(mss.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pivot Levels */}
      {(smc.pivots.daily || smc.pivots.weekly) && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-indigo-400" />
              Pivot Levels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {smc.pivots.daily && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                  Daily
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {Object.entries(smc.pivots.daily)
                    .filter(([, v]) => typeof v === 'number')
                    .slice(0, 9)
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className={`px-2 py-1.5 rounded bg-slate-950/60 text-center ${
                          key.startsWith('r')
                            ? 'text-red-400'
                            : key.startsWith('s')
                              ? 'text-emerald-400'
                              : 'text-indigo-400'
                        }`}
                      >
                        <span className="block text-[9px] text-slate-500 uppercase">{key}</span>
                        {Number(val).toFixed(2)}
                      </div>
                    ))}
                </div>
              </div>
            )}
            {smc.pivots.weekly && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                  Weekly
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {Object.entries(smc.pivots.weekly)
                    .filter(([, v]) => typeof v === 'number')
                    .slice(0, 9)
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className={`px-2 py-1.5 rounded bg-slate-950/60 text-center ${
                          key.startsWith('r')
                            ? 'text-red-400'
                            : key.startsWith('s')
                              ? 'text-emerald-400'
                              : 'text-indigo-400'
                        }`}
                      >
                        <span className="block text-[9px] text-slate-500 uppercase">{key}</span>
                        {Number(val).toFixed(2)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detected Structures – collapsible lists */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Detected Structures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Order Blocks */}
          <button
            onClick={() => setShowOBs(!showOBs)}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-950/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Order Blocks</span>
              <Badge className="text-[10px] px-1.5 bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {freshOBs.length} fresh / {smc.order_blocks.length} total
              </Badge>
            </div>
            {showOBs ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {showOBs && freshOBs.length > 0 && (
            <div className="space-y-1 pl-2">
              {freshOBs.slice(0, 8).map((ob, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-slate-950/40"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        ob.type === 'bullish' || ob.type === 'long'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }
                    >
                      {(ob.type || '').toUpperCase()}
                    </span>
                    {ob.is_breaker && (
                      <Badge className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-400 border-amber-500/25">
                        BREAKER
                      </Badge>
                    )}
                  </div>
                  <span className="text-slate-400">
                    ${ob.low.toFixed(2)} – ${ob.high.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Fair Value Gaps */}
          <button
            onClick={() => setShowFVGs(!showFVGs)}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-950/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Fair Value Gaps</span>
              <Badge className="text-[10px] px-1.5 bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {freshFVGs.length} fresh / {smc.fair_value_gaps.length} total
              </Badge>
            </div>
            {showFVGs ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {showFVGs && freshFVGs.length > 0 && (
            <div className="space-y-1 pl-2">
              {freshFVGs.slice(0, 8).map((fvg, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-slate-950/40"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        fvg.type === 'bullish' || fvg.type === 'long'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }
                    >
                      {(fvg.type || '').toUpperCase()}
                    </span>
                    {fvg.is_inverse && (
                      <Badge className="text-[9px] px-1 py-0 bg-purple-500/15 text-purple-400 border-purple-500/25">
                        IFVG
                      </Badge>
                    )}
                    {fvg.displacement_strong && (
                      <Badge className="text-[9px] px-1 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                        STRONG
                      </Badge>
                    )}
                  </div>
                  <span className="text-slate-400">
                    ${fvg.low.toFixed(2)} – ${fvg.high.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Liquidity Pools */}
          <button
            onClick={() => setShowLiquidity(!showLiquidity)}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-950/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Liquidity Pools</span>
              <Badge className="text-[10px] px-1.5 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                {smc.liquidity_pools.length}
              </Badge>
            </div>
            {showLiquidity ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {showLiquidity && smc.liquidity_pools.length > 0 && (
            <div className="space-y-1 pl-2">
              {smc.liquidity_pools.slice(0, 10).map((pool, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-slate-950/40"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span className="text-slate-300 capitalize">
                      {(pool.type || pool.label || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-slate-400">${Number(pool.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Trade Signals</span>
            <span className="text-white font-medium">{smc.signals.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">High Confidence (75%+)</span>
            <span className="text-emerald-400 font-medium">
              {smc.signals.filter((s) => s.confidence >= 0.75).length}
            </span>
          </div>
          <Separator className="bg-slate-800" />
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Fresh Order Blocks</span>
            <span className="text-white font-medium">{freshOBs.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Fresh FVGs</span>
            <span className="text-white font-medium">{freshFVGs.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Liquidity Pools</span>
            <span className="text-white font-medium">{smc.liquidity_pools.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">MSS Signals</span>
            <span className="text-white font-medium">
              {smc.market_structure.mss_signals.length}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Signal Filters
   ============================================================ */
function SignalFilters({
  filters,
  setFilters,
  scannedSymbols,
}: {
  filters: { minConfidence: number; direction: string; signalType: string; symbol: string };
  setFilters: (f: any) => void;
  scannedSymbols: string[];
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol filter */}
        <div>
          <label className="text-xs text-slate-400 mb-2 block">Symbol</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilters({ ...filters, symbol: 'all' })}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filters.symbol === 'all'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {scannedSymbols.map((sym) => (
              <button
                key={sym}
                onClick={() => setFilters({ ...filters, symbol: sym })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filters.symbol === sym
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-2 block">Min Confidence</label>
          <input
            type="range"
            min="50"
            max="95"
            value={filters.minConfidence * 100}
            onChange={(e) =>
              setFilters({ ...filters, minConfidence: parseInt(e.target.value) / 100 })
            }
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50%</span>
            <span className="text-indigo-400 font-medium">
              {(filters.minConfidence * 100).toFixed(0)}%
            </span>
            <span>95%</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-2 block">Direction</label>
          <div className="flex gap-2">
            {(['all', 'long', 'short'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setFilters({ ...filters, direction: dir })}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  filters.direction === dir
                    ? dir === 'long'
                      ? 'bg-emerald-500 text-white'
                      : dir === 'short'
                        ? 'bg-red-500 text-white'
                        : 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {dir.charAt(0).toUpperCase() + dir.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-2 block">Signal Type</label>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'ote', 'mss', 'judas_swing', 'po3'].map((t) => (
              <button
                key={t}
                onClick={() => setFilters({ ...filters, signalType: t })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filters.signalType === t
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All' : t.replace(/_/g, ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Trade Execution Modal
   ============================================================ */
function TradeExecutionModal({
  signal,
  symbol,
  isOpen,
  onClose,
}: {
  signal: RawSignal | null;
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);

  useEffect(() => {
    if (signal && isOpen) {
      const atr = signal.price * 0.01;
      const stopLoss =
        signal.direction === 'long' ? signal.price - atr * 1.5 : signal.price + atr * 1.5;
      const takeProfit =
        signal.direction === 'long' ? signal.price + atr * 3 : signal.price - atr * 3;

      setRecommendation({
        entry_price: signal.price,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        risk_reward: 3.0,
        position_size: 0.5,
        risk_amount: 2000,
        risk_percent: 2.0,
      });
    }
  }, [signal, isOpen]);

  const handleExecute = async () => {
    if (!signal || !recommendation) return;
    setLoading(true);
    try {
      const { data } = await executeTrade({
        symbol,
        direction: signal.direction,
        entry_price: recommendation.entry_price,
        stop_loss: recommendation.stop_loss,
        take_profit: recommendation.take_profit,
        confidence: signal.confidence,
      });
      if (data.success) {
        toast.success('Trade executed successfully');
        onClose();
      } else {
        toast.error(data.error || 'Trade execution failed');
      }
    } catch {
      toast.error('Failed to execute trade');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !signal || !recommendation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4">Execute Trade</h3>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-slate-400">Symbol</span>
            <span className="text-white font-medium">{symbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Direction</span>
            <Badge className={signal.direction === 'long' ? 'bg-emerald-500' : 'bg-red-500'}>
              {signal.direction.toUpperCase()}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Entry Price</span>
            <span className="text-white font-medium">
              ${recommendation.entry_price.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Stop Loss</span>
            <span className="text-red-400 font-medium">
              ${recommendation.stop_loss.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Take Profit</span>
            <span className="text-emerald-400 font-medium">
              ${recommendation.take_profit.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Risk/Reward</span>
            <span className="text-indigo-400 font-medium">1:{recommendation.risk_reward}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Risk Amount</span>
            <span className="text-white font-medium">
              ${recommendation.risk_amount.toLocaleString()} ({recommendation.risk_percent}%)
            </span>
          </div>

          {/* Confluence badges from the signal */}
          <div>
            <span className="text-slate-400 text-sm mb-1 block">
              Confluence ({signal.confluence_factors.length} layers)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {signal.confluence_factors.map((f) => (
                <Badge
                  key={f}
                  className="text-[10px] bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                >
                  {f.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-slate-700 text-slate-300"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={handleExecute}
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Confirm Trade'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main Signals Component
   ============================================================ */
export function Signals() {
  const { selectedSymbol, setSignals, smcAnalysis, setSmcAnalysis, smcLoading, setSmcLoading } =
    useTradingStore();

  const [filters, setFilters] = useState({
    minConfidence: 0.6,
    direction: 'all',
    signalType: 'all',
    symbol: 'all',
  });
  const [selectedSignal, setSelectedSignal] = useState<RawSignal | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('15m');
  const [htfTimeframe, setHtfTimeframe] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Multi-market state
  const [scanResults, setScanResults] = useState<ScanAllResponse | null>(null);
  const [focusedSymbol, setFocusedSymbol] = useState<string>(selectedSymbol);

  /* ---------- Fetch multi-market SMC analysis ---------- */
  const fetchSMCAnalysis = useCallback(async () => {
    setSmcLoading(true);
    setScanError(null);
    try {
      const { data } = await scanAllMarkets(timeframe, htfTimeframe, 300);

      if (data.error) {
        setScanError(data.error);
        return;
      }

      setScanResults(data as ScanAllResponse);

      // Set the focused symbol's data into smcAnalysis for backward compatibility
      const focusedData = data.per_symbol?.[focusedSymbol];
      if (focusedData) {
        setSmcAnalysis(focusedData);
      }

      // Push all signals into the global store for other components
      if (data.signals) {
        const formattedSignals = data.signals.map((s: RawSignal, i: number) => ({
          id: `sig_${Date.now()}_${i}`,
          type: s.type,
          direction: s.direction,
          confidence: s.confidence,
          price: s.price,
          symbol: s.symbol || 'UNKNOWN',
          confluenceFactors: s.confluence_factors || [],
          timestamp: s.timestamp || new Date().toISOString(),
          metadata: s.metadata,
        }));
        setSignals(formattedSignals);
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail || error?.message || 'Failed to fetch multi-market analysis';
      setScanError(msg);
      console.error('Multi-market scan error:', error);
    } finally {
      setSmcLoading(false);
    }
  }, [focusedSymbol, timeframe, htfTimeframe, setSmcAnalysis, setSignals, setSmcLoading]);

  // When focusedSymbol changes, update smcAnalysis from cached scanResults
  useEffect(() => {
    if (scanResults?.per_symbol?.[focusedSymbol]) {
      setSmcAnalysis(scanResults.per_symbol[focusedSymbol]);
    }
  }, [focusedSymbol, scanResults, setSmcAnalysis]);

  // Initial fetch + re-fetch when params change
  useEffect(() => {
    fetchSMCAnalysis();
  }, [fetchSMCAnalysis]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSMCAnalysis, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchSMCAnalysis]);

  /* ---------- Filter signals (from all markets) ---------- */
  const allSignals: RawSignal[] = scanResults?.signals ?? smcAnalysis?.signals ?? [];
  const filteredSignals = allSignals.filter((s) => {
    if (s.confidence < filters.minConfidence) return false;
    if (filters.direction !== 'all' && s.direction !== filters.direction) return false;
    if (filters.signalType !== 'all' && s.type !== filters.signalType) return false;
    if (filters.symbol !== 'all' && s.symbol !== filters.symbol) return false;
    return true;
  });

  const scannedSymbols = scanResults?.symbols_scanned ?? [];
  const symbolSummaries = scanResults?.symbol_summaries ?? {};

  const handleExecuteSignal = (signal: RawSignal) => {
    setSelectedSignal(signal);
    setShowExecutionModal(true);
  };

  /* ---------- Render ---------- */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-indigo-400" />
            ICT Smart Money Signals
          </h2>
          <p className="text-slate-400 mt-1">
            Scanning {scannedSymbols.length || 7} markets with 11-layer confluence engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe selectors */}
          <div className="flex items-center gap-1.5 bg-slate-900/50 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-[10px] text-slate-500 uppercase">TF</span>
            {['5m', '15m', '1h'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/50 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-[10px] text-slate-500 uppercase">HTF</span>
            {['1h', '4h'].map((tf) => (
              <button
                key={tf}
                onClick={() => setHtfTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  htfTimeframe === tf
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <Badge variant="outline" className="text-slate-400 border-slate-700">
            <Target className="w-3 h-3 mr-1" />
            {filteredSignals.length} Signal{filteredSignals.length !== 1 ? 's' : ''}
          </Badge>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg border transition-colors ${
              autoRefresh
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 bg-slate-900/50 text-slate-500'
            }`}
            title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={`w-4 h-4 ${smcLoading ? 'animate-spin' : ''}`} />
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchSMCAnalysis}
            disabled={smcLoading}
            className="border-slate-700 text-slate-300"
          >
            <Clock className="w-4 h-4 mr-2" />
            {smcLoading ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {scanError && (
        <div className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm text-red-300 font-medium">Analysis Failed</p>
            <p className="text-xs text-red-400/70 mt-0.5">{scanError}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-red-500/30 text-red-300 hover:bg-red-500/10"
            onClick={fetchSMCAnalysis}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Left sidebar — Filters + Market Context */}
        <div className="col-span-1 lg:col-span-3 space-y-3 md:space-y-4">
          <SignalFilters filters={filters} setFilters={setFilters} scannedSymbols={scannedSymbols} />

          {/* Multi-market summary cards */}
          {scannedSymbols.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Market Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scannedSymbols.map((sym) => {
                  const summary = symbolSummaries[sym];
                  if (!summary) return null;
                  const isFocused = focusedSymbol === sym;
                  return (
                    <button
                      key={sym}
                      onClick={() => setFocusedSymbol(sym)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isFocused
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isFocused ? 'text-indigo-300' : 'text-slate-300'}`}>
                          {sym}
                        </span>
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${
                            summary.trend === 'bullish'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : summary.trend === 'bearish'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {summary.trend}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{summary.signal_count} sig</span>
                        <span>·</span>
                        <span>{summary.fresh_obs} OB</span>
                        <span>·</span>
                        <span>{summary.fresh_fvgs} FVG</span>
                        {summary.kill_zone_active && (
                          <>
                            <span>·</span>
                            <span className="text-amber-400">KZ</span>
                          </>
                        )}
                        {summary.error && (
                          <>
                            <span>·</span>
                            <span className="text-red-400">err</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {smcAnalysis && <MarketContextPanel smc={smcAnalysis} />}
        </div>

        {/* Main signal area */}
        <div className="col-span-1 lg:col-span-9">
          {/* Loading state */}
          {smcLoading && !scanResults && (
            <div className="flex flex-col items-center justify-center h-96 rounded-xl bg-slate-900/50 border border-slate-800">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                Scanning all markets...
              </h3>
              <p className="text-sm text-slate-500 text-center max-w-md">
                Running 11-layer SMC confluence engine across 7 symbols: OB, FVG, MSS, Liquidity,
                Kill Zones, Pivots, Judas Swing, PO3...
              </p>
            </div>
          )}

          {/* No analysis yet, no loading */}
          {!smcLoading && !scanResults && !scanError && (
            <div className="flex flex-col items-center justify-center h-96 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">Ready to Scan</h3>
              <p className="text-sm text-slate-500 text-center max-w-md">
                Click "Scan Now" to run full Smart Money Concepts analysis across all markets
              </p>
              <Button
                className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white"
                onClick={fetchSMCAnalysis}
              >
                <Zap className="w-4 h-4 mr-2" />
                Run Multi-Market Scan
              </Button>
            </div>
          )}

          {/* Analysis complete – show signals */}
          {(scanResults || smcAnalysis) && (
            <div className="space-y-4">
              {/* Analysis header banner */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                      <Layers className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {scanResults
                          ? `${scanResults.symbols_scanned.length} Markets — ${scanResults.timeframe.toUpperCase()} / ${scanResults.htf_timeframe.toUpperCase()}`
                          : `${smcAnalysis!.symbol} — ${smcAnalysis!.timeframe.toUpperCase()} / ${smcAnalysis!.htf_timeframe.toUpperCase()}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Last scan:{' '}
                        {new Date(scanResults?.timestamp || smcAnalysis!.timestamp).toLocaleTimeString()}
                        {' · '}{scanResults?.total_signals ?? allSignals.length} total signals
                        {smcLoading && (
                          <span className="ml-2 text-indigo-400">
                            <RefreshCw className="w-3 h-3 inline animate-spin" /> Updating...
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {smcAnalysis && (
                      <>
                        <Badge
                          className={`${
                            smcAnalysis.kill_zones?.active
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          {smcAnalysis.kill_zones?.active
                            ? smcAnalysis.kill_zones.session.replace(/_/g, ' ')
                            : 'Off Session'}
                        </Badge>
                        <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[10px]">
                          {focusedSymbol}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Signal list or empty state */}
              {filteredSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-slate-900/30 border border-slate-800/50">
                  <div className="w-14 h-14 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <Zap className="w-7 h-7 text-slate-600" />
                  </div>
                  <h3 className="text-base font-medium text-slate-400 mb-2">
                    {allSignals.length === 0
                      ? 'No Trade Signals Detected'
                      : 'No Signals Match Filters'}
                  </h3>
                  <p className="text-sm text-slate-500 text-center max-w-lg mb-1">
                    {allSignals.length === 0
                      ? `The 11-layer confluence engine did not find setups meeting the minimum threshold across all ${scannedSymbols.length || 7} markets (${timeframe}). Markets may be in consolidation or lacking clear liquidity sweeps.`
                      : 'Adjust filters to see available signals.'}
                  </p>
                  {allSignals.length > 0 && allSignals.length !== filteredSignals.length && (
                    <Button
                      variant="outline"
                      className="mt-4 border-slate-700 text-slate-300"
                      onClick={() =>
                        setFilters({ minConfidence: 0.5, direction: 'all', signalType: 'all', symbol: 'all' })
                      }
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSignals.map((signal, i) => (
                    <SignalCard
                      key={`${signal.symbol}_${signal.type}_${signal.direction}_${i}`}
                      signal={signal}
                      index={i}
                      onExecute={handleExecuteSignal}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trade Execution Modal */}
      <TradeExecutionModal
        signal={selectedSignal}
        symbol={selectedSignal?.symbol || focusedSymbol}
        isOpen={showExecutionModal}
        onClose={() => {
          setShowExecutionModal(false);
          setSelectedSignal(null);
        }}
      />
    </div>
  );
}
