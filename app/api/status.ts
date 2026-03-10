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
    const response = await fetch(`${PYTHON_API_URL}/api/status`, {
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
    console.error('Status fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
