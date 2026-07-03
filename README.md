# SC AI Video Content Studio (SCAiGenVid)

Internal frontend for staff to upload a product image + prompt, submit an
AI video-generation job, poll its status, preview/approve/download the
result.

**This is a separate application from the SC ERP stock-management SPA
(`SC-StockDay-Ordering/apps/admin-web`).** It is an unrelated domain (AI
video content generation, not stock/ordering) and is kept in its own repo
on purpose to avoid confusion — this repo may also be made public at some
point, which is a bad fit for the internal ERP codebase.

It talks to the **same shared backend** used by the other SC frontends:
`PaaSRTSM-project/apps/admin-api` (Express, deployed at
`https://paasrtsm-project.onrender.com`), reusing the existing
cookie-session auth (`POST /api/auth/login`). This repo contains **no
backend code** — it is a pure Vite + React frontend that calls the
already-existing (or in-progress) `/api/content/*` video job endpoints.

## Local development

```bash
npm install
cp .env.example .env
# edit .env if you want to point at something other than localhost:4000
npm run dev
```

The dev server runs on `http://localhost:5175` by default.

## Pointing at the deployed backend

Set `VITE_API_BASE_URL` in `.env` (or in the Render static-site env vars)
to `https://paasrtsm-project.onrender.com` to use the live shared API
instead of a local backend.

## Build

```bash
npm run build
npm run preview
```

## Security note (this repo may become public)

- No secrets of any kind belong in this repository.
- `.env` and `.env.local` are gitignored — never commit real values.
- `.env.example` intentionally contains no real API keys, tokens, or
  credentials, only a placeholder `VITE_API_BASE_URL`.
- Provider/storage API keys (e.g. OpenAI, video render providers, object
  storage) live **server-side only**, in the backend
  (`PaaSRTSM-project/apps/admin-api`) — this frontend never sees or
  needs them.
- If you fork or contribute to this repo, double-check `git status` /
  `git diff` before committing to make sure no `.env` file or credential
  ever gets staged.

## Structure

```
src/
  main.jsx            entry point
  App.jsx              top-level shell: auth gate + nav (New Job / History)
  AuthContext.jsx       login/logout/session state (user, role, csrfToken)
  lib/api.js             fetch wrapper (credentials: include, CSRF header, JSON envelope handling)
  lib/permissions.js     client-side mirror of role -> permission map (UX only; server enforces)
  pages/LoginPage.jsx
  pages/NewJobPage.jsx
  pages/HistoryPage.jsx
  components/NewGenerationForm.jsx
  components/JobHistoryList.jsx
  components/JobDetailPanel.jsx
  components/StatusBadge.jsx
```

## Known gaps / TODO (backend not finished yet)

- No `GET /api/auth/me` / session-restore-on-load endpoint was specified
  in the contract this app was built against, so refreshing the page
  currently requires logging in again (no persisted session hydration).
  If/when the backend exposes a session-check endpoint, wire it into
  `AuthContext.jsx` the same way `order-web` does.
- The "Generate" button does create + submit in a single click (see
  below) rather than a two-step Save Draft / Submit flow.
- Everything under `/api/content/*` is unverified against a live backend
  — this app was built purely against the documented contract and a
  production build was the only verification performed (see project
  report).
