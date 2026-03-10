import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const performance = {
    trade_statistics: {
      total_trades: 47,
      winning_trades: 31,
      losing_trades: 16,
      win_rate: 65.96,
      avg_win: 285.40,
      avg_loss: -142.80,
      profit_factor: 1.85,
      expectancy: 87.25,
    },
    account_performance: {
      starting_balance: 100000.0,
      current_balance: 104250.0,
      total_return: 4.25,
      max_drawdown: 2.5,
      sharpe_ratio: 1.42,
      sortino_ratio: 1.85,
      calmar_ratio: 1.70,
    },
    recent_trades: [
      { symbol: 'EURUSD', direction: 'long', pnl: 320.50, date: new Date(Date.now() - 3600000).toISOString() },
      { symbol: 'GBPUSD', direction: 'short', pnl: -85.20, date: new Date(Date.now() - 7200000).toISOString() },
      { symbol: 'XAUUSD', direction: 'long', pnl: 450.00, date: new Date(Date.now() - 14400000).toISOString() },
      { symbol: 'US30', direction: 'short', pnl: 180.30, date: new Date(Date.now() - 28800000).toISOString() },
      { symbol: 'USDJPY', direction: 'long', pnl: -62.10, date: new Date(Date.now() - 43200000).toISOString() },
    ],
  };

  res.status(200).json(performance);
}
