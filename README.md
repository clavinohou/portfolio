# Personal Portfolio - Calvin Hou

A minimal, interactive portfolio website with a Teenage Engineering-inspired design aesthetic.

## 🚀 Features

- **Minimal Design**: Clean, geometric layout with bold typography
- **Interactive Elements**: Hover effects, smooth animations, and micro-interactions
- **Responsive**: Works beautifully on all devices
- **Fast**: Built with Vite for optimal performance
- **Modern**: React + Framer Motion for smooth animations

## 🛠️ Tech Stack

- React 19
- Vite
- Framer Motion
- CSS Modules

## 📦 Installation

```bash
npm install
```

## 🏃 Development

```bash
npm run dev
```

Visit `http://localhost:5173` to see your site.

## 🏗️ Build

```bash
npm run build
```

This creates a `dist` folder with your production-ready site.

## 📤 Deploying to GitHub Pages

### Option 1: Manual Deployment

1. Build your site:
   ```bash
   npm run build
   ```

2. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

3. Go to your repository on GitHub
4. Navigate to **Settings** → **Pages**
5. Under **Source**, select the `main` branch and `/docs` folder
6. Click **Save**

7. Update `vite.config.js` to output to `docs` folder:
   ```js
   export default defineConfig({
     plugins: [react()],
     build: {
       outDir: 'docs',
     },
     base: '/',
   })
   ```

8. Rebuild and push:
   ```bash
   npm run build
   git add docs
   git commit -m "Build for GitHub Pages"
   git push
   ```

### Option 2: Automatic Deployment (GitHub Actions)

The included `.github/workflows/deploy.yml` will automatically build and deploy your site whenever you push to the `main` branch.

1. Push your code to GitHub (same as above)
2. The GitHub Action will automatically deploy your site
3. Go to **Settings** → **Pages** and select **GitHub Actions** as the source

### Custom Domain Setup

1. In your GitHub repository, go to **Settings** → **Pages**
2. Under **Custom domain**, enter `calvinhou.com`
3. Update your DNS records with your domain provider:
   - Add an A record pointing to GitHub Pages IPs:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - OR add a CNAME record pointing to `YOUR_USERNAME.github.io`
4. Wait for DNS propagation (can take up to 24 hours)
5. GitHub will automatically provision an SSL certificate

## 📝 Customization

### Update Your Information

1. **Hero Section**: Edit `src/components/Hero.jsx`
2. **About Section**: Edit `src/components/About.jsx`
3. **Projects**: Edit the `projects` array in `src/components/Projects.jsx`
4. **Contact**: Update social links in `src/components/Contact.jsx`
5. **Colors**: Modify CSS variables in `src/styles/global.css`

### Add Your Projects

Edit `src/components/Projects.jsx` and update the `projects` array with your actual projects:

```jsx
const projects = [
  {
    id: 1,
    title: 'Your Project Name',
    description: 'Project description',
    tags: ['Design', 'Development'],
    color: '#FF6B35',
    link: 'https://your-project-url.com', // Optional
  },
  // Add more projects...
]
```

## 🎨 Design System

The site uses a Teenage Engineering-inspired design system:

- **Colors**: Black, White, Accent Orange (#FF6B35)
- **Typography**: Space Grotesk (geometric sans-serif)
- **Layout**: Grid-based with generous whitespace
- **Interactions**: Smooth transitions (0.25s ease)

## 📄 License

MIT


