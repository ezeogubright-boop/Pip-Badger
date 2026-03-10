import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock market data for trading symbols
  const marketData = {
    EURUSD: {
      price: 1.0875,
      bid: 1.0874,
      ask: 1.0876,
      spread: 0.0002,
      change_24h: 0.25,
      volume_24h: 1500000,
      high_24h: 1.0900,
      low_24h: 1.0800,
    },
    GBPUSD: {
      price: 1.2620,
      bid: 1.2619,
      ask: 1.2621,
      spread: 0.0002,
      change_24h: -0.15,
      volume_24h: 950000,
      high_24h: 1.2700,
      low_24h: 1.2580,
    },
    XAUUSD: {
      price: 2050.5,
      bid: 2050.3,
      ask: 2050.7,
      spread: 0.4,
      change_24h: 0.8,
      volume_24h: 2000000,
      high_24h: 2055.0,
      low_24h: 2040.0,
    },
    US30: {
      price: 39450.25,
      bid: 39449.5,
      ask: 39451.0,
      spread: 1.5,
      change_24h: 0.35,
      volume_24h: 1200000,
      high_24h: 39600.0,
      low_24h: 39300.0,
    },
    US500: {
      price: 5285.75,
      bid: 5285.5,
      ask: 5286.0,
      spread: 0.5,
      change_24h: 0.42,
      volume_24h: 1800000,
      high_24h: 5300.0,
      low_24h: 5250.0,
    },
    USDJPY: {
      price: 149.85,
      bid: 149.83,
      ask: 149.87,
      spread: 0.04,
      change_24h: -0.25,
      volume_24h: 850000,
      high_24h: 150.50,
      low_24h: 149.20,
    },
    AUDUSD: {
      price: 0.6585,
      bid: 0.6584,
      ask: 0.6586,
      spread: 0.0002,
      change_24h: 0.15,
      volume_24h: 700000,
      high_24h: 0.6620,
      low_24h: 0.6550,
    },
  };

  res.status(200).json(marketData);
}
