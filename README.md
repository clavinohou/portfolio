# Personal Portfolio - Calvin Hou

Design inspired by Teenage Engineering design language. (my favorite!)

[Link](https://calvinhou.com)


## Front + Backend

- React 19
- Vite
- Framer Motion
- CSS Modules
- Github Pages
- Decap CMS

## Local editor

Run `npm run dev` and `npm run cms`, then open http://localhost:5173/admin/.
Saving entries, uploading media, or deleting content automatically commits and
pushes those changes to `origin/main`. Media saves also refresh optimized images.
The save completes only after GitHub confirms the push. If a push fails, the editor
reports an error; the local changes are retained and saving again retries the push.
The backend requires `main`, no staged changes, and a branch that includes the
latest remote changes. It preserves unrelated unstaged work and never force-pushes.

## Optional project pages and build notes

In Portfolio Studio → Projects, **Give this project a page** enables its overview
page, gallery, and optional PCB viewer. Turn it off to keep a portfolio-only card
that opens its external link instead.

**Show build notes** independently enables the Build log section, jump link, and
entry counts. Turn it off on any project to show only its overview; older projects
retain their existing behavior. Turning notes off preserves their content for later. CB2
Estimation starts with an overview and PCB viewer, without a build log.

## PCB design viewer

Project pages show one large photo beside the description, with a thumbnail
carousel directly underneath. The arrows, thumbnail buttons, and left/right
keyboard keys change the main photo. Photos slide horizontally across the main
preview, and reduced-motion preferences skip the movement. Click the large
photo to use the existing full-size viewer and zoom controls.

Cover images and gallery photos still use the standard Decap project fields.
The project-page thumbnail count controls how many appear in the carousel at once.
The interactive PCB viewer remains a separate section below the project hero.

In Portfolio Studio → Projects, open **PCB design viewer**. Supply either:

- An **Altium embed link**: save the design to Altium 365 Personal Space, choose
  **Embed**, enable embedding anywhere on the web, then copy the iframe's `src`
  URL into this field. Paste the URL only. This takes priority over an archive.
- A **public design archive**: upload a ZIP of the project, PCB, and schematic
  files, or paste a public HTTPS URL ending in `.zip`, `.rar`, or `.7z`.

Choose the starting view: 3D assembly, PCB layout, or schematics. The project’s
page shows an **Explore PCB** panel below the photo gallery. Altium only
loads when the visitor clicks the button. Projects without a valid source show
no viewer. The viewer can expand or open in a separate tab.

CB2 Estimation uses its saved Altium 365 Personal Space embed and starts in 3D
assembly view. Its starter page is a standard project record at
`src/content/cms/projects/cb2-estimation.json`, editable through Portfolio Studio
like any other project. Add its description, dates, and photos there; build notes
can be linked to `cb2-estimation` through the Related project field.

Its media gallery includes front and rear 3D captures, a PCB layout capture,
and the original `ctv-fold-and-unfold.gif` showing the complete folding and
unfolding sequence as one animation. The GIF stays animated in both the gallery
and the full-size viewer. Its timing adds a one-second pause at the fully folded
and fully unfolded positions, while keeping the original movement speed.

The charger uses its saved Altium 365 Personal Space embed and starts in 3D.
The **CTV Engine Controller** is at `/log/pcb-project`, backed by
`src/content/cms/projects/pcb-project.json`. Its gallery combines Altium board
captures with vehicle CAD, a block diagram, and schematic excerpts from the
team’s design reviews. Its viewer starts in 3D.

For archive-based viewers, archives are fetched and processed by Altium, so the URL must
be publicly reachable, without sign-in.
For local archive uploads, processing needs the deployed website URL; Altium
cannot fetch files from your local preview. Use a persistent Personal Space
embed for preprocessed designs; standalone upload share links expire in 48 hours.

The archive loader runs in its own document at `public/viewers/altium.html` so
Altium’s script does not modify React’s DOM. Both the content loader and standalone
document validate their source URLs. Run `npm run test:pcb` to check URL handling.

[Altium embedding documentation](https://www.altium.com/documentation/altium-365/standalone-viewer#embedding-altium-365-viewer-on-your-own-website)

### Spreadsheet previews

Upload an `.xlsx` workbook to the Decap media library and link its `/uploads/`
path in any project description or build note. For example:

```markdown
[See the buck calculations](/uploads/ctv-buck-calculations.xlsx "Buck calculations")
```

A regular click opens the read-only workbook preview, with a download link for
the original file. The optional Markdown link title names the preview window.
