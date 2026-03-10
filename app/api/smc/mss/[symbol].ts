import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol } = req.query;
    const timeframe = (req.query.timeframe as string) || '15m';

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Mock market structure shifts data
    const mockData = {
      symbol,
      timeframe,
      market_structure: {
        trend: 'bullish',
        htf_bias: 'bullish',
        bos_level: 1945.0,
        bos_confirmed: true,
        choch_detected: true,
        choch_level: 1950.0,
        swing_direction: 'up',
      },
    };

    res.status(200).json(mockData);
  } catch (error) {
    console.error('MSS fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch market structure shifts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
