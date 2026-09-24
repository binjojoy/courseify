# Courseify — UI Design Specification

Tagline: *Paste a playlist link. Turn it into a course.*
Target generator: Google Stitch. Generate three primary screens (Input, Dashboard, Player), each in light and dark, plus the states listed in each section. Web app, desktop-first. Frames: Desktop 1440×900, Tablet 834×1194, Mobile 390×844.

---

## 1. Product Design Direction

Courseify is a quiet study tool wrapped around a YouTube player. The interface should feel like a well-organized desk: the video is the biggest object, everything else is arranged around it at a lower volume.

**Direction in one paragraph.** Cool graphite-and-paper neutrals, one blue accent used only for "where you are" (current video, progress, primary actions), one green used only for "done" (completed videos, completed courses). Type is IBM Plex Sans for everything in the interface, with Source Serif 4 reserved for three headline moments (Input heading, Dashboard greeting, Course-complete title). Flat surfaces separated by 1px borders, not shadows. Cards exist only where an item is a discrete, clickable object (course cards, Continue banner, dialogs). Everything else is plain rows and hairline dividers.

**Theme behavior.** Follow the OS setting by default. Dark is the reference theme for the Player View (long sessions, video letterboxing blends into the page). Both themes use the identical layout and token names.

**Voice.** Sentence case everywhere. Plain verbs. Buttons say exactly what happens ("Add course", "Resume", "Remove course"). Errors say what happened and what to do; they never apologize.

## 2. Design Principles

1. **The video owns the screen.** On desktop the player is flush to the top and left edges of the content area (no surrounding padding, no card frame) and takes ~72% of the viewport width.
2. **Progress is always visible, never loud.** Progress appears as numbers plus a slim bar, in the sidebar header on desktop and in a strip under the title on small screens.
3. **One accent means "current"; one green means "done".** No third status color except error and warning for real problems.
4. **Rows over cards.** Lists of 400+ items are dense, borderless rows with a single highlighted current row.
5. **Same skeleton on every screen.** Same app bar, same type scale, same radii, same buttons, same progress bar, same empty-state pattern.
6. **Nothing moves unless the user acted.** No entrance animations. Only hover/press transitions, panel open/close, and progress bar fill.

**Avoid (hard constraints for Stitch):** hero illustrations, gradients, glassmorphism/backdrop blur, drop shadows on resting cards, uniform 16px radius on everything, all-caps or letter-spaced labels, eyebrow labels above headings, monospace fonts, emoji, decorative blobs, multiple accent colors, stock-photo backgrounds, stat tiles with gradient icons.

---

## 3. Visual Language

### Color System

Use these exact tokens. Names are shared across themes.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-canvas` | `#F4F5F7` | `#171B22` | Page background, app bar |
| `bg-surface` | `#FFFFFF` | `#1D222B` | Cards, sidebar, inputs, dialogs |
| `bg-hover` | `#EEF0F3` | `#262C37` | Row/button hover |
| `bg-elevated` | `#FFFFFF` | `#242A35` | Menus, popovers, toasts, dialogs |
| `border-default` | `#DDE1E7` | `#2C333F` | Card, input, divider borders |
| `border-strong` | `#C3C9D3` | `#3B4453` | Hovered borders, checkbox outlines |
| `text-primary` | `#161A22` | `#E9ECF1` | Titles, body, current row |
| `text-secondary` | `#4A5361` | `#B0B7C4` | Descriptions, completed row titles, meta |
| `text-muted` | `#667085` | `#838B9B` | Captions, placeholders, durations |
| `accent` | `#2456D6` | `#7BA0FF` | Primary buttons, current row, progress fill, links, focus ring |
| `accent-hover` | `#1C46B5` | `#96B3FF` | Primary button hover |
| `accent-pressed` | `#163A96` | `#6289F0` | Primary button pressed |
| `accent-subtle` | `#E6EDFB` | `#23324F` | Current row background, selected menu item |
| `on-accent` | `#FFFFFF` | `#0E1526` | Text/icon on accent fill |
| `success` | `#1B7A4B` | `#58C48C` | Checked checkbox, completed badge, 100% progress |
| `success-subtle` | `#E3F3EA` | `#1B3A2C` | Completed badge/button background |
| `error` | `#C2372E` | `#FF8F86` | Error text, error borders, destructive button |
| `error-subtle` | `#FBE9E7` | `#43231F` | Error banners |
| `warning` | `#9A6100` | `#E6B454` | Storage-quota warning |
| `warning-subtle` | `#FBF0DA` | `#3D3018` | Warning banner |
| `player-black` | `#000000` | `#000000` | Player letterbox in both themes |
| `scrim` | `rgba(15,18,25,0.50)` | `rgba(0,0,0,0.65)` | Behind dialogs and drawers |

Rules: progress fill = `accent`, turns `success` at 100%. Track color = `border-default`. Links inside descriptions and notes = `accent`, underlined on hover only. Body text on any surface must meet 4.5:1 (all token pairings above do).

### Typography

- **UI family:** IBM Plex Sans (400, 500, 600). Fallback: system-ui, sans-serif.
- **Display family:** Source Serif 4 (600), only for the three display headings named in Section 1. Letter-spacing −0.01em.
- **Numbers:** all durations, counts, indexes and percentages use tabular figures.
- No all caps, no italics for emphasis, no monospace.

| Style | Font | Size / line-height | Weight | Used for |
|---|---|---|---|---|
| Display L | Source Serif 4 | 40 / 48 (mobile 30 / 38) | 600 | Input heading |
| Display M | Source Serif 4 | 32 / 40 (mobile 26 / 34) | 600 | Dashboard greeting |
| Display S | Source Serif 4 | 28 / 36 | 600 | Course-complete title |
| Title | Plex Sans | 22 / 30 (mobile 20 / 28) | 600 | Current video title |
| Heading | Plex Sans | 18 / 26 | 600 | Section titles ("Your courses", "Notes") |
| Card title | Plex Sans | 15 / 22 | 600 | Course card title, banner title |
| Body | Plex Sans | 15 / 24 | 400 | Description, notes, dialog body |
| Body small | Plex Sans | 14 / 20 | 400 / 500 | Playlist row titles, buttons, menu items, input text |
| Caption | Plex Sans | 12 / 16 | 400 | Durations, channel name, timestamps, "Saved" |
| Stat | Plex Sans | 24 / 32 | 600 | Numbers in Learning stats |

