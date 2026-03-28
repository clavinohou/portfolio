# Personal Portfolio Website - Project Plan

## 🎨 Design Vision
- **Aesthetic**: Teenage Engineering-inspired minimalism
  - Clean lines, bold typography
  - Limited color palette (blacks, whites, maybe one accent color)
  - Geometric shapes and grid-based layouts
  - Playful but functional interactions
- **Style**: Unique, interactive, but not overwhelming
- **Target**: Personal portfolio showcasing work/projects

---

## 🛠️ Tech Stack Recommendation

### Frontend Framework
**Option 1: Vanilla HTML/CSS/JavaScript** (Recommended for simplicity)
- Pros: Lightweight, fast, no build process needed, easy to deploy
- Cons: More manual work for complex interactions

**Option 2: React + Vite** (Recommended for interactivity)
- Pros: Component-based, great for interactive elements, modern tooling
- Cons: Requires build step, slightly more complex setup

**Option 3: Next.js** (If you want SEO/performance)
- Pros: Great SEO, server-side rendering, excellent performance
- Cons: More complex, might be overkill for a simple portfolio

**Recommendation**: **React + Vite** - Best balance of interactivity and simplicity

### Styling
- **CSS Modules** or **Tailwind CSS** for styling
- **Framer Motion** or **GSAP** for smooth animations
- Custom CSS for Teenage Engineering aesthetic

### Deployment
- **Vercel** (Recommended - FREE tier)
  - Free for personal projects
  - Automatic deployments from Git
  - Custom domain support
  - Great performance (CDN)
  - Zero config for React/Next.js

- **Netlify** (Alternative - FREE tier)
  - Similar to Vercel
  - Free tier with custom domains
  - Easy drag-and-drop or Git integration

- **GitHub Pages** (Cheapest - FREE)
  - Completely free
  - Works with static sites
  - Custom domain support
  - Slightly more setup required

**Recommendation**: **Vercel** - Easiest setup, best developer experience, free

---

## 🎯 Interactive Features Plan

### Core Interactions
1. **Hover Effects**
   - Button color/scale changes
   - Text underline animations
   - Image overlays
   - Icon transformations

2. **Navigation**
   - Smooth scroll to sections
   - Active section highlighting
   - Mobile-friendly hamburger menu

3. **Project Cards**
   - Hover to reveal details
   - Click to expand/view project
   - Image transitions

4. **About Section**
   - Interactive timeline or skill bars
   - Hover to reveal more info

5. **Contact Form**
   - Animated input fields
   - Button state changes
   - Success/error animations

6. **Cursor Effects** (Optional)
   - Custom cursor that follows mouse
   - Changes on hover over interactive elements

---

## 📐 Site Structure

```
Homepage Sections:
1. Hero Section
   - Name/title
   - Brief tagline
   - Scroll indicator

2. About
   - Short bio
   - Skills/interests
   - Photo (optional)

3. Projects/Work
   - Grid of project cards
   - Filter/tag system (optional)
   - Each card: image, title, description, tags

4. Contact
   - Email link
   - Social media links
   - Contact form (optional)

5. Footer
   - Copyright
   - Additional links
```

---

## 🚀 Implementation Plan

### Phase 1: Setup & Foundation
1. Initialize React + Vite project
2. Set up project structure
3. Install dependencies (Framer Motion, styling library)
4. Create base layout components
5. Set up routing (if multi-page) or smooth scroll (single page)

### Phase 2: Design System
1. Define color palette (Teenage Engineering inspired)
2. Choose typography (geometric, clean fonts)
3. Create reusable components (Button, Card, Section)
4. Set up CSS variables for theming

### Phase 3: Core Sections
1. Build Hero section with animations
2. Create About section
3. Build Projects grid with cards
4. Create Contact section
5. Add Footer

### Phase 4: Interactions & Polish
1. Add hover effects to all interactive elements
2. Implement smooth scroll animations
3. Add page transitions
4. Mobile responsiveness
5. Performance optimization

### Phase 5: Deployment
1. Set up Git repository
2. Configure Vite for GitHub Pages (base path, build output)
3. Set up GitHub Actions for automatic deployment (optional)
4. Configure custom domain (calvinhou.com) in GitHub Pages settings
5. Update DNS records for custom domain
6. Test live site
7. SSL certificate (automatic with GitHub Pages)

---

## 💰 Deployment Cost Breakdown

### Vercel (Recommended)
- **Cost**: FREE for personal projects
- **Features**:
  - Unlimited personal projects
  - Custom domains
  - SSL certificates (automatic)
  - CDN (global)
  - Automatic deployments
  - 100GB bandwidth/month (plenty for low traffic)
- **Limits**: 
  - 100GB bandwidth/month (more than enough)
  - Build time limits (not an issue for static sites)

### Netlify
- **Cost**: FREE tier available
- **Features**: Similar to Vercel
- **Limits**: 100GB bandwidth/month

### GitHub Pages
- **Cost**: FREE
- **Features**: Basic static hosting
- **Limits**: 1GB storage, 100GB bandwidth/month

**Recommendation**: **GitHub Pages** - Completely free, works with any static site (including React apps), and you can create a completely custom design (no template restrictions).

---

## 📋 Pre-Deployment Checklist

1. ✅ Domain purchased (calvinhou.com) - DONE
2. ⬜ Website built
3. ⬜ Git repository created
4. ⬜ GitHub repository created
5. ⬜ Vite configured for GitHub Pages
6. ⬜ GitHub Pages enabled in repository settings
7. ⬜ Custom domain configured in GitHub Pages
8. ⬜ DNS records updated (A/CNAME records)
9. ⬜ SSL certificate (automatic with GitHub Pages)
10. ⬜ Site tested and live

---

## 🎨 Teenage Engineering Design Elements

### Visual Style
- **Colors**: 
  - Primary: Black (#000000)
  - Secondary: White (#FFFFFF)
  - Accent: Orange/Red (#FF6B35 or similar)
  - Background: Off-white or pure white

- **Typography**:
  - Sans-serif, geometric
  - Font options: Inter, Space Grotesk, DM Sans, or custom
  - Bold headings, regular body text

- **Layout**:
  - Grid-based
  - Generous whitespace
  - Clear hierarchy
  - Asymmetric but balanced

- **Interactive Elements**:
  - Buttons with clear states
  - Smooth transitions (0.2-0.3s)
  - Hover feedback
  - Playful micro-interactions

---

## 📝 Next Steps

1. Review and approve this plan
2. Choose tech stack (React + Vite recommended)
3. Start building the website
4. Set up deployment when ready

---

## 🔗 Useful Resources

- **Vercel**: https://vercel.com
- **Teenage Engineering**: https://teenage.engineering (for design inspiration)
- **Framer Motion**: https://www.framer.com/motion/
- **Fonts**: Google Fonts, Fontshare

---

**Ready to start building?** Let me know if you want to adjust anything in this plan, or we can proceed with implementation!

