# Quick Start: Deploy to Vercel in 5 Minutes

## Prerequisites
- Vercel account (free at vercel.com)
- Vercel CLI installed: `npm i -g vercel`

## Quick Deploy Steps

### Step 1: Deploy Backend (2 minutes)
```bash
cd artifacts/api-server
vercel --prod
# Answer prompts - select "Other" for framework
# Note the URL it gives you (e.g., https://agency-management-api.vercel.app)
```

### Step 2: Set Backend Environment Variables
In Vercel dashboard → Your API Project → Settings → Environment Variables:

Add these variables (copy from your local .env.project):
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEON_AUTH_COOKIE_SECRET` (generate: `openssl rand -base64 32`)

Then redeploy: `vercel --prod --force`

### Step 3: Deploy Frontend (2 minutes)
Edit `artifacts/agency-os/src/App.tsx`:
```typescript
// Update line with setBaseUrl to:
setBaseUrl(import.meta.env.PROD ? "https://your-api-url.vercel.app" : "/");
```

Then deploy:
```bash
cd artifacts/agency-os
vercel --prod
```

### Step 4: Test
1. Open your frontend URL
2. Login with: `admin@agencyos.com` / `Admin@123`
3. Create a new account
4. Login with the new account

## Done! 🎉

Your app is now live on Vercel!

## Need More Details?
See `VERCEL_DEPLOYMENT.md` for comprehensive guide with troubleshooting.
