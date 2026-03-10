import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  lotSize: number;
  unrealizedPnl: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  openTime: string;
}

export interface Signal {
  id: string;
  type: string;
  direction: 'long' | 'short';
  confidence: number;
  price: number;
  symbol: string;
  confluenceFactors: string[];
  timestamp: string;
  metadata?: any;
}

export interface RiskMetrics {
  accountBalance: number;
  equity: number;
  openPnl: number;
  dailyPnl: number;
  currentDrawdown: number;
  maxDrawdown: number;
  totalRiskExposed: number;
  marginUsed: number;
  marginAvailable: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tradesToday: number;
  consecutiveLosses: number;
  winRate: number;
  sharpeRatio: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface SMCAnalysis {
  symbol: string;
  timeframe: string;
  htf_timeframe: string;
  timestamp: string;
  market_structure: {
    trend: string;
    htf_bias: string;
    mss_signals: any[];
  };
  order_blocks: any[];
  fair_value_gaps: any[];
  liquidity_pools: any[];
  kill_zones: {
    active: boolean;
    session: string;
  };
  pivots: {
    daily: Record<string, number> | null;
    weekly: Record<string, number> | null;
  };
  judas_swing: { direction: string; price: number } | null;
  po3_phase: string | null;
  signals: any[];
  volatility_regime: string;
}

interface TradingState {
  // Connection
  isConnected: boolean;
  wsConnected: boolean;
  
  // Market Data
  marketData: Record<string, MarketData>;
  selectedSymbol: string;
  
  // Trading
  positions: Position[];
  signals: Signal[];
  selectedSignal: Signal | null;
  
  // SMC Analysis
  smcAnalysis: SMCAnalysis | null;
  smcLoading: boolean;
  smcLastUpdate: string | null;
  
  // Risk
  riskMetrics: RiskMetrics;
  tradingEnabled: boolean;
  killSwitchTriggered: boolean;
  
  // Performance
  totalReturn: number;
  totalTrades: number;
  winningTrades: number;
  
  // UI
  activeTab: 'dashboard' | 'positions' | 'signals' | 'analytics' | 'settings';
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  setMarketData: (symbol: string, data: MarketData) => void;
  setSelectedSymbol: (symbol: string) => void;
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;
  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  setSelectedSignal: (signal: Signal | null) => void;
  setSmcAnalysis: (analysis: SMCAnalysis | null) => void;
  setSmcLoading: (loading: boolean) => void;
  setRiskMetrics: (metrics: RiskMetrics) => void;
  setTradingEnabled: (enabled: boolean) => void;
  setKillSwitch: (triggered: boolean) => void;
  setActiveTab: (tab: TradingState['activeTab']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set, _get) => ({
      // Initial state
      isConnected: false,
      wsConnected: false,
      marketData: {},
      selectedSymbol: 'XAUUSD',
      positions: [],
      signals: [],
      selectedSignal: null,
      smcAnalysis: null,
      smcLoading: false,
      smcLastUpdate: null,
      riskMetrics: {
        accountBalance: 100000,
        equity: 100000,
        openPnl: 0,
        dailyPnl: 0,
        currentDrawdown: 0,
        maxDrawdown: 0,
        totalRiskExposed: 0,
        marginUsed: 0,
        marginAvailable: 50000,
        riskLevel: 'low',
        tradesToday: 0,
        consecutiveLosses: 0,
        winRate: 0,
        sharpeRatio: 0,
      },
      tradingEnabled: true,
      killSwitchTriggered: false,
      totalReturn: 0,
      totalTrades: 0,
      winningTrades: 0,
      activeTab: 'dashboard',
      isLoading: false,
      error: null,
      
      // Actions
      setConnected: (connected) => set({ isConnected: connected }),
      setWsConnected: (connected) => set({ wsConnected: connected }),
      
      setMarketData: (symbol, data) => set((state) => ({
        marketData: { ...state.marketData, [symbol]: data }
      })),
      
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      
      setPositions: (positions) => set({ positions }),
      
      addPosition: (position) => set((state) => ({
        positions: [...state.positions, position]
      })),
      
      updatePosition: (id, updates) => set((state) => ({
        positions: state.positions.map(p => 
          p.id === id ? { ...p, ...updates } : p
        )
      })),
      
      removePosition: (id) => set((state) => ({
        positions: state.positions.filter(p => p.id !== id)
      })),
      
      setSignals: (signals) => set({ signals }),
      
      addSignal: (signal) => set((state) => ({
        signals: [signal, ...state.signals].slice(0, 50) // Keep last 50
      })),
      
      setSelectedSignal: (signal) => set({ selectedSignal: signal }),
      
      setSmcAnalysis: (analysis) => set({ smcAnalysis: analysis, smcLastUpdate: new Date().toISOString() }),
      setSmcLoading: (loading) => set({ smcLoading: loading }),
      
      setRiskMetrics: (metrics) => set({ riskMetrics: metrics }),
      
      setTradingEnabled: (enabled) => set({ tradingEnabled: enabled }),
      
      setKillSwitch: (triggered) => set({ killSwitchTriggered: triggered }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
    }),
    {
      name: 'ict-trading-storage',
      partialize: (state) => ({
        selectedSymbol: state.selectedSymbol,
        activeTab: state.activeTab,
      }),
    }
  )
);
