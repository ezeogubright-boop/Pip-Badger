import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return simulated trading status
  const status = {
    system_status: 'operational',
    trading_enabled: true,
    kill_switch: false,
    risk_level: 'low',
    account: {
      balance: 100000.0,
      equity: 99500.0,
      open_pnl: -500.0,
      daily_pnl: -200.0,
      current_drawdown: 0.5,
    },
    positions: {
      open: 2,
      total_risk: 2.0,
    },
    execution: {
      total_orders: 15,
      successful: 14,
      failed: 1,
      avg_execution_time_ms: 245,
    },
    timestamp: new Date().toISOString(),
    mode: 'simulation',
  };

  res.status(200).json(status);
}
