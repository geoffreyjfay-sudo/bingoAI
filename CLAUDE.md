# Decades Bingo

Music bingo for a live event ("Geoff & David's Decades Bingo Bash"). Eight games, one per decade
(1950s, 1960s, 1970s, 1980s, 1990s, 2000s, 2010s, 2020s), each with a pool of 50 songs. Players mark song titles on a 5×5 card
(centre square FREE) as the host plays tracks.

Plain static HTML/CSS/JS — no build step, no package manager, no tests, and no internet needed: nothing
is loaded from a CDN (keep it that way; the venue Wi-Fi may be poor). Only the song links go online. Serve the folder (the
`static` config in `.claude/launch.json` runs `python3 -m http.server 8780`) and open the pages.

## Pages

| File | Who uses it | What it does |
|---|---|---|
| `bingo.html` + `bingo.css` | Host, before the event | Generates 400 printable cards, four to an A4 sheet: each player's eight (one per decade) fill two sheets, each with a card number and checksum. Ends with a report page: duplicate checksums, song usage counts, unused songs, and an HTML bar chart of the most-used songs. Print to PDF. |
| `index.html` + `bingoplay.css` | Players, on their phones | Digital card from the same batch as the printed ones, opened as `index.html?batch=54321` (without `?batch=` it asks for the number). The phone picks a random page 51–9999, i.e. eight cards (one per game) numbered above 400 (`&page=` forces one), and shows the card number, batch and checksum so the host can check it. Tap to mark. A "Playing for" picker (per game, default Any line) sets the pattern the host announced; completing it (from the player's own marks, via `checkPattern`) outlines the squares in gold and pins a banner with the card number to the bottom of the screen. `localStorage`: `bingoPhoneCard` `{batch, page}`, `bingoState_1950s` etc. `{marked}`, `bingoPattern_1950s` etc., `bingoLastDecade`. A different batch or page in the link gives a new card and clears marks. Two phones can draw the same page (identical cards). |
| `livelist.html` + `styleslist.css` | Host, during the event | Shuffled running order per decade. Links open Apple Music by default, or Spotify with `livelist.html?service=spotify` (switch link at the top). Clicking a link/checkbox marks the song played; unticking (after a confirm) or "Undo Last Played" un-marks it. "Next Random Song" highlights an unplayed track. "Check a Card" takes a batch and card number, rebuilds that printed card with `cards.js` and shows whether it has the pattern chosen for that game ("This game is for" picker: any line, two lines, four corners, X, full house) against the songs played in its decade; the last batch entered is remembered as `bingoBatch`. A saved game carries on automatically on load; "Start Over" asks before clearing it. State in `localStorage` (`bingoState_songs70` etc.): the running order as titles, marked titles and the game's pattern, shared by both services. Links are looked up at render time. Older saves holding `[title, link]` pairs are converted on load. |
| `livelist_spot.html` | — | Redirect to `livelist.html?service=spotify`, kept so old bookmarks work. |
| `checklist.html` | Host | Printable A4-landscape tick-list of all songs per decade. |

## Song data

`songs.js` is the only song file. `SONGS["1970s"]` (etc.) is a list of
`{ title, apple, spotify }`; it also defines `songs50/60/70/80/90/00/10/20` as plain title lists.
Apple links are to clean (or not-explicit) versions, and Spotify links avoid the explicit badge where
there's a choice. The decade order everywhere comes from `BATCH_DECADES` in `cards.js`. Every page loads it.

Title style: standard title case, straight apostrophes (`'`) only, official song titles. Titles are
compared as raw strings for checksums, marks and saved games, so renaming a song changes card
checksums and what every batch seed produces, and drops that song's mark from saved games.

## Checksum

`titleValue(title)` = sum of char codes. Card checksum = Σ `titleValue(song) × position`, with
positions 1–25 across the grid and position 13 (FREE) skipped. Used to verify a winning card —
`bingo.html` and `index.html` must keep the same algorithm.

## Batches (`cards.js`, `bingo.html`)

`cards.js` builds batches (`generateBatch(seed, count)`, `cardsForPage`, `cardByNumber`) and checks
cards (`checkCard`, `BINGO_LINES`, and `PATTERNS`/`checkPattern` for the win patterns; each pattern is a list of alternative shapes of grid squares). `bingo.html` prints cards 1–400 (pages 1–50), `index.html` gives
phones a page from 51–9999, and `livelist.html` checks any card number, so they always agree.
Card N's decade is `(N - 1) % 8` (1950s … 2020s, `GAMES = 8`); page P (one player) holds cards 8P-7 to 8P.
Generating more cards never changes earlier ones. Don't change the order or number of
`random()` calls in `generateBatch`, or every existing batch changes.

Printed cards come from a seed in the URL: `bingo.html?seed=54321` always produces the same 400
cards, checksums and report. With no `?seed=` a 5-digit one is picked and written into the URL. The
batch number is printed on every card and on the report. All card randomness must go through the seeded
generator in `cards.js`, never `Math.random()`, or batches stop being reproducible.
Changing the song lists also changes what a seed produces. The on-screen bar (hidden in print) has
"New batch" and a "Check card #" lookup.

## Shuffling

Every page that randomises songs (`bingo.html`, `index.html`, `livelist*.html`) uses Fisher–Yates on
a copy of the list. Don't use `sort(() => Math.random() - 0.5)`: it's biased.

