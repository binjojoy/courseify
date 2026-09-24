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
YOUTUBE_API_KEY=your_api_key_here
```
> **Note**: Even without an API key, Courseify includes an automated scraper engine that fetches playlist data directly.

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
```

`PORT` is assigned automatically by Render. `FRONTEND_URL` is optional; the backend accepts Vercel deployment domains automatically. Set it if you use a custom frontend domain.

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

---

## 📂 Project Architecture

```
courseify/
├── backend/
│   ├── src/
│   │   ├── data/            # Fallback mock data structures
│   │   ├── services/
│   │   │   └── youtube.js   # Scraper & YouTube API integration
│   │   ├── utils/
│   │   │   └── duration.js  # ISO 8601 & formatted duration parsers
│   │   └── server.js        # Express API endpoints (/api/playlist, /api/health)
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Navbar, YouTubePlayer, PlaylistSidebar, NotesSection, etc.)
│   │   ├── pages/           # HomePage (#/add), DashboardPage (#/dashboard), PlayerPage (#/course/:id)
│   │   ├── services/        # LocalStorage persistence, API client
│   │   ├── types/           # TypeScript definitions
│   │   ├── App.tsx          # Hash routing & global modals
│   │   ├── main.tsx         # React entry point
│   │   └── index.css        # Tailwind tokens & dark/light theme variables
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── requirements/            # UI reference specifications & PRD
├── .gitignore
└── README.md
```

---

## 📄 License

MIT License. Free for personal and educational use.
