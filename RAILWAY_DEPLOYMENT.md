# Deploy Python Backend to Railway - Quick Guide

## Step 1: Sign Up & Connect GitHub

1. Visit [railway.app](https://railway.app)
2. Click **"Start Project"**
3. Choose **"Deploy from GitHub"**
4. Authorize Railway to access your GitHub
5. Select your **Pip Badger** repository
6. Click **"Deploy Now"**

Railway will automatically:
- Detect Python from `requirements.txt`
- Build your project
- Deploy the backend

## Step 2: Get Your Railway URL

After deployment completes:

1. Go to your Railway dashboard
2. Click on your **pip-badger** project
3. Click on the **Deployments** tab
4. Find your service URL (looks like: `https://pip-badger.up.railway.app`)
5. Copy this URL

**This is your `PYTHON_API_URL`**

## Step 3: Set Environment Variables in Railway

In your Railway dashboard:

1. Go to project **Settings**
2. Click **"Environment Variables"**
3. Add these from your `.env`:
   ```
   MT5_LOGIN=your_login
   MT5_PASSWORD=your_password
   MT5_SERVER=your_server
   ```
4. Set `ENVIRONMENT=production`
5. Click **"Update"**

## Step 4: Connect to Vercel

Now that your Python backend is running on Railway:

1. Go to [vercel.com](https://vercel.com)
2. Select **pip-badger** project
3. Go to **Settings → Environment Variables**
4. Add:
   - **Name**: `PYTHON_API_URL`
   - **Value**: `https://pip-badger.up.railway.app` (your Railway URL)
5. Click **"Save"** then **"Redeploy"**

## Step 5: Verify Everything Works

#### Test from your machine:
```bash
# Test your Railway backend directly
curl https://pip-badger.up.railway.app/

# Test through Vercel
curl https://pip-badger.vercel.app/api/status
```

#### Test from Vercel logs:
```bash
vercel logs --follow
```

You should see successful requests to your Railway backend.

## Troubleshooting Railway Deployment

### Deployment Failed?
- Check **Deployments** tab for error logs
- Click on failed deployment to see full logs
- Common issues:
  - Missing dependencies in `requirements.txt`
  - Wrong Python version
  - Port not exposed

### Application won't start?
- Check Railway logs: **Deployments → View Logs**
- Ensure `uvicorn` starts correctly
- Verify all imports work

### Connection timeout?
- Cold start issue (Railway takes 10-15s first request)
- Wait for Railway to fully initialize
- Or use "Always On" feature (paid)

### `ModuleNotFoundError`?
- Missing dependency in `requirements.txt`
- Add it: `pip install package_name && pip freeze > requirements.txt`
- Redeploy Railway

## Railway Dashboard Guide

### View Logs
**Deployments → Active → View Logs** (real-time output)

### Monitor Resources
**Monitoring** tab shows:
- CPU usage
- Memory usage
- Network traffic

### Restart Service
**Settings → Restart** button

### View Live URL
**Deployments → Environment** shows your Railway URL

## Keep Costs Low

- **Free tier**: Includes monthly credits (enough for testing)
- **Tips to stay free**:
  - Don't use 24/7 always-on
  - Optimize database queries
  - Use caching (Redis)
  - Monitor resource usage

## Next: Connect Everything

Once Railway deployment is live:

1. **Set `PYTHON_API_URL` in Vercel**
2. **Redeploy Vercel** (`vercel --prod --yes`)
3. **Test API endpoints**

Your full-stack app is now live! 🚀

```
Browser → Vercel (Frontend + API Routes) → Railway (Python Backend)
```

## Support

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- Pip Badger Docs: [See DEPLOYMENT.md](DEPLOYMENT.md)
