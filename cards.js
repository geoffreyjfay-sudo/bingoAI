// Builds printed bingo batches. Shared by bingo.html (printing) and livelist.html (checking a
// winner's card), so both always agree on what is on a card. Needs songs.js loaded first.
//
// A batch is a numbered run of cards made from a seed, cycling through the eight games: cards 1, 9,
// 17… are the 1950s game, 2, 10, 18… the 1960s, and so on to 8, 16, 24… the 2020s, so each "page" of
// eight is one player's set, one card per decade. Pages 1–50 (cards 1–400) are printed by bingo.html,
// two A4 sheets per player; phones (index.html) take a page from 51 up, so their cards continue the
// same batch and can be checked the same way. The same seed and song
// list always give the same cards, and asking for more cards never changes earlier ones. Changing the
// order of random() calls below changes every existing batch, so don't.

const BATCH_DECADES = [
  { name: "1950s", game: 1, class: "card-50s", key: "songs50" },
  { name: "1960s", game: 2, class: "card-60s", key: "songs60" },
  { name: "1970s", game: 3, class: "card-70s", key: "songs70" },
  { name: "1980s", game: 4, class: "card-80s", key: "songs80" },
  { name: "1990s", game: 5, class: "card-90s", key: "songs90" },
  { name: "2000s", game: 6, class: "card-00s", key: "songs00" },
  { name: "2010s", game: 7, class: "card-10s", key: "songs10" },
  { name: "2020s", game: 8, class: "card-20s", key: "songs20" }
];
const GAMES = BATCH_DECADES.length; // cards per page (one per game)
const CARDS_PER_BATCH = 50 * GAMES; // printed cards (50 pages, i.e. 50 players)
const FIRST_PHONE_PAGE = 51;
const LAST_PHONE_PAGE = 9999;     // phone pages are picked at random from 51–9999
const FREE_SQUARE = 12; // index of the centre square in a 5×5 grid, read row by row

const LABEL_COLORS = [
  "#ff1744", "#00e676", "#ffea00", "#2979ff", "#ff9100", "#d500f9",
  "#00e5ff", "#ff4081", "#76ff03", "#ff5252", "#00bfa5", "#b388ff"
];
const FREE_COLORS = [
  "#ff1744", "#d50000", "#ff6d00", "#ff9100", "#ffea00", "#c6ff00", "#76ff03",
  "#00e676", "#1de9b6", "#00e5ff", "#2979ff", "#304ffe", "#7c4dff", "#d500f9",
  "#ff4081", "#f50057", "#ff80ab", "#8d6e63", "#aeea00", "#00bfa5"
];

