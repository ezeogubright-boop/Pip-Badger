import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signal = req.body;

    if (!signal || typeof signal !== 'object') {
      return res.status(400).json({ error: 'Signal data is required' });
    }

    // Mock signal confirmation
    const confirmation = {
      signal_confirmed: true,
      recommendation: {
        action: 'BUY',
        confidence: signal.confidence || 0.8,
        position_size: 0.01,
        entry: signal.price || 1950.0,
        stop_loss: signal.stop_loss || 1945.0,
        take_profit: signal.take_profit || 1960.0,
        risk_reward_ratio: 2.0,
      },
      risk_check: 'passed',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(confirmation);
  } catch (error) {
    console.error('Signal confirmation error:', error);
    res.status(500).json({
      error: 'Failed to confirm signal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
