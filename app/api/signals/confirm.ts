import type { VercelRequest, VercelResponse } from '@vercel/node';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export default async function handler(
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

    const response = await fetch(`${PYTHON_API_URL}/api/signals/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signal),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Signal confirmation error:', error);
    res.status(500).json({
      error: 'Failed to confirm signal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
