# Vercel Deployment Guide - Agency Management System

## ✅ Current Status
- ✅ Neon PostgreSQL database is set up and configured
- ✅ Database schema has been migrated
- ✅ Login issue fixed (auto-approval for new users)
- ✅ Deployment configurations added

## Overview
Your application consists of two separate services that will be deployed as separate Vercel projects:
1. **Frontend** (agency-os) - Vite React app
2. **Backend** (api-server) - Express.js API

## Step 1: Deploy Backend API

### 1a. Create Backend Vercel Project
```bash
cd artifacts/api-server
vercel --prod
```

When prompted:
- **Project name**: `agency-management-api` (or your preferred name)
- **Framework**: Select `Other`
- **Build Command**: Keep default or use `npm run build`
- **Output Directory**: `dist`

### 1b. Get Your API URL
After deployment, Vercel will show you the API URL (e.g., `https://agency-management-api.vercel.app`)
**Save this URL** - you'll need it for the frontend.

### 1c. Set Environment Variables in Vercel
Go to your Vercel project settings → Environment Variables and add:

```
DATABASE_URL=postgresql://neondb_owner:npg_Z9TbOPCd3SwG@ep-muddy-pond-ahma78hn-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require

DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_Z9TbOPCd3SwG@ep-muddy-pond-ahma78hn.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require

ADMIN_EMAIL=admin@agencyos.com

ADMIN_PASSWORD=Admin@123

NEON_AUTH_COOKIE_SECRET=[Generate a random string - see below]
```

#### Generating NEON_AUTH_COOKIE_SECRET
Run this command locally:
```bash
openssl rand -base64 32
```
Copy the output and paste it as the value for `NEON_AUTH_COOKIE_SECRET`.

### 1d. Redeploy with Environment Variables
After setting env vars, redeploy:
```bash
vercel --prod --force
```

## Step 2: Deploy Frontend

### 2a. Update API URL in Frontend Code
Edit `artifacts/agency-os/src/App.tsx` and update the API base URL:

Find this line:
```typescript
setBaseUrl("/");  // This is for local development
```

For production, it should connect to your backend:
```typescript
// In App.tsx, update to use the backend API URL
const apiBaseUrl = import.meta.env.PROD 
  ? "https://your-api-url.vercel.app"  // Replace with your actual API URL
  : "/";

setBaseUrl(apiBaseUrl);
```

### 2b. Create Frontend Vercel Project
```bash
cd artifacts/agency-os
vercel --prod
```

When prompted:
- **Project name**: `agency-management-frontend` (or your preferred name)
- **Framework**: Select `Vite`
- **Build Command**: `npm run build` or `pnpm build`
- **Output Directory**: `dist`

### 2c. Set Environment Variables
Add to your frontend's Vercel environment variables:
```
VITE_API_URL=https://your-api-url.vercel.app
```

### 2d. Redeploy
```bash
vercel --prod --force
```

## Step 3: Verification

### Test Backend
```bash
curl https://your-api-url.vercel.app/api/health
```

### Test Frontend
1. Open your frontend URL in the browser
2. Try logging in with:
   - **Email**: `admin@agencyos.com`
   - **Password**: `Admin@123`
3. Try creating a new account and logging in

## Environment Variables Reference

### Backend (api-server) Required Env Vars:
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon database connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | Your Neon database connection string (unpooled) |
| `ADMIN_EMAIL` | Email for admin account (e.g., `admin@agencyos.com`) |
| `ADMIN_PASSWORD` | Password for admin account (e.g., `Admin@123`) |
| `NEON_AUTH_COOKIE_SECRET` | Generated secret for cookie encryption (use `openssl rand -base64 32`) |
| `PORT` | Port for the API (default: 5000) |
| `NODE_ENV` | Set to `production` |

### Frontend (agency-os) Required Env Vars:
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Your backend API URL (e.g., `https://agency-management-api.vercel.app`) |

## Important Notes

1. **Separate Projects**: Backend and frontend are deployed as separate Vercel projects. This provides:
   - Independent scaling
   - Better performance
   - Easier maintenance
   - Different deployment cycles

2. **Database Connection**: The Neon database is already set up with:
   - Users table with authentication
   - All necessary schemas
   - Connection pooling for better performance

3. **CORS**: Make sure your backend API allows requests from your frontend domain. The Express server should have CORS configured properly.

4. **Domain Setup**: After deployment, you can:
   - Connect custom domains in Vercel settings
   - Set up API routes with custom subdomains (e.g., `api.yourdomain.com`)

## Troubleshooting

### Login not working after deployment
1. Check that `DATABASE_URL` env var is set in backend
2. Verify `NEON_AUTH_COOKIE_SECRET` is set
3. Check that frontend is pointing to correct backend URL
4. Look at backend logs: `vercel logs <backend-url>`

### CORS errors
1. Check Express CORS configuration in `artifacts/api-server/src/app.ts`
2. Update CORS allowed origins to include your frontend URL

### Database connection errors
1. Verify `DATABASE_URL` is correct
2. Check that Neon database is active in your account
3. Verify IP whitelist (Neon allows all IPs by default)

## Next Steps

1. Push your code to GitHub (already done ✓)
2. Deploy backend first
3. Get backend URL and update frontend config
4. Deploy frontend
5. Test the complete flow

Happy deploying! 🚀
