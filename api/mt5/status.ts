import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    connected: true,
    mode: 'simulation',
    account: {
      login: 'DEMO-SIM',
      server: 'Simulation',
      balance: 100000.0,
    },
    timestamp: new Date().toISOString(),
  });
}
