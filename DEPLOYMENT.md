# Deployment Guide - GitHub Pages

This guide will walk you through deploying your portfolio to GitHub Pages with your custom domain `calvinhou.com`.

## Prerequisites

- GitHub account
- Git installed on your computer
- Domain `calvinhou.com` purchased and ready to configure

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `portfolio` or `calvinhou-portfolio`
3. Make it **public** (required for free GitHub Pages)
4. Don't initialize with README (we already have one)

## Step 2: Push Your Code to GitHub

Open terminal in your project directory and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Portfolio website"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - **Source**: `GitHub Actions`
5. Click **Save**

## Step 4: Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically:
- Build your site when you push to `main` branch
- Deploy it to GitHub Pages
- Update whenever you push new changes

**First deployment:**
- After pushing your code, go to the **Actions** tab in your repository
- You should see a workflow running
- Wait for it to complete (usually 1-2 minutes)
- Once done, your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## Step 5: Configure Custom Domain

### Option A: Using CNAME (Recommended)

1. In your repository, go to **Settings** → **Pages**
2. Under **Custom domain**, enter: `calvinhou.com`
3. Check **Enforce HTTPS** (wait a few minutes for SSL to provision)
4. Click **Save**

5. Create a file named `CNAME` in your repository:
   ```bash
   echo "calvinhou.com" > CNAME
   git add CNAME
   git commit -m "Add CNAME for custom domain"
   git push
   ```

6. Go to your domain provider (where you bought calvinhou.com) and add DNS records:
   - **Type**: CNAME
   - **Name**: `@` or leave blank (depends on your provider)
   - **Value**: `YOUR_USERNAME.github.io`
   - **TTL**: 3600 (or default)

   OR if CNAME doesn't work for root domain, use A records:
   - **Type**: A
   - **Name**: `@`
   - **Value**: `185.199.108.153`
   - Add 3 more A records with:
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`

### Option B: Using A Records Only

1. Add the CNAME file as above
2. Add 4 A records pointing to GitHub Pages IPs:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`

### Option C: Using www Subdomain

If you want `www.calvinhou.com`:

1. In **Settings** → **Pages**, enter: `www.calvinhou.com`
2. Create CNAME file with: `www.calvinhou.com`
3. Add CNAME record:
   - **Name**: `www`
   - **Value**: `YOUR_USERNAME.github.io`

## Step 6: Wait for DNS Propagation

- DNS changes can take anywhere from a few minutes to 48 hours
- Usually takes 1-2 hours
- You can check propagation status at: https://www.whatsmydns.net

## Step 7: Verify SSL Certificate

1. After DNS propagates, GitHub will automatically provision an SSL certificate
2. This usually takes 10-60 minutes
3. Check **Settings** → **Pages** - you should see "Enforce HTTPS" option
4. Enable it once available

## Step 8: Test Your Site

Visit:
- `https://calvinhou.com` (your custom domain)
- `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/` (GitHub Pages URL)

Both should work!

## Updating Your Site

Whenever you make changes:

```bash
# Make your changes to the code
# Then commit and push
git add .
git commit -m "Update portfolio"
git push
```

GitHub Actions will automatically rebuild and redeploy your site. Changes usually go live within 1-2 minutes.

## Troubleshooting

### Site not loading
- Check DNS propagation: https://www.whatsmydns.net
- Verify DNS records are correct
- Wait up to 48 hours for full propagation

### SSL certificate not working
- Make sure DNS is fully propagated
- Wait 10-60 minutes after DNS is set
- Check GitHub Pages settings for SSL status

### Build failing
- Check the **Actions** tab for error messages
- Make sure all dependencies are in `package.json`
- Verify `vite.config.js` is correct

### 404 errors
- Make sure you're using the correct base path in `vite.config.js`
- For root domain, use `base: '/'`
- For subdirectory, use `base: '/repo-name/'`

## Need Help?

- GitHub Pages Docs: https://docs.github.com/en/pages
- DNS Help: Contact your domain provider
- GitHub Support: https://support.github.com


