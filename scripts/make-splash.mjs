// Statische Startbilder für iOS (apple-touch-startup-image), Hochformat.
// Aufruf: node scripts/make-splash.mjs  → public/splash/*.png + gibt die <link>-Zeilen für index.html aus.
// Rendert scripts/splash-markup.mjs mit dem installierten Chrome in echten Gerätepixeln.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SPLASH_CSS, SPLASH_HTML } from './splash-markup.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// [CSS-Breite, CSS-Höhe, Pixelverhältnis, Geräte]
export const SIZES = [
  [440, 956, 3, 'iPhone 16 Pro Max, 17 Pro Max'],
  [430, 932, 3, 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus'],
  [428, 926, 3, 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus'],
  [420, 912, 3, 'iPhone Air'],
  [414, 896, 3, 'iPhone 11 Pro Max, XS Max'],
  [414, 896, 2, 'iPhone 11, XR'],
  [402, 874, 3, 'iPhone 16 Pro, 17, 17 Pro'],
  [393, 852, 3, 'iPhone 14 Pro, 15, 15 Pro, 16'],
  [390, 844, 3, 'iPhone 12, 13, 14, 16e'],
  [375, 812, 3, 'iPhone 12 mini, 13 mini, X, XS, 11 Pro'],
  [375, 667, 2, 'iPhone SE'],
  [1032, 1376, 2, 'iPad Pro 13 (M4)'],
  [1024, 1366, 2, 'iPad Pro 12.9'],
  [834, 1210, 2, 'iPad Pro 11 (M4)'],
  [834, 1194, 2, 'iPad Air 11, iPad Pro 11'],
  [820, 1180, 2, 'iPad 10, 11'],
  [810, 1080, 2, 'iPad 9'],
  [768, 1024, 2, 'iPad (alt)'],
  [744, 1133, 2, 'iPad mini'],
]

const dir = mkdtempSync(join(tmpdir(), 'casa-splash-'))
const page = join(dir, 'splash.html')
writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#1A2340}${SPLASH_CSS}</style></head><body>${SPLASH_HTML}</body></html>`)
mkdirSync('public/splash', { recursive: true })

const links = []
for (const [w, h, dpr, note] of SIZES) {
  const name = `splash-${w}x${h}@${dpr}x.png`
  execFileSync(CHROME, [
    '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run',
    `--user-data-dir=${join(dir, 'profile')}`,
    `--window-size=${w},${h}`, `--force-device-scale-factor=${dpr}`,
    `--screenshot=${join(process.cwd(), 'public/splash', name)}`, `file://${page}`,
  ], { stdio: 'ignore' })
  links.push(`    <link rel="apple-touch-startup-image" href="/casa/splash/${name}" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" /><!-- ${note} -->`)
  console.log(name, note)
}
writeFileSync(join('public/splash', 'links.html'), links.join('\n') + '\n')
console.log('fertig →', 'public/splash/links.html')
