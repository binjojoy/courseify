# Courseify 🎓

> **Turn any YouTube playlist or video into a distraction-free, structured interactive course with progress tracking and timestamped markdown notes.**

Courseify converts scattered YouTube educational content into a personal learning management system. It runs with zero accounts, zero trackers, and saves all your course curriculums, lesson completion states, playback resume positions, and markdown notes locally in your browser.

---

## ✨ Features

- 🔗 **Instant Playlist & Single Video Conversion**: Paste any public or unlisted YouTube playlist or single video URL to generate an ordered, navigable lesson tree.
- ⏯️ **Distraction-Free Video Player**: Powered by YouTube IFrame API with custom controls, automatic video completion tracking (triggers at ≥ 90% or on video end), and auto-play next lesson toggle.
- 📝 **Timestamped Markdown Notes**: Take personal study notes per lesson with a 1-click `Insert Timestamp` shortcut. Notes auto-save continuously to LocalStorage.
- 📊 **Dynamic Learning Dashboard**: Displays enrolled courses, watch metrics, completion progress bars, and recent notes.
- 🔄 **Backup Export & Import**: Full data portability. Export your entire course catalogue, notes, and study progress into a clean JSON file and import it anytime.
- 🎨 **Google Sans & Clean Design System**: Clean typography and UI adhering to Google Sans & Arial specifications, with full Dark Mode and Light Mode support.
- 🔒 **100% In-Browser Privacy**: No account required. All state is preserved locally via LocalStorage.

---

## 🛠️ Tech Stack

- **Frontend**:
  - React 18
  - TypeScript
  - Vite
  - Tailwind CSS 3
  - Canvas Confetti
  - Google Sans & Material Symbols Outlined
- **Backend**:
  - Node.js (ES Modules)
  - Express.js
  - YouTube public metadata scraper with fallback support for both `lockupViewModel` and `playlistVideoRenderer` structures
  - Optional official YouTube Data API v3 integration via API key

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### 1. Clone the repository

```bash
git clone https://github.com/binjojoy/courseify.git
cd courseify
```

### 2. Backend Setup

```bash
cd backend
npm install
```

*(Optional)* Create a `.env` file in `backend/` if you want to use the official YouTube Data API v3:
```env
PORT=5000
FRONTEND_URL=http://localhost:5173
YOUTUBE_API_KEY=your_api_key_here
```
> **Note**: Even without an API key, Courseify includes an automated scraper engine that fetches playlist data directly.

`FRONTEND_URL` is a comma-separated list of the exact browser origins allowed to call the API. It defaults to `https://youtubecourseify.vercel.app,http://localhost:5173`. There is deliberately **no wildcard matching** — a browser request from any other origin is rejected with `403 ORIGIN_NOT_ALLOWED`, so a third party cannot stand up a site on a lookalike domain and spend this service's YouTube quota. Add every origin you actually deploy to.

> **Note**: `YOUTUBE_API_KEY` is a server-side secret. Do not prefix it with `VITE_`; Vite inlines `VITE_*` variables into the client bundle and would publish the key to every visitor. The backend ignores and warns about any such variable.

Start the backend server:
```bash
npm start
# or
node src/server.js
```
The backend server runs on `http://localhost:5000`.

### 3. Frontend Setup

In a new terminal window:
```bash
cd ../frontend
npm install
npm run dev
```
The frontend Vite development server runs on `http://localhost:5173`.

---

## ☁️ Deploying with Vercel and Render

Deploy the frontend to Vercel and the backend as a Render Web Service.

### Render backend

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:

```env
YOUTUBE_API_KEY=your_api_key_here
FRONTEND_URL=https://your-frontend-domain.example
```

`PORT` is assigned automatically by Render. `FRONTEND_URL` is **required** in production: without it the API falls back to the default allow-list, which only contains the Vercel deployment and `http://localhost:5173`. List every origin that should be able to call the API, separated by commas. Origins are matched exactly — `*.vercel.app` style wildcards are not supported, so a preview deployment must be added explicitly.

### Vercel frontend

