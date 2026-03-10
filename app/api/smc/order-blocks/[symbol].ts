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

    // Mock order blocks data
    const mockData = {
      symbol,
      timeframe,
      order_blocks: [
        {
          level: 1950.5,
          type: 'bullish',
          confirmed: true,
          strength: 0.85,
          time: new Date().toISOString(),
        },
        {
          level: 1940.0,
          type: 'bearish',
          confirmed: false,
          strength: 0.65,
          time: new Date().toISOString(),
        },
      ],
    };

    res.status(200).json(mockData);
  } catch (error) {
    console.error('Order blocks error:', error);
    res.status(500).json({
      error: 'Failed to fetch order blocks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
