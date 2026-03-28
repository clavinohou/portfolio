# Quick Start Guide

## 🚀 Get Started Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Visit `http://localhost:5173`

## ✏️ Customize Your Content

### Update Personal Information

1. **Hero Section** (`src/components/Hero.jsx`):
   - Change "Calvin Hou" to your name
   - Update tagline "Designer & Developer"
   - Modify description text

2. **About Section** (`src/components/About.jsx`):
   - Replace bio text with your own
   - Update skills array with your skills
   - Add/remove skills as needed

3. **Projects** (`src/components/Projects.jsx`):
   - Replace the sample projects with your actual projects
   - Each project needs: `id`, `title`, `description`, `tags`, `color`
   - Optionally add `link` property for project URLs

4. **Contact** (`src/components/Contact.jsx`):
   - Update email in social links: `mailto:your.email@example.com`
   - Update GitHub URL
   - Update LinkedIn URL
   - Modify contact form message

5. **Footer** (`src/components/Footer.jsx`):
   - Already shows your domain `calvinhou.com`
   - Update copyright year if needed

### Change Colors

Edit `src/styles/global.css` and modify the CSS variables:

```css
:root {
  --color-black: #000000;
  --color-white: #FFFFFF;
  --color-accent: #FF6B35;  /* Change this for accent color */
  --color-bg: #FAFAFA;
  --color-text: #1A1A1A;
  --color-text-light: #666666;
}
```

### Change Fonts

The site uses **Space Grotesk** from Google Fonts. To change:

1. Update the font link in `index.html`
2. Update `--font-primary` in `src/styles/global.css`

## 📦 Build for Production

```bash
npm run build
```

This creates a `dist` folder ready for deployment.

## 🌐 Deploy to GitHub Pages

See `DEPLOYMENT.md` for detailed instructions.

**Quick version:**
1. Push code to GitHub
2. Enable GitHub Pages in repository settings
3. Configure custom domain
4. Done! 🎉

## 📱 Test Responsiveness

- Open browser dev tools (F12)
- Toggle device toolbar
- Test on different screen sizes
- Mobile menu should appear on screens < 768px

## 🎨 Design Notes

- **Teenage Engineering aesthetic**: Minimal, geometric, bold
- **Color scheme**: Black, white, accent orange
- **Typography**: Space Grotesk (geometric sans-serif)
- **Interactions**: Smooth hover effects, animations
- **Layout**: Grid-based with generous whitespace

## 🔧 Troubleshooting

**Port already in use?**
- Change port: `npm run dev -- --port 3000`

**Build errors?**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

**Styles not loading?**
- Make sure CSS files are imported in components
- Check browser console for errors

## 📚 Next Steps

1. Customize all content with your information
2. Add your actual projects
3. Update social media links
4. Test on different devices
5. Deploy to GitHub Pages
6. Configure custom domain

Happy coding! 🚀


