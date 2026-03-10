import type { VercelRequest, VercelResponse } from '@vercel/node';

// Base prices for symbols
const basePrices: Record<string, number> = {
  EURUSD: 1.0875,
  GBPUSD: 1.2620,
  XAUUSD: 2050.5,
  US30: 39450.0,
  US500: 5285.0,
  USDJPY: 149.85,
  AUDUSD: 0.6585,
};

// Typical volatility (as fraction of price) per bar
const volatility: Record<string, number> = {
  EURUSD: 0.0003,
  GBPUSD: 0.0004,
  XAUUSD: 0.001,
  US30: 0.001,
  US500: 0.0008,
  USDJPY: 0.0003,
  AUDUSD: 0.0004,
};

const tfMinutes: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

// Seeded pseudo-random for deterministic results per symbol+timeframe
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const symbol = (req.query.symbol as string || 'XAUUSD').toUpperCase();
  const timeframe = (req.query.timeframe as string) || '1h';
  const bars = Math.min(Number(req.query.bars) || 100, 500);

  const base = basePrices[symbol] || 2050;
  const vol = volatility[symbol] || 0.001;
  const minutes = tfMinutes[timeframe] || 60;

  const rand = seededRandom(hashCode(symbol + timeframe));
  const now = Date.now();
  const data = [];
  let price = base * (1 + (rand() - 0.5) * 0.01); // slight random offset

  for (let i = bars - 1; i >= 0; i--) {
    const time = new Date(now - i * minutes * 60000).toISOString();
    const change = (rand() - 0.48) * vol * base; // slight upward bias
    const open = price;
    const close = open + change;
    const high = Math.max(open, close) + rand() * vol * base * 0.5;
    const low = Math.min(open, close) - rand() * vol * base * 0.5;
    const volume = Math.round(500 + rand() * 2000);

    data.push({
      time,
      open: Number(open.toFixed(symbol.includes('JPY') ? 3 : symbol === 'XAUUSD' ? 2 : symbol.startsWith('US') ? 2 : 5)),
      high: Number(high.toFixed(symbol.includes('JPY') ? 3 : symbol === 'XAUUSD' ? 2 : symbol.startsWith('US') ? 2 : 5)),
      low: Number(low.toFixed(symbol.includes('JPY') ? 3 : symbol === 'XAUUSD' ? 2 : symbol.startsWith('US') ? 2 : 5)),
      close: Number(close.toFixed(symbol.includes('JPY') ? 3 : symbol === 'XAUUSD' ? 2 : symbol.startsWith('US') ? 2 : 5)),
      volume,
    });

    price = close;
  }

  res.status(200).json({
    symbol,
    timeframe,
    source: 'simulation',
    bars: data.length,
    data,
  });
}
