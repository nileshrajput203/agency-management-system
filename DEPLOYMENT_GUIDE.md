# Deployment Guide - Agency Management System

This guide will help you deploy both the frontend and backend to Vercel as separate projects.

## Overview

- **Frontend** (agency-os): Vite React app
- **Backend** (api-server): Express.js API
- **Database**: You'll need to set up a database (Neon, Supabase, or similar)

---

## Step 1: Set Up Database

Before deploying, you need a cloud database. Choose one:

### Option A: Neon PostgreSQL (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a new project
3. Copy your database connection string (DATABASE_URL)

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get the PostgreSQL connection string from Settings

### Option C: Your existing database
If you already have a database, get the connection string.

---

## Step 2: Deploy Backend API

### 2.1 Push code to GitHub
```bash
git add -A
git commit -m "chore: add Vercel deployment config"
git push origin fix-login-issue
```

### 2.2 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Choose your repository: `nileshrajput203/agency-management-system`
5. Select the `fix-login-issue` branch
6. **Root Directory**: `artifacts/api-server`
7. Click **"Configure Project"**
8. Add **Environment Variables**:
   - `DATABASE_URL`: Your database connection string
   - `NODE_ENV`: `production`
   - `ADMIN_EMAIL`: `admin@agencyos.com`
   - `ADMIN_PASSWORD`: `Admin@123`

9. Click **"Deploy"**
10. Wait for the deployment to complete
11. Copy the deployment URL (e.g., `https://api-server-xxx.vercel.app`)

---

## Step 3: Deploy Frontend

### 3.1 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Choose your repository again
5. Select the `fix-login-issue` branch
6. **Root Directory**: `artifacts/agency-os`
7. Click **"Configure Project"**
8. Add **Environment Variables**:
   - `VITE_API_URL`: Your backend API URL from Step 2.11
     - Example: `https://api-server-xxx.vercel.app`

9. Click **"Deploy"**
10. Wait for deployment to complete
11. Your app will be live at the provided Vercel URL

---

## Step 4: Verify Deployment

### Test the Backend
```bash
curl https://api-server-xxx.vercel.app/api/health
```
Should return a success response.

### Test the Frontend
1. Visit your frontend URL
2. Try logging in with:
   - Email: `admin@agencyos.com`
   - Password: `Admin@123`
3. Test registration with a new account

---

## Step 5: Optional - Custom Domain

1. In Vercel project settings
2. Go to **"Domains"**
3. Add your custom domain
4. Follow DNS configuration steps

---

## Troubleshooting

### Backend not connecting from frontend
- Make sure `VITE_API_URL` is set correctly on the frontend
- Check that backend URL doesn't have trailing slash
- Example: `https://api-server-xxx.vercel.app` (not `/api`)

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check if your database allows connections from Vercel IPs
- Test locally first with the same DATABASE_URL

### Build failures
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify environment variables are set

---

## Environment Variables Summary

### Backend (api-server)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Set to `production`
- `ADMIN_EMAIL` - Admin account email
- `ADMIN_PASSWORD` - Admin account password

### Frontend (agency-os)
- `VITE_API_URL` - Backend API base URL (from backend deployment)

---

## Next Steps

After deployment:
1. Monitor your app on Vercel dashboard
2. Set up custom domains if needed
3. Configure CI/CD for auto-deployments on push
4. Set up error tracking (optional)

