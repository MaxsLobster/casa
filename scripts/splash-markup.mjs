// Gemeinsame Vorlage für das Startbild: wird 1:1 in index.html (Zettel vor dem Laden der App)
// und von scripts/make-splash.mjs (statische PNGs für iOS) verwendet. Beide sehen so exakt gleich aus.
export const SPLASH_CSS = `
#splash{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;cursor:default;
  background-color:#1A2340;background-image:radial-gradient(circle at 1px 1px,rgba(233,225,207,0.13) 1px,transparent 1.4px);
  background-size:19px 19px;background-position:6px 8px}
#splash .zettel{position:relative;width:120px;height:120px;transform:rotate(-4deg);background:#EFE4C8;
  box-shadow:0 5px 12px rgba(0,0,0,0.4)}
#splash .tape{position:absolute;top:-10px;left:50%;width:58px;height:18px;margin-left:-29px;
  background:rgba(217,174,98,0.5);transform:rotate(3deg)}
#splash svg.haken{position:absolute;inset:0;width:120px;height:120px;filter:url(#sRough)}
#splash.go .zettel{animation:zettel-weg .5s cubic-bezier(.4,0,.2,1) both}
#splash.go{animation:splash-weg .4s ease .4s both;pointer-events:none}
#splash.quick{animation:splash-weg .3s ease both;pointer-events:none}
@keyframes zettel-weg{to{opacity:0;transform:rotate(-8deg) scale(.9)}}
@keyframes splash-weg{to{opacity:0}}
`
export const SPLASH_HTML = `<div id="splash" aria-hidden="true">
  <svg width="0" height="0" style="position:absolute"><filter id="sRough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="n"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg>
  <div class="zettel"><span class="tape"></span><svg class="haken" viewBox="0 0 96 96" fill="none"><path d="M26 50 L42 66 L72 32" stroke="#243150" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>
</div>`
