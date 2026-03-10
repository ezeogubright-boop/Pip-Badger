import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock risk metrics
  const metrics = {
    account: {
      balance: 100000.0,
      equity: 99500.0,
      open_pnl: -500.0,
      daily_pnl: -200.0,
    },
    risk: {
      level: 'low',
      total_exposed: 2.0,
      current_drawdown: 0.5,
      max_drawdown: 2.5,
      margin_used: 25000.0,
      margin_available: 75000.0,
    },
    performance: {
      trades_today: 5,
      consecutive_losses: 1,
      win_rate: 65.0,
      sharpe_ratio: 1.25,
    },
  };

  res.status(200).json({ data: metrics });
}
