import axios from 'axios';

// Use relative paths for Vercel API routes, or PYTHON_API_URL for external backend
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Status API
export const getStatus = () => api.get('/api/status');

// Market Analysis API
export const analyzeMarket = (symbol: string, timeframe = '15m', htfTimeframe = '1h') => 
  api.post('/api/analyze', { symbol, timeframe, htf_timeframe: htfTimeframe });

// Full SMC Analysis (comprehensive endpoint)
export const getFullSMCAnalysis = (
  symbol: string,
  timeframe = '15m',
  htfTimeframe = '1h',
  bars = 300
) =>
  api.get(`/api/smc/full/${symbol}`, {
    params: { timeframe, htf_timeframe: htfTimeframe, bars },
  });

// Multi-market scan – analyse ALL symbols in one call
export const scanAllMarkets = (
  timeframe = '15m',
  htfTimeframe = '1h',
  bars = 300,
  minConfidence = 0
) =>
  api.get('/api/smc/scan-all', {
    params: { timeframe, htf_timeframe: htfTimeframe, bars, min_confidence: minConfidence },
    timeout: 60000, // scanning 7 symbols can take a while
  });

// Individual SMC endpoints
export const getSMCOrderBlocks = (symbol: string, timeframe = '15m', bars = 300) =>
  api.get(`/api/smc/order-blocks/${symbol}`, { params: { timeframe, bars } });

export const getSMCFVG = (symbol: string, timeframe = '15m', bars = 300) =>
  api.get(`/api/smc/fvg/${symbol}`, { params: { timeframe, bars } });

export const getSMCMSS = (symbol: string, timeframe = '15m', bars = 300) =>
  api.get(`/api/smc/mss/${symbol}`, { params: { timeframe, bars } });

export const getSMCLiquidity = (symbol: string, timeframe = '15m', bars = 300) =>
  api.get(`/api/smc/liquidity/${symbol}`, { params: { timeframe, bars } });

export const getSMCKillZones = () => api.get('/api/smc/kill-zones');

export const getSMCPivots = (symbol: string, timeframe = '1h', bars = 500, method = 'classic') =>
  api.get(`/api/smc/pivots/${symbol}`, { params: { timeframe, bars, method } });

export const getSMCJudasSwing = (symbol: string, timeframe = '15m', bars = 300) =>
  api.get(`/api/smc/judas-swing/${symbol}`, { params: { timeframe, bars } });

export const getSMCPO3 = (symbol: string, timeframe = '15m', bars = 300) =>
  api.get(`/api/smc/po3/${symbol}`, { params: { timeframe, bars } });

export const confirmSignal = (signal: any) => 
  api.post('/api/signals/confirm', signal);

// Trading API
export const executeTrade = (tradeData: {
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
}) => api.post('/api/trade/execute', tradeData);

export const getPositions = () => api.get('/api/positions');

export const closePosition = (positionId: string, exitPrice?: number) => 
  api.post(`/api/positions/${positionId}/close`, { exit_price: exitPrice });

// Risk API
export const getRiskMetrics = () => api.get('/api/risk/metrics');

export const updateRiskConfig = (config: {
  max_risk_per_trade: number;
  max_daily_risk: number;
  max_daily_loss: number;
  kill_switch_losses: number;
}) => api.post('/api/risk/config', config);

export const resetRisk = () => api.post('/api/risk/reset');

// Performance API
export const getPerformance = () => api.get('/api/performance');

// Market Data API
export const getMarketData = () => api.get('/api/market/data');

// MT5 API
export const getMt5Status = () => api.get('/api/mt5/status');

export const getMt5Ohlcv = (symbol: string, timeframe = '1h', bars = 100) =>
  api.get(`/api/mt5/ohlcv/${symbol}`, { params: { timeframe, bars } });

export const getMt5Tick = (symbol: string) =>
  api.get(`/api/mt5/tick/${symbol}`);

// Available symbols
export const getAvailableSymbols = () => api.get<{ symbols: string[] }>('/api/symbols');

export default api;
