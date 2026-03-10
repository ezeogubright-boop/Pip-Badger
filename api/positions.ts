import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock positions data
  const positions = {
    open_positions: [
      {
        id: '1',
        symbol: 'EURUSD',
        direction: 'long',
        entry_price: 1.0850,
        current_price: 1.0875,
        quantity: 1.0,
        lot_size: 1.0,
        unrealized_pnl: 250.0,
        stop_loss: 1.0800,
        take_profit: 1.0920,
        risk_percent: 1.5,
        open_time: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '2',
        symbol: 'GBPUSD',
        direction: 'short',
        entry_price: 1.2650,
        current_price: 1.2620,
        quantity: 0.5,
        lot_size: 0.5,
        unrealized_pnl: 150.0,
        stop_loss: 1.2700,
        take_profit: 1.2550,
        risk_percent: 0.5,
        open_time: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    count: 2,
  };

  res.status(200).json(positions);
}
