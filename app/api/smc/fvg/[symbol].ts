import type { VercelRequest, VercelResponse } from '@vercel/node';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol } = req.query;
    const timeframe = (req.query.timeframe as string) || '15m';
    const bars = parseInt(req.query.bars as string) || 300;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const url = new URL(`${PYTHON_API_URL}/api/smc/fvg/${symbol}`);
    url.searchParams.append('timeframe', timeframe);
    url.searchParams.append('bars', bars.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Fair value gaps fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch fair value gaps',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
