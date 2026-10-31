// Erzeugt die Papier-Kacheln für den Analog-Look (nahtlos, PNG mit Alpha).
// Aufruf: node scripts/paper-tiles.mjs  → public/paper/*.png
// Ausgangspunkt sind die feTurbulence-Werte aus casa-v4/design-referenz-v4/Analog.dc.html.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// ---------- PNG ----------
const CRC = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---------- Rauschen ----------
let seed = 7
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
// Periodisches Wert-Rauschen: Gitter nx × ny, weich interpoliert, nahtlos
function valueNoise(nx, ny) {
  const g = Array.from({ length: ny }, () => Array.from({ length: nx }, rnd))
  const sm = (t) => t * t * (3 - 2 * t)
  return (u, v) => {
    const x = u * nx, y = v * ny
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const tx = sm(x - x0), ty = sm(y - y0)
    const x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny
    const a = g[y0 % ny][x0 % nx], b = g[y0 % ny][x1], c = g[y1][x0 % nx], d = g[y1][x1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }
}
function fractal(layers) {
  const fns = layers.map(([nx, ny, amp]) => [valueNoise(nx, ny), amp])
  const sum = fns.reduce((s, [, a]) => s + a, 0)
  return (u, v) => fns.reduce((s, [f, a]) => s + f(u, v) * a, 0) / sum
}
const clamp = (x) => Math.max(0, Math.min(1, x))

function tile(name, size, color, fn) {
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = clamp(fn(x / size, y / size))
      const i = (y * size + x) * 4
      buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = Math.round(a * 255)
    }
  }
  writeFileSync(`public/paper/${name}.png`, png(size, size, buf))
}

mkdirSync('public/paper', { recursive: true })
const LIGHT = [77, 61, 41]      // dunkles Korn auf hellem Papier (0.30 0.24 0.16)
const DARK = [242, 235, 217]    // helles Korn auf dunklem Papier (0.95 0.92 0.85)
const MOTTLE_L = [140, 107, 56] // 0.55 0.42 0.22
const MOTTLE_D = [140, 158, 217] // 0.55 0.62 0.85

// Körnung: feines Rauschen, 256 px
const soft = () => (rnd() + rnd() + rnd() + rnd() + rnd()) / 5
// Stufe „mittel“ (v5): hell halb so stark wie v4, Fleckigkeit nur ein Hauch, keine Fasern hell
const grainL = () => 0.3 * soft() - 0.11
const grainD = () => 0.38 * soft() - 0.13
tile('grain-light', 256, LIGHT, grainL)
tile('grain-dark', 256, DARK, grainD)

// Fleckigkeit: sehr großflächig, 512 px
const mot = fractal([[3, 3, 1], [6, 6, 0.5]])
tile('mottle-light', 512, MOTTLE_L, (u, v) => 0.10 * mot(u, v) - 0.04)
tile('mottle-dark', 512, MOTTLE_D, (u, v) => 0.14 * mot(u, v) - 0.05)

// Fasern: in x lang, in y fein, 512 px, ganz dezent
const fib = fractal([[6, 48, 1], [12, 96, 0.5]])
tile('fibers-dark', 512, DARK, (u, v) => 0.10 * fib(u, v) - 0.05)
console.log('fertig')
