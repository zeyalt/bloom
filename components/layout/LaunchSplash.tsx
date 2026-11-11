/*
 * The launch animation for the installed app. The phone's own splash shows the logo
 * on the paper colour; this picks up from that exact frame (same logo, same size,
 * centred) and plays a short "sprout": the pot squashes, the sprout springs up and
 * sways, pollen bursts out, the wordmark rises, then the whole thing lifts away.
 *
 * It is server-rendered markup + CSS (see `.launch-splash` in globals.css), so it
 * runs on first paint without waiting for React. `LAUNCH_SPLASH_SCRIPT` (in <head>)
 * decides whether to show it: only in standalone mode, once per launch, or with
 * `?splash` in the URL for testing. Tapping skips it.
 */

// Pollen: direction (unit-ish vector) and colour for each dot.
const POLLEN: { x: number; y: number; c: string; d: number }[] = [
  { x: -1, y: -0.2, c: "#4a9a3f", d: 0 },
  { x: -0.8, y: -0.8, c: "#1f6fb5", d: 40 },
  { x: -0.3, y: -1, c: "#e2a23b", d: 20 },
  { x: 0.3, y: -1.05, c: "#4a9a3f", d: 60 },
  { x: 0.8, y: -0.75, c: "#d95f8e", d: 10 },
  { x: 1, y: -0.15, c: "#1f6fb5", d: 50 },
  { x: 0.9, y: 0.45, c: "#e2a23b", d: 30 },
  { x: -0.9, y: 0.5, c: "#d95f8e", d: 70 },
  { x: -0.55, y: -0.5, c: "#7cc36a", d: 90 },
  { x: 0.55, y: -0.4, c: "#7cc36a", d: 80 },
];

export const LAUNCH_SPLASH_SCRIPT = `(function(){try{
var d=document.documentElement,force=/[?&]splash\\b/.test(location.search);
var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
if(!force&&(!standalone||sessionStorage.getItem('bloom.splash')))return;
sessionStorage.setItem('bloom.splash','1');
d.classList.add('splash');
var end=function(){d.classList.remove('splash')};
setTimeout(end,2400);
addEventListener('pointerdown',end,{once:true});
}catch(e){}})();`;

export function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      <div className="launch-splash__stage">
        <div className="launch-splash__logo">
          <img className="launch-splash__base" src="/splash/base.png" alt="" width={96} height={160} />
          <img className="launch-splash__sprout" src="/splash/sprout.png" alt="" width={96} height={160} />
          <div className="launch-splash__pollen">
            {POLLEN.map((p, i) => (
              <span
                key={i}
                style={{
                  ["--x" as string]: `${p.x * 88}px`,
                  ["--y" as string]: `${p.y * 88}px`,
                  ["--delay" as string]: `${p.d}ms`,
                  backgroundColor: p.c,
                }}
              />
            ))}
          </div>
        </div>
        <div className="launch-splash__word">Bloom</div>
      </div>
    </div>
  );
}
