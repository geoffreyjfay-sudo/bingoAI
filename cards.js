// Builds printed bingo batches. Shared by bingo.html (printing) and livelist.html (checking a
// winner's card), so both always agree on what is on a card. Needs songs.js loaded first.
//
// A batch is 200 cards made from a seed: cards 1, 5, 9… are the 1970s game, 2, 6, 10… the 1980s,
// 3, 7, 11… the 1990s and 4, 8, 12… the 2000s. The same seed and song list always give the same
// cards. Changing the order of random() calls below changes every existing batch, so don't.

const BATCH_DECADES = [
  { name: "1970s", game: 1, class: "card-70s", key: "songs70" },
  { name: "1980s", game: 2, class: "card-80s", key: "songs80" },
  { name: "1990s", game: 3, class: "card-90s", key: "songs90" },
  { name: "2000s", game: 4, class: "card-00s", key: "songs00" }
];
const CARDS_PER_BATCH = 200;
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

// Returns all 200 cards of a batch:
// { number, decade, game, class, songs (24 titles, row by row without the centre), checksum, freeColor, labelColor }
function generateBatch(seed) {
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
  for (let number = 1; number <= CARDS_PER_BATCH; number++) {
    const decade = BATCH_DECADES[(number - 1) % 4];
    const songs = shuffled(SONGS[decade.name].map(s => s.title)).slice(0, 24);
    const freeColor = FREE_COLORS[Math.floor(random() * FREE_COLORS.length)];
    const labelColor = LABEL_COLORS[Math.floor(random() * LABEL_COLORS.length)];
    cards.push({ number, decade: decade.name, game: decade.game, class: decade.class, songs,
      checksum: cardChecksum(songs), freeColor, labelColor });
  }
  return cards;
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
