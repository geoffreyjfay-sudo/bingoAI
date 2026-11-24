# Decades Bingo

Music bingo for a live event ("Geoff & David's Decades Bingo Bash"). Four games, one per decade
(1970s, 1980s, 1990s, 2000s), each with a pool of 50 songs. Players mark song titles on a 5×5 card
(centre square FREE) as the host plays tracks.

Plain static HTML/CSS/JS — no build step, no package manager, no tests. Serve the folder (the
`static` config in `.claude/launch.json` runs `python3 -m http.server 8780`) and open the pages.

## Pages

| File | Who uses it | What it does |
|---|---|---|
| `bingo.html` + `bingo.css` | Host, before the event | Generates 50 printable A4 pages × 4 cards (200 cards), one per decade per page, each with a card number and checksum. Ends with a report page: duplicate checksums, song usage counts, unused songs, Chart.js bar chart. Print to PDF. |
| `index.html` + `bingoplay.css` | Players, on their phones | Digital card. Pick a decade, get a random 24-song card, tap to mark. State kept in `localStorage` (`bingoState_1970s` etc., plus `bingoLastDecade` so a reload resumes the decade the player was on). |
| `livelist.html` + `styleslist.css` | Host, during the event | Shuffled running order per decade with links to Apple Music. Clicking a link/checkbox marks the song played (locked). "Next Random Song" highlights an unplayed track. State in `localStorage` (`bingoState_songs70` etc.): the running order as titles plus marked titles. Links are looked up from the loaded list at render time, so both live list pages share one game. Older saves holding `[title, link]` pairs are converted on load. |
| `livelist_spot.html` | Host | Same as `livelist.html` but loads Spotify links (`list_links_spot.js`). |
| `checklist.html` | Host | Printable A4-landscape tick-list of all songs per decade. |

## Data files

- `song_arrays.js` — `songs70/80/90/00` as plain title arrays. Used by `bingo.html`, `index.html` and `checklist.html`.
- `list_links.js` — same songs as `[title, appleMusicUrl]` pairs.
- `list_links_spot.js` — same songs as `[title, spotifyUrl]` pairs.

**Song titles must match exactly across all three files** (checksums and marking compare raw
strings, including curly vs straight apostrophes). Edit all three together when changing a song.

## Checksum

`titleValue(title)` = sum of char codes. Card checksum = Σ `titleValue(song) × position`, with
positions 1–25 across the grid and position 13 (FREE) skipped. Used to verify a winning card —
`bingo.html` and `index.html` must keep the same algorithm.

## Batches (`bingo.html`)

Printed cards come from a seed in the URL: `bingo.html?seed=54321` always produces the same 200
cards, checksums and report. With no `?seed=` a 5-digit one is picked and written into the URL. The
batch number is printed on every card and on the report. All randomness in `bingo.html` must go
through `random()` (the seeded generator), never `Math.random()`, or batches stop being reproducible.
Changing the song lists also changes what a seed produces. The on-screen bar (hidden in print) has
"New batch" and a "Check card #" lookup.

## Shuffling

Every page that randomises songs (`bingo.html`, `index.html`, `livelist*.html`) uses Fisher–Yates on
a copy of the list. Don't use `sort(() => Math.random() - 0.5)`: it's biased.

## Known quirks

- `bingo.css` contains a duplicated block of rules (second copy wins); `margin: 5 auto` is invalid.