- Root directory: `frontend`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

Replace the value with the URL of the deployed Render backend. Do not add a trailing slash.

The frontend uses the local Vite proxy during development and `VITE_API_URL` in production.

---

## 📖 How to Use

1. **Create a Course**:
   - Open `http://localhost:5173/#/add` in your browser.
   - Paste any YouTube playlist link (e.g., `https://www.youtube.com/playlist?list=...`) or a single YouTube video URL.
   - Click **Create Course** or press Enter.

2. **Learn & Track Progress**:
   - The lesson tree appears in the right sidebar with video durations and completion statuses.
   - Videos resume automatically from your last saved position.
   - Mark videos as completed manually using the checkbox or let the auto-complete mark them when finished.

3. **Take Timestamped Notes**:
   - Use the notes panel beneath the video.
   - Click **Insert [Timestamp]** to reference exact lesson timestamps in your notes.
   - Click any timestamp in your notes to jump directly to that point in the lesson.

4. **Review via Dashboard**:
   - Click **Dashboard** in the top navigation bar to see all your active courses, continue where you left off, sort by progress or recent activity, and review recent notes.

5. **Backup & Restore**:
   - Click the user avatar profile icon in the top right header.
   - Select **Export backup (JSON)** to download your data.
   - Select **Import backup (JSON)** on any browser or device to restore your learning history.
   - Importing validates the whole file first, then asks how to apply it:
     **Merge with my data** (default — keeps everything already here and adds anything new, and never downgrades a completion you earned) or **Replace my data** (restores the backup exactly, discarding anything added since the export).
   - Files are capped at 10 MB. A file that is not a Courseify backup is rejected with a specific reason rather than partially applied.

---

## 🧪 Tests

```bash
# Backend: origin matching, URL parsing, upstream error classification,
# duration parsing, truncation, and API-key non-leakage.
cd backend && npm test

# Frontend end-to-end: build first, then run Playwright against the preview server.
cd frontend
npm run build
npm run test:e2e
```

The Playwright suite runs every test on a desktop and a mobile viewport.

---

## 📂 Project Architecture

```
courseify/
├── backend/
│   ├── src/
│   │   ├── config/env.js      # PORT / FRONTEND_URL / YOUTUBE_API_KEY parsing + exact-origin CORS policy
│   │   ├── data/              # Fallback mock data structures
│   │   ├── services/
│   │   │   └── youtube.js     # Scraper & YouTube API integration
│   │   ├── utils/
│   │   │   └── duration.js    # ISO 8601 & formatted duration parsers
│   │   └── server.js          # Express API endpoints (see below)
│   ├── test/                  # node:test suites
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components (Navbar, YouTubePlayer, PlaylistSidebar, NotesSection, etc.)
│   │   ├── hooks/             # useFocusTrap
│   │   ├── pages/             # HomePage (#/add), DashboardPage (#/dashboard), PlayerPage (#/course/:id)
│   │   ├── services/          # LocalStorage persistence, API client, AI client, backup validation
│   │   ├── types/             # TypeScript definitions (incl. the YouTube IFrame API surface)
│   │   ├── utils/             # progress.ts — the single source of truth for completion maths
│   │   ├── App.tsx            # Hash routing & global modals
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Tailwind tokens & dark/light theme variables
│   ├── tests/                 # Playwright specs
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── requirements/            # UI reference specifications & PRD
├── .gitignore
└── README.md
```

### API endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check. |
| `GET` | `/api/sample-courses` | Static sample catalogue, no upstream call. |
| `GET` | `/api/playlist?url=…` | Playlist or single-video metadata + lesson list. |
| `POST` | `/api/playlist` | Same, with the URL in a JSON body. |
| `GET` | `/api/video/:videoId/description` | Lesson description text. |

All `/api` routes are origin-checked, rate limited per IP (30 playlist requests and 60 description requests per minute), and capped at a 200-lesson page. A truncated response carries `truncated: true` and `totalItemCount`, and the UI says so rather than implying the course is complete.

---

## 📄 License

MIT License. Free for personal and educational use.
