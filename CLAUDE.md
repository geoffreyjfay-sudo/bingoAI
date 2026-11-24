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
| `livelist.html` + `styleslist.css` | Host, during the event | Shuffled running order per decade. Links open Apple Music by default, or Spotify with `livelist.html?service=spotify` (switch link at the top). Clicking a link/checkbox marks the song played; unticking (after a confirm) or "Undo Last Played" un-marks it. "Next Random Song" highlights an unplayed track. "Check a Card" takes a batch and card number, rebuilds that printed card with `cards.js` and shows whether it has a line (rows, columns, diagonals) or full house against the songs played in its decade; the last batch entered is remembered as `bingoBatch`. State in `localStorage` (`bingoState_songs70` etc.): the running order as titles plus marked titles, shared by both services. Links are looked up at render time. Older saves holding `[title, link]` pairs are converted on load. |
| `livelist_spot.html` | — | Redirect to `livelist.html?service=spotify`, kept so old bookmarks work. |
| `checklist.html` | Host | Printable A4-landscape tick-list of all songs per decade. |

## Song data

`songs.js` is the only song file. `SONGS["1970s"]` (etc.) is a list of
`{ title, apple, spotify }`; it also defines `songs70/80/90/00` as plain title lists for the card
pages. Every page loads it.

Title style: standard title case, straight apostrophes (`'`) only, official song titles. Titles are
compared as raw strings for checksums, marks and saved games, so renaming a song changes card
checksums and what every batch seed produces, and drops that song's mark from saved games.

## Checksum

`titleValue(title)` = sum of char codes. Card checksum = Σ `titleValue(song) × position`, with
positions 1–25 across the grid and position 13 (FREE) skipped. Used to verify a winning card —
`bingo.html` and `index.html` must keep the same algorithm.

## Batches (`cards.js`, `bingo.html`)

`cards.js` builds batches (`generateBatch(seed)`) and checks cards (`checkCard`, `BINGO_LINES`).
`bingo.html` prints from it and `livelist.html` checks winners with it, so they always agree.
Card N's decade is `(N - 1) % 4` (1970s, 1980s, 1990s, 2000s). Don't change the order or number of
`random()` calls in `generateBatch`, or every existing batch changes.

Printed cards come from a seed in the URL: `bingo.html?seed=54321` always produces the same 200
cards, checksums and report. With no `?seed=` a 5-digit one is picked and written into the URL. The
batch number is printed on every card and on the report. All card randomness must go through the seeded
generator in `cards.js`, never `Math.random()`, or batches stop being reproducible.
Changing the song lists also changes what a seed produces. The on-screen bar (hidden in print) has
"New batch" and a "Check card #" lookup.

## Shuffling

Every page that randomises songs (`bingo.html`, `index.html`, `livelist*.html`) uses Fisher–Yates on
a copy of the list. Don't use `sort(() => Math.random() - 0.5)`: it's biased.