Maximum line length for description and notes: 760px (about 75 characters).

### Spacing

4px base. Scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Page gutters: 32 (desktop), 24 (tablet), 16 (mobile).
- Vertical gap between major page sections: 48 (desktop), 40 (tablet), 32 (mobile).
- Gap inside cards: 12. Gap between grid cards: 24 (mobile 16).
- Sidebar horizontal inset: 8 for rows, 16 for header content.

### Borders & Radius

- Default border: 1px `border-default`. Hover on interactive containers: `border-strong`.
- Radius scale (deliberately different by role):
  - 4px: checkboxes, small chips, timestamp links
  - 8px: buttons, menus, dropdowns, notes box, playlist rows, thumbnails inside cards
  - 12px: course cards, Continue banner, hero URL input, empty-state container
  - 16px: dialogs
  - 999px: progress bars, avatar, "Jump to current" pill, switch
- The player is square-cornered (0 radius) on desktop; on tablet/mobile it is edge-to-edge and also square.

### Elevation

Three levels only.
- **Level 0 (default):** no shadow. Separation by border and background token.
- **Level 1 (menus, popovers, toasts, jump pill):** 1px `border-default` + shadow `0 4px 16px rgba(20,24,31,0.12)` light / `0 4px 16px rgba(0,0,0,0.5)` dark.
- **Level 2 (dialogs):** 1px `border-default` + `0 16px 48px rgba(20,24,31,0.20)` light / `0 16px 48px rgba(0,0,0,0.6)` dark, over `scrim`.
- Course cards get Level 1 shadow on hover in light theme only; in dark theme hover changes the border to `border-strong` only.

### Iconography

Lucide-style outline icons, 1.75px stroke, rounded caps and joins. Sizes: 16 (inline with caption text), 20 (default in buttons and rows), 24 (empty states, error panel at 40). Icons inherit text color. Icons used: play, pause-free "playing" glyph (three static vertical bars, 14px), check, arrow-right, arrow-left, chevron-down, chevron-left, chevron-right, more-vertical, plus, sun, moon, sticky-note, clock, external-link, alert-circle, alert-triangle, eye-off, lock, trash-2, rotate-ccw, link, arrow-up/arrow-down (for jump pill).

Logo: 24×24 `accent` rounded square (radius 6) containing a white play triangle with two short horizontal lines beneath it (playlist). Wordmark "Courseify" Plex Sans 17/24 600, `text-primary`, 8px right of the mark.

---

## 4. Global Layout

- **App bar** on every screen: height 56px (mobile 48px), background `bg-canvas`, 1px bottom border `border-default`, no blur, no shadow. Not sticky on mobile Player View (see Section 8); sticky everywhere else.
  - Left: logo mark + wordmark; click goes to Dashboard (or Input if no courses).
  - Right: theme toggle icon button (36×36, sun/moon), then avatar button (32px circle, `accent-subtle` bg, initial in `accent`, Caption weight 600; if no name, a user-outline icon).
  - Avatar menu (Level 1, 240px wide, 8px radius): "Edit your name", "Export backup", "Import backup", divider, "Your data stays in this browser" (caption, `text-muted`, lock icon, non-interactive).
- **Content container (Input, Dashboard):** centered, max-width 1240px (Dashboard) / 640px (Input), horizontal gutters per Section 3.
- **Player View** does not use a centered container; it is a full-bleed two-column grid (Section 8).
- **Toasts:** bottom-left on desktop (16px from edges), bottom-center on mobile. Height 44, `bg-elevated`, Level 1, Body small, optional text button on the right. Auto-dismiss 4s.
- **Banners** (storage warning, notices): full content width under the app bar, 44px min-height, 16px horizontal padding, icon + text + optional text button + dismiss X. Color pairs: `warning-subtle`/`warning`, `error-subtle`/`error`, `accent-subtle`/`accent`.

## 5. Navigation

