// Startbild-Animation (v5): index.html zeigt beim Kaltstart einen Navy-Zettel (#splash), exakt wie das
// statische iOS-Startbild. Sobald Heute bereit ist, verblasst der Zettel und die Zeilen erscheinen nacheinander.
// Beim Zurückwechseln in die App gibt es keinen Zettel, weil er nur beim Laden der Seite existiert.

import { useEffect, useState } from 'react'

export const SPLASH_DONE = 'casa:splashdone'

function el(): HTMLElement | null {
  return document.getElementById('splash')
}

function remove() {
  const s = el()
  if (!s) return
  s.remove()
  window.dispatchEvent(new Event(SPLASH_DONE))
}

/** true, sobald der Zettel vom Kaltstart weg ist (oder nie da war). */
export function useSplashGone(): boolean {
  const [gone, setGone] = useState(() => !el())
  useEffect(() => {
    if (gone) return
    const h = () => setGone(!el())
    window.addEventListener(SPLASH_DONE, h)
    const t = window.setInterval(h, 500)
    return () => {
      window.removeEventListener(SPLASH_DONE, h)
      window.clearInterval(t)
    }
  }, [gone])
  return gone
}

function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function onHeute(): boolean {
  const h = location.hash.replace(/^#/, '').split('?')[0]
  return h === '' || h === '/' || h === '/heute'
}

/** Zettel noch da und noch nicht am Verschwinden? */
function pending(): boolean {
  const s = el()
  return !!s && !s.classList.contains('go') && !s.classList.contains('quick')
}

/** Sollen die Zeilen von Heute gestaffelt erscheinen? Nur beim Kaltstart auf Heute, nicht bei Reduced Motion
 *  und nicht, wenn der Zettel schon weggetippt wurde oder die App über eine Mitteilung woanders startet. */
export function wantsStagger(): boolean {
  return pending() && !reduced() && onHeute()
}

/** Zettel wegnehmen: 'stagger' = Zettel dreht und verblasst, Navy blendet aus; 'quick' = nur kurz überblenden. */
export function finishSplash(mode: 'stagger' | 'quick') {
  const s = el()
  if (!s || !pending()) return
  const go = mode === 'stagger' && !reduced()
  s.classList.add(go ? 'go' : 'quick')
  // Nach der Animation weg (animationend in index.html ist nur die erste Instanz, das hier das Netz)
  window.setTimeout(remove, go ? 900 : 350)
}
