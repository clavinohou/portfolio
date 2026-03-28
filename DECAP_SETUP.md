# Decap CMS setup for this portfolio

Your site content now lives in **`src/content/cms/site.json`**. The React app imports it through **`src/content/siteContent.js`** (with a small normalizer so list fields match what the UI expects).

You edit everything in a **browser UI** at **`/admin`** — no hand-editing HTML.

---

## 1. Point Decap at your GitHub repo

Open **`public/admin/config.yml`** and set:

1. **`backend.repo`** — `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` → your real repo (e.g. `calvinhou/personal-portfolio`).
2. **`backend.branch`** — usually `main` (or `master` if that is your default).
3. **`site_url`** — the public URL of the site (e.g. `https://calvinhou.github.io` or `https://calvinhou.github.io/my-repo/` if you use a project page).

If you host at **GitHub Pages with a project URL**, also set **`base`** in **`vite.config.js`** to `'/your-repo-name/'` and set Decap’s **`public_folder`** to match how assets are served (see section 5).

---

## 2. Local editing (fastest way to try the UI)

You don’t need GitHub OAuth for this.

1. Install deps: `npm install`
2. Terminal A: `npm run dev`
3. Terminal B: `npm run cms` (starts **decap-server** for the local backend)
4. Open **`http://localhost:5173/admin/`** (port may differ if Vite picks another).

**`local_backend: true`** is already set in **`config.yml`**. With **decap-server** running, saves go to your **local files** (including `site.json`).

When you’re done testing, **commit** `src/content/cms/site.json` (and any new files under **`public/uploads/`** or **`public/resume/`**).

**Optional:** Comment out **`local_backend: true`** before pushing if you only want production auth (some teams leave it; it only activates when **decap-server** is running).

---

## 3. Production editing on GitHub Pages (GitHub login)

On the **live** site, Decap uses the **GitHub** backend: you sign in with GitHub and it **commits** changes to the repo. That requires a **GitHub OAuth App** and a small **OAuth helper** (GitHub does not issue tokens purely in the browser for this flow).

High-level:

1. **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   - **Homepage URL:** your live site URL.
   - **Authorization callback URL:** depends on the OAuth provider you use (see below).

2. Follow the official guide: **[Decap — GitHub backend](https://decapcms.org/docs/github-backend/)**  
   It explains **`base_url`** / **`auth_endpoint`** and common hosting options.

**Common choices:**

- **Netlify** (often easiest): deploy the same repo to Netlify, use **Git Gateway** / Identity as in Decap’s Netlify docs — then you can keep or drop GitHub Pages.
- **Self-hosted OAuth proxy** (e.g. a tiny Node service or **Cloudflare Worker**) that implements the flow Decap expects — many community templates exist; use only ones you trust.

After OAuth works, visiting **`https://your-site.com/admin/`** shows the **same UI** as locally; **Publish** creates a commit on **`backend.branch`**.

---

## 4. Deploy workflow

- **GitHub Actions** or **GitHub Pages** build: on each push to **`main`**, run **`npm run build`** and publish **`dist/`**.
- After you **publish** from Decap, wait for the build to finish (~1–2 minutes) before checking the live site.

---

## 5. Images, resume, and paths

- **Project images:** the CMS uses **`public/uploads`**. Uploaded files end up there and are referenced as **`/uploads/...`** on the site root.
- **Existing** images under **`public/images/`** stay valid if **`imageUrl`** is still **`/images/project-foo.jpg`** (you can type that in the field if you use “Choose URL” where available, or keep paths in JSON).
- **Resume:** use the **Resume PDF** field (file widget). You can also put the PDF in **`public/resume/`** and set **`downloadUrl`** to **`/resume/YourName.pdf`** manually.

If the site is served from a **subpath** (e.g. **`/personal-portfolio/`**), set Vite **`base`** accordingly and use **asset URLs that match** (often **`/personal-portfolio/uploads/...`**). Update **`public_folder`** in **`config.yml`** to that same prefix so new uploads get the right path.

---

## 6. Security

- **`/admin`** is a static page; it does not run a server on GitHub Pages.
- Only **you** should be able to **publish**; that is enforced by **GitHub permissions** (OAuth + repo write access) or **local_backend** on your machine.
- Do **not** commit OAuth **client secrets** into the repo; the helper service holds the secret.

---

## Quick reference

| What            | Where                                      |
|-----------------|--------------------------------------------|
| Editable data   | `src/content/cms/site.json`                |
| CMS config      | `public/admin/config.yml`                  |
| Admin UI        | `http://localhost:5173/admin/` (dev)      |
| Normalizer      | `src/content/siteContent.js`               |
| Media uploads   | `public/uploads/`                          |

After any change to **`site.json`**, save and refresh the portfolio; a full **`npm run build`** is only needed for production deploy.