Flat, three destinations, no top-level link list.
- Logo → Dashboard.
- Dashboard "Add course" → Input.
- Input (when ≥1 course exists) shows a "Back to dashboard" ghost button with chevron-left at the top-left of the content area, 24px below the app bar.
- Player View app bar replaces the wordmark with: chevron-left icon button (36×36, "Back to dashboard"), a 1px 20px-high vertical divider, and the course title (Body small 500, single line, truncated, max 480px). Right side: ⋮ course menu button (36×36), theme toggle, avatar.
- **Course menu (⋮), Level 1, 220px:** "Course info", "Refresh playlist", "Back to dashboard", divider, "Remove course" in `error` color with trash-2 icon. (Placed in the app bar, not over the iframe, so it never collides with YouTube's own overlay controls.)
- No breadcrumbs, no tabs at the app-bar level, no footer.

---

## 6. Input View

### Layout
- Route `/`. Viewport-height layout: app bar, then a flex column that centers its content horizontally and places it optically at ~38% of the remaining height (padding-bottom 8vh).
- Content column width 640px max (100% minus 32px gutters below 704px).
- Order, top to bottom, all center-aligned:
  1. Heading: "Enter your playlist link", Display L, `text-primary`.
  2. 24px gap.
  3. URL input field (hero size).
  4. 12px gap.
  5. Helper line: "Turn it into a course", Body small, `text-secondary`.
  6. Inline status/error area (reserved 40px min-height so layout does not jump).
- Footer line pinned 24px above the bottom edge: lock icon (16) + "Courses and notes are saved in this browser only. No account needed." Caption, `text-muted`, centered.
- No illustration, no feature list, no sample courses, no marketing sections. Background is flat `bg-canvas`.

### Components
- **Hero URL input:** height 56px, width 100%, background `bg-surface`, 1px `border-default`, radius 12. Left padding 16, leading `link` icon 20px `text-muted`, 12px gap to text. Text Body 15/24 `text-primary`. Placeholder "https://www.youtube.com/playlist?list=…" in `text-muted`. Right padding 8.
- **Submit button (inside input, right end):** 40×40, radius 8, `accent` fill, `on-accent` arrow-right icon 20px. Positioned 8px from the right edge, vertically centered. Accessible name "Add playlist".
- Input autofocuses on load. Enter submits.
- Accepted-format hint is not shown by default; it appears only inside the invalid-URL error message.

### States
| State | Appearance |
|---|---|
| Default | As above. Submit button disabled while input is empty: `bg-hover` fill, `text-muted` icon, no pointer cursor. |
| Hover (input) | Border `border-strong`. |
| Focus | Border `accent` 1px + 2px `accent` outline offset 2px. |
| Filled | Submit button becomes `accent`. |
| Loading | Input becomes read-only, text `text-secondary`. Submit button shows a 20px spinner (2px stroke, `on-accent`) instead of the arrow. Below the input, replacing the helper line: a 4px-high full-input-width progress bar (`accent` fill on `border-default` track, radius 999) and beneath it, Body small `text-secondary`: "Fetching playlist… 50 / 431 videos" with a "Cancel" text button (`accent`) right-aligned on the same row. Text is `aria-live="polite"`. |
| Error | Input border becomes 1px `error` (focus ring also `error`). A 20px alert-circle icon `error` replaces the leading link icon. Message beneath, left-aligned to the input, Body small `error`. |
| Duplicate playlist | `accent-subtle` inline notice under the input (radius 8, 12px padding, info icon): "This playlist is already in your courses. Opening it now." Then navigate to the existing course after 1.2s. |
| Success | Navigate immediately to Player View at video 1 (or last watched if it exists). No success screen. |

**Error copy (exact):**
- Invalid URL: "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=…"
- No playlist ID: "This link has no playlist in it. Open the playlist on YouTube and copy its link."
- Not found or private: "We couldn't find this playlist. It may be private or deleted."
- Network/API failure: "Couldn't reach YouTube. Check your connection and try again." (with "Try again" text button)
- Quota exceeded: "YouTube's daily limit has been reached. Try again tomorrow."
- Empty playlist: "This playlist has no playable videos."
- Storage full: "Not enough browser storage to save this course. Remove a course and try again."

### Interactions
- Paste into the field triggers no auto-submit; user presses Enter or the arrow button.
- Clearing text after an error removes the error immediately.
- Failed fetch saves nothing; the field keeps the URL so the user can retry.

---

## 7. Dashboard

### Layout
Route `/dashboard`. Container max-width 1240, gutters 32/24/16. Vertical order:
1. **Page header** (48px top padding): left, greeting "Welcome back, {name}" in Display M (falls back to "Welcome back"); right, primary button "Add course" (plus icon, 40px height, `accent`). Both baseline-aligned to the bottom of the header row.
2. **Continue learning banner** (32px below header).
3. **Your courses** section (48px below): Heading "Your courses" left, sort dropdown right, 16px gap, then the card grid.
4. **Activity section** (48px below the grid): two columns at ≥1024px: "Recent notes" (8/12 width) and "Learning stats" (4/12 width), 48px column gap. Stacked on smaller screens (notes first, stats second).
5. 64px bottom padding.

First-run name prompt: a small dialog (width 400, Level 2, radius 16) on first Dashboard visit: title "What should we call you?" (Heading), one input (40px), "Save" primary button and "Skip" ghost button. Editable later from the avatar menu.

### Course Cards
- Grid columns: ≥1200px 4 columns; 900–1199px 3; 600–899px 2; <600px 1. Equal-height cards. Gap 24px.
- Card: `bg-surface`, 1px `border-default`, radius 12, overflow hidden, whole card clickable (opens last watched video, or video 1). No shadow at rest.
- **Thumbnail:** top of the card, full card width, 16:9, no padding, `player-black` fallback. Overlays: bottom-right chip "31 videos" (Caption, white text on `rgba(0,0,0,0.72)`, radius 4, 4×8 padding, 8px inset). If completed: top-left chip with check icon and "Completed" (Caption 500, `success` text on `success-subtle`, radius 4, 4×8 padding, 8px inset).
- **Body (padding 16, gap 8 between blocks):**
  1. Title: Card title, 2-line clamp, `text-primary`.
  2. Channel name: Caption, `text-muted`, one line.
  3. Stats row: two items separated by 16px gap (not dots): "12 / 31 videos" and "5h 10m" — Body small `text-secondary`, clock icon 16px before the duration.
  4. Progress: 4px bar (radius 999) full width; right of the bar, "39%" Caption 500 `text-secondary`, 8px gap. Bar and percent on one line.
  5. Last watched: Caption `text-muted`, one line truncated: "Last watched: 12. Virtual memory: page tables and the TLB". Omitted when unstarted.
  6. **Action button** (12px above, full width, height 36, radius 8, 1px `border-default`, `bg-surface`, Body small 500 `text-primary`, play icon 16 before label): "Continue learning". Label variants: unstarted "Start learning", completed "Rewatch". On card hover this button's border becomes `accent` and text `accent`.
- **Overflow menu (⋮):** 32×32 icon button at the top-right of the body, aligned with the title, Level 1 menu, 200px: "Open", "Reset progress", divider, "Remove course" (`error`). Reset and Remove open confirmation dialogs (Section 10).
- **Add course tile:** last grid cell, same height as the cards, 1px dashed `border-strong`, radius 12, transparent background, centered plus icon (24, `text-secondary`) above "Add course" (Body small 500 `text-secondary`). Hover: border `accent`, text and icon `accent`, background `accent-subtle`.
- Hover (card): border `border-strong`; light theme adds Level 1 shadow. Focus: 2px `accent` outline, offset 2px.

### Continue Learning
- Shown when at least one course has been watched. Uses the most recently watched course. Full container width, `bg-surface`, 1px `border-default`, radius 12, padding 16, flex row gap 20 (stacks vertically below 720px).
- Left: thumbnail of the last watched video 16:9, 280px wide (full width when stacked), radius 8, with a 4px progress line along its bottom edge showing that video's watched fraction (`accent` on `rgba(255,255,255,0.3)`).
- Right, vertical stack, space-between:
  - Caption `text-muted`: "Last watched 2 hours ago"
  - Card title (18/26 override to Heading size): course title, one line truncated.
  - Body `text-secondary`, 2-line clamp: "12. Virtual memory: page tables and the TLB"
  - Row: 6px progress bar (flex 1) + Caption "12 of 31 videos" left below the bar and "39%" right.
  - Button "Resume" (primary, 44px, play icon, right-aligned; full width on mobile).
- Banner is not otherwise clickable, so it has exactly one action.

### Progress
- Same progress bar component everywhere: track `border-default`, fill `accent`, fill `success` at 100%, radius 999, fill width animates 300ms ease-out. Heights: 4px (cards, sidebar row-level), 6px (banner, sidebar header).
- Percent is rounded to the nearest integer and always shown with `%`.
- Numbers use the format "12 / 31 videos" (cards) and "12 of 31 videos" (banner caption).

### Empty State
Shown when there are zero courses (e.g., after removing the last one). Replaces sections 2–4 below the header. The header shows "Welcome back" and hides the "Add course" button (the empty state has its own).
- Container: centered, max-width 480, 96px top padding, no card.
- Icon composition: 72px single-color line glyph in `text-muted` (three stacked horizontal lines with a play triangle at the left of the top line), inside a 96px circle with 1px `border-default`. No fills, no color, no extra decoration.
- Heading "No courses yet" (Heading), 16px below.
- Body `text-secondary`, centered, max 360 wide: "Paste a YouTube playlist link and it becomes a course with progress, notes, and a resume point."
- Primary button "Add your first course" (48px, plus icon), 24px below.
- Recent notes and Learning stats are hidden.

### Sorting
- Dropdown trigger: height 36, radius 8, 1px `border-default`, `bg-surface`, Body small; label "Sort: Recently watched" with chevron-down 16. Right-aligned in the section header row.
- Menu (Level 1, 220px): "Recently watched" (default), "Recently added", "Progress", "Title". Selected item has `accent-subtle` background and a check icon at the right. Selection persists locally.

### Recent notes and Learning stats
- **Recent notes:** Heading "Recent notes". Up to 4 rows, flat (no card), each row 16px vertical padding, 1px `border-default` divider between rows, whole row clickable (opens that video with the notes field focused). Row content: note snippet (Body, `text-primary`, 2-line clamp); below, Caption `text-muted`: "{Course title}, video {n}" left and relative date ("2 days ago") right. Hover: `bg-hover` with 8px radius and −8px horizontal bleed. Empty: Body small `text-muted` "Notes you write while watching appear here."
- **Learning stats:** Heading "Learning stats". Four stats in a 2×2 grid, hairline dividers between (1px `border-default`), no card, no icons. Each: Stat number (`text-primary`) with Caption `text-muted` label below: "hours watched", "videos completed", "courses completed", "day streak". Cell padding 16 vertical.

### Responsive Behavior
- ≥1200: 4-column grid, banner horizontal, activity two columns.
- 900–1199: 3-column grid, activity two columns.
- 600–899: 2-column grid, activity stacked, banner horizontal until 720 then stacked.
- <600: 1-column grid (gap 16), header stacks (greeting Display M mobile size, "Add course" becomes a full-width 44px button beneath it), banner stacked with full-width Resume button, sort dropdown stays right-aligned.
- Thumbnails always keep 16:9.

---

## 8. Player View

### Overall Layout
Route `/course/:courseId?v=:videoId`. Full-bleed, no centered container.

**Desktop (≥1024px):** a two-column CSS grid directly under the 56px app bar: `[main: 1fr] [sidebar: clamp(340px, 28vw, 440px)]`. At 1440px wide this is ~1037px main / 403px sidebar (72 / 28). Both columns are exactly viewport height minus 56px.
- **Main column:** scrolls vertically on its own (custom 8px scrollbar, thumb `border-strong`, transparent track).
- **Sidebar:** `bg-surface`, 1px left border `border-default`, its own internal scroll for the list; header stays fixed at its top.
- Main column background is `bg-canvas`, but the player region behind the video is `player-black` and spans the full column width.

```
┌─ app bar 56 ─────────────────────────────────────────────┐
├───────────────────────────────────────────┬──────────────┤
│ player-black band, video 16:9, flush      │ Sidebar hdr  │
│ (max height = 100vh − 56 − 132)           │  progress    │
├───────────────────────────────────────────┤  watch time  │
│ Title / meta / prev-next-complete         │  bar, toggles│
│ ───────────────────────────────────────── ├──────────────┤
│ Description (3 lines, Show more)          │ 1 Row        │
│ ───────────────────────────────────────── │ 2 Row        │
│ Notes box                                 │ 3 Current ▎  │
│                                           │ … (scrolls)  │
└───────────────────────────────────────────┴──────────────┘
```

### Video Player
- Container spans the entire main column width, starts at the app bar's bottom edge, touches the left edge of the viewport. Background `player-black`.
- The YouTube iframe is 16:9, uses the full column width; its height is capped at `100vh − 56px − 132px` (minimum 360px). When the cap applies (very wide or short windows), the video is centered horizontally inside the black band, which still spans the column.
- Native YouTube controls stay on. No custom overlay UI on top of the iframe.
- **Error panel (embed-restricted, deleted, private)** replaces the iframe inside the same 16:9 black area: centered column, 40px alert-circle icon in `#B0B7C4`; title "This video can't be played here" (Heading, `#E9ECF1`); body Body small `#B0B7C4`, max 420 wide: "The owner may have disabled embedding, or the video is private or deleted."; two buttons in a row, 12px gap: "Open on YouTube" (outline style: transparent background, 1px border of white at 40% opacity, white text, external-link icon, 40px height) and "Skip to next video" (`accent` dark-theme fill `#7BA0FF`, `#0E1526` text, 40px).
- Loading: black area with a centered 32px spinner (2px stroke, `#B0B7C4`).

### Video Information
Below the player, inside the main column, content wrapper: padding 24px 32px 0, max-width 824px (so text is ≤760 wide after padding), left-aligned to the player's left edge plus 32px.
1. **Title row:** Title style (22/30 600), max 2 lines. Beneath it, 8px gap, a meta row: Caption `text-muted` "Video 12 of 31" and, 16px right, clock icon + "14:32". On the right side of the whole block (aligned to the title's top, wrapping below the title under 1280px main-width), an action cluster with 8px gaps:
   - Previous video: 40×40 icon button (chevron-left), 1px `border-default`, radius 8, `bg-surface`. Disabled on video 1.
   - Next video: 40×40 icon button (chevron-right), same style. Disabled on the last video.
   - **Mark complete:** 40px height, radius 8, 16px horizontal padding, check icon 20 + "Mark complete", 1px `border-strong`, `text-primary`. When complete: `success-subtle` background, `success` text and border, label "Completed". Hover on completed: label "Mark incomplete".
2. **Description:** 24px below, separated by a 1px `border-default` top divider with 24px padding above it. Body, `text-secondary`, clamped to 3 lines; "Show more" text button (Body small 500, `accent`) directly below; expands in place with 200ms height transition to full text and changes to "Show less". URLs are `accent` and open in a new tab. Timestamps like `12:34` in the text render as `accent` tabular links with radius 4 and `accent-subtle` background on hover, and seek the player when clicked.

### Notes
- 24px below the description, 1px `border-default` top divider, 24px padding above, 64px bottom padding on the column.
- Section header row: Heading "Notes" left; right side, status Caption `text-muted`: "Saved" with a 14px check icon (`success`), or "Saving…" while debouncing. Reserved width so the header does not shift.
- **Empty state:** a 96px-min-height box, `bg-surface`, 1px dashed `border-strong`, radius 8, padding 16, sticky-note icon 20 `text-muted` at top-left, text "Click to add note" in Body `text-muted` beside it. Hover: border solid `accent`, text `text-secondary`. Entire box is one button.
- **Editing:** on click or focus the box becomes a solid 1px `border-default` `bg-surface` textarea, radius 8, padding 16, Body 15/24 `text-primary`, min-height 160px, auto-grows to a max of 480px then scrolls. Focus: 1px `accent` border + 2px `accent` outline offset 2px.
- **Toolbar** under the textarea, 8px gap, 40px tall row: left, "Insert timestamp" ghost button (clock icon 16 + current player time in tabular figures, e.g. "Insert 12:34", 32px height, radius 8, Body small `text-secondary`); nothing on the right.
- Inserted timestamps in notes render as `accent` text with `accent-subtle` background, radius 4, 2×6 padding, tabular figures, clickable.
- Videos with a saved note show a sticky-note icon in their sidebar row.

### Playlist Sidebar
Structure: fixed header (never scrolls away) and a scrolling list below.

### Progress Header
Padding 16, bottom border 1px `border-default`, `bg-surface`. Contents in order (gap 12):
1. **Progress row:** left, Body small `text-secondary` "Progress"; right, Body small 500 `text-primary` tabular "12 / 31". Right of that, 8px gap, Caption `text-muted` "39%".
2. **Watch time row:** left "Watch time" (same style); right "2h 05m / 5h 10m".
3. **Progress bar:** 6px, radius 999, `accent` fill, animates 300ms.
4. **Controls row (32px):** left, switch "Autoplay next" (36×20 switch, on = `accent`, Body small `text-secondary`); right, text-toggle button "Hide completed" (eye-off icon 16 + label, Body small 500, `text-secondary`; when active: `accent` text and `accent-subtle` background, radius 8).
When the course is complete: the bar is `success`; the Progress row reads "31 / 31" with a `success` check icon before it and the Controls row stays.

### Playlist Items
- Row height fixed at 56px (mobile 60px) for every row, so lists of 400+ virtualize cleanly. Rows are inset 8px from the sidebar edges, radius 8, no dividers, no borders.
- Row columns, left to right, padding 0 8px 0 12px, vertical center:
  1. **Index:** 28px wide, right-aligned, Caption tabular `text-muted` ("1" … "431"; supports 3 digits).
  2. 8px gap.
  3. **Title:** flex 1, Body small 14/20, 2-line clamp with ellipsis, `text-primary`.
  4. 12px gap.
  5. **Duration:** 44px wide, right-aligned, Caption tabular `text-muted` ("14:32", "1:02:10"). If the video has a note, a 14px sticky-note icon (`text-muted`) sits left of the duration, 4px gap.
  6. 8px gap.
  7. **Checkbox:** visual 20×20, radius 4, 1.5px `border-strong` outline, `bg-surface`; inside a 32×32 hit area (44×44 on touch). Checked: `success` fill and border, white check icon 14px.
- Default row: transparent. Hover: `bg-hover`. Pressed: `bg-hover` at 100% with title `text-primary`. Focus-visible: 2px `accent` outline, offset −2px (inside the row).
- Clicking the row loads the video; clicking the checkbox toggles completion only, without changing the current video.
- **Jump to current pill:** when the current row is scrolled out of view, a pill appears 16px above the list's bottom edge, horizontally centered: 32px height, radius 999, `bg-elevated`, Level 1, Body small 500 `text-primary`, label "Current video" with arrow-up or arrow-down (16) depending on direction. Click smooth-scrolls (200ms) to place the current row in the vertical center.
- **On load and video change,** the current row scrolls into the vertical center of the list (instant on load, smooth on change).
- **Hide completed active:** each consecutive run of completed rows collapses into one 40px summary row (Caption `text-muted`, chevron-right icon, e.g. "Videos 1–11 completed (11)"); clicking expands that run inline. The current row is never hidden.
- **Unavailable videos:** row title in `text-muted`, an alert-triangle icon (16, `warning`) replaces the checkbox, duration replaced by Caption "Unavailable". Not clickable for playback, but focusable; excluded from totals.
- **Scrollbar:** 8px wide, thumb `border-strong`, radius 999, appears on hover of the sidebar.
- **Keyboard:** Up/Down moves focus between rows, Enter loads the video, Space toggles the checkbox of the focused row.

### Current Video
- Row background `accent-subtle`; a 3px-wide `accent` bar at the row's left edge (24px tall, vertically centered, radius 2, sitting flush with the row's left edge); index replaced by a 14px "playing" glyph (three static vertical bars) in `accent`; title weight 600, `text-primary`; duration `text-secondary`.
- Hover on the current row keeps `accent-subtle` (no hover change).
- `aria-current="true"`.

### Completed Video
- Checkbox checked (`success`). Title switches to `text-secondary`, weight stays 400, no strikethrough. Index stays `text-muted`. Row background unchanged. This keeps completed rows visibly quieter than incomplete ones without drawing attention.
- A completed row that is also current follows the Current Video style, with the green checkbox retained.

### Responsive Behavior (Player View)
See Section 11. Summary: below 1024px the sidebar dissolves into a tab set beneath a pinned player.

---

## 9. Course Completion

Triggered when the last incomplete video is marked complete (manually or automatically). Un-completing any video removes the completed state.

- **Dialog:** centered, width 480 (mobile: full width minus 32, bottom-aligned as a sheet with 16px top radius), `bg-elevated`, radius 16, Level 2, padding 32, over `scrim`. Focus moves to the primary button; Esc closes.
- Content, center-aligned, top to bottom:
  1. 56px circle, `success-subtle` fill, `success` check icon 28px. (No confetti by default. If confetti is implemented, a single 1.2s burst in `success` and `accent` tints, disabled when reduced motion is on.)
  2. 20px gap. "Course complete" in Display S.
  3. 8px gap. Course title: Body, `text-secondary`, max 2 lines.
  4. 24px gap. Three stat columns, hairline dividers between them: "31" / "videos", "5h 10m" / "total time" (Stat number, Caption label `text-muted`). Third column: "100%" / "completed".
  5. 32px gap. Two buttons stacked on mobile, side by side on desktop, 12px gap, each 44px: "Back to dashboard" (primary, `accent`) and "Rewatch" (secondary: 1px `border-strong`, `bg-surface`, `text-primary`).
- After closing the dialog, the Player View shows the sidebar header in its complete state (Section 8: green bar, check before "31 / 31").
- On the Dashboard the course card shows the "Completed" thumbnail chip, a `success` progress bar at 100%, and the action button labelled "Rewatch". "Rewatch" resets completion flags but not notes and returns to video 1.

---

## 10. Component States

### Buttons
Heights: small 32, medium 40 (default), large 44/48. Radius 8. Body small 500. Icon 20 with 8px gap to label. Horizontal padding 16 (small 12).

| Variant | Default | Hover | Active/Pressed | Focus | Disabled | Loading |
|---|---|---|---|---|---|---|
| Primary | `accent` fill, `on-accent` text | `accent-hover` | `accent-pressed` | 2px `accent` outline, offset 2px | `bg-hover` fill, `text-muted` text | Label replaced by 20px spinner, width preserved |
| Secondary | `bg-surface`, 1px `border-strong`, `text-primary` | `bg-hover` | `bg-hover` + border `text-muted` | same | 50% opacity, no hover | spinner in `text-secondary` |
| Ghost | transparent, `text-secondary` | `bg-hover`, `text-primary` | `bg-hover` | same | 50% opacity | — |
| Destructive | `error` fill; text white in light theme, `#2A0F0C` in dark theme | 8% darker | 14% darker | outline `error` | as primary disabled | spinner |
| Icon button | 36×36 (40×40 in Player actions), transparent, `text-secondary` | `bg-hover` | `bg-hover` | outline `accent` | 40% opacity | — |

### Inputs (standard, 40px height)
`bg-surface`, 1px `border-default`, radius 8, padding 0 12, Body small. Hover: `border-strong`. Focus: 1px `accent` border + 2px `accent` outline offset 2px. Error: 1px `error` border, message Caption `error` 4px below. Disabled: `bg-hover`, `text-muted`. Hero input variant is defined in Section 6.

### Checkbox / Switch
- Checkbox: unchecked 1.5px `border-strong`; hover border `text-secondary`; checked `success`; focus outline `accent` offset 2px; disabled 40% opacity.
- Switch: 36×20, off `border-strong` track, on `accent` track, white 16px thumb; focus outline `accent`.

### Menus and dropdowns
Level 1, radius 8, padding 4. Items 36px high, 12px horizontal padding, Body small, radius 4. Hover `bg-hover`. Selected `accent-subtle`. Destructive item `error` text. Focus ring inside item.

### Dialogs (confirmations)
Width 420, radius 16, Level 2, padding 24. Title Heading, body Body `text-secondary`, actions right-aligned 12px gap, 40px buttons.
- **Remove course:** title "Remove this course?"; body "Progress and notes for “{course title}” will be deleted from this browser. This can't be undone."; buttons "Cancel" (secondary), "Remove course" (destructive).
- **Reset progress:** title "Reset progress?"; body "All completed videos and resume positions for “{course title}” will be cleared. Your notes are kept."; buttons "Cancel", "Reset progress" (destructive).

### Loading
- Skeleton blocks: `bg-hover` fill, radius matching the real element, opacity pulsing 60%→100% over 1.2s (static at 80% with reduced motion). No shimmer gradients.
- Dashboard load: header text real, 4 card skeletons (thumbnail block + 3 text lines + button block).
- Player load: player-black area with spinner; sidebar header numbers real if cached; 10 skeleton rows (56px each, 20px index block, two text lines of 70% and 40% width).
- Adding a playlist: see Section 6.

### Error
- Inline field errors as in Section 6.
- Storage-quota banner (`warning`): "Storage is almost full. Remove a course to keep saving your progress." with "Manage courses" text button.
- 404 (missing course/video): centered on `bg-canvas`, 96px top padding, alert-circle 40 `text-muted`, Heading "We couldn't find that course", Body `text-secondary` "It may have been removed from this browser.", primary button "Back to dashboard".
- Corrupted-data recovery toast: "Some saved data couldn't be read and was skipped."

### Empty
- Dashboard: Section 7 pattern (line glyph in bordered circle, heading, one sentence, one primary button). The same pattern, at 48px glyph size and without the button, is used for empty notes list and Hide-completed-with-nothing-left ("Nothing left to hide/watch: all videos completed").
- Notes (in Player): dashed "Click to add note" box.

### Focus (global)
Every interactive element shows a 2px `accent` outline with 2px offset on keyboard focus (`:focus-visible` only). Inside rows and menu items where clipping would occur, offset is −2px (inside).

---

## 11. Responsive Design

Breakpoints: Mobile <640, Tablet 640–1023, Desktop ≥1024 (large ≥1600).

### Desktop
- **≥1024px:** Player View as in Section 8. Sidebar width = `clamp(340px, 28vw, 440px)`.
- **1024–1279px:** description/notes wrapper padding 24px instead of 32px; action cluster wraps below the title (title full-width, buttons in a row beneath).
- **≥1600px:** video max height cap still applies; content wrapper stays left-aligned at 824px max width; the empty space to its right in the main column stays `bg-canvas`.
- Input and Dashboard as in Sections 6 and 7.

### Tablet
- **Landscape (1024+):** treated as desktop.
- **Portrait/small (640–1023px):** single column. Sidebar is removed as a column.
  - App bar 56px (scrolls away with the page).
  - **Player pinned:** the player sits full-width edge-to-edge (16:9, up to 834×469), `position: sticky; top: 0`, and stays visible while the rest scrolls beneath it.
  - Below the player (scrolling), in order: title row (Title 22/30; Prev, Next, Mark complete cluster below the title, 40px buttons), then the **Progress strip**: 48px high, `bg-surface`, top and bottom 1px `border-default`, padding 0 24; contents in a row: "12 / 31 videos" (Body small 500), a 6px progress bar (flex 1, 12px horizontal margins), "39%" (Body small 500).
  - **Tab bar** directly below the strip, sticky beneath the pinned player (`top` = player height): 48px high, `bg-canvas`, bottom 1px `border-default`, three tabs equally spaced, left-aligned text: "Videos" (with count "31" in `text-muted`), "Notes", "About" (description). Active tab: `text-primary` 600 with a 2px `accent` underline; inactive `text-secondary`. Default active tab: Videos.
  - **Videos tab:** header block (Watch time row, Autoplay switch, Hide completed toggle) then the list, using page scroll (not an inner scrollbar). Row height 60px, checkbox hit area 44×44. Content max-width 720px, centered.
  - **Notes tab:** Notes section identical to desktop, full width with 24px gutters; textarea min-height 200px.
  - **About tab:** description expanded by default.
  - Gutters 24px.

### Mobile
- **<640px:** same information architecture as tablet portrait with these changes.
  - App bar 48px: chevron-left, course title (Body small 500, truncated), ⋮ menu. Theme toggle and avatar move into the ⋮ menu.
  - Player pinned edge-to-edge at 390×219; the app bar scrolls away, the player sticks at the top of the viewport.
  - Title style at mobile size (20/28). Action cluster: Prev and Next 44×44 icon buttons and a flex-1 "Mark complete" button 44px high, one row.
  - Progress strip: 44px high, gutters 16px, same three elements.
  - Tab bar 44px high, sticky under the player. Tabs: "Videos", "Notes", "About". Default tab: Videos.
  - Videos tab rows 60px, index column 24px, duration column 40px, checkbox hit area 44×44. Header controls stack: Autoplay switch row, then Hide completed row, each 44px high.
  - "Jump to current" pill sits 16px above the bottom safe-area edge.
  - Dialogs become bottom sheets (Section 9). Menus become bottom sheets with 48px rows.
  - Notes tab: textarea sticks above the keyboard; toolbar buttons 44px.
- **Why a pinned player with tabs:** on phones the person must keep the video visible while scrolling 400+ rows or writing a note; a drawer would hide the list and a stacked layout would push the list below the fold.

---

## 12. Accessibility

- Contrast: text ≥4.5:1, UI boundaries and icons ≥3:1 against their backgrounds in both themes. `text-muted` on `bg-surface` measures ≥4.6:1 in both themes.
- Visible keyboard focus on every interactive element (Section 10).
- Touch targets ≥44×44 on mobile and tablet; ≥32×32 on desktop.
- Semantics: playlist rendered as a list; current row `aria-current="true"`; each row checkbox labelled "Mark {video title} complete" / "Mark {video title} incomplete"; "Saved" indicator and fetch progress use `aria-live="polite"`; dialogs trap focus and restore it on close; icon-only buttons have accessible names (e.g., "Previous video", "Next video", "Course menu", "Toggle theme", "Add playlist").
- Status is never conveyed by color alone: completed = check icon + green; current = playing glyph + accent bar + bolder weight; error = alert icon + text.
- Reduced motion: disable skeleton pulse, progress fill animation, smooth scroll, confetti; use instant transitions.
- Do not rely on hover; every hover-only affordance (row hover, Hide completed) also works via focus.
- Text can scale to 200% without loss: row heights grow, the 56px fixed height is a minimum when zoomed text is detected.

---

## 13. Final Screen Composition

Use this sample content to populate the screens.

**Sample profile:** name "Asha".
**Sample course (Player):** "Operating Systems Fundamentals" by Northfield CS. 31 videos, 5h 10m total. Progress 12 / 31 (39%), watch time 2h 05m / 5h 10m. Current video 12: "Virtual memory: page tables and the TLB" (14:32). Description: 4 lines about address translation, with one URL and a "12:34" timestamp. Note text: "Page table = one entry per virtual page. TLB caches recent translations, so misses are expensive. Revisit at 12:34." Completed videos: 1–11 (video 7 and 9 have notes).
**Sidebar rows visible (approximate):** 8 "Processes and the process table" 11:20 ✓; 9 "Context switching in practice" 9:48 ✓ (note); 10 "CPU scheduling: FIFO, SJF, round robin" 18:05 ✓; 11 "Multi-level feedback queues" 12:41 ✓; 12 current; 13 "Segmentation and paging compared" 16:27; 14 "Page replacement algorithms" 13:59; 15 "Thrashing and working sets" 8:33; 16 "Concurrency: threads vs processes" 15:02; 17 "Locks and mutual exclusion" 17:44.

### Input
- **Desktop 1440×900, dark:** `bg-canvas` `#171B22`. App bar with logo left, sun icon and avatar right. Centered stack at ~38% height: "Enter your playlist link" (Display L, serif, `#E9ECF1`), 56px URL input 640 wide with the blue arrow button inside its right end and placeholder "https://www.youtube.com/playlist?list=…", helper "Turn it into a course" beneath. Footer: lock icon and privacy sentence at the bottom.
- **Mobile 390×844, light:** app bar 48, heading Display L mobile size wrapping onto two lines, input full width minus 32, helper line, privacy footer above the bottom safe area.
- Also generate: loading state (progress bar + "Fetching playlist… 50 / 431 videos" + Cancel) and error state ("That doesn't look like a YouTube link…").

### Dashboard
- **Desktop 1440×900, light:** Header row with "Welcome back, Asha" (serif) and "Add course" primary button at the right. Continue learning banner (thumbnail left, course title, "12. Virtual memory: page tables and the TLB", 39% bar, "Resume" button). "Your courses" with sort dropdown; 4-column grid with 6 cards + Add course tile: Operating Systems Fundamentals (12 / 31, 39%), Learn Rust from Scratch (52 / 431, 12%, 64h 20m), Organic Chemistry I (40 / 40, 100%, Completed chip, "Rewatch"), Spanish for Travelers (0 / 24, "Start learning"), Linear Algebra Review (9 / 18, 50%), Intro to Type Design (3 / 12, 25%). Below: Recent notes (3 rows) left, Learning stats (2×2) right.
- **Mobile 390×844, dark:** stacked header, full-width "Add course" button, banner stacked, single-column cards.
- Also generate: empty state and skeleton loading state.

### Player
- **Desktop 1440×900, dark (hero screen):** App bar with back chevron, "Operating Systems Fundamentals" and ⋮ menu at right. Video flush top-left, ~1037×583, black. Below: title "Virtual memory: page tables and the TLB", meta "Video 12 of 31" and "14:32", Prev/Next buttons and "Mark complete". Divider, description (3 lines + "Show more"), divider, Notes with the sample note in edit state and "Saved" indicator. Sidebar (~403px wide): header with "Progress 12 / 31 39%", "Watch time 2h 05m / 5h 10m", 6px blue bar, "Autoplay next" switch, "Hide completed" toggle; rows 8–17 with green checkboxes on 8–11, row 12 highlighted with accent-subtle background, accent left bar and playing glyph.
- **Tablet 834×1194, light:** player pinned at top full-width, title and actions, progress strip, tab bar with Videos active, list of rows.
- **Mobile 390×844, dark:** compact 48px bar scrolled away, pinned 390×219 player, title, Prev/Next/Mark complete row, progress strip, tab bar (Videos active), list rows 60px high with 44px checkboxes.
- Also generate: Notes tab on mobile with keyboard-safe toolbar; player error panel; course-complete dialog over the Player.

**Cross-screen consistency check (Stitch must verify before finishing):** same app bar on all three screens; serif used only for the three named display headings; blue appears only on primary actions, progress, links, current row and focus; green only on completion; radii follow the 4/8/12/16/999 scale; progress bars are the same component on Dashboard and Player; no shadows on resting cards.

---

## Mobbin Research References

**Status: not verified against Mobbin.** The Mobbin MCP returned "requires a paid plan" on every query (search_screens, twice), so no screenshots were reviewed. The entries below are established, widely shipped patterns recalled from general knowledge of the products; each one is labeled by what it contributed. Replace or confirm these with Mobbin screen links once access is available.

### Reference 1
Product: Udemy (web course player)
Screen: Lesson player with curriculum sidebar
Pattern: Video flush against the top and left with a curriculum panel on the right; lesson rows with a completion checkbox and duration.
How Courseify adapts it: 72 / 28 split, edge-to-edge black player, right sidebar with checkbox rows. Courseify removes the tab strip and promo content, and puts progress numbers in a fixed sidebar header.

### Reference 2
Product: YouTube (theater mode + playlist panel; mobile app)
Screen: Watch page with playlist; mobile watch page
Pattern: Playlist panel with the current item highlighted; on mobile the player stays pinned while the list scrolls beneath; a thin resume bar on thumbnails.
How Courseify adapts it: pinned player on tablet/mobile with a sticky tab bar; resume bar on the Continue banner thumbnail; native YouTube controls untouched.

### Reference 3
Product: Spotify (web player, playlist view)
Screen: Track list
Pattern: The playing item replaces its row number with an animated glyph; dense rows with tabular durations.
How Courseify adapts it: current row replaces its index with a static "playing" glyph plus accent tint and left bar; 56px fixed rows with right-aligned tabular durations.

### Reference 4
Product: Linear (issue lists)
Screen: Dense list with hover and keyboard navigation
Pattern: Borderless rows separated only by hover/selected backgrounds; full keyboard traversal.
How Courseify adapts it: no dividers in the playlist, rounded row highlight inset 8px, Up/Down/Enter/Space keyboard model, collapsed runs for long lists.

### Reference 5
Product: Coursera (course lecture navigation)
Screen: Lecture list with completion checkmarks
Pattern: Completed items are quieter than incomplete items rather than struck through.
How Courseify adapts it: completed rows use `text-secondary` and a green checkbox, not strikethrough or dimming.

### Reference 6
Product: Notion (empty block/notes placeholder)
Screen: Empty page/block placeholder
Pattern: An empty writing area that becomes an editor on click, with inline save feedback.
How Courseify adapts it: dashed "Click to add note" box that turns into an auto-growing textarea with a "Saved" indicator.
