// A small cartoon of Lumi (the lavender fuzzy character from setup/icon/lumi/lumi.png) as inline SVG: a soft bell-shaped
// body with a fur edge (turbulence displacement), big eyes, orange brows and smile, a pink heart held by two paws and
// two little feet that run (CSS: .lumi-art.is-running). lumiArt({ mood: 'happy'|'sad'|'hmm', size }) -> svg string.
let n = 0;
export function lumiArt({ mood = 'happy', size = 64 } = {}) {
  const id = 'la' + (++n);
  const mouth = mood === 'sad' ? '<path d="M41 58q9-6 18 0" fill="none" stroke="var(--orange)" stroke-width="4.2" stroke-linecap="round"/>'
    : mood === 'hmm' ? '<path d="M42 57.5h15" fill="none" stroke="var(--orange)" stroke-width="4.2" stroke-linecap="round"/>'
    : '<path d="M42 54.5q8 7 16 0" fill="none" stroke="var(--orange)" stroke-width="4.2" stroke-linecap="round"/>';
  const brows = mood === 'sad' ? '<path d="M30 30.5q4-4.5 9-3M61 27.5q5-1.5 9 3" fill="none" stroke="var(--orange)" stroke-width="3.2" stroke-linecap="round"/>'
    : '<path d="M30 28q4-3.5 9-2.5M61 25.5q5-1 9 2.5" fill="none" stroke="var(--orange)" stroke-width="3.2" stroke-linecap="round"/>';
  const tear = mood === 'sad' ? '<path class="la-tear" d="M33 50c0 2.4-1.5 4-3.4 4s-3.4-1.6-3.4-4c0-2 3.4-6.4 3.4-6.4s3.4 4.4 3.4 6.4z" fill="#a9c8f0"/>' : '';
  const look = mood === 'sad' ? 1.5 : 0;
  return `<svg class="lumi-art" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <radialGradient id="${id}b" cx="40%" cy="28%" r="78%"><stop offset="0" stop-color="#e6dcf4"/><stop offset=".62" stop-color="#cdbde6"/><stop offset="1" stop-color="#ab97d2"/></radialGradient>
    <filter id="${id}f" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="3.6" xChannelSelector="R" yChannelSelector="G"/></filter>
  </defs>
  <g class="la-feet"><ellipse class="la-foot l" cx="38" cy="92" rx="8" ry="4.6" fill="#a08cc9"/><ellipse class="la-foot r" cx="62" cy="92" rx="8" ry="4.6" fill="#a08cc9"/></g>
  <g class="la-body">
    <path d="M50 8c19 0 30 14 31 31 .4 7 4 11 7 17 5 11 2 32-38 32S7 67 12 56c3-6 6.6-10 7-17C20 22 31 8 50 8z" fill="url(#${id}b)" filter="url(#${id}f)"/>
    ${brows}
    <circle cx="39" cy="40" r="9" fill="#fff"/><circle cx="61" cy="40" r="9" fill="#fff"/>
    <circle cx="${40 - look}" cy="${41 + look}" r="5.6" fill="#141016"/><circle cx="${62 - look}" cy="${41 + look}" r="5.6" fill="#141016"/>
    <circle cx="${41.6 - look}" cy="${39 + look}" r="1.6" fill="#fff"/><circle cx="${63.6 - look}" cy="${39 + look}" r="1.6" fill="#fff"/>
    ${mouth}${tear}
    <path d="M50 66c-3-5-13-6-14 1-1 6 8 11 14 15 6-4 15-9 14-15-1-7-11-6-14-1z" fill="#d993b4"/>
    <path d="M33 74c2-3 8-3 11 0 2 2 1 6-4 6.5-4 .4-8.5-3-7-6.5zM67 74c-2-3-8-3-11 0-2 2-1 6 4 6.5 4 .4 8.5-3 7-6.5z" fill="#e2d6f2"/>
  </g>
</svg>`;
}
