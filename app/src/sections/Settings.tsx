import { useState } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { updateRiskConfig, resetRisk } from '@/services/api';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Bell,
  Zap,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  Sliders,
  Layers,
  Target,
  Clock,
  ChevronDown,
  ChevronRight,
  Gem
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// Risk Settings Component
function RiskSettings() {
  const { tradingEnabled, killSwitchTriggered, setTradingEnabled, setKillSwitch } = useTradingStore();
  
  const [config, setConfig] = useState({
    max_risk_per_trade: 2.0,
    max_daily_risk: 6.0,
    max_daily_loss: 4.0,
    kill_switch_losses: 3,
  });
  
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRiskConfig(config);
      toast.success('Risk configuration saved');
    } catch (error) {
      toast.error('Failed to save risk config');
    } finally {
      setSaving(false);
    }
  };
  
  const handleReset = async () => {
    setResetting(true);
    try {
      await resetRisk();
      setKillSwitch(false);
      setTradingEnabled(true);
      toast.success('Kill switch reset - Trading resumed');
    } catch (error) {
      toast.error('Failed to reset kill switch');
    } finally {
      setResetting(false);
    }
  };
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          Risk Management
        </CardTitle>
        <CardDescription className="text-slate-400">
          Configure risk limits and protection settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trading Status */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">Trading Status</h4>
              <p className="text-xs text-slate-400 mt-1">
                {killSwitchTriggered 
                  ? 'Kill switch activated - Trading halted' 
                  : tradingEnabled 
                    ? 'Trading is currently active' 
                    : 'Trading is paused'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={killSwitchTriggered ? 'destructive' : tradingEnabled ? 'default' : 'secondary'}
                className={killSwitchTriggered ? 'bg-red-500/20 text-red-400 border-red-500/30' : tradingEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}
              >
                {killSwitchTriggered ? 'KILL SWITCH' : tradingEnabled ? 'ACTIVE' : 'PAUSED'}
              </Badge>
              {killSwitchTriggered && (
                <Button 
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={handleReset}
                  disabled={resetting}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${resetting ? 'animate-spin' : ''}`} />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Risk Limits */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm text-slate-300">Max Risk Per Trade</Label>
              <span className="text-sm text-indigo-400 font-medium">{config.max_risk_per_trade}%</span>
            </div>
            <Slider 
              value={[config.max_risk_per_trade]} 
              onValueChange={([v]) => setConfig({ ...config, max_risk_per_trade: v })}
              min={0.5}
              max={5}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum percentage of account risked on a single trade
            </p>
          </div>
          
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm text-slate-300">Max Daily Risk</Label>
              <span className="text-sm text-indigo-400 font-medium">{config.max_daily_risk}%</span>
            </div>
            <Slider 
              value={[config.max_daily_risk]} 
              onValueChange={([v]) => setConfig({ ...config, max_daily_risk: v })}
              min={2}
              max={15}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum total risk exposure per day
            </p>
          </div>
          
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm text-slate-300">Max Daily Loss</Label>
              <span className="text-sm text-indigo-400 font-medium">{config.max_daily_loss}%</span>
            </div>
            <Slider 
              value={[config.max_daily_loss]} 
              onValueChange={([v]) => setConfig({ ...config, max_daily_loss: v })}
              min={1}
              max={10}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum allowable daily loss before kill switch
            </p>
          </div>
          
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm text-slate-300">Kill Switch After Losses</Label>
              <span className="text-sm text-indigo-400 font-medium">{config.kill_switch_losses} trades</span>
            </div>
            <Slider 
              value={[config.kill_switch_losses]} 
              onValueChange={([v]) => setConfig({ ...config, kill_switch_losses: v })}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Consecutive losses before automatic trading halt
            </p>
          </div>
        </div>
        
        <Separator className="bg-slate-800" />
        
        <Button 
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Risk Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

// Strategy Settings Component — Smart Money Concepts Suite
function StrategySettings() {
  const [config, setConfig] = useState({
    // Signal thresholds
    minConfidence: 70,
    requireConfluence: 4,

    // Smart Money Detection
    useOrderBlocks: true,
    useBreakerBlocks: true,
    useFVG: true,
    useInverseFVG: true,
    useConsequentEncroachment: true,
    useMSS: true,
    useBOS: true,
    useCHOCH: true,

    // Liquidity
    useLiquiditySweeps: true,
    useEqualLevels: true,
    usePDH_PDL: true,
    usePWH_PWL: true,
    useSessionLiquidity: true,

    // Kill Zones / Sessions
    useKillZones: true,
    killZoneLondonOpen: true,
    killZoneNYOpen: true,
    killZoneOverlap: true,
    killZoneLondonClose: true,
    killZoneAsia: false,

    // Advanced ICT Tools
    useJudasSwing: true,
    usePO3: true,
    useDailyPivots: true,
    useWeeklyPivots: true,
    pivotMethod: 'classic' as 'classic' | 'fibonacci',
    useOTE: true,
    useVolumeFilter: true,
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    detection: true,
    liquidity: false,
    killzones: false,
    advanced: false,
  });

  const toggle = (section: string) =>
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));

  const SectionHeader = ({
    id,
    icon: Icon,
    title,
    description,
    color,
    activeCount,
    totalCount,
  }: {
    id: string;
    icon: React.ElementType;
    title: string;
    description: string;
    color: string;
    activeCount: number;
    totalCount: number;
  }) => (
    <button
      onClick={() => toggle(id)}
      className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950/50 hover:bg-slate-950/80 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-md ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-left">
          <h4 className="text-sm font-medium text-white">{title}</h4>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] px-1.5">
          {activeCount}/{totalCount}
        </Badge>
        {expanded[id] ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </div>
    </button>
  );

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
    accent,
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    accent?: string;
  }) => (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="pr-4">
        <span className="text-sm text-slate-200">{label}</span>
        {accent && (
          <Badge className="ml-2 text-[9px] px-1 py-0 bg-amber-500/15 text-amber-400 border-amber-500/25">
            {accent}
          </Badge>
        )}
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  // Counts for badges
  const detectionActive = [
    config.useOrderBlocks,
    config.useBreakerBlocks,
    config.useFVG,
    config.useInverseFVG,
    config.useConsequentEncroachment,
    config.useMSS,
    config.useBOS,
    config.useCHOCH,
  ].filter(Boolean).length;

  const liquidityActive = [
    config.useLiquiditySweeps,
    config.useEqualLevels,
    config.usePDH_PDL,
    config.usePWH_PWL,
    config.useSessionLiquidity,
  ].filter(Boolean).length;

  const kzActive = [
    config.useKillZones,
    config.killZoneLondonOpen,
    config.killZoneNYOpen,
    config.killZoneOverlap,
    config.killZoneLondonClose,
    config.killZoneAsia,
  ].filter(Boolean).length;

  const advancedActive = [
    config.useJudasSwing,
    config.usePO3,
    config.useDailyPivots,
    config.useWeeklyPivots,
    config.useOTE,
    config.useVolumeFilter,
  ].filter(Boolean).length;

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          Strategy Configuration
        </CardTitle>
        <CardDescription className="text-slate-400">
          ICT Smart Money Concepts — 11-layer confluence engine
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Signal Thresholds ─────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm text-slate-300">Minimum Signal Confidence</Label>
              <span className="text-sm text-indigo-400 font-medium">{config.minConfidence}%</span>
            </div>
            <Slider
              value={[config.minConfidence]}
              onValueChange={([v]) => setConfig({ ...config, minConfidence: v })}
              min={50}
              max={95}
              step={5}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm text-slate-300">Required Confluence Layers</Label>
              <span className="text-sm text-indigo-400 font-medium">
                {config.requireConfluence}
                <span className="text-slate-500 font-normal"> / 11</span>
              </span>
            </div>
            <Slider
              value={[config.requireConfluence]}
              onValueChange={([v]) => setConfig({ ...config, requireConfluence: v })}
              min={2}
              max={11}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Layers: HTF Bias · Liquidity Sweep · FVG · Order Block · Breaker · OTE · Kill Zone · MSS · Pivot · Judas Swing · PO3
            </p>
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* ── Smart Money Detection ────────────────────────── */}
        <div className="space-y-2">
          <SectionHeader
            id="detection"
            icon={Layers}
            title="Smart Money Detection"
            description="Order blocks, FVG, market structure"
            color="bg-indigo-500/20 text-indigo-400"
            activeCount={detectionActive}
            totalCount={8}
          />
          {expanded.detection && (
            <div className="ml-2 pl-4 border-l border-slate-800 space-y-1">
              <ToggleRow
                label="Order Blocks (OB)"
                description="Last opposing candle before displacement — institutional entry zones"
                checked={config.useOrderBlocks}
                onChange={(v) => setConfig({ ...config, useOrderBlocks: v })}
              />
              <ToggleRow
                label="Breaker Blocks"
                description="Failed OBs that flip polarity — high-probability S/R"
                checked={config.useBreakerBlocks}
                onChange={(v) => setConfig({ ...config, useBreakerBlocks: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Fair Value Gaps (FVG)"
                description="3-candle imbalance zones — institutional price inefficiency"
                checked={config.useFVG}
                onChange={(v) => setConfig({ ...config, useFVG: v })}
              />
              <ToggleRow
                label="Inverse FVG (IFVG)"
                description="Mitigated FVGs that flip direction — polarity inversion"
                checked={config.useInverseFVG}
                onChange={(v) => setConfig({ ...config, useInverseFVG: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Consequent Encroachment"
                description="50% midpoint of FVG — precise reaction level"
                checked={config.useConsequentEncroachment}
                onChange={(v) => setConfig({ ...config, useConsequentEncroachment: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Market Structure Shift (MSS)"
                description="First break against prevailing trend — institutional reversal signal"
                checked={config.useMSS}
                onChange={(v) => setConfig({ ...config, useMSS: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Break of Structure (BOS)"
                description="Continuation break of swing high/low with displacement"
                checked={config.useBOS}
                onChange={(v) => setConfig({ ...config, useBOS: v })}
              />
              <ToggleRow
                label="Change of Character (CHOCH)"
                description="Trend reversal pattern from swing-point sequence"
                checked={config.useCHOCH}
                onChange={(v) => setConfig({ ...config, useCHOCH: v })}
              />
            </div>
          )}
        </div>

        {/* ── Liquidity ────────────────────────────────────── */}
        <div className="space-y-2">
          <SectionHeader
            id="liquidity"
            icon={Target}
            title="Liquidity Analysis"
            description="Stop hunts, equal levels, PDH/PDL sweeps"
            color="bg-cyan-500/20 text-cyan-400"
            activeCount={liquidityActive}
            totalCount={5}
          />
          {expanded.liquidity && (
            <div className="ml-2 pl-4 border-l border-slate-800 space-y-1">
              <ToggleRow
                label="Liquidity Sweeps"
                description="Detect stop hunts with rejection — institutional accumulation"
                checked={config.useLiquiditySweeps}
                onChange={(v) => setConfig({ ...config, useLiquiditySweeps: v })}
              />
              <ToggleRow
                label="Equal Highs / Lows"
                description="Clustered levels forming liquidity pools"
                checked={config.useEqualLevels}
                onChange={(v) => setConfig({ ...config, useEqualLevels: v })}
              />
              <ToggleRow
                label="Previous Day High / Low"
                description="PDH/PDL as key liquidity targets"
                checked={config.usePDH_PDL}
                onChange={(v) => setConfig({ ...config, usePDH_PDL: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Previous Week High / Low"
                description="PWH/PWL for higher-timeframe liquidity"
                checked={config.usePWH_PWL}
                onChange={(v) => setConfig({ ...config, usePWH_PWL: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Session Liquidity"
                description="Asia/London session high/low as intraday liquidity"
                checked={config.useSessionLiquidity}
                onChange={(v) => setConfig({ ...config, useSessionLiquidity: v })}
                accent="NEW"
              />
            </div>
          )}
        </div>

        {/* ── Kill Zones ───────────────────────────────────── */}
        <div className="space-y-2">
          <SectionHeader
            id="killzones"
            icon={Clock}
            title="Kill Zones (Sessions)"
            description="High-probability trading windows (UTC)"
            color="bg-amber-500/20 text-amber-400"
            activeCount={kzActive}
            totalCount={6}
          />
          {expanded.killzones && (
            <div className="ml-2 pl-4 border-l border-slate-800 space-y-1">
              <ToggleRow
                label="Enable Kill Zone Filter"
                description="Only trade during selected high-volume sessions"
                checked={config.useKillZones}
                onChange={(v) => setConfig({ ...config, useKillZones: v })}
              />
              <ToggleRow
                label="London Open (07:00–10:00 UTC)"
                description="High institutional volatility — primary setup window"
                checked={config.killZoneLondonOpen}
                onChange={(v) => setConfig({ ...config, killZoneLondonOpen: v })}
              />
              <ToggleRow
                label="New York Open (12:00–15:00 UTC)"
                description="US institutional flow — overlaps with London"
                checked={config.killZoneNYOpen}
                onChange={(v) => setConfig({ ...config, killZoneNYOpen: v })}
              />
              <ToggleRow
                label="London–NY Overlap (12:00–16:00 UTC)"
                description="Peak liquidity — highest probability setups"
                checked={config.killZoneOverlap}
                onChange={(v) => setConfig({ ...config, killZoneOverlap: v })}
              />
              <ToggleRow
                label="London Close (15:00–16:00 UTC)"
                description="Reversals and profit-taking window"
                checked={config.killZoneLondonClose}
                onChange={(v) => setConfig({ ...config, killZoneLondonClose: v })}
              />
              <ToggleRow
                label="Asian Session (00:00–06:00 UTC)"
                description="Range-building phase — used for PO3 accumulation"
                checked={config.killZoneAsia}
                onChange={(v) => setConfig({ ...config, killZoneAsia: v })}
              />
            </div>
          )}
        </div>

        {/* ── Advanced ICT Tools ───────────────────────────── */}
        <div className="space-y-2">
          <SectionHeader
            id="advanced"
            icon={Gem}
            title="Advanced ICT Tools"
            description="Judas Swing, PO3, pivots, OTE"
            color="bg-purple-500/20 text-purple-400"
            activeCount={advancedActive}
            totalCount={6}
          />
          {expanded.advanced && (
            <div className="ml-2 pl-4 border-l border-slate-800 space-y-1">
              <ToggleRow
                label="Judas Swing"
                description="False session-open breakout that sweeps prior-session liquidity"
                checked={config.useJudasSwing}
                onChange={(v) => setConfig({ ...config, useJudasSwing: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Power of Three (PO3)"
                description="Accumulation → Manipulation → Distribution daily model"
                checked={config.usePO3}
                onChange={(v) => setConfig({ ...config, usePO3: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Daily Pivot Points"
                description="Classic/Fibonacci pivots from prior-day OHLC"
                checked={config.useDailyPivots}
                onChange={(v) => setConfig({ ...config, useDailyPivots: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Weekly Pivot Points"
                description="Classic/Fibonacci pivots from prior-week OHLC"
                checked={config.useWeeklyPivots}
                onChange={(v) => setConfig({ ...config, useWeeklyPivots: v })}
                accent="NEW"
              />
              <ToggleRow
                label="Optimal Trade Entry (OTE)"
                description="Fibonacci 0.618–0.79 retracement zone"
                checked={config.useOTE}
                onChange={(v) => setConfig({ ...config, useOTE: v })}
              />
              <ToggleRow
                label="Volume Confirmation"
                description="Require volume spike to validate OB and displacement"
                checked={config.useVolumeFilter}
                onChange={(v) => setConfig({ ...config, useVolumeFilter: v })}
              />

              {/* Pivot method selector */}
              {(config.useDailyPivots || config.useWeeklyPivots) && (
                <div className="pt-2 pb-1 px-1">
                  <Label className="text-xs text-slate-400 mb-2 block">Pivot Calculation Method</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfig({ ...config, pivotMethod: 'classic' })}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        config.pivotMethod === 'classic'
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-950/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      Classic (Floor)
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, pivotMethod: 'fibonacci' })}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        config.pivotMethod === 'fibonacci'
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-950/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      Fibonacci
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-slate-800" />

        {/* Active confluence summary */}
        <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-indigo-300">Active Confluence Layers</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'HTF Bias', on: true },
              { label: 'Liq Sweep', on: config.useLiquiditySweeps },
              { label: 'FVG', on: config.useFVG },
              { label: 'Order Block', on: config.useOrderBlocks },
              { label: 'Breaker', on: config.useBreakerBlocks },
              { label: 'OTE', on: config.useOTE },
              { label: 'Kill Zone', on: config.useKillZones },
              { label: 'MSS', on: config.useMSS },
              { label: 'Pivots', on: config.useDailyPivots || config.useWeeklyPivots },
              { label: 'Judas', on: config.useJudasSwing },
              { label: 'PO3', on: config.usePO3 },
            ].map((l) => (
              <Badge
                key={l.label}
                className={`text-[10px] px-1.5 py-0 ${
                  l.on
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-slate-800/50 text-slate-600 border-slate-700/50'
                }`}
              >
                {l.label}
              </Badge>
            ))}
          </div>
        </div>

        <Button
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={() => toast.success('Strategy settings saved')}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Strategy Settings
        </Button>
      </CardContent>
    </Card>
  );
}

// Notification Settings Component
function NotificationSettings() {
  const [config, setConfig] = useState({
    emailAlerts: true,
    pushNotifications: true,
    signalAlerts: true,
    tradeAlerts: true,
    riskAlerts: true,
    dailyReport: false,
  });
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-400" />
          Notifications
        </CardTitle>
        <CardDescription className="text-slate-400">
          Configure alert and notification preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50">
          <div>
            <h4 className="text-sm font-medium text-white">Signal Alerts</h4>
            <p className="text-xs text-slate-400">Notify when high-confidence signals are generated</p>
          </div>
          <Switch 
            checked={config.signalAlerts}
            onCheckedChange={(v) => setConfig({ ...config, signalAlerts: v })}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50">
          <div>
            <h4 className="text-sm font-medium text-white">Trade Execution Alerts</h4>
            <p className="text-xs text-slate-400">Notify on trade open/close</p>
          </div>
          <Switch 
            checked={config.tradeAlerts}
            onCheckedChange={(v) => setConfig({ ...config, tradeAlerts: v })}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50">
          <div>
            <h4 className="text-sm font-medium text-white">Risk Alerts</h4>
            <p className="text-xs text-slate-400">Notify on risk limit breaches</p>
          </div>
          <Switch 
            checked={config.riskAlerts}
            onCheckedChange={(v) => setConfig({ ...config, riskAlerts: v })}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50">
          <div>
            <h4 className="text-sm font-medium text-white">Daily Performance Report</h4>
            <p className="text-xs text-slate-400">Receive daily summary email</p>
          </div>
          <Switch 
            checked={config.dailyReport}
            onCheckedChange={(v) => setConfig({ ...config, dailyReport: v })}
          />
        </div>
        
        <Separator className="bg-slate-800" />
        
        <Button 
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={() => toast.success('Notification settings saved')}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Notification Settings
        </Button>
      </CardContent>
    </Card>
  );
}

// API Configuration Component
function APIConfiguration() {
  const [showKeys, setShowKeys] = useState(false);
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-400" />
          API Configuration
        </CardTitle>
        <CardDescription className="text-slate-400">
          Configure exchange API connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-medium text-white">Binance API</h4>
              <p className="text-xs text-slate-400">Connected in sandbox mode</p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <RefreshCw className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">API Key</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  type={showKeys ? 'text' : 'password'}
                  value="************************"
                  readOnly
                  className="bg-slate-900 border-slate-700 text-slate-400"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  className="border-slate-700"
                  onClick={() => setShowKeys(!showKeys)}
                >
                  {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sandbox" checked readOnly className="rounded border-slate-700" />
              <Label htmlFor="sandbox" className="text-sm text-slate-300">Use Sandbox Mode</Label>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outline"
          className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Test Connection
        </Button>
      </CardContent>
    </Card>
  );
}

// Main Settings Component
export function Settings() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-400" />
          Settings
        </h2>
        <p className="text-slate-400 mt-1">
          Configure your trading bot preferences
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <RiskSettings />
        <StrategySettings />
        <NotificationSettings />
        <APIConfiguration />
      </div>
    </div>
  );
}
