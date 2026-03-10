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

    // Mock fair value gaps data
    const mockData = {
      symbol,
      timeframe,
      fair_value_gaps: [
        {
          start: 1948.0,
          end: 1950.0,
          type: 'bullish',
          mitigated: false,
          strength: 0.8,
        },
        {
          start: 1955.0,
          end: 1957.0,
          type: 'bearish',
          mitigated: true,
          strength: 0.6,
        },
      ],
    };

    res.status(200).json(mockData);
  } catch (error) {
    console.error('FVG fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch fair value gaps',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
