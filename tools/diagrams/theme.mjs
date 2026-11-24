// Shared visual language for the oil-and-gas-edge documentation diagrams.
// Every diagram is a 1280x720 stage rendered by a headless browser, so the
// output is deterministic and the source of each figure stays reviewable.

export const STAGE = { w: 1280, h: 720 };

export const COLOR = {
  bg: '#0e0e0e',
  bgEdge: '#0a0a0a',
  rule: '#ee0000',
  card: '#272727',
  cardAlt: '#2a2a2e',
  panel: '#161616',
  panelBorder: '#3c3f42',
  text: '#e0e0e0',
  textMuted: '#9a9d9f',
  white: '#ffffff',
  gold: '#c89738',
  goldText: '#e0b25c',
  ink: '#111111',
};

export const FONTS = [
  { family: 'Red Hat Display', weight: 500, file: 'RedHatDisplay-Medium.ttf' },
  { family: 'Red Hat Display', weight: 700, file: 'RedHatDisplay-Bold.ttf' },
  { family: 'Red Hat Display', weight: 900, file: 'RedHatDisplay-Black.ttf' },
  { family: 'Red Hat Text', weight: 400, file: 'RedHatText-Regular.ttf' },
  { family: 'Red Hat Text', weight: 500, file: 'RedHatText-Medium.ttf' },
  { family: 'Red Hat Text', weight: 700, file: 'RedHatText-Bold.ttf' },
  { family: 'Red Hat Mono', weight: 500, file: 'RedHatMono-Medium.ttf' },
  { family: 'Red Hat Mono', weight: 700, file: 'RedHatMono-Bold.ttf' },
];

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const html = (strings, ...values) =>
  strings.reduce((out, chunk, i) => out + chunk + (i < values.length ? values[i] ?? '' : ''), '');

/** Absolute placement helper. */
const box = ({ x, y, w, h }) =>
  `left:${x}px;top:${y}px;` + (w != null ? `width:${w}px;` : '') + (h != null ? `height:${h}px;` : '');

/**
 * Product card: red cap, dark body, icon, white name chip, gold role chip.
 * Most product marks already ship their own tile, so `tile` defaults to off;
 * turn it on for a mark that would disappear against the dark card.
 */
export function card({ x, y, w, h, icon, iconSize = 76, tile = false, name, role, note, step }) {
  const iconHtml = icon
    ? `<div class="icon ${tile ? 'tiled' : ''}" style="--s:${iconSize}px"><img src="${esc(icon)}" alt="" /></div>`
    : '';
  return html`
    <div class="card" style="${box({ x, y, w, h })}">
      ${step ? `<div class="step">${esc(step)}</div>` : ''}
      ${iconHtml}
      <div class="chips">
        ${name ? `<div class="chip-name">${esc(name)}</div>` : ''}
        ${role ? `<div class="chip-role">${esc(role)}</div>` : ''}
      </div>
      ${note ? `<div class="note">${esc(note)}</div>` : ''}
    </div>`;
}

/** Wide card with the icon on the left and stacked text on the right. */
export function wideCard({ x, y, w, h, icon, iconSize = 72, tile = false, name, role, note }) {
  return html`
    <div class="card wide" style="${box({ x, y, w, h })}">
      <div class="icon ${tile ? 'tiled' : ''}" style="--s:${iconSize}px"><img src="${esc(icon)}" alt="" /></div>
      <div class="wide-body">
        <div class="chips left">
          <div class="chip-name">${esc(name)}</div>
          ${role ? `<div class="chip-role">${esc(role)}</div>` : ''}
        </div>
        ${note ? `<div class="note left">${esc(note)}</div>` : ''}
      </div>
    </div>`;
}

/** Grouping region with a caption in the top-left corner. */
export function panel({ x, y, w, h, label, accent = COLOR.panelBorder, children = '' }) {
  return html`
    <div class="panel" style="${box({ x, y, w, h })};--accent:${accent}">
      ${label ? `<div class="panel-label">${esc(label)}</div>` : ''}
    </div>
    ${children}`;
}

/** Loose product mark, outside any card. */
export function glyph({ x, y, size = 44, icon }) {
  return `<img class="glyph" src="${esc(icon)}" alt="" style="${box({ x, y, w: size, h: size })}" />`;
}

/** Monospace pill, used for topic names, ports and resource names. */
export function pill({ x, y, text, tone = 'mono' }) {
  return `<div class="pill ${tone}" style="${box({ x, y })}">${esc(text)}</div>`;
}

/** Free text block. */
export function text({ x, y, w, value, cls = 'body' }) {
  return `<div class="text ${cls}" style="${box({ x, y, w })}">${esc(value)}</div>`;
}

/**
 * Gold connector. `d` is an SVG path in stage coordinates.
 * `label` is centred on the midpoint supplied by the caller.
 */
export function arrow({ d, label, lx, ly, dashed = false }) {
  return {
    path: `<path d="${d}" class="${dashed ? 'flow dashed' : 'flow'}" marker-end="url(#head)" />`,
    label: label ? `<div class="edge-label" style="left:${lx}px;top:${ly}px">${esc(label)}</div>` : '',
  };
}

export function stage({ title, subtitle, caption, logo, body, arrows = [] }) {
  const paths = arrows.map((a) => a.path).join('\n');
  const labels = arrows.map((a) => a.label).join('\n');
  return html`
    <div class="stage">
      <div class="rule"></div>
      <div class="head">
        <div class="heading">
          <div class="title">${esc(title)}</div>
          ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
        </div>
        <img class="brand" src="${esc(logo)}" alt="" />
      </div>
      <svg class="wires" viewBox="0 0 ${STAGE.w} ${STAGE.h}">
        <defs>
          <marker id="head" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 11 6 L 0 11 z" fill="${COLOR.gold}" />
          </marker>
        </defs>
        ${paths}
      </svg>
      ${labels}
      ${body}
      ${caption ? `<div class="caption">${esc(caption)}</div>` : ''}
    </div>`;
}

