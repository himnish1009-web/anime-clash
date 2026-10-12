#  DEPLOY ANIME CLASH — free, no credit card, ~10 minutes of clicking

You need **two free accounts** (email signup, no card): **GitHub** and **Render**.
Everything below is copy-paste or drag-drop. No terminal, no code editing.

---

## Step 1 — Put the game on GitHub (3 min)

1. Go to https://github.com/signup → create a free account (skip all paid plans).
2. Sign in → click the **+** (top right) → **New repository**.
3. Repository name: `anime-clash` → keep **Public** → click **Create repository**.
4. On the empty-repo page click the blue link **“uploading an existing file”**.
5. Open the folder you downloaded from Arena (`anime-clash-deploy.zip` → extract it).
   Drag **everything inside the extracted `anime-clash` folder** (folders `public`,
   `server`, `src`, `tests` + the loose files like `package.json`, `render.yaml`…)
   into the upload box. Wait for all files to finish uploading.
6. Click the green **Commit changes** button.

## Step 2 — Tell Render to host it (3 min)

1. Go to https://render.com → **Get Started** → sign up **with your GitHub account**.
2. Dashboard → **New** → **Blueprint**.
3. Pick your `anime-clash` repository → **Connect**.
4. Render reads the included `render.yaml` automatically:
   - name `anime-clash`, **Free** plan
   - build: `npm ci && npm run build`
   - start: `npm start`
   Click **Apply / Create** when asked.
5. Wait for the first deploy (~2–4 min). The page shows a green **Live** badge.
6. Click the URL at the top (looks like `https://anime-clash.onrender.com`).
   **That is your permanent, shareable game link.** 🎉

## Step 3 — Play & share

- Open the link → **VS CPU** / **LOCAL VERSUS** / **FIGHT ONLINE** all work,
  including real-time online PvP (the relay lives in the same app).
- Free-tier apps **sleep after ~15 min of nobody playing**. The first visitor
  after a nap waits ~30–60 s while it wakes up — then it's instant for everyone.
  (That's the only "cost" of $0 hosting. No action needed from you.)
- Want a new version live later? Edit files on GitHub (or re-upload them) —
  Render redeploys automatically on every commit.

---

## Plan B — instant static copy (60 s, no accounts at all)

If you just want the game reachable *right now* and don't care about online PvP:

1. In this folder run nothing — instead drag the **`dist/` folder** (after a build)
   or use https://app.netlify.com/drop with the extracted project's `dist` folder.
2. You get a temporary public URL instantly. CPU + local versus work;
   **FIGHT ONLINE needs the Render version** (it hosts the WebSocket relay).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Render build fails with “vite: not found” | Make sure you uploaded `package-lock.json` (build uses `npm ci`). |
| Deploy log: unsupported Node version | The included `.nvmrc` pins Node 22 — re-upload it if missing. |
| Site loads but “FIGHT ONLINE” says server unreachable | You're on a static host (Plan B). Deploy the Render version instead. |
| Link slow the first time after idle | Normal free-tier wake-up (~30–60 s). Refresh once it's up. |
