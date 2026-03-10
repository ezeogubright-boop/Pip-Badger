# Pip Badger Deployment Guide

## Architecture Overview

Your Pip Badger Trading Bot is now configured as a **hybrid full-stack deployment**:

- **Frontend**: React + Vite → Deployed on **Vercel** ✅
- **Backend**: FastAPI Python → Deploy separately on a Python-capable platform
- **Communication**: Node.js API Routes on Vercel → Forward requests to Python backend

## Deployment Steps

### Step 1: Deploy Frontend + API Routes to Vercel

Your frontend and Node.js proxy routes are already deployed to:
```
https://pip-badger.vercel.app
```

### Step 2: Deploy Python Backend

You have two main options:

#### Option A: Railway (Recommended - Simplest)

1. Sign up at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Set environment variables:
   ```
   PYTHON_ENV=production
   ```
4. Railway will automatically detect `requirements.txt` and deploy
5. Get your Railway API URL (e.g., `https://pip-badger.up.railway.app`)

#### Option B: Render

1. Sign up at [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set:
   - Build command: `pip install -r backend/requirements.txt`
   - Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set environment variables
6. Deploy and get your Render URL

#### Option C: Heroku (if using traditional Heroku)

```bash
cd backend
heroku create pip-badger-backend
heroku config:set PYTHON_ENV=production
git push heroku main
```

### Step 3: Connect Frontend to Backend

Once your Python backend is deployed:

1. Go to [vercel.com](https://vercel.com)
2. Select your **pip-badger** project
3. Go to **Settings → Environment Variables**
4. Add:
   ```
   PYTHON_API_URL = https://your-backend-url.com
   ```
   (Replace with your actual Railway/Render/Heroku URL)
5. Click **Save** and **Redeploy**

### Step 4: Update Vercel Deployment

After setting the environment variable, trigger a redeploy:

```bash
vercel --prod
```

Or redeploy from Vercel dashboard.

## File Structure

The API routes are configured as:

```
app/api/
├── status.ts                      # GET /api/status
├── analyze.ts                     # POST /api/analyze
├── signals/
│   └── confirm.ts                # POST /api/signals/confirm
└── smc/
    ├── order-blocks/[symbol].ts  # GET /api/smc/order-blocks/:symbol
    ├── fvg/[symbol].ts           # GET /api/smc/fvg/:symbol
    └── mss/[symbol].ts           # GET /api/smc/mss/:symbol
```

These routes proxy all requests to your Python backend at `PYTHON_API_URL`.

## Environment Variables

### Vercel Environment Variables
```
PYTHON_API_URL=https://your-backend-url.com
```

### Python Backend Environment Variables (set on Railway/Render)
```
MT5_LOGIN=your_mt5_login
MT5_PASSWORD=your_mt5_password
MT5_SERVER=your_mt5_server
REDIS_URL=redis://...
LOG_LEVEL=info
```

## Testing the Deployment

### Test Frontend
```bash
curl https://pip-badger.vercel.app
```

### Test API Routes
```bash
curl https://pip-badger.vercel.app/api/status
```

### Test Python Backend Connection
Check Vercel logs:
```bash
vercel logs
```

## Troubleshooting

### "Failed to fetch status" error

1. Check if `PYTHON_API_URL` is set correctly in Vercel
2. Verify Python backend is running
3. Check CORS headers in Python backend
4. View Vercel logs: `vercel logs --follow`

### Slow API responses

- Python backend cold start issue (Railway/Render takes ~10-15s first request)
- Solution: Use "Always On" features or implement keep-alive pings

### WebSocket not working

WebSocket connections need special handling. Currently, they're not proxied through Vercel API routes. For WebSocket support:

1. Connect directly to Python backend: `wss://your-backend-url.com/ws`
2. Update frontend to use environment variable for WS URL
3. Or: Upgrade to Vercel Pro for additional features

## Monitoring & Logs

### View Vercel Logs
```bash
vercel logs --follow
```

### View Python Backend Logs (Railway)
- Dashboard → Select project → View logs

### View Python Backend Logs (Render)
- Dashboard → Select service → Logs tab

## Cost Estimation

- **Vercel**: Free tier (Frontend + API routes) ✅
- **Railway**: Free tier or ~$5/month paid
- **Render**: Free tier or ~$7/month paid

## Next Steps

1. Deploy Python backend to Railway or Render
2. Set `PYTHON_API_URL` environment variable in Vercel
3. Redeploy from Vercel dashboard
4. Test API endpoints
5. Monitor logs for any issues

## Support

For issues:
- Check Vercel dashboard: vercel.com
- Check Railway/Render dashboard
- Review logs in both platforms
- Test endpoints with curl or Postman
