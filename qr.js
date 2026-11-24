// Minimal QR code generator, so the host page can show a players' link without loading anything from
// the internet. Byte mode, error correction level M (about 15% damage tolerated), versions 1–9
// (up to 180 bytes — plenty for a link). Follows the QR spec (ISO/IEC 18004); layout approach after
// Project Nayuki's reference implementation.
//
//   qrSvg(text, { scale: 8 })  →  "<svg …>" string (with a 4-module quiet zone)
//   qrMatrix(text)             →  rows of true (dark) / false (light)

const QR = (() => {
  // Level M per version 1–9: EC codewords per block, then [count, data codewords] for each block group.
  const BLOCKS = [null,
    [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
    [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46]];
  const FORMAT_M = 0; // format bits for level M

  // GF(256) arithmetic for Reed–Solomon, primitive polynomial 0x11D.
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      poly.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= mul(c, EXP[i]); });
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, degree) {
    const gen = rsGenerator(degree);
    const rem = new Array(degree).fill(0);
    for (const b of data) {
      const factor = b ^ rem.shift();
      rem.push(0);
      for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
    }
    return rem;
  }

  const getBit = (x, i) => ((x >>> i) & 1) !== 0;

  function encode(text) {
    const bytes = [...new TextEncoder().encode(text)];
    let version = 1, dataCount = 0;
    for (; version <= 9; version++) {
      const [, ...groups] = BLOCKS[version];
      dataCount = groups.reduce((s, [n, d]) => s + n * d, 0);
      if (4 + 8 + bytes.length * 8 <= dataCount * 8) break;
    }
    if (version > 9) throw new Error("Text too long for this QR generator");

    // Data bits: byte mode (0100), 8-bit length, the bytes, terminator, then pad bytes.
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push(getBit(val, i)); };
    push(4, 4); push(bytes.length, 8); bytes.forEach(b => push(b, 8));
    push(0, Math.min(4, dataCount * 8 - bits.length));
    while (bits.length % 8) bits.push(false);
    for (let pad = 0xEC; bits.length < dataCount * 8; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));

    // Split into blocks, add error correction, interleave.
    const [ecLen, ...groups] = BLOCKS[version];
    const blocks = [];
    let k = 0;
    for (const [n, d] of groups) for (let i = 0; i < n; i++) { blocks.push(data.slice(k, k + d)); k += d; }
    const ecc = blocks.map(b => rsRemainder(b, ecLen));
    const out = [];
    const maxData = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxData; i++) blocks.forEach(b => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < ecLen; i++) ecc.forEach(e => out.push(e[i]));
    return { version, codewords: out };
  }

  function build(version, codewords) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // timing
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const align = ALIGN[version], last = align.length - 1;
    align.forEach((ay, i) => align.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));

    const drawFormat = mask => {
      const fmt = (FORMAT_M << 3) | mask;
      let rem = fmt;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((fmt << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, getBit(b, i));
      set(8, 7, getBit(b, 6)); set(8, 8, getBit(b, 7)); set(7, 8, getBit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, getBit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(b, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, getBit(b, i));
      set(8, size - 8, true); // the always-dark module
    };
    drawFormat(0); // reserve the format areas

    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const b = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + i % 3, c = Math.floor(i / 3);
        set(a, c, getBit(b, i)); set(c, a, getBit(b, i));
      }
    }

    // Place the codewords in the zig-zag order, two columns at a time from the right.
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
          if (!isFunction[y][x] && i < codewords.length * 8) {
            modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }

    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const applyMask = m => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
        if (!isFunction[y][x] && MASKS[m](x, y)) modules[y][x] = !modules[y][x];
    };

    // Try all eight masks and keep the one with the lowest penalty (easiest to scan).
    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const score = penalty(modules);
      if (score < bestScore) { best = m; bestScore = score; }
      applyMask(m); // undo
    }
    applyMask(best); drawFormat(best);
    return modules;
  }

  function penalty(m) {
    const n = m.length;
    let score = 0, dark = 0;
    const at = (vertical, i, j) => vertical ? m[j][i] : m[i][j];
    const finderA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], finderB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (const vertical of [false, true]) {
      for (let i = 0; i < n; i++) {
        let run = 1;
        for (let j = 1; j < n; j++) {
          if (at(vertical, i, j) === at(vertical, i, j - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
          else run = 1;
        }
        for (let j = 0; j + 11 <= n; j++) {
          if (finderA.every((v, k) => at(vertical, i, j + k) === !!v)) score += 40;
          if (finderB.every((v, k) => at(vertical, i, j + k) === !!v)) score += 40;
        }
      }
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (y < n - 1 && x < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
    score += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return score;
  }

  function matrix(text) {
    const { version, codewords } = encode(text);
    return build(version, codewords);
  }

  function svg(text, { scale = 8, quiet = 4 } = {}) {
    const m = matrix(text), n = m.length, full = n + quiet * 2;
    let path = "";
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="${full * scale}" height="${full * scale}" ` +
      `shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/>` +
      `<path d="${path}" fill="#000"/></svg>`;
  }

  return { matrix, svg };
})();

const qrMatrix = QR.matrix;
const qrSvg = QR.svg;