export function css(fontFaces) {
  return `
${fontFaces}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${STAGE.w}px; height: ${STAGE.h}px; overflow: hidden; }
body {
  background: ${COLOR.bgEdge};
  font-family: "Red Hat Text", sans-serif;
  color: ${COLOR.text};
  -webkit-font-smoothing: antialiased;
}
.stage {
  position: relative;
  width: ${STAGE.w}px;
  height: ${STAGE.h}px;
  background:
    radial-gradient(130% 95% at 50% 0%, #161616 0%, ${COLOR.bg} 48%, ${COLOR.bgEdge} 100%);
  overflow: hidden;
}
.rule { position: absolute; inset: 0 0 auto 0; height: 6px; background: ${COLOR.rule}; }

/* header */
.head { position: absolute; left: 34px; right: 30px; top: 26px; display: flex; align-items: flex-start; justify-content: space-between; }
.title { font-family: "Red Hat Display", sans-serif; font-weight: 700; font-size: 27px; letter-spacing: -0.2px; color: #fff; }
.subtitle { margin-top: 5px; font-size: 14.5px; font-weight: 500; color: ${COLOR.textMuted}; }
.brand { height: 42px; width: auto; }

/* connectors */
.wires { position: absolute; inset: 0; width: ${STAGE.w}px; height: ${STAGE.h}px; }
.flow { fill: none; stroke: ${COLOR.gold}; stroke-width: 5; stroke-linecap: round; }
.flow.dashed { stroke-dasharray: 11 9; stroke-width: 4; }
.edge-label {
  position: absolute; transform: translate(-50%, -50%);
  font-family: "Red Hat Mono", monospace; font-weight: 500; font-size: 12.5px;
  color: #0f0f0f; background: ${COLOR.gold};
  padding: 3px 9px; border-radius: 4px; white-space: nowrap;
}

/* grouping regions */
.panel {
  position: absolute; border: 1px solid var(--accent); border-radius: 12px;
  background: rgba(22, 22, 22, 0.55);
}
.panel-label {
  position: absolute; left: 18px; top: -11px;
  font-family: "Red Hat Display", sans-serif; font-weight: 700; font-size: 13px;
  letter-spacing: 0.6px; text-transform: uppercase;
  color: ${COLOR.textMuted}; background: ${COLOR.bg};
  padding: 1px 10px; border-radius: 3px;
}

/* cards */
.card {
  position: absolute; border-radius: 10px; overflow: hidden;
  background: linear-gradient(180deg, ${COLOR.card} 0%, ${COLOR.cardAlt} 100%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.62);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 18px 14px 14px;
}
.card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 5px; background: ${COLOR.rule}; }
.card.wide { flex-direction: row; align-items: center; justify-content: flex-start; gap: 20px; padding: 18px 22px 14px; }
.wide-body { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1; min-width: 0; }

.step {
  position: absolute; right: 12px; top: 14px;
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid ${COLOR.gold}; color: ${COLOR.goldText};
  font-family: "Red Hat Display", sans-serif; font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}

.icon { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.icon img { width: var(--s); height: var(--s); object-fit: contain; display: block; }
.icon.tiled {
  background: #fff; border-radius: 14px; padding: 9px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
}

.chips { display: flex; flex-direction: column; align-items: center; margin-top: 14px; width: 100%; }
.chips.left { align-items: flex-start; margin-top: 0; }
.chip-name {
  background: #fff; color: ${COLOR.ink};
  font-family: "Red Hat Text", sans-serif; font-weight: 700; font-size: 14px;
  padding: 4px 12px; border-radius: 3px; text-align: center; white-space: nowrap;
}
.chip-role {
  background: ${COLOR.gold}; color: ${COLOR.ink};
  font-family: "Red Hat Text", sans-serif; font-weight: 700; font-size: 13px;
  padding: 3px 12px; border-radius: 3px; margin-top: 3px; text-align: center; white-space: nowrap;
}
.note { margin-top: 10px; font-size: 12.5px; line-height: 1.45; color: #b6b9bb; text-align: center; }
.note.left { margin-top: 0; text-align: left; }

/* loose elements */
.pill {
  position: absolute;
  font-family: "Red Hat Mono", monospace; font-weight: 500; font-size: 13px;
  color: #e6e6e6; background: #121212; border: 1px solid ${COLOR.panelBorder};
  border-left: 3px solid ${COLOR.gold};
  padding: 7px 13px; border-radius: 5px; white-space: nowrap;
}
.pill.plain { border-left-color: ${COLOR.panelBorder}; }

.glyph { position: absolute; object-fit: contain; }
.text { position: absolute; }
.text.body { font-size: 14px; line-height: 1.55; color: #c3c6c8; }
.text.lede { font-size: 15px; line-height: 1.5; color: ${COLOR.text}; }
.text.small { font-size: 12.5px; line-height: 1.5; color: ${COLOR.textMuted}; }
.text.head {
  font-family: "Red Hat Display", sans-serif; font-weight: 700; font-size: 15px; color: #fff;
}

.caption {
  position: absolute; left: 0; right: 0; bottom: 20px; text-align: center;
  font-size: 14px; color: #cfd2d4;
}
`;
}