// mulberry32: small, fast seeded generator returning numbers in [0, 1), used in place of Math.random.
function seededRandom(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function titleValue(title) {
  return [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

// Checksum of a card's 24 songs in grid order: positions 1–25 row by row, centre (13) skipped.
function cardChecksum(songs) {
  return songs.reduce((sum, song, i) => sum + titleValue(song) * (i < FREE_SQUARE ? i + 1 : i + 2), 0);
}

// Returns cards 1..count of a batch (default: the 400 printed cards):
// { number, decade, game, class, songs (24 titles, row by row without the centre), checksum, freeColor, labelColor }
function generateBatch(seed, count = CARDS_PER_BATCH) {
  const random = seededRandom(seed);
  const shuffled = list => {
    const array = [...list];
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  };
  const cards = [];
  for (let number = 1; number <= count; number++) {
    const decade = BATCH_DECADES[(number - 1) % GAMES];
    const songs = shuffled(SONGS[decade.name].map(s => s.title)).slice(0, 24);
    const freeColor = FREE_COLORS[Math.floor(random() * FREE_COLORS.length)];
    const labelColor = LABEL_COLORS[Math.floor(random() * LABEL_COLORS.length)];
    cards.push({ number, decade: decade.name, game: decade.game, class: decade.class, songs,
      checksum: cardChecksum(songs), freeColor, labelColor });
  }
  return cards;
}

// The eight cards (1950s … 2020s) on page `page` of a batch.
function cardsForPage(seed, page) {
  return generateBatch(seed, page * GAMES).slice(-GAMES);
}

// The single card `number` of a batch.
function cardByNumber(seed, number) {
  return generateBatch(seed, number)[number - 1];
}

// The 12 winning lines (5 rows, 5 columns, 2 diagonals) as grid indexes 0–24.
const BINGO_LINES = (() => {
  const lines = [];
  for (let i = 0; i < 5; i++) {
    lines.push({ name: `Row ${i + 1}`, cells: [0, 1, 2, 3, 4].map(j => i * 5 + j) });
    lines.push({ name: `Column ${i + 1}`, cells: [0, 1, 2, 3, 4].map(j => j * 5 + i) });
  }
  lines.push({ name: "Diagonal ↘", cells: [0, 6, 12, 18, 24] });
  lines.push({ name: "Diagonal ↙", cells: [4, 8, 12, 16, 20] });
  return lines;
})();

// What a player needs to win a game. The host picks one per game (livelist.html) and announces it;
// players pick the same on their phone (index.html). Each pattern is a list of alternative shapes
// (sets of grid indexes): completing any one shape wins.
const PATTERNS = (() => {
  const unionOf = (...lists) => [...new Set(lists.flat())].sort((a, b) => a - b);
  const pairs = [];
  BINGO_LINES.forEach((a, i) => BINGO_LINES.slice(i + 1).forEach(b =>
    pairs.push({ name: `${a.name} + ${b.name}`, cells: unionOf(a.cells, b.cells) })));
  const diagonals = BINGO_LINES.filter(l => l.name.startsWith("Diagonal")).map(l => l.cells);
  return [
    { id: "line", name: "Any line", short: "Line", icon: [10, 11, 12, 13, 14], shout: "BINGO!", shapes: BINGO_LINES },
    { id: "two-lines", name: "Two lines", short: "2 lines", icon: [5, 6, 7, 8, 9, 15, 16, 17, 18, 19], shout: "TWO LINES!", shapes: pairs },
    { id: "corners", name: "Four corners", short: "Corners", icon: [0, 4, 20, 24], shout: "FOUR CORNERS!", shapes: [{ name: "Four corners", cells: [0, 4, 20, 24] }] },
    { id: "x", name: "X (both diagonals)", short: "X", icon: unionOf(...diagonals), shout: "X MARKS THE SPOT!", shapes: [{ name: "X", cells: unionOf(...diagonals) }] },
    { id: "full", name: "Full house", short: "Full house", icon: [...Array(25).keys()], shout: "FULL HOUSE!", shapes: [{ name: "Full house", cells: [...Array(25).keys()] }] }
  ];
})();
const DEFAULT_PATTERN = "line";

function patternById(id) {
  return PATTERNS.find(p => p.id === id) || PATTERNS.find(p => p.id === DEFAULT_PATTERN);
}

// A mini 5×5 card with the pattern's squares lit (`icon` is one example shape), for the pattern buttons.
function patternIcon(pattern) {
  const on = new Set(pattern.icon);
  return `<span class="pattern-icon" aria-hidden="true">` +
    [...Array(25).keys()].map(i => `<i class="${on.has(i) ? "on" : ""}"></i>`).join("") + `</span>`;
}

// Fills `container` with one button per pattern (icon + short name). Clicking one calls onPick(id).
// Returns setActive(id), which highlights the pattern in play.
function renderPatternButtons(container, onPick) {
  container.innerHTML = PATTERNS.map(p =>
    `<button type="button" data-pattern="${p.id}" role="radio" aria-checked="false" aria-label="${p.name}" title="${p.name}">` +
    `${patternIcon(p)}<span>${p.short}</span></button>`).join("");
  const buttons = [...container.querySelectorAll("button")];
  const setActive = id => buttons.forEach(b => {
    const on = b.dataset.pattern === id;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", on);
  });
  buttons.forEach(b => b.addEventListener("click", () => { setActive(b.dataset.pattern); onPick(b.dataset.pattern); }));
  return setActive;
}

// Checks a card against a pattern. Returns { pattern, won: completed shape names, cells: grid indexes
// of the completed shapes (to highlight), missing: songs still needed for the closest shape, grid }.
function checkPattern(card, playedTitles, patternId) {
  const pattern = patternById(patternId);
  const { grid } = checkCard(card, playedTitles);
  const shapes = pattern.shapes.map(s => ({ name: s.name, cells: s.cells, missing: s.cells.filter(c => !grid[c].played).length }));
  const won = shapes.filter(s => s.missing === 0);
  return {
    pattern,
    won: won.map(s => s.name),
    cells: [...new Set(won.flatMap(s => s.cells))],
    missing: Math.min(...shapes.map(s => s.missing)),
    grid
  };
}

// Checks a card against the songs played so far.
// Returns { grid: 25 cells { song, played, free }, lines: completed line names, bestMissing, fullHouse }.
function checkCard(card, playedTitles) {
  const played = new Set(playedTitles);
  const grid = [];
  for (let i = 0, s = 0; i < 25; i++) {
    if (i === FREE_SQUARE) { grid.push({ song: null, played: true, free: true }); continue; }
    const song = card.songs[s++];
    grid.push({ song, played: played.has(song), free: false });
  }
  const missingPerLine = BINGO_LINES.map(l => ({ name: l.name, missing: l.cells.filter(c => !grid[c].played).length }));
  return {
    grid,
    lines: missingPerLine.filter(l => l.missing === 0).map(l => l.name),
    bestMissing: Math.min(...missingPerLine.map(l => l.missing)),
    fullHouse: grid.every(c => c.played)
  };
}
