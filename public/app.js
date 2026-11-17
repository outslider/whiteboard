/* ITホワイトボード クライアント */
'use strict';
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8);
const r1 = v => Math.round(v * 10) / 10;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('wb.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wb.' + k, JSON.stringify(v)); } catch {} },
};
function toast(msg, ms = 2000) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

/* ================================================================== */
/* 定数                                                                */
/* ================================================================== */
const FONTS = {
  gothic: { label: 'ゴシック', css: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP","Noto Sans CJK JP",sans-serif', ppt: 'Meiryo' },
  meiryo: { label: 'メイリオ', css: '"Meiryo","メイリオ","Hiragino Sans",sans-serif', ppt: 'Meiryo' },
  yugothic: { label: '游ゴシック', css: '"Yu Gothic","YuGothic","游ゴシック","Hiragino Sans",sans-serif', ppt: 'Yu Gothic' },
  udp: { label: 'BIZ UDPゴシック', css: '"BIZ UDPGothic","BIZ UDPゴシック","Hiragino Sans",sans-serif', ppt: 'BIZ UDPGothic' },
  maru: { label: '丸ゴシック', css: '"Hiragino Maru Gothic ProN","Kosugi Maru","BIZ UDPGothic","M PLUS Rounded 1c",sans-serif', ppt: 'BIZ UDPGothic' },
  mincho: { label: '明朝', css: '"Hiragino Mincho ProN","Yu Mincho","YuMincho","游明朝","Noto Serif JP","Noto Serif CJK JP",serif', ppt: 'Yu Mincho' },
  arial: { label: 'Arial', css: 'Arial,Helvetica,sans-serif', ppt: 'Arial' },
  mono: { label: '等幅 (Consolas)', css: 'Consolas,"Courier New",monospace', ppt: 'Consolas' },
  hand: { label: '手書き風', css: '"Segoe Print","Comic Sans MS","Klee One","Bradley Hand",cursive', ppt: 'Segoe Print' },
};
const STROKES = ['#1e1e1e', '#868e96', '#e03131', '#f08c00', '#2f9e44', '#1c7ed6', '#7048e8', '#c2255c', '#ffffff'];
const FILLS = ['none', '#ffffff', '#f1f3f5', '#ffe3e3', '#fff3bf', '#d3f9d8', '#d0ebff', '#e5dbff', '#ffd8a8', '#1e1e1e', '#1c7ed6', '#e03131'];
const STICKY_FILLS = ['#fff3bf', '#ffd8a8', '#ffdeeb', '#d3f9d8', '#d0ebff', '#e5dbff', '#f1f3f5'];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128];
const DEFAULT_STYLE = {
  stroke: '#1e1e1e', fill: 'none', sw: 2, dash: 'solid', radius: 8, opacity: 1,
  font: 'gothic', fs: 18, bold: false, italic: false, underline: false, color: '#1e1e1e', align: 'center',
  ah1: false, ah2: true, stickyFill: '#fff3bf', iconSize: 64,
};
const GRID = 10;
const BOX_TYPES = new Set(['rect', 'ellipse', 'diamond', 'sticky', 'frame', 'text', 'icon', 'pen']);
const TEXT_TYPES = new Set(['rect', 'ellipse', 'diamond', 'sticky', 'text', 'icon', 'line', 'frame']);
const SHAPE_TYPES = new Set(['rect', 'ellipse', 'diamond', 'sticky']);

/* ================================================================== */
/* 状態                                                                */
/* ================================================================== */
const params = new URLSearchParams(location.search);
const boardId = params.get('board');
let els = new Map();
let view = { x: 0, y: 0, z: 1 };
let tool = 'select';
let selection = new Set();
let style = Object.assign({}, DEFAULT_STYLE, LS.get('style', {}));
let gridOn = LS.get('grid', true);
let editing = null; // {id, before}
let placeItem = null; // {icon} or {src,w,h}
let hoverBind = null;
let drag = null;
let spaceDown = false;
let lastPointer = { x: 0, y: 0 };
const undoStack = [], redoStack = [];
const me = { name: LS.get('name', ''), color: LS.get('color', null) };
if (!me.color) { me.color = ['#e8590c', '#1c7ed6', '#2f9e44', '#c2255c', '#7048e8', '#0c8599', '#f08c00', '#5c940d'][Math.floor(Math.random() * 8)]; LS.set('color', me.color); }

/* ================================================================== */
/* テキストレイアウト                                                  */
/* ================================================================== */
const mctx = document.createElement('canvas').getContext('2d');
const fontCss = (el, fs) => `${el.italic ? 'italic ' : ''}${el.bold ? '700' : '400'} ${fs || el.fs || 18}px ${FONTS[el.font || 'gothic']?.css || FONTS.gothic.css}`;
const LH = 1.3;
const layoutCache = new Map();
function layoutText(text, el, maxW) {
  text = text || '';
  const font = fontCss(el);
  const key = font + '|' + (maxW ? Math.round(maxW) : 0) + '|' + text;
  let r = layoutCache.get(key);
  if (r) return r;
  mctx.font = font;
  const lines = [];
  let width = 0;
  for (const para of text.split('\n')) {
    if (!maxW) { const w = mctx.measureText(para).width; lines.push(para); width = Math.max(width, w); continue; }
    const tokens = para.match(/[A-Za-z0-9_\-.,:;!?'"()\[\]{}\/\\@#$%&*+=<>|~^`]+\s*|\s+|./gu) || [''];
    let cur = '', curW = 0;
    const push = () => { lines.push(cur); width = Math.max(width, curW); cur = ''; curW = 0; };
    for (const tk of tokens) {
      const tw = mctx.measureText(tk).width;
      if (curW + tw <= maxW || cur === '') {
        if (tw > maxW && cur === '') { // 長い単語は文字単位で分割
          for (const ch of tk) {
            const cw = mctx.measureText(ch).width;
            if (curW + cw > maxW && cur) push();
            cur += ch; curW += cw;
          }
        } else { cur += tk; curW += tw; }
      } else {
        push();
        if (/^\s+$/.test(tk)) continue;
        if (tw > maxW) { for (const ch of tk) { const cw = mctx.measureText(ch).width; if (curW + cw > maxW && cur) push(); cur += ch; curW += cw; } }
        else { cur = tk; curW = tw; }
      }
    }
    push();
  }
  const fs = el.fs || 18;
  r = { lines, w: width, h: lines.length * fs * LH };
  if (layoutCache.size > 3000) layoutCache.clear();
  layoutCache.set(key, r);
  return r;
}
function fitTextBox(el) {
  if (el.type !== 'text') return;
  if (el.autoW !== false) {
    const L = layoutText(el.text || ' ', el, 0);
    el.w = r1(Math.max(L.w + 6, 20));
    el.h = r1(Math.max(L.h, (el.fs || 18) * LH));
  } else {
    const L = layoutText(el.text || ' ', el, el.w);
    el.h = r1(Math.max(L.h, (el.fs || 18) * LH));
  }
}

/* ================================================================== */
/* ジオメトリ                                                          */
/* ================================================================== */
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
function edgePoint(t, toward) {
  const b = bbox(t), c = center(b);
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const gap = 6;
  let k;
  if (t.type === 'ellipse') {
    const rx = b.w / 2 + gap, ry = b.h / 2 + gap;
    k = 1 / Math.sqrt(dx * dx / (rx * rx) + dy * dy / (ry * ry));
  } else if (t.type === 'diamond') {
    k = 1 / (Math.abs(dx) / (b.w / 2 + gap) + Math.abs(dy) / (b.h / 2 + gap));
  } else {
    // アイコンはラベル部分も避けて線を止める
    let x1 = b.x - gap, y1 = b.y - gap, x2 = b.x + b.w + gap, y2 = b.y + b.h + gap;
    if (t.type === 'icon' && t.text) {
      const L = layoutText(t.text, t, 0);
      y2 = b.y + b.h + 4 + L.h + gap;
      if (Math.abs(dy) > 0 && dy > 0) { const hw = Math.max(b.w / 2, L.w / 2); x1 = Math.min(x1, c.x - hw - gap); x2 = Math.max(x2, c.x + hw + gap); }
    }
    k = Math.min(dx > 0 ? (x2 - c.x) / dx : dx < 0 ? (x1 - c.x) / dx : Infinity, dy > 0 ? (y2 - c.y) / dy : dy < 0 ? (y1 - c.y) / dy : Infinity);
  }
  return { x: c.x + dx * k, y: c.y + dy * k };
}
function linePts(el, map = els) {
  let a = { x: el.x1, y: el.y1 }, b = { x: el.x2, y: el.y2 };
  const A = el.sb && map.get(el.sb), B = el.eb && map.get(el.eb);
  const ca = A ? center(bbox(A, map)) : a, cb = B ? center(bbox(B, map)) : b;
  if (A) a = edgePoint(A, cb);
  if (B) b = edgePoint(B, ca);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}
function bbox(el, map = els) {
  if (el.type === 'line') {
    const p = linePts(el, map);
    return { x: Math.min(p.x1, p.x2), y: Math.min(p.y1, p.y2), w: Math.abs(p.x2 - p.x1), h: Math.abs(p.y2 - p.y1) };
  }
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}
// ラベルや線幅も含めた外形（エクスポート範囲・全体表示用）
function extBox(el, map = els) {
  const b = bbox(el, map);
  let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
  const pad = (el.sw || 0) + (el.type === 'line' ? 12 : 2);
  x1 -= pad; y1 -= pad; x2 += pad; y2 += pad;
  if (el.type === 'icon' && el.text) {
    const L = layoutText(el.text, el, 0);
    const cx = b.x + b.w / 2;
    x1 = Math.min(x1, cx - L.w / 2 - 4); x2 = Math.max(x2, cx + L.w / 2 + 4); y2 = Math.max(y2, b.y + b.h + 4 + L.h + 4);
  }
  if (el.type === 'frame') y1 -= 26;
  if (el.type === 'line' && el.text) {
    const L = layoutText(el.text, el, 0); const c = center(b);
    x1 = Math.min(x1, c.x - L.w / 2 - 6); x2 = Math.max(x2, c.x + L.w / 2 + 6); y1 = Math.min(y1, c.y - L.h / 2 - 4); y2 = Math.max(y2, c.y + L.h / 2 + 4);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function unionBox(list, fn = bbox) {
  if (!list.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const el of list) { const b = fn(el); x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
const snap = v => gridOn ? Math.round(v / GRID) * GRID : v;
const toWorld = (cx, cy) => { const r = stage.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z }; };
const toScreen = (x, y) => ({ x: x * view.z + view.x, y: y * view.z + view.y });
function sortedEls(list) {
  return list.sort((a, b) => ((a.type === 'frame') - (b.type === 'frame')) * -1 || (a.z || 0) - (b.z || 0) || (a.id < b.id ? -1 : 1));
}
const maxZ = () => { let m = 0; for (const e of els.values()) m = Math.max(m, e.z || 0); return m; };
const minZ = () => { let m = 0; for (const e of els.values()) m = Math.min(m, e.z || 0); return m; };

/* ================================================================== */
/* SVG レンダリング                                                    */
/* ================================================================== */
function dashArr(el) {
  const w = el.sw || 2;
  if (el.dash === 'dashed') return ` stroke-dasharray="${w * 4} ${w * 3}"`;
  if (el.dash === 'dotted') return ` stroke-dasharray="0.1 ${w * 2.5}" stroke-linecap="round"`;
  return '';
}
function strokeAttr(el) {
  if (!el.stroke || el.stroke === 'none' || !el.sw) return ' stroke="none"';
  return ` stroke="${esc(el.stroke)}" stroke-width="${el.sw}"${dashArr(el)} stroke-linejoin="round"`;
}
const fillAttr = f => ` fill="${!f || f === 'none' ? 'none' : esc(f)}"`;
function fontAttrs(el) {
  return ` font-family="${esc(FONTS[el.font || 'gothic']?.css || FONTS.gothic.css)}" font-size="${el.fs || 18}"` +
    (el.bold ? ' font-weight="700"' : '') + (el.italic ? ' font-style="italic"' : '') +
    (el.underline ? ' text-decoration="underline"' : '') + ` fill="${esc(el.color || '#1e1e1e')}"`;
}
// box 内にテキストを描画。valign: 'middle' | 'top'
function textSvg(el, box, valign, wrapW, alignOverride) {
  if (!el.text) return '';
  const L = layoutText(el.text, el, wrapW);
  const fs = el.fs || 18, lh = fs * LH;
  const align = alignOverride || el.align || 'center';
  const y0 = valign === 'middle' ? box.y + (box.h - L.h) / 2 : box.y;
  const x = align === 'left' ? box.x : align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  let s = `<text${fontAttrs(el)} text-anchor="${anchor}" dominant-baseline="central" xml:space="preserve">`;
  L.lines.forEach((ln, i) => { s += `<tspan x="${r1(x)}" y="${r1(y0 + i * lh + lh / 2)}">${esc(ln) || ' '}</tspan>`; });
  return s + '</text>';
}
function arrowHead(x1, y1, x2, y2, el) {
  const a = Math.atan2(y2 - y1, x2 - x1), w = el.sw || 2, L = 10 + w * 2.2, sp = 0.45;
  const p1 = [x2 - L * Math.cos(a - sp), y2 - L * Math.sin(a - sp)], p2 = [x2 - L * Math.cos(a + sp), y2 - L * Math.sin(a + sp)];
  return `<path d="M${r1(p1[0])} ${r1(p1[1])}L${r1(x2)} ${r1(y2)}L${r1(p2[0])} ${r1(p2[1])}Z" fill="${esc(el.stroke)}" stroke="${esc(el.stroke)}" stroke-width="${w}" stroke-linejoin="round"/>`;
}
function penPath(el) {
  const p = el.pts || [];
  if (p.length < 4) return p.length === 2 ? `M${r1(el.x + p[0])} ${r1(el.y + p[1])}l0.1 0` : '';
  let d = `M${r1(el.x + p[0])} ${r1(el.y + p[1])}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += `Q${r1(el.x + p[i])} ${r1(el.y + p[i + 1])} ${r1(el.x + mx)} ${r1(el.y + my)}`;
  }
  d += `L${r1(el.x + p[p.length - 2])} ${r1(el.y + p[p.length - 1])}`;
  return d;
}
function shapePath(el) {
  const { x, y, w, h } = el;
  if (el.type === 'ellipse') return `M${x} ${y + h / 2}a${w / 2} ${h / 2} 0 1 0 ${w} 0a${w / 2} ${h / 2} 0 1 0 ${-w} 0Z`;
  if (el.type === 'diamond') return `M${x + w / 2} ${y}L${x + w} ${y + h / 2}L${x + w / 2} ${y + h}L${x} ${y + h / 2}Z`;
  const r = Math.min(el.type === 'sticky' ? 3 : (el.radius || 0), w / 2, h / 2);
  if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}
/* o: {exp:true(エクスポート用), editing:id, srcMap, map, hitW} */
function renderEl(el, o = {}) {
  const map = o.map || els;
  const hideText = o.editing === el.id;
  const hitW = o.hitW || 10;
  const op = el.opacity != null && el.opacity < 1 ? ` opacity="${el.opacity}"` : '';
  let s = `<g${o.exp ? '' : ` data-id="${el.id}"`}${op}>`;
  const hit = (d, filled) => o.exp ? '' : `<path class="el-hit" d="${d}" fill="${filled ? 'transparent' : 'none'}" stroke="transparent" stroke-width="${hitW}" pointer-events="${filled ? 'all' : 'stroke'}"/>`;
  switch (el.type) {
    case 'rect': case 'ellipse': case 'diamond': case 'sticky': {
      const d = shapePath(el);
      if (el.type === 'sticky') s += `<path d="${shapePath({ ...el, x: el.x + 2, y: el.y + 4 })}" fill="rgba(0,0,0,0.10)"/>`;
      s += `<path d="${d}"${fillAttr(el.fill)}${strokeAttr(el)}/>`;
      s += hit(d, el.fill && el.fill !== 'none');
      if (!hideText) {
        const pad = el.type === 'sticky' ? 14 : el.type === 'diamond' ? Math.max(8, el.w * 0.18) : 8;
        const inner = { x: el.x + pad, y: el.y + pad, w: Math.max(4, el.w - pad * 2), h: Math.max(4, el.h - pad * 2) };
        s += textSvg(el, inner, el.type === 'sticky' && el.valign === 'top' ? 'top' : 'middle', inner.w);
      }
      break;
    }
    case 'frame': {
      const d = shapePath({ ...el, radius: 0 });
      if (!o.frameAsSlide) {
        s += `<path d="${d}"${fillAttr(el.fill)} stroke="#adb5bd" stroke-width="1.5" pointer-events="none"/>`;
        s += hit(d, false);
        if (!hideText) {
          const t = { ...el, fs: 14, bold: true, italic: false, underline: false, color: '#868e96', font: el.font || 'gothic' };
          const title = esc(el.text || 'フレーム');
          s += `<text${fontAttrs(t)} x="${el.x}" y="${el.y - 8}"${o.exp ? '' : ' class="frame-title" style="cursor:move"'}>${title}</text>`;
        }
      } else if (el.fill && el.fill !== 'none') s += `<path d="${d}"${fillAttr(el.fill)}/>`;
      break;
    }
    case 'text': {
      if (!o.exp) s += `<rect class="el-hit" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="transparent"/>`;
      if (!hideText) s += textSvg(el, { x: el.x, y: el.y, w: el.w, h: el.h }, 'top', el.autoW === false ? el.w : 0, el.align || 'left');
      break;
    }
    case 'line': {
      const p = linePts(el, map);
      const d = `M${r1(p.x1)} ${r1(p.y1)}L${r1(p.x2)} ${r1(p.y2)}`;
      s += `<path d="${d}" fill="none"${strokeAttr(el)} stroke-linecap="round"/>`;
      if (el.ah2) s += arrowHead(p.x1, p.y1, p.x2, p.y2, el);
      if (el.ah1) s += arrowHead(p.x2, p.y2, p.x1, p.y1, el);
      s += hit(d, false).replace(`stroke-width="${hitW}"`, `stroke-width="${Math.max(hitW * 1.4, (el.sw || 2) + 8)}"`);
      if (el.text && !hideText) {
        const L = layoutText(el.text, el, 0), cx = (p.x1 + p.x2) / 2, cy = (p.y1 + p.y2) / 2;
        s += `<rect x="${r1(cx - L.w / 2 - 5)}" y="${r1(cy - L.h / 2 - 2)}" width="${r1(L.w + 10)}" height="${r1(L.h + 4)}" rx="3" fill="#ffffff"/>`;
        s += textSvg(el, { x: cx - L.w / 2, y: cy - L.h / 2, w: L.w, h: L.h }, 'top', 0, 'center');
      }
      break;
    }
    case 'pen': {
      const d = penPath(el);
      s += `<path d="${d}" fill="none" stroke="${esc(el.stroke)}" stroke-width="${el.sw}" stroke-linecap="round" stroke-linejoin="round"${dashArr(el)}/>`;
      s += hit(d, false).replace(`stroke-width="${hitW}"`, `stroke-width="${Math.max(hitW, (el.sw || 2) + 8)}"`);
      break;
    }
    case 'icon': {
      if (el.src) {
        const href = (o.srcMap && o.srcMap[el.src]) || el.src;
        s += `<image href="${esc(href)}" xlink:href="${esc(href)}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="xMidYMid meet"/>`;
      } else {
        s += `<use href="#ic-${esc(el.icon)}" xlink:href="#ic-${esc(el.icon)}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}"/>`;
      }
      if (!o.exp) s += `<rect class="el-hit" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="transparent"/>`;
      if (el.text && !hideText) {
        const L = layoutText(el.text, el, 0);
        s += textSvg(el, { x: el.x + el.w / 2 - L.w / 2, y: el.y + el.h + 4, w: L.w, h: L.h }, 'top', 0, 'center');
      }
      break;
    }
  }
  return s + '</g>';
}

/* ================================================================== */
/* 画面描画                                                            */
/* ================================================================== */
const stage = $('#stage'), svg = $('#svg'), world = $('#world'), content = $('#content'), overlay = $('#overlay');
$('#defs').innerHTML = WB_ICONS.symbols;
let raf = 0, contentDirty = true;
const peers = new Map(); // cid -> {name,color,x,y,sel}
function invalidate(contentToo = true) { if (contentToo) contentDirty = true; if (!raf) raf = requestAnimationFrame(render); }

function render() {
  raf = 0;
  world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.z})`);
  const gs = GRID * 2 * view.z < 10 ? GRID * 10 : GRID * 2;
  stage.style.backgroundSize = `${gs * view.z}px ${gs * view.z}px`;
  stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
  stage.classList.toggle('grid', gridOn);
  $('#zoomPct').textContent = Math.round(view.z * 100) + '%';
  if (contentDirty) {
    contentDirty = false;
    const hitW = 10 / view.z;
    content.innerHTML = sortedEls([...els.values()]).map(el => renderEl(el, { editing: editing?.id, hitW })).join('');
  }
  renderOverlay();
}

function renderOverlay() {
  const z = view.z, sw = 1.5 / z, hs = 9 / z;
  let s = '';
  // 他ユーザーの選択
  for (const p of peers.values()) {
    for (const id of p.sel || []) {
      const el = els.get(id); if (!el) continue;
      const b = bbox(el);
      s += `<rect x="${b.x - 4 / z}" y="${b.y - 4 / z}" width="${b.w + 8 / z}" height="${b.h + 8 / z}" fill="none" stroke="${p.color}" stroke-width="${2 / z}" pointer-events="none"/>`;
      s += `<text x="${b.x - 4 / z}" y="${b.y - 8 / z}" font-size="${11 / z}" fill="${p.color}" font-weight="700" pointer-events="none">${esc(p.name)}</text>`;
    }
  }
  // 接続先ハイライト
  if (hoverBind && els.get(hoverBind)) {
    const b = bbox(els.get(hoverBind));
    s += `<rect x="${b.x - 6 / z}" y="${b.y - 6 / z}" width="${b.w + 12 / z}" height="${b.h + 12 / z}" rx="${6 / z}" fill="rgba(28,126,214,.08)" stroke="#1c7ed6" stroke-width="${2 / z}" pointer-events="none"/>`;
  }
  // 自分の選択
  const sel = [...selection].map(id => els.get(id)).filter(Boolean);
  if (sel.length && !(drag && drag.mode === 'create')) {
    for (const el of sel) {
      const b = bbox(el);
      if (el.type === 'line') continue;
      s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#1c7ed6" stroke-width="${sw}" ${sel.length > 1 ? `stroke-dasharray="${4 / z} ${3 / z}"` : ''} pointer-events="none"/>`;
    }
    if (sel.length === 1 && sel[0].type === 'line') {
      const p = linePts(sel[0]);
      s += `<path d="M${p.x1} ${p.y1}L${p.x2} ${p.y2}" stroke="#1c7ed6" stroke-width="${sw}" stroke-dasharray="${4 / z} ${3 / z}" pointer-events="none"/>`;
      for (const [k, x, y] of [['p1', p.x1, p.y1], ['p2', p.x2, p.y2]])
        s += `<circle class="handle" data-h="${k}" cx="${x}" cy="${y}" r="${6 / z}" fill="#fff" stroke="#1c7ed6" stroke-width="${2 / z}"/>`;
    } else if (!editing) {
      const B = unionBox(sel);
      if (sel.length > 1) s += `<rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" fill="none" stroke="#1c7ed6" stroke-width="${sw}" pointer-events="none"/>`;
      const hs2 = [['nw', B.x, B.y], ['n', B.x + B.w / 2, B.y], ['ne', B.x + B.w, B.y], ['e', B.x + B.w, B.y + B.h / 2],
        ['se', B.x + B.w, B.y + B.h], ['s', B.x + B.w / 2, B.y + B.h], ['sw', B.x, B.y + B.h], ['w', B.x, B.y + B.h / 2]];
      const onlyText = sel.length === 1 && sel[0].type === 'text';
      for (const [k, x, y] of hs2) {
        if (onlyText && !['e', 'w'].includes(k)) continue;
        if (B.w * z < 30 && ['n', 's'].includes(k)) continue;
        if (B.h * z < 30 && ['e', 'w'].includes(k)) continue;
        const cur = { nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw', n: 'ns', s: 'ns', e: 'ew', w: 'ew' }[k];
        s += `<rect class="handle" data-h="${k}" x="${x - hs / 2}" y="${y - hs / 2}" width="${hs}" height="${hs}" rx="${2 / z}" fill="#fff" stroke="#1c7ed6" stroke-width="${sw}" style="cursor:${cur}-resize"/>`;
      }
    }
  }
  // 範囲選択
  if (drag && drag.mode === 'marquee' && drag.box) {
    const b = drag.box;
    s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="rgba(28,126,214,.08)" stroke="#1c7ed6" stroke-width="${sw}" pointer-events="none"/>`;
  }
  // 配置プレビュー
  if (tool === 'place' && placeItem && drag == null && lastPointer.inside) {
    const sz = placeItem.w ? placeItem : { w: style.iconSize, h: style.iconSize };
    s += `<rect x="${lastPointer.wx - sz.w / 2}" y="${lastPointer.wy - sz.h / 2}" width="${sz.w}" height="${sz.h}" fill="rgba(28,126,214,.06)" stroke="#1c7ed6" stroke-dasharray="${4 / z}" stroke-width="${sw}" pointer-events="none"/>`;
  }
  // カーソル
  for (const p of peers.values()) {
    if (p.x == null) continue;
    s += `<g transform="translate(${p.x} ${p.y}) scale(${1 / z})" pointer-events="none">
      <path d="M0 0L0 16L4.5 12L7.5 18.5L10 17.3L7 11H13Z" fill="${p.color}" stroke="#fff" stroke-width="1.2"/>
      <rect x="12" y="16" width="${esc(p.name).length * 7 + 16}" height="18" rx="4" fill="${p.color}"/>
      <text x="20" y="29" font-size="11" fill="#fff" font-weight="700">${esc(p.name)}</text></g>`;
  }
  overlay.innerHTML = s;
}

/* ================================================================== */
/* 変更管理・同期                                                      */
/* ================================================================== */
const pendingOps = new Map(); // id -> op（未送信）
const unacked = new Map(); // seq -> ops
let sendTimer = 0, seq = 0, ws = null, wsReady = false, everConnected = false, reconnectDelay = 500;

function queuePut(el) { pendingOps.set(el.id, { o: 'put', el: clone(el) }); scheduleSend(); }
function queueDel(id) { pendingOps.set(id, { o: 'del', id }); scheduleSend(); }
function scheduleSend() {
  setSaveState('saving');
  if (!sendTimer) sendTimer = setTimeout(flushOps, 60);
}
function flushOps() {
  sendTimer = 0;
  if (!pendingOps.size || !wsReady) return;
  const ops = [...pendingOps.values()];
  pendingOps.clear();
  const s = ++seq;
  unacked.set(s, ops);
  wsSend({ t: 'ops', ops, seq: s });
}
function wsSend(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

// 履歴（Undo）付きの変更: before = Map(id -> el|null)
function snapshotIds(ids) { const m = new Map(); for (const id of ids) m.set(id, els.has(id) ? clone(els.get(id)) : null); return m; }
function commitHistory(before) {
  const after = new Map();
  let changed = false;
  for (const [id, b] of before) {
    const a = els.has(id) ? clone(els.get(id)) : null;
    after.set(id, a);
    if (JSON.stringify(a) !== JSON.stringify(b)) changed = true;
  }
  if (!changed) return;
  undoStack.push({ before, after });
  if (undoStack.length > 300) undoStack.shift();
  redoStack.length = 0;
}
function applyState(state) {
  for (const [id, v] of state) {
    if (v) { els.set(id, clone(v)); queuePut(v); }
    else if (els.has(id)) { els.delete(id); queueDel(id); selection.delete(id); }
  }
  invalidate(); updateProps(); sendSel();
}
function undo() { const h = undoStack.pop(); if (!h) return; redoStack.push(h); applyState(h.before); }
function redo() { const h = redoStack.pop(); if (!h) return; undoStack.push(h); applyState(h.after); }

// 単発の変更（履歴あり）
function change(ids, fn) {
  const before = snapshotIds(ids);
  fn();
  for (const id of ids) { if (els.has(id)) queuePut(els.get(id)); else if (before.get(id)) queueDel(id); }
  commitHistory(before);
  invalidate(); updateProps();
}
function addEls(list) {
  const before = new Map(list.map(e => [e.id, null]));
  for (const e of list) { els.set(e.id, e); queuePut(e); }
  commitHistory(before);
  invalidate();
}
function deleteEls(ids) {
  ids = new Set(ids);
  // フレームは中身を残す。線の接続先が消える場合は線の端点を固定座標化
  const touched = new Set(ids);
  for (const el of els.values()) if (el.type === 'line' && !ids.has(el.id) && (ids.has(el.sb) || ids.has(el.eb))) touched.add(el.id);
  change([...touched], () => {
    for (const id of touched) {
      const el = els.get(id); if (!el) continue;
      if (ids.has(id)) { els.delete(id); continue; }
      const p = linePts(el);
      if (ids.has(el.sb)) { el.x1 = p.x1; el.y1 = p.y1; delete el.sb; }
      if (ids.has(el.eb)) { el.x2 = p.x2; el.y2 = p.y2; delete el.eb; }
    }
  });
  for (const id of ids) selection.delete(id);
  sendSel(); updateProps();
}

let saveStateTimer = 0;
function setSaveState(s, at) {
  const el = $('#saveState');
  el.classList.toggle('err', s === 'offline');
  if (s === 'saving') el.textContent = wsReady ? '保存中…' : 'オフライン（変更は再接続時に保存）';
  else if (s === 'saved') el.textContent = '✓ 自動保存 ' + new Date(at || Date.now()).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  else if (s === 'offline') el.textContent = 'オフライン – 再接続中…';
  else if (s === 'connecting') el.textContent = '接続中…';
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = location.pathname.replace(/[^/]*$/, '');
  ws = new WebSocket(`${proto}//${location.host}${basePath}ws?board=${encodeURIComponent(boardId)}`);
  $('#connDot').className = '';
  ws.onopen = () => { reconnectDelay = 500; wsSend({ t: 'hello', name: me.name || 'ゲスト', color: me.color }); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    onServer(m);
  };
  ws.onclose = () => {
    wsReady = false;
    $('#connDot').className = 'off';
    setSaveState('offline');
    peers.clear(); renderPeers(); invalidate(false);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  };
}

function onServer(m) {
  switch (m.t) {
    case 'init': {
      // 送信済みだが未確認の変更を再送キューへ戻す
      for (const ops of unacked.values()) for (const op of ops) { const k = op.o === 'put' ? op.el.id : op.id; if (!pendingOps.has(k)) pendingOps.set(k, op); }
      unacked.clear();
      els = new Map(Object.entries(m.board.elements || {}));
      for (const op of pendingOps.values()) { if (op.o === 'put') els.set(op.el.id, clone(op.el)); else els.delete(op.id); }
      $('#boardName').value = m.board.name || '';
      document.title = (m.board.name || 'ボード') + ' - ITホワイトボード';
      peers.clear();
      for (const p of m.peers || []) peers.set(p.cid, { name: p.name, color: p.color, sel: p.sel || [] });
      wsReady = true;
      $('#connDot').className = 'on';
      for (const id of [...selection]) if (!els.has(id)) selection.delete(id);
      if (!everConnected) { everConnected = true; if (els.size) fitView(); }
      renderPeers(); invalidate(); updateProps();
      if (pendingOps.size) flushOps(); else setSaveState('saved', m.board.updated);
      sendSel();
      break;
    }
    case 'ops':
      for (const op of m.ops) {
        if (op.o === 'put') {
          if (drag && drag.ids && drag.ids.has && drag.ids.has(op.el.id)) continue; // 自分が操作中のものは無視
          if (editing && editing.id === op.el.id && els.has(op.el.id)) op.el.text = els.get(op.el.id).text; // 編集中は自分の入力を優先
          els.set(op.el.id, op.el);
        } else {
          els.delete(op.id); selection.delete(op.id);
          if (editing && editing.id === op.id) cancelEdit();
        }
      }
      invalidate(); updateProps();
      break;
    case 'ack':
      unacked.delete(m.seq);
      break;
    case 'saved':
      if (!pendingOps.size && !unacked.size) setSaveState('saved', m.at);
      break;
    case 'peer': peers.set(m.cid, { name: m.name, color: m.color, sel: [] }); renderPeers(); toast(`${m.name} さんが参加しました`); break;
    case 'peer-leave': peers.delete(m.cid); renderPeers(); invalidate(false); break;
    case 'cursor': { const p = peers.get(m.cid); if (p) { p.x = m.x; p.y = m.y; invalidate(false); } break; }
    case 'sel': { const p = peers.get(m.cid); if (p) { p.sel = m.ids; invalidate(false); } break; }
    case 'meta': $('#boardName').value = m.name; document.title = m.name + ' - ITホワイトボード'; break;
    case 'reload': undoStack.length = redoStack.length = 0; pendingOps.clear(); unacked.clear(); toast('履歴から復元されました'); ws.close(); break;
  }
}
function renderPeers() {
  const box = $('#peers');
  const all = [{ name: me.name || 'あなた', color: me.color, me: true }, ...peers.values()];
  box.innerHTML = all.slice(0, 8).map((p, i) => `<div class="avatar${p.me ? ' me' : ''}" data-i="${i}" style="background:${p.color}" title="${esc(p.name)}${p.me ? '（あなた・クリックで名前変更）' : '（クリックでカーソル位置へ）'}">${esc((p.name || '?').slice(0, 1))}</div>`).join('') +
    (all.length > 8 ? `<div class="avatar" style="background:#868e96">+${all.length - 8}</div>` : '');
  $$('.avatar', box).forEach(a => a.onclick = () => {
    const p = all[+a.dataset.i]; if (!p) return;
    if (p.me) askName(true);
    else if (p.x != null) { const r = stage.getBoundingClientRect(); view.x = r.width / 2 - p.x * view.z; view.y = r.height / 2 - p.y * view.z; invalidate(); }
  });
}
let lastSelSent = '';
function sendSel() {
  const s = JSON.stringify([...selection]);
  if (s === lastSelSent) return;
  lastSelSent = s;
  wsSend({ t: 'sel', ids: [...selection] });
}
let cursorTimer = 0, cursorPos = null;
function sendCursor(x, y) {
  cursorPos = { x: r1(x), y: r1(y) };
  if (cursorTimer) return;
  cursorTimer = setTimeout(() => { cursorTimer = 0; if (cursorPos) wsSend({ t: 'cursor', ...cursorPos }); }, 50);
}

/* ================================================================== */
/* 要素生成                                                            */
/* ================================================================== */
function textProps() {
  const { font, fs, bold, italic, underline, color, align } = style;
  return { font, fs, bold, italic, underline, color, align };
}
function newEl(type, x, y, extra = {}) {
  const base = { id: uid(), type, z: maxZ() + 1 };
  if (type === 'frame') base.z = minZ() - 1;
  switch (type) {
    case 'rect': case 'ellipse': case 'diamond':
      return Object.assign(base, { x, y, w: 0, h: 0, stroke: style.stroke, fill: style.fill, sw: style.sw, dash: style.dash, radius: type === 'rect' ? style.radius : 0, opacity: style.opacity, text: '' }, textProps(), extra);
    case 'sticky':
      return Object.assign(base, { x, y, w: 0, h: 0, stroke: 'none', fill: style.stickyFill, sw: 0, text: '' }, textProps(), { color: '#1e1e1e' }, extra);
    case 'frame':
      return Object.assign(base, { x, y, w: 0, h: 0, fill: '#ffffff', text: 'フレーム ' + ([...els.values()].filter(e => e.type === 'frame').length + 1), font: style.font }, extra);
    case 'text':
      return Object.assign(base, { x, y, w: 20, h: style.fs * LH, text: '', autoW: true, opacity: style.opacity }, textProps(), { align: style.align === 'center' ? 'left' : style.align }, extra);
    case 'line':
      return Object.assign(base, { x1: x, y1: y, x2: x, y2: y, stroke: style.stroke, sw: style.sw, dash: style.dash, ah1: false, ah2: false, opacity: style.opacity, text: '' }, textProps(), extra);
    case 'pen':
      return Object.assign(base, { x, y, w: 0, h: 0, pts: [0, 0], stroke: style.stroke, sw: Math.max(style.sw, 2), dash: 'solid', opacity: style.opacity }, extra);
    case 'icon':
      return Object.assign(base, { x, y, w: style.iconSize, h: style.iconSize, text: '' }, textProps(), { fs: Math.min(style.fs, 14), align: 'center' }, extra);
  }
}
const DEFAULT_SIZE = { rect: [160, 90], ellipse: [120, 120], diamond: [140, 100], sticky: [180, 180], frame: [960, 540] };

function placeIconAt(item, x, y) {
  let w = style.iconSize, h = style.iconSize;
  if (item.w && item.h) { w = item.w; h = item.h; }
  const name = item.icon ? (WB_ICONS.byId[item.icon]?.name || '') : '';
  const el = newEl('icon', snap(x - w / 2), snap(y - h / 2), item.icon ? { icon: item.icon, w, h, text: LS.get('iconLabels', true) ? name : '' } : { src: item.src, w, h });
  addEls([el]);
  selection = new Set([el.id]); sendSel(); updateProps();
  return el;
}

/* ================================================================== */
/* テキスト編集                                                        */
/* ================================================================== */
const editor = $('#editor');
function startEdit(id) {
  const el = els.get(id);
  if (!el || el.type === 'pen') return;
  if (editing) commitEdit();
  editing = { id, before: snapshotIds([id]) };
  selection = new Set([id]); sendSel();
  editor.value = el.text || '';
  editor.classList.remove('hidden');
  positionEditor();
  invalidate(); updateProps();
  editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length);
  setTimeout(() => { if (editing && document.activeElement !== editor) editor.focus(); }, 0);
}
function positionEditor() {
  if (!editing) return;
  const el = els.get(editing.id); if (!el) return;
  const z = view.z;
  const isFrame = el.type === 'frame';
  const tEl = isFrame ? { ...el, fs: 14, bold: true } : el;
  const fs = (tEl.fs || 18);
  Object.assign(editor.style, {
    fontFamily: FONTS[tEl.font || 'gothic'].css, fontSize: fs + 'px', fontWeight: tEl.bold ? '700' : '400',
    fontStyle: tEl.italic ? 'italic' : 'normal', textDecoration: tEl.underline ? 'underline' : 'none',
    color: isFrame ? '#868e96' : (tEl.color || '#1e1e1e'), textAlign: tEl.align || 'center', transform: `scale(${z})`,
    paddingTop: '0px',
  });
  let box, w, h;
  const text = editor.value || ' ';
  if (el.type === 'text') {
    const L = layoutText(text, el, el.autoW === false ? el.w : 0);
    box = { x: el.x, y: el.y }; w = el.autoW === false ? el.w : L.w + fs; h = L.h;
    editor.style.textAlign = el.align || 'left';
  } else if (SHAPE_TYPES.has(el.type)) {
    const pad = el.type === 'sticky' ? 14 : el.type === 'diamond' ? Math.max(8, el.w * 0.18) : 8;
    w = Math.max(4, el.w - pad * 2);
    const L = layoutText(text, el, w);
    h = L.h;
    box = { x: el.x + pad, y: el.type === 'sticky' && el.valign === 'top' ? el.y + pad : el.y + pad + (el.h - pad * 2 - L.h) / 2 };
  } else if (el.type === 'icon') {
    const L = layoutText(text, el, 0);
    w = Math.max(L.w + fs, el.w * 2.5, 120); h = L.h;
    box = { x: el.x + el.w / 2 - w / 2, y: el.y + el.h + 4 };
    editor.style.textAlign = 'center';
  } else if (el.type === 'line') {
    const p = linePts(el), L = layoutText(text, el, 0);
    w = Math.max(L.w + fs, 120); h = L.h;
    box = { x: (p.x1 + p.x2) / 2 - w / 2, y: (p.y1 + p.y2) / 2 - h / 2 };
    editor.style.textAlign = 'center';
  } else if (isFrame) {
    const L = layoutText(text, tEl, 0);
    w = Math.max(L.w + 40, 200); h = L.h;
    box = { x: el.x, y: el.y - 8 - L.h * 0.75 };
    editor.style.textAlign = 'left';
  }
  const s = toScreen(box.x, box.y);
  Object.assign(editor.style, { left: s.x + 'px', top: s.y + 'px', width: (w + 2) + 'px', height: (h + 2) + 'px' });
}
editor.addEventListener('input', () => {
  if (!editing) return;
  const el = els.get(editing.id); if (!el) return;
  el.text = editor.value;
  fitTextBox(el);
  queuePut(el);
  positionEditor();
  invalidate();
});
editor.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitEdit(); }
  if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    const k = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
    const el = els.get(editing.id); if (el) setProp(k, !el[k]);
  }
});
editor.addEventListener('blur', () => setTimeout(() => { if (editing && document.activeElement !== editor && !document.activeElement?.closest('#props')) commitEdit(); }, 0));
function commitEdit() {
  if (!editing) return;
  const { id, before } = editing;
  editing = null;
  editor.classList.add('hidden');
  const el = els.get(id);
  if (el) {
    el.text = editor.value.replace(/\s+$/, m => m.includes('\n') ? '' : m);
    if (el.type === 'text' && !el.text.trim()) { els.delete(id); queueDel(id); selection.delete(id); }
    else { fitTextBox(el); queuePut(el); }
  }
  commitHistory(before);
  invalidate(); updateProps(); sendSel();
}
function cancelEdit() { editing = null; editor.classList.add('hidden'); invalidate(); }

/* ================================================================== */
/* ポインター操作                                                      */
/* ================================================================== */
const pointers = new Map();
let pinch = null;

function setTool(t, keepPlace) {
  if (editing) commitEdit();
  tool = t;
  if (t !== 'place' && !keepPlace) { placeItem = null; $$('#palette .item.on').forEach(i => i.classList.remove('on')); }
  $$('#toolbar .tb[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  stage.className = stage.className.replace(/\btool-\S+/g, '').trim() + ' tool-' + t;
  if (t !== 'select') { selection.clear(); sendSel(); }
  invalidate(false); updateProps();
}

function hitIdAt(target) {
  const g = target && target.closest && target.closest('[data-id]');
  return g ? g.dataset.id : null;
}
function hitBindTarget(cx, cy, excludeId) {
  for (const n of document.elementsFromPoint(cx, cy)) {
    const id = hitIdAt(n);
    if (!id || id === excludeId) continue;
    const el = els.get(id);
    if (el && el.type !== 'line' && el.type !== 'pen' && el.type !== 'frame') return id;
    if (el && el.type === 'frame') continue;
  }
  return null;
}
function framesChildren(frameIds) {
  const out = new Set();
  for (const fid of frameIds) {
    const f = els.get(fid); if (!f || f.type !== 'frame') continue;
    for (const el of els.values()) if (el.id !== fid && el.type !== 'frame' && contains(f, bbox(el))) out.add(el.id);
  }
  return out;
}

stage.addEventListener('pointerdown', e => {
  if (e.target === editor) return;
  e.preventDefault(); // フォーカス移動を防ぐ（テキスト入力の取りこぼし防止）
  if (document.activeElement && document.activeElement !== editor && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) document.activeElement.blur();
  hideCtx();
  if (editing) commitEdit();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { startPinch(); return; }
  if (pointers.size > 2) return;
  stage.setPointerCapture(e.pointerId);
  const p = toWorld(e.clientX, e.clientY);
  const hitId = hitIdAt(e.target);
  const handle = e.target.closest && e.target.closest('.handle');

  if (e.button === 1 || spaceDown || tool === 'hand') {
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    stage.classList.add('panning');
    return;
  }
  if (e.button === 2) {
    if (hitId && !selection.has(hitId)) { selection = new Set([hitId]); sendSel(); invalidate(false); updateProps(); }
    return;
  }

  if (handle && selection.size) { startHandleDrag(handle.dataset.h, p, e); return; }

  switch (tool) {
    case 'select': {
      if (hitId) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (selection.has(hitId)) selection.delete(hitId); else selection.add(hitId);
          sendSel(); invalidate(false); updateProps();
          if (!selection.has(hitId)) return;
        } else if (!selection.has(hitId)) { selection = new Set([hitId]); sendSel(); updateProps(); }
        if (e.altKey) duplicateSelection(0);
        startMove(p);
      } else {
        if (!e.shiftKey) { selection.clear(); sendSel(); updateProps(); }
        drag = { mode: 'marquee', start: p, base: new Set(selection) };
      }
      invalidate(false);
      break;
    }
    case 'rect': case 'ellipse': case 'diamond': case 'sticky': case 'frame': {
      const el = newEl(tool, snap(p.x), snap(p.y));
      els.set(el.id, el);
      drag = { mode: 'create', id: el.id, start: { x: snap(p.x), y: snap(p.y) }, ids: new Set([el.id]), moved: false };
      invalidate();
      break;
    }
    case 'line': case 'arrow': {
      const sb = hitBindTarget(e.clientX, e.clientY);
      const el = newEl('line', snap(p.x), snap(p.y), { ah2: tool === 'arrow' ? true : false, ah1: false });
      if (sb) el.sb = sb;
      els.set(el.id, el);
      drag = { mode: 'create-line', id: el.id, ids: new Set([el.id]), start: p };
      invalidate();
      break;
    }
    case 'pen': {
      const el = newEl('pen', p.x, p.y);
      el.abs = [p.x, p.y];
      els.set(el.id, el);
      drag = { mode: 'pen', id: el.id, ids: new Set([el.id]) };
      invalidate();
      break;
    }
    case 'text': {
      setTool('select');
      if (hitId && TEXT_TYPES.has(els.get(hitId)?.type)) { startEdit(hitId); break; }
      const el = newEl('text', snap(p.x), snap(p.y - style.fs * LH / 2));
      els.set(el.id, el); queuePut(el);
      startEdit(el.id);
      editing.before = new Map([[el.id, null]]);
      break;
    }
    case 'eraser': {
      drag = { mode: 'erase', before: new Map(), ids: new Set() };
      eraseAt(e.clientX, e.clientY);
      break;
    }
    case 'place': {
      if (placeItem) placeIconAt(placeItem, p.x, p.y);
      if (!e.shiftKey) setTool('select');
      break;
    }
  }
});

function startMove(p) {
  const ids = new Set(selection);
  for (const id of framesChildren(ids)) ids.add(id);
  const orig = new Map();
  for (const id of ids) {
    const el = els.get(id);
    orig.set(id, clone(el));
    if (el.type === 'line') orig.get(id)._p = linePts(el);
  }
  const B = unionBox([...ids].map(id => els.get(id)));
  drag = { mode: 'move', start: p, ids, orig, before: snapshotIds(ids), B, moved: false };
}
function startHandleDrag(h, p, e) {
  const sel = [...selection].map(id => els.get(id)).filter(Boolean);
  if (h === 'p1' || h === 'p2') {
    const el = sel[0];
    drag = { mode: 'endpoint', h, id: el.id, ids: new Set([el.id]), before: snapshotIds([el.id]) };
    return;
  }
  const orig = new Map(sel.map(el => [el.id, clone(el)]));
  for (const el of sel) if (el.type === 'line') orig.get(el.id)._p = linePts(el);
  drag = { mode: 'resize', h, B: unionBox(sel), orig, ids: new Set(sel.map(e => e.id)), before: snapshotIds(sel.map(e => e.id)), start: p };
}
function eraseAt(cx, cy) {
  const r = 6;
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const id = hitIdAt(document.elementFromPoint(cx + dx, cy + dy));
    if (id && els.has(id) && !drag.ids.has(id)) {
      const el = els.get(id);
      if (el.type === 'frame') continue;
      drag.ids.add(id);
      drag.before.set(id, clone(el));
      els.delete(id); queueDel(id); selection.delete(id);
      invalidate();
    }
  }
}

window.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { movePinch(); return; }
  const p = toWorld(e.clientX, e.clientY);
  const r = stage.getBoundingClientRect();
  lastPointer = { x: e.clientX, y: e.clientY, wx: p.x, wy: p.y, inside: e.target === svg || svg.contains(e.target) };
  if (lastPointer.inside) sendCursor(p.x, p.y);
  if (tool === 'place') invalidate(false);
  if (!drag) return;
  switch (drag.mode) {
    case 'pan':
      view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy;
      positionEditor(); invalidate(false); break;
    case 'marquee': {
      const s = drag.start;
      drag.box = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
      const sel = new Set(drag.base);
      for (const el of els.values()) {
        const b = bbox(el);
        if (contains(drag.box, b) && (el.type !== 'frame' || true)) sel.add(el.id);
      }
      selection = sel; invalidate(false); break;
    }
    case 'move': {
      let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) * view.z < 3) return;
      drag.moved = true;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (gridOn) { dx = snap(drag.B.x + dx) - drag.B.x; dy = snap(drag.B.y + dy) - drag.B.y; }
      for (const [id, o] of drag.orig) {
        const el = els.get(id); if (!el) continue;
        if (el.type === 'line') {
          const sbIn = el.sb && drag.ids.has(el.sb), ebIn = el.eb && drag.ids.has(el.eb);
          if (!el.sb || sbIn || !o.sb) { el.x1 = o.x1 + dx; el.y1 = o.y1 + dy; }
          if (!el.eb || ebIn || !o.eb) { el.x2 = o.x2 + dx; el.y2 = o.y2 + dy; }
          // 単独で動かした線は接続を外す
          if (o.sb && !sbIn) { delete el.sb; el.x1 = o._p.x1 + dx; el.y1 = o._p.y1 + dy; }
          if (o.eb && !ebIn) { delete el.eb; el.x2 = o._p.x2 + dx; el.y2 = o._p.y2 + dy; }
        } else { el.x = o.x + dx; el.y = o.y + dy; }
        throttledPut(el);
      }
      invalidate(); break;
    }
    case 'create': {
      const el = els.get(drag.id);
      let x2 = snap(p.x), y2 = snap(p.y), { x: sx, y: sy } = drag.start;
      let w = x2 - sx, h = y2 - sy;
      if (e.shiftKey) {
        if (el.type === 'frame') { h = Math.sign(h || 1) * Math.abs(w) * 9 / 16; }
        else { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      }
      el.x = Math.min(sx, sx + w); el.y = Math.min(sy, sy + h); el.w = Math.abs(w); el.h = Math.abs(h);
      drag.moved = drag.moved || el.w > 4 || el.h > 4;
      invalidate(); break;
    }
    case 'create-line': case 'endpoint': {
      const el = els.get(drag.id);
      const which = drag.mode === 'endpoint' ? drag.h : 'p2';
      const target = hitBindTarget(e.clientX, e.clientY, el.id);
      const other = which === 'p2' ? el.sb : el.eb;
      hoverBind = target && target !== other ? target : null;
      let x = snap(p.x), y = snap(p.y);
      if (e.shiftKey) { // 水平・垂直・45度
        const q = linePts(el); const ox = which === 'p2' ? q.x1 : q.x2, oy = which === 'p2' ? q.y1 : q.y2;
        const a = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * Math.PI / 4, d = Math.hypot(x - ox, y - oy);
        x = ox + Math.cos(a) * d; y = oy + Math.sin(a) * d;
      }
      if (which === 'p2') { el.x2 = x; el.y2 = y; delete el.eb; } else { el.x1 = x; el.y1 = y; delete el.sb; }
      if (drag.mode === 'endpoint') throttledPut(el);
      invalidate(); break;
    }
    case 'pen': {
      const el = els.get(drag.id);
      const a = el.abs;
      const lx = a[a.length - 2], ly = a[a.length - 1];
      if (Math.hypot(p.x - lx, p.y - ly) * view.z < 2) return;
      a.push(r1(p.x), r1(p.y));
      el.pts = a.map((v, i) => v - (i % 2 ? el.y : el.x));
      invalidate(); break;
    }
    case 'resize': doResize(p, e.shiftKey); break;
    case 'erase': eraseAt(e.clientX, e.clientY); break;
  }
});

const putTimers = new Map();
function throttledPut(el) {
  if (putTimers.has(el.id)) return;
  putTimers.set(el.id, setTimeout(() => { putTimers.delete(el.id); const cur = els.get(el.id); if (cur) queuePut(cur); }, 50));
}

function doResize(p, shift) {
  const { h, B, orig } = drag;
  const sel = [...orig.values()];
  const single = sel.length === 1 ? sel[0] : null;
  let x1 = B.x, y1 = B.y, x2 = B.x + B.w, y2 = B.y + B.h;
  const px = snap(p.x), py = snap(p.y);
  if (h.includes('w')) x1 = Math.min(px, x2 - 4);
  if (h.includes('e')) x2 = Math.max(px, x1 + 4);
  if (h.includes('n')) y1 = Math.min(py, y2 - 4);
  if (h.includes('s')) y2 = Math.max(py, y1 + 4);
  let sx = (x2 - x1) / (B.w || 1), sy = (y2 - y1) / (B.h || 1);
  const keepAspect = (single && (single.type === 'icon' || single.type === 'pen')) ? !shift : shift;
  if (keepAspect && h.length === 2) {
    const s = Math.max(sx, sy); sx = sy = s;
    if (h.includes('w')) x1 = x2 - B.w * s; else x2 = x1 + B.w * s;
    if (h.includes('n')) y1 = y2 - B.h * s; else y2 = y1 + B.h * s;
  }
  const ax = h.includes('w') ? x2 : x1, ay = h.includes('n') ? y2 : y1;
  const bx = h.includes('w') ? B.x + B.w : B.x, by = h.includes('n') ? B.y + B.h : B.y;
  const tx = v => ax + (v - bx) * sx, ty = v => ay + (v - by) * sy;
  for (const o of sel) {
    const el = els.get(o.id); if (!el) continue;
    if (el.type === 'line') {
      if (!o.sb) { el.x1 = tx(o.x1); el.y1 = ty(o.y1); }
      if (!o.eb) { el.x2 = tx(o.x2); el.y2 = ty(o.y2); }
    } else if (el.type === 'text' && single) {
      el.x = Math.min(tx(o.x), tx(o.x + o.w)); el.w = Math.max(20, Math.abs(o.w * sx)); el.autoW = false; fitTextBox(el);
    } else {
      const nx1 = tx(o.x), nx2 = tx(o.x + o.w), ny1 = ty(o.y), ny2 = ty(o.y + o.h);
      el.x = r1(Math.min(nx1, nx2)); el.y = r1(Math.min(ny1, ny2));
      if (el.type === 'text') { el.w = Math.max(20, o.w * sx); if (o.autoW === false) fitTextBox(el); }
      else { el.w = r1(Math.max(4, Math.abs(nx2 - nx1))); el.h = r1(Math.max(4, Math.abs(ny2 - ny1))); }
      if (el.type === 'pen') el.pts = o.pts.map((v, i) => r1(v * (i % 2 ? sy : sx)));
    }
    throttledPut(el);
  }
  invalidate();
}

window.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (!drag) return;
  const d = drag; drag = null;
  stage.classList.remove('panning');
  switch (d.mode) {
    case 'move':
      if (d.moved) { for (const id of d.ids) { const el = els.get(id); if (el) queuePut(el); } commitHistory(d.before); }
      break;
    case 'marquee': sendSel(); updateProps(); break;
    case 'create': {
      const el = els.get(d.id);
      if (!d.moved || el.w < 6 || el.h < 6) {
        const [w, h] = DEFAULT_SIZE[el.type];
        el.w = w; el.h = h; el.x = snap(d.start.x - (el.type === 'frame' ? 0 : w / 2)); el.y = snap(d.start.y - (el.type === 'frame' ? 0 : h / 2));
      }
      els.delete(el.id);
      addEls([el]);
      selection = new Set([el.id]); sendSel();
      setTool('select'); selection = new Set([el.id]); sendSel(); updateProps();
      if (el.type === 'sticky') startEdit(el.id);
      break;
    }
    case 'create-line': {
      const el = els.get(d.id);
      if (hoverBind) el.eb = hoverBind;
      hoverBind = null;
      const p = linePts(el);
      if (Math.hypot(p.x2 - p.x1, p.y2 - p.y1) < 8 && !el.eb) { els.delete(el.id); invalidate(); break; }
      els.delete(el.id);
      addEls([el]);
      setTool('select'); selection = new Set([el.id]); sendSel(); updateProps();
      break;
    }
    case 'endpoint': {
      const el = els.get(d.id);
      if (hoverBind) { if (d.h === 'p2') el.eb = hoverBind; else el.sb = hoverBind; }
      hoverBind = null;
      queuePut(el); commitHistory(d.before); invalidate();
      break;
    }
    case 'pen': {
      const el = els.get(d.id);
      const a = el.abs; delete el.abs;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let i = 0; i < a.length; i += 2) { x1 = Math.min(x1, a[i]); x2 = Math.max(x2, a[i]); y1 = Math.min(y1, a[i + 1]); y2 = Math.max(y2, a[i + 1]); }
      Object.assign(el, { x: r1(x1), y: r1(y1), w: r1(Math.max(x2 - x1, 1)), h: r1(Math.max(y2 - y1, 1)) });
      el.pts = a.map((v, i) => r1(v - (i % 2 ? el.y : el.x)));
      els.delete(el.id);
      addEls([el]);
      break;
    }
    case 'resize':
      for (const id of d.ids) { const el = els.get(id); if (el) queuePut(el); }
      commitHistory(d.before);
      break;
    case 'erase':
      if (d.before.size) { const before = d.before; undoStack.push({ before, after: new Map([...before.keys()].map(k => [k, null])) }); redoStack.length = 0; }
      break;
  }
  invalidate();
});
window.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pinch = null; });

function startPinch() {
  // 作成中の操作は取り消し
  if (drag && ['create', 'create-line', 'pen'].includes(drag.mode)) { els.delete(drag.id); }
  drag = null;
  const [a, b] = [...pointers.values()];
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: { ...view } };
  invalidate();
}
function movePinch() {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const r = stage.getBoundingClientRect();
  const z = clampZ(pinch.view.z * d / pinch.d);
  const wx = (pinch.cx - r.left - pinch.view.x) / pinch.view.z, wy = (pinch.cy - r.top - pinch.view.y) / pinch.view.z;
  view.z = z; view.x = cx - r.left - wx * z; view.y = cy - r.top - wy * z;
  positionEditor(); invalidate();
}

stage.addEventListener('dblclick', e => {
  if (tool !== 'select') return;
  const id = hitIdAt(e.target);
  if (id) { if (TEXT_TYPES.has(els.get(id)?.type)) startEdit(id); return; }
  const p = toWorld(e.clientX, e.clientY);
  const el = newEl('text', snap(p.x), snap(p.y - style.fs * LH / 2));
  els.set(el.id, el); queuePut(el);
  startEdit(el.id);
  editing.before = new Map([[el.id, null]]);
});

/* ---------- ズーム ---------- */
const clampZ = z => Math.min(8, Math.max(0.05, z));
function zoomAt(cx, cy, factor) {
  const r = stage.getBoundingClientRect();
  const sx = cx - r.left, sy = cy - r.top;
  const z = clampZ(view.z * factor);
  view.x = sx - (sx - view.x) * z / view.z; view.y = sy - (sy - view.y) * z / view.z; view.z = z;
  positionEditor(); invalidate();
}
let wheelZoom = LS.get('wheelZoom', true);
stage.addEventListener('wheel', e => {
  e.preventDefault();
  const pinchGesture = e.ctrlKey || e.metaKey;
  if (pinchGesture || (wheelZoom && !e.shiftKey && Math.abs(e.deltaX) < 1 && e.deltaMode !== 0) || (wheelZoom && !e.shiftKey && Math.abs(e.deltaX) < 1 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY))) {
    const f = Math.exp(-e.deltaY * (pinchGesture ? 0.01 : 0.0015) * (e.deltaMode === 1 ? 30 : 1));
    zoomAt(e.clientX, e.clientY, f);
  } else {
    view.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; view.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    positionEditor(); invalidate(false);
  }
}, { passive: false });
function fitView(list) {
  list = list || [...els.values()];
  const r = stage.getBoundingClientRect();
  if (!list.length) { view = { x: r.width / 2, y: r.height / 2, z: 1 }; invalidate(); return; }
  const B = unionBox(list, extBox);
  const padL = $('#palette').classList.contains('collapsed') ? 60 : $('#palette').offsetWidth + 40;
  const padR = $('#props').offsetWidth + 40;
  const aw = Math.max(200, r.width - padL - padR), ah = Math.max(200, r.height - 140);
  const z = clampZ(Math.min(aw / B.w, ah / B.h, 2));
  view = { z, x: padL + (aw - B.w * z) / 2 - B.x * z, y: 70 + (ah - B.h * z) / 2 - B.y * z };
  positionEditor(); invalidate();
}
$('#zoomIn').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); };
$('#zoomOut').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); };
$('#zoomPct').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / view.z); };
$('#zoomFit').onclick = () => fitView();
$('#gridBtn').onclick = () => { gridOn = !gridOn; LS.set('grid', gridOn); $('#gridBtn').classList.toggle('on', gridOn); invalidate(false); };
$('#gridBtn').classList.toggle('on', gridOn);

/* ================================================================== */
/* キーボード                                                          */
/* ================================================================== */
const TOOL_KEYS = { v: 'select', h: 'hand', r: 'rect', o: 'ellipse', d: 'diamond', a: 'arrow', l: 'line', p: 'pen', t: 'text', s: 'sticky', f: 'frame', e: 'eraser' };
window.addEventListener('keydown', e => {
  if (!boardId) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || $('.modal')) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.key === ' ' && !spaceDown) { spaceDown = true; stage.classList.add('panning'); e.preventDefault(); return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'a') { e.preventDefault(); selection = new Set(els.keys()); sendSel(); invalidate(false); updateProps(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSelection(20); return; }
  if (mod && (k === '0')) { e.preventDefault(); $('#zoomPct').click(); return; }
  if (mod && ['b', 'i', 'u'].includes(k) && selection.size) { e.preventDefault(); const key = { b: 'bold', i: 'italic', u: 'underline' }[k]; const first = els.get([...selection][0]); setProp(key, !first?.[key]); return; }
  if (mod && k === ']') { e.preventDefault(); layer(e.shiftKey ? 'front' : 'up'); return; }
  if (mod && k === '[') { e.preventDefault(); layer(e.shiftKey ? 'back' : 'down'); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { if (selection.size) { e.preventDefault(); deleteEls([...selection]); } return; }
  if (e.key === 'Escape') { selection.clear(); sendSel(); setTool('select'); hideCtx(); return; }
  if (e.key === 'Enter' && selection.size === 1) { e.preventDefault(); startEdit([...selection][0]); return; }
  if (e.key.startsWith('Arrow') && selection.size) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    const ids = [...selection, ...framesChildren(selection)];
    change(ids, () => { for (const id of ids) { const el = els.get(id); if (el.type === 'line') { el.x1 += dx; el.x2 += dx; el.y1 += dy; el.y2 += dy; } else { el.x += dx; el.y += dy; } } });
    return;
  }
  if (e.key === '+' || e.key === '=') { $('#zoomIn').click(); return; }
  if (e.key === '-') { $('#zoomOut').click(); return; }
  if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) { fitView(); return; }
  if (TOOL_KEYS[k] && !e.altKey) setTool(TOOL_KEYS[k]);
});
window.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; stage.classList.remove('panning'); } });
window.addEventListener('blur', () => { spaceDown = false; });

/* ---------- コピー&ペースト ---------- */
function selectionPayload(ids = selection) {
  const list = [...ids].map(id => els.get(id)).filter(Boolean);
  for (const id of framesChildren(ids)) if (!ids.has(id)) list.push(els.get(id));
  return { wbClip: 1, els: list.map(clone) };
}
function pasteEls(list, offset, at) {
  if (!list.length) return;
  const idMap = new Map(list.map(e => [e.id, uid()]));
  let dx = offset, dy = offset;
  if (at) { const B = unionBox(list, el => bbox(el, new Map(list.map(x => [x.id, x])))); dx = snap(at.x - B.x - B.w / 2); dy = snap(at.y - B.y - B.h / 2); }
  let z = maxZ();
  const out = sortedEls(list.map(clone)).map(el => {
    el.id = idMap.get(el.id);
    el.z = el.type === 'frame' ? el.z : ++z;
    if (el.type === 'line') {
      el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy;
      el.sb = el.sb && idMap.get(el.sb); el.eb = el.eb && idMap.get(el.eb);
      if (!el.sb) delete el.sb; if (!el.eb) delete el.eb;
    } else { el.x += dx; el.y += dy; }
    return el;
  });
  addEls(out);
  selection = new Set(out.map(e => e.id)); sendSel(); updateProps();
}
function duplicateSelection(off) {
  const p = selectionPayload();
  if (!p.els.length) return;
  // 接続先が複製対象外の線は接続先を固定座標へ
  for (const el of p.els) if (el.type === 'line') { const q = linePts(els.get(el.id)); if (el.sb && !p.els.find(x => x.id === el.sb)) { el.x1 = q.x1; el.y1 = q.y1; } if (el.eb && !p.els.find(x => x.id === el.eb)) { el.x2 = q.x2; el.y2 = q.y2; } }
  pasteEls(p.els, off);
}
let internalClip = null;
document.addEventListener('copy', e => {
  if (!boardId || editing || /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || !selection.size) return;
  const p = selectionPayload();
  for (const el of p.els) if (el.type === 'line') { const q = linePts(els.get(el.id)); if (el.sb && !p.els.find(x => x.id === el.sb)) { el.x1 = q.x1; el.y1 = q.y1; } if (el.eb && !p.els.find(x => x.id === el.eb)) { el.x2 = q.x2; el.y2 = q.y2; } }
  internalClip = p;
  e.clipboardData.setData('text/plain', JSON.stringify(p));
  e.preventDefault();
  toast(`${p.els.length} 個コピーしました`, 1200);
});
document.addEventListener('cut', e => {
  if (!boardId || editing || /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || !selection.size) return;
  const p = selectionPayload();
  for (const el of p.els) if (el.type === 'line') { const q = linePts(els.get(el.id)); if (el.sb && !p.els.find(x => x.id === el.sb)) { el.x1 = q.x1; el.y1 = q.y1; } if (el.eb && !p.els.find(x => x.id === el.eb)) { el.x2 = q.x2; el.y2 = q.y2; } }
  internalClip = p;
  e.clipboardData.setData('text/plain', JSON.stringify(p));
  e.preventDefault();
  deleteEls([...selection]);
});
document.addEventListener('paste', async e => {
  if (!boardId || editing || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const at = lastPointer.inside ? { x: lastPointer.wx, y: lastPointer.wy } : viewCenter();
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); for (const f of files) await insertImageFile(f, at); return; }
  const txt = e.clipboardData?.getData('text/plain');
  if (!txt) return;
  e.preventDefault();
  try {
    const p = JSON.parse(txt);
    if (p && p.wbClip && Array.isArray(p.els)) { pasteEls(p.els, 0, at); return; }
  } catch {}
  const el = newEl('text', snap(at.x), snap(at.y), { text: txt.slice(0, 20000) });
  fitTextBox(el);
  addEls([el]); selection = new Set([el.id]); sendSel(); updateProps();
});
function viewCenter() { const r = stage.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }

/* ---------- 画像 ---------- */
async function uploadImage(file, library) {
  const res = await fetch('api/assets', { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name || 'image'), 'X-Library': library ? '1' : '0' } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
function imageSize(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 200, h: i.naturalHeight || 200 }); i.onerror = () => res({ w: 200, h: 200 }); i.src = src; });
}
async function insertImageFile(file, at) {
  try {
    toast('画像をアップロード中…');
    const r = await uploadImage(file, false);
    let { w, h } = await imageSize(r.url);
    const m = 400 / Math.max(w, h); if (m < 1) { w *= m; h *= m; }
    placeIconAt({ src: r.url, w: Math.round(w), h: Math.round(h) }, at.x, at.y);
    toast('画像を挿入しました');
  } catch (err) { toast('アップロード失敗: ' + err.message, 4000); }
}
$('#imgBtn').onclick = () => $('#imgFile').click();
$('#imgFile').onchange = async e => { const c = viewCenter(); let i = 0; for (const f of e.target.files) await insertImageFile(f, { x: c.x + i * 30, y: c.y + (i++) * 30 }); e.target.value = ''; };
let dropHint = null;
stage.addEventListener('dragover', e => {
  e.preventDefault();
  if (!dropHint && [...e.dataTransfer.types].includes('Files')) { dropHint = document.createElement('div'); dropHint.id = 'dropHint'; dropHint.textContent = 'ここに画像をドロップ'; stage.append(dropHint); }
});
stage.addEventListener('dragleave', e => { if (dropHint && !stage.contains(e.relatedTarget)) { dropHint.remove(); dropHint = null; } });
stage.addEventListener('drop', async e => {
  e.preventDefault();
  if (dropHint) { dropHint.remove(); dropHint = null; }
  const p = toWorld(e.clientX, e.clientY);
  const item = e.dataTransfer.getData('text/x-wb-item');
  if (item) { placeIconAt(JSON.parse(item), p.x, p.y); setTool('select'); return; }
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  let i = 0; for (const f of files) await insertImageFile(f, { x: p.x + i * 30, y: p.y + (i++) * 30 });
  if (!files.length && [...e.dataTransfer.files].some(f => f.name.endsWith('.json'))) toast('JSONはボード一覧画面から取り込めます');
});

/* ================================================================== */
/* 重なり順・整列                                                      */
/* ================================================================== */
function layer(kind) {
  const ids = [...selection].filter(id => els.get(id)?.type !== 'frame');
  if (!ids.length) return;
  const all = sortedEls([...els.values()].filter(e => e.type !== 'frame'));
  change(ids, () => {
    if (kind === 'front') { let z = maxZ(); for (const el of all) if (selection.has(el.id)) el.z = ++z; }
    else if (kind === 'back') { let z = Math.min(0, ...all.map(e => e.z || 0)) - ids.length - 1; for (const el of all) if (selection.has(el.id)) el.z = ++z; }
    else {
      for (const id of ids) {
        const el = els.get(id), i = all.findIndex(e => e.id === id);
        const nb = all[kind === 'up' ? i + 1 : i - 1];
        if (nb && !selection.has(nb.id)) { el.z = (nb.z || 0) + (kind === 'up' ? 0.5 : -0.5); }
      }
    }
  });
}
function align(kind) {
  const sel = [...selection].map(id => els.get(id)).filter(e => e && e.type !== 'line');
  if (sel.length < 2) return;
  const B = unionBox(sel);
  change(sel.map(e => e.id), () => {
    if (kind === 'hdist' || kind === 'vdist') {
      const hz = kind === 'hdist';
      const arr = [...sel].sort((a, b) => hz ? a.x - b.x : a.y - b.y);
      const total = arr.reduce((s, e) => s + (hz ? e.w : e.h), 0);
      const gap = ((hz ? B.w : B.h) - total) / (arr.length - 1);
      let pos = hz ? B.x : B.y;
      for (const e of arr) { if (hz) { e.x = r1(pos); pos += e.w + gap; } else { e.y = r1(pos); pos += e.h + gap; } }
      return;
    }
    for (const e of sel) {
      if (kind === 'left') e.x = B.x; if (kind === 'right') e.x = B.x + B.w - e.w; if (kind === 'hcenter') e.x = r1(B.x + B.w / 2 - e.w / 2);
      if (kind === 'top') e.y = B.y; if (kind === 'bottom') e.y = B.y + B.h - e.h; if (kind === 'vcenter') e.y = r1(B.y + B.h / 2 - e.h / 2);
    }
  });
}

/* ================================================================== */
/* プロパティパネル                                                    */
/* ================================================================== */
function applicable(el, key) {
  const t = el.type;
  switch (key) {
    case 'stroke': case 'dash': return ['rect', 'ellipse', 'diamond', 'line', 'pen'].includes(t);
    case 'sw': return ['rect', 'ellipse', 'diamond', 'line', 'pen'].includes(t);
    case 'fill': return ['rect', 'ellipse', 'diamond', 'sticky', 'frame'].includes(t);
    case 'radius': return t === 'rect';
    case 'ah1': case 'ah2': return t === 'line';
    case 'font': case 'fs': case 'bold': case 'italic': case 'underline': case 'color': return TEXT_TYPES.has(t) && t !== 'frame';
    case 'align': return ['rect', 'ellipse', 'diamond', 'sticky', 'text'].includes(t);
    case 'opacity': return true;
    case 'valign': return t === 'sticky';
  }
  return false;
}
function setProp(key, val) {
  const ids = [...selection].filter(id => els.has(id) && applicable(els.get(id), key));
  if (key === 'fill' && [...selection].some(id => els.get(id)?.type === 'sticky')) style.stickyFill = val;
  if (!(key === 'fill' && ids.length && ids.every(id => els.get(id).type === 'sticky'))) style[key] = val;
  LS.set('style', style);
  if (ids.length) {
    change(ids, () => { for (const id of ids) { const el = els.get(id); el[key] = val; fitTextBox(el); } });
    if (editing) positionEditor();
  }
  updateProps();
}
function setIconSize(sz) {
  style.iconSize = sz; LS.set('style', style);
  const ids = [...selection].filter(id => els.get(id)?.type === 'icon');
  if (ids.length) change(ids, () => { for (const id of ids) { const el = els.get(id); const c = center(el); const k = sz / Math.max(el.w, el.h); el.w = r1(el.w * k); el.h = r1(el.h * k); el.x = r1(c.x - el.w / 2); el.y = r1(c.y - el.h / 2); } });
  updateProps();
}

function swatches(key, colors, cur) {
  return `<div class="sw">${colors.map(c => `<button data-k="${key}" data-v="${c}" class="${c === 'none' ? 'none ' : ''}${c === cur ? 'on' : ''}" style="${c !== 'none' ? 'background:' + c : ''}" title="${c === 'none' ? '透明' : c}"></button>`).join('')}
    <input type="color" data-k="${key}" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#000000'}" title="その他の色"></div>`;
}
function seg(key, opts, cur) {
  return `<div class="seg">${opts.map(([v, l, t]) => `<button data-k="${key}" data-v='${JSON.stringify(v)}' class="${JSON.stringify(v) === JSON.stringify(cur) ? 'on' : ''}" title="${t || ''}">${l}</button>`).join('')}</div>`;
}
let propsCollapsed = LS.get('propsCollapsed', false);
function updateProps() {
  const body = $('#propsBody');
  $('#props').classList.toggle('collapsed', propsCollapsed);
  const sel = [...selection].map(id => els.get(id)).filter(Boolean);
  const createMap = { rect: 'rect', ellipse: 'ellipse', diamond: 'diamond', sticky: 'sticky', frame: 'frame', text: 'text', line: 'line', arrow: 'line', pen: 'pen', place: 'icon' };
  const types = sel.length ? new Set(sel.map(e => e.type)) : new Set(createMap[tool] ? [createMap[tool]] : []);
  if (!types.size) { body.innerHTML = `<div class="row" style="color:var(--muted);font-size:12px;line-height:1.7">要素を選択するとスタイルを変更できます。<br>・ダブルクリックで文字入力<br>・矢印は図形/アイコンの上から引くと自動接続<br>・Space+ドラッグ / ホイールで移動・拡大縮小</div>`; $('#propsTitle').textContent = 'スタイル'; return; }
  $('#propsTitle').textContent = sel.length ? `選択中: ${sel.length} 個` : '新規作成のスタイル';
  const v = key => { const e = sel.find(x => applicable(x, key)); return e && e[key] !== undefined ? e[key] : style[key]; };
  const has = key => [...types].some(t => applicable({ type: t }, key));
  let h = '';
  if (has('stroke')) h += `<div class="row"><div class="lbl">線の色</div>${swatches('stroke', STROKES, v('stroke'))}</div>`;
  if (has('fill')) {
    const onlySticky = [...types].every(t => t === 'sticky');
    h += `<div class="row"><div class="lbl">塗りつぶし</div>${swatches('fill', onlySticky ? STICKY_FILLS : FILLS, onlySticky ? (sel[0]?.fill || style.stickyFill) : v('fill'))}</div>`;
  }
  if (has('sw')) h += `<div class="row"><div class="lbl">線の太さ</div>${seg('sw', [[1, '細'], [2, '標準'], [4, '太'], [8, '極太']], v('sw'))}</div>`;
  if (has('dash')) h += `<div class="row"><div class="lbl">線種</div>${seg('dash', [['solid', '―', '実線'], ['dashed', '- -', '破線'], ['dotted', '···', '点線']], v('dash'))}</div>`;
  if (has('radius')) h += `<div class="row"><div class="lbl">角</div>${seg('radius', [[0, '直角'], [8, '角丸'], [24, '大きく丸く']], v('radius'))}</div>`;
  if (has('ah2')) h += `<div class="row"><div class="lbl">矢印</div><div class="seg">
      <button data-k="ah1" data-v='${JSON.stringify(!v('ah1'))}' class="${v('ah1') ? 'on' : ''}">◀ 始点</button>
      <button data-k="ah2" data-v='${JSON.stringify(!v('ah2'))}' class="${v('ah2') ? 'on' : ''}">終点 ▶</button></div></div>`;
  if (has('font')) {
    h += `<div class="row"><div class="lbl">フォント</div><select data-k="font">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${k === v('font') ? 'selected' : ''} style="font-family:${esc(f.css)}">${f.label}</option>`).join('')}</select></div>`;
    h += `<div class="row"><div class="lbl">文字サイズ</div><div class="flex"><input type="number" data-k="fs" min="6" max="400" value="${v('fs')}" style="width:70px">
      <select data-k="fs" style="flex:1">${FONT_SIZES.map(s => `<option value="${s}" ${s === v('fs') ? 'selected' : ''}>${s}px</option>`).join('')}${FONT_SIZES.includes(v('fs')) ? '' : `<option selected>${v('fs')}px</option>`}</select></div></div>`;
    h += `<div class="row"><div class="flex"><div class="seg" style="flex:1">
      <button data-k="bold" data-v='${!v('bold')}' class="${v('bold') ? 'on' : ''}" title="太字 (Ctrl+B)"><b>B</b></button>
      <button data-k="italic" data-v='${!v('italic')}' class="${v('italic') ? 'on' : ''}" title="斜体 (Ctrl+I)"><i>I</i></button>
      <button data-k="underline" data-v='${!v('underline')}' class="${v('underline') ? 'on' : ''}" title="下線 (Ctrl+U)"><u>U</u></button></div>
      ${has('align') ? `<div style="flex:1.2">${seg('align', [['left', '左', '左揃え'], ['center', '中', '中央揃え'], ['right', '右', '右揃え']], v('align'))}</div>` : ''}</div></div>`;
    h += `<div class="row"><div class="lbl">文字色</div>${swatches('color', STROKES.concat(['#1864ab', '#2b8a3e']), v('color'))}</div>`;
  }
  if (has('valign')) h += `<div class="row"><div class="lbl">付箋の文字位置</div>${seg('valign', [['middle', '中央'], ['top', '上']], v('valign') || 'middle')}</div>`;
  if (types.has('icon')) h += `<div class="row"><div class="lbl">アイコンサイズ</div>${seg('iconSize', [[40, 'S'], [64, 'M'], [96, 'L'], [128, 'XL']], sel.length ? Math.round(Math.max(sel.find(e => e.type === 'icon').w, sel.find(e => e.type === 'icon').h)) : style.iconSize)}</div>`;
  h += `<div class="row"><div class="lbl">不透明度 <span id="opv">${Math.round(v('opacity') * 100)}%</span></div><input type="range" data-k="opacity" min="0.1" max="1" step="0.05" value="${v('opacity')}" style="width:100%"></div>`;
  if (sel.length) {
    h += `<div class="row"><div class="lbl">重なり順</div><div class="minibtns">
      <button data-act="front" title="最前面 (Ctrl+Shift+])">最前面</button><button data-act="up" title="前面へ (Ctrl+])">前へ</button>
      <button data-act="down" title="背面へ (Ctrl+[)">後ろへ</button><button data-act="back" title="最背面 (Ctrl+Shift+[)">最背面</button></div></div>`;
    if (sel.filter(e => e.type !== 'line').length > 1) h += `<div class="row"><div class="lbl">整列</div><div class="minibtns">
      <button data-act="left">左</button><button data-act="hcenter">左右中央</button><button data-act="right">右</button><button data-act="hdist">横に等間隔</button>
      <button data-act="top">上</button><button data-act="vcenter">上下中央</button><button data-act="bottom">下</button><button data-act="vdist">縦に等間隔</button></div></div>`;
    h += `<div class="row"><div class="minibtns" style="grid-template-columns:1fr 1fr 1fr">
      <button data-act="dup" title="Ctrl+D">複製</button><button data-act="edit" title="Enter / ダブルクリック">文字編集</button><button data-act="del" style="color:#e03131" title="Delete">削除</button></div></div>`;
  }
  body.innerHTML = h;
}
$('#propsHead').onclick = () => { propsCollapsed = !propsCollapsed; LS.set('propsCollapsed', propsCollapsed); updateProps(); };
$('#props').addEventListener('mousedown', e => { if (editing && e.target.tagName === 'BUTTON') e.preventDefault(); });
$('#propsBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act) {
    const a = b.dataset.act;
    if (['front', 'up', 'down', 'back'].includes(a)) layer(a);
    else if (a === 'dup') duplicateSelection(20);
    else if (a === 'del') deleteEls([...selection]);
    else if (a === 'edit') { const id = [...selection][0]; if (id) startEdit(id); }
    else align(a);
    return;
  }
  const k = b.dataset.k; if (!k || b.dataset.v === undefined) return;
  const v = JSON.parse(b.dataset.v.startsWith('#') || b.dataset.v === 'none' ? JSON.stringify(b.dataset.v) : b.dataset.v);
  if (k === 'iconSize') setIconSize(v); else setProp(k, v);
});
$('#propsBody').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  let v = e.target.value;
  if (k === 'fs') v = Math.max(6, Math.min(400, parseInt(v, 10) || 18));
  if (k === 'opacity') v = parseFloat(v);
  setProp(k, v);
});
$('#propsBody').addEventListener('input', e => {
  if (e.target.dataset.k === 'opacity') $('#opv').textContent = Math.round(e.target.value * 100) + '%';
});

/* ================================================================== */
/* アイコンパレット                                                    */
/* ================================================================== */
let library = [];
const closedCats = new Set(LS.get('closedCats', []));
async function loadLibrary() {
  try { library = await (await fetch('api/library')).json(); } catch { library = []; }
  renderPalette();
  for (const l of library) { const src = 'assets/' + l.file; if (!sizeCache.has(src)) itemOf({ dataset: { src } }); }
}
function renderPalette() {
  const q = $('#palSearch').value.trim().toLowerCase();
  const match = i => !q || (i.name + ' ' + (i.kw || '') + ' ' + i.id).toLowerCase().includes(q);
  let h = '';
  const lib = library.filter(l => !q || l.name.toLowerCase().includes(q));
  h += `<div class="cat ${closedCats.has('my') ? 'closed' : ''}" data-cat="my">マイ画像（全員で共有）</div>`;
  if (!closedCats.has('my')) {
    h += `<div class="grid">${lib.map(l => `<div class="item" draggable="true" data-src="assets/${esc(l.file)}" title="${esc(l.name)}"><img src="assets/${esc(l.file)}" alt=""><span>${esc(l.name.replace(/\.[a-z]+$/i, ''))}</span><button class="del" data-del="${esc(l.file)}" title="パレットから外す">×</button></div>`).join('')}</div>`;
    if (!lib.length && !q) h += `<div style="font-size:11px;color:var(--muted);padding:2px 4px">「＋登録」から社内ロゴや製品画像を追加できます</div>`;
  }
  for (const c of WB_ICONS.CATEGORIES) {
    const items = WB_ICONS.ICONS.filter(i => i.cat === c && match(i));
    if (!items.length) continue;
    const closed = closedCats.has(c) && !q;
    h += `<div class="cat ${closed ? 'closed' : ''}" data-cat="${c}">${c}</div>`;
    if (!closed) h += `<div class="grid">${items.map(i => `<div class="item${placeItem && placeItem.icon === i.id ? ' on' : ''}" draggable="true" data-icon="${i.id}" title="${esc(i.name)}（クリック→配置 / ドラッグ）"><svg viewBox="0 0 64 64"><use href="#ic-${i.id}"/></svg><span>${esc(i.name)}</span></div>`).join('')}</div>`;
  }
  $('#palBody').innerHTML = h;
}
$('#palBody').addEventListener('click', async e => {
  const del = e.target.closest('[data-del]');
  if (del) {
    e.stopPropagation();
    if (!confirm('この画像をパレットから外しますか？（ボード上の画像はそのまま残ります）')) return;
    await fetch('api/assets/' + del.dataset.del, { method: 'DELETE' }); loadLibrary(); return;
  }
  const cat = e.target.closest('.cat');
  if (cat) { const c = cat.dataset.cat; closedCats.has(c) ? closedCats.delete(c) : closedCats.add(c); LS.set('closedCats', [...closedCats]); renderPalette(); return; }
  const it = e.target.closest('.item'); if (!it) return;
  const item = await itemOf(it);
  if (placeItem && JSON.stringify(placeItem) === JSON.stringify(item)) { setTool('select'); renderPalette(); return; }
  placeItem = item;
  setTool('place', true);
  $$('#palette .item').forEach(x => x.classList.toggle('on', x === it));
  toast('ボード上をクリックして配置（Shift+クリックで連続配置）', 2500);
});
const sizeCache = new Map();
async function itemOf(it) {
  if (it.dataset.icon) return { icon: it.dataset.icon };
  const src = it.dataset.src;
  if (!sizeCache.has(src)) {
    let { w, h } = await imageSize(src);
    const k = Math.max(style.iconSize, 64) / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k);
    sizeCache.set(src, { w, h });
  }
  return { src, ...sizeCache.get(src) };
}
$('#palBody').addEventListener('dragstart', e => {
  const it = e.target.closest('.item'); if (!it) return;
  const src = it.dataset.src;
  const item = it.dataset.icon ? { icon: it.dataset.icon } : { src, ...(sizeCache.get(src) || { w: style.iconSize, h: style.iconSize }) };
  if (src && !sizeCache.has(src)) itemOf(it);
  e.dataTransfer.setData('text/x-wb-item', JSON.stringify(item));
  e.dataTransfer.effectAllowed = 'copy';
});
$('#palSearch').addEventListener('input', renderPalette);
$('#palSearch').addEventListener('keydown', e => e.stopPropagation());
const palSize = LS.get('palSize', 64);
$('#palSize').value = palSize;
$('#palette').style.setProperty('--ps', palSize + 'px');
$('#palSize').oninput = e => { $('#palette').style.setProperty('--ps', e.target.value + 'px'); LS.set('palSize', +e.target.value); };
$('#palette').style.width = LS.get('palWidth', 250) + 'px';
$('#palResize').addEventListener('pointerdown', e => {
  e.preventDefault();
  const startX = e.clientX, w0 = $('#palette').offsetWidth;
  const mv = ev => { const w = Math.max(170, Math.min(window.innerWidth * 0.7, w0 + ev.clientX - startX)); $('#palette').style.width = w + 'px'; };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); LS.set('palWidth', $('#palette').offsetWidth); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
});
const setPalCollapsed = c => { $('#palette').classList.toggle('collapsed', c); $('#palToggle').textContent = c ? '≫' : '≪'; LS.set('palCollapsed', c); };
$('#palToggle').onclick = () => setPalCollapsed(!$('#palette').classList.contains('collapsed'));
setPalCollapsed(LS.get('palCollapsed', false));
$('#palUpload').onclick = () => $('#palFile').click();
$('#palFile').onchange = async e => {
  for (const f of e.target.files) { try { await uploadImage(f, true); } catch (err) { toast('登録失敗: ' + err.message, 4000); } }
  e.target.value = ''; closedCats.delete('my'); loadLibrary(); toast('パレットに登録しました');
};

/* ================================================================== */
/* ツールバー・その他UI                                                */
/* ================================================================== */
$$('#toolbar .tb[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
$('#undoBtn').onclick = undo;
$('#redoBtn').onclick = redo;
$('#goHome').onclick = () => { location.href = location.pathname; };
$('#boardName').addEventListener('change', e => { wsSend({ t: 'rename', name: e.target.value }); });
$('#boardName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
$('#shareBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); toast('このボードのURLをコピーしました'); }
  catch { prompt('このURLを共有してください', location.href); }
};

/* ---------- コンテキストメニュー ---------- */
let ctxEl = null;
function hideCtx() { if (ctxEl) { ctxEl.remove(); ctxEl = null; } }
stage.addEventListener('contextmenu', e => {
  e.preventDefault(); hideCtx();
  const p = toWorld(e.clientX, e.clientY);
  const hasSel = selection.size > 0;
  const sel1 = hasSel ? els.get([...selection][0]) : null;
  const items = [];
  if (hasSel) {
    items.push(['文字を編集', 'Enter', () => startEdit(sel1.id)], ['複製', 'Ctrl+D', () => duplicateSelection(20)],
      ['コピー', 'Ctrl+C', () => { internalClip = selectionPayload(); toast('コピーしました', 1000); }], '-',
      ['最前面へ', 'Ctrl+Shift+]', () => layer('front')], ['最背面へ', 'Ctrl+Shift+[', () => layer('back')], '-');
    if (selection.size === 1 && sel1.type === 'frame') items.push(['このフレームをPNG保存', '', () => quickExportPNG('frame:' + sel1.id)], ['このフレームを表示', '', () => fitView([sel1])], '-');
    else items.push(['選択範囲をPNG保存', '', () => quickExportPNG('selection')], '-');
    items.push(['削除', 'Del', () => deleteEls([...selection])]);
  } else {
    if (internalClip) items.push(['ここに貼り付け', 'Ctrl+V', () => pasteEls(internalClip.els, 0, p)], '-');
    items.push(['すべて選択', 'Ctrl+A', () => { selection = new Set(els.keys()); sendSel(); invalidate(false); updateProps(); }],
      ['全体を表示', 'Shift+1', () => fitView()], ['グリッド 表示/非表示', '', () => $('#gridBtn').click()],
      [wheelZoom ? '✓ ホイールで拡大縮小' : '　ホイールで拡大縮小', '', () => { wheelZoom = !wheelZoom; LS.set('wheelZoom', wheelZoom); toast(wheelZoom ? 'ホイール＝拡大縮小' : 'ホイール＝スクロール（Ctrl+ホイールで拡大縮小）'); }],
      [LS.get('iconLabels', true) ? '✓ アイコン配置時に名前を表示' : '　アイコン配置時に名前を表示', '', () => LS.set('iconLabels', !LS.get('iconLabels', true))]);
  }
  ctxEl = document.createElement('div'); ctxEl.id = 'ctx';
  ctxEl.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}"><span>${esc(it[0])}</span><kbd>${esc(it[1])}</kbd></button>`).join('');
  document.body.append(ctxEl);
  const w = ctxEl.offsetWidth, h = ctxEl.offsetHeight;
  ctxEl.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px'; ctxEl.style.top = Math.min(e.clientY, innerHeight - h - 8) + 'px';
  ctxEl.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const it = items[+b.dataset.i]; hideCtx(); it[2](); };
});
document.addEventListener('pointerdown', e => { if (ctxEl && !ctxEl.contains(e.target)) hideCtx(); });

/* ---------- モーダル ---------- */
function modal(html, onMount) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box">${html}</div>`;
  document.body.append(m);
  const close = () => m.remove();
  m.addEventListener('pointerdown', e => { if (e.target === m) close(); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') close(); e.stopPropagation(); });
  $$('[data-close]', m).forEach(b => b.onclick = close);
  onMount && onMount(m, close);
  return { m, close };
}
function askName(force) {
  if (me.name && !force) return;
  modal(`<h3>表示名を入力してください</h3><div class="f"><label>他の参加者のカーソルに表示されます</label><input type="text" id="nm" maxlength="30" value="${esc(me.name)}" placeholder="例: 辻"></div>
    <div class="f"><label>カーソルの色</label><div class="sw" id="nmc">${['#e8590c', '#1c7ed6', '#2f9e44', '#c2255c', '#7048e8', '#0c8599', '#f08c00', '#5c940d'].map(c => `<button data-c="${c}" class="${c === me.color ? 'on' : ''}" style="background:${c};width:26px;height:26px"></button>`).join('')}</div></div>
    <div class="foot"><button class="btn primary" id="nmOk">OK</button></div>`, (m, close) => {
    const inp = $('#nm', m); setTimeout(() => inp.focus(), 50);
    let color = me.color;
    $('#nmc', m).onclick = e => { const b = e.target.closest('button'); if (!b) return; color = b.dataset.c; $$('#nmc button', m).forEach(x => x.classList.toggle('on', x === b)); };
    const ok = () => {
      me.name = inp.value.trim() || 'ゲスト'; me.color = color; LS.set('name', me.name); LS.set('color', me.color); close();
      renderPeers();
      if (ws && ws.readyState === 1) ws.close(); // 名前を反映して再接続
    };
    $('#nmOk', m).onclick = ok; inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  });
}

/* ---------- 履歴 ---------- */
$('#histBtn').onclick = async () => {
  const list = await (await fetch(`api/boards/${boardId}/history`)).json().catch(() => []);
  const fmt = ts => new Date(ts).toLocaleString('ja-JP');
  const lbl = { manual: '手動保存', prerestore: '復元前の自動退避' };
  modal(`<h3>保存履歴</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px">編集内容は常に自動保存されています。加えて編集中は数分ごとにスナップショットが残り、ここから復元できます（全員の画面に反映）。</div>
    <div class="hist">${list.length ? list.map(h => `<div><span>${fmt(h.ts)}</span><em>${lbl[h.label] || '自動'}</em><button class="btn sm" data-dl="${h.file}">JSON</button><button class="btn sm" data-rs="${h.file}">復元</button></div>`).join('') : '<div><span style="color:var(--muted)">まだスナップショットはありません</span></div>'}</div>
    <div class="foot"><button class="btn" id="snapNow">今の状態をスナップショット</button><button class="btn" data-close>閉じる</button></div>`, (m, close) => {
    $('#snapNow', m).onclick = async () => { await fetch(`api/boards/${boardId}/snapshot`, { method: 'POST' }); close(); toast('スナップショットを保存しました'); };
    m.addEventListener('click', async e => {
      const rs = e.target.closest('[data-rs]'), dl = e.target.closest('[data-dl]');
      if (rs) {
        if (!confirm('この時点の状態に戻しますか？\n（現在の状態も履歴に退避されます）')) return;
        await fetch(`api/boards/${boardId}/history/${rs.dataset.rs}`, { method: 'POST' }); close();
      }
      if (dl) {
        const d = await (await fetch(`api/boards/${boardId}/history/${dl.dataset.dl}`)).json();
        downloadBlob(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }), `${safeName(d.name)}_${dl.dataset.dl}`);
      }
    });
  });
};

/* ================================================================== */
/* エクスポート                                                        */
/* ================================================================== */
const safeName = s => (s || 'whiteboard').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const frames = () => [...els.values()].filter(e => e.type === 'frame').sort((a, b) => (Math.abs(a.y - b.y) > 100 ? a.y - b.y : a.x - b.x));

// 範囲指定 → {box, list, frame}
function regionOf(spec) {
  const all = [...els.values()];
  if (spec.startsWith('frame:')) {
    const f = els.get(spec.slice(6));
    return { box: { x: f.x, y: f.y, w: f.w, h: f.h }, list: all.filter(e => e.type !== 'frame' && intersects(f, extBox(e))), frame: f };
  }
  let list = spec === 'selection' ? [...selection].map(id => els.get(id)).filter(Boolean) : all;
  if (spec === 'selection') for (const id of framesChildren(selection)) list.push(els.get(id));
  list = [...new Set(list)];
  if (!list.length) return null;
  const B = unionBox(list, extBox), pad = 24;
  return { box: { x: B.x - pad, y: B.y - pad, w: B.w + pad * 2, h: B.h + pad * 2 }, list };
}
async function srcMapFor(list) {
  const map = {};
  for (const el of list) if (el.type === 'icon' && el.src && !map[el.src]) {
    try {
      const blob = await (await fetch(el.src)).blob();
      map[el.src] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch {}
  }
  return map;
}
function buildSVG(region, { bg = '#ffffff', srcMap = {}, frameAsSlide = false } = {}) {
  const { box, list } = region;
  const used = new Set(list.filter(e => e.type === 'icon' && e.icon).map(e => e.icon));
  const defs = WB_ICONS.ICONS.filter(i => used.has(i.id)).map(i => `<symbol id="ic-${i.id}" viewBox="0 0 64 64">${i.svg}</symbol>`).join('');
  const body = sortedEls([...list]).map(el => renderEl(el, { exp: true, srcMap, frameAsSlide })).join('');
  const bgFill = region.frame && region.frame.fill && region.frame.fill !== 'none' ? region.frame.fill : bg;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(box.w)}" height="${Math.ceil(box.h)}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">` +
    `<defs>${defs}</defs>${bgFill && bgFill !== 'none' ? `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${esc(bgFill)}"/>` : ''}${body}</svg>`;
}
function svgToCanvas(svgStr, w, h, scale) {
  return new Promise((resolve, reject) => {
    const maxPx = 16000;
    scale = Math.min(scale, maxPx / w, maxPx / h, Math.sqrt(120e6 / (w * h)));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error('SVGの画像化に失敗しました'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  });
}
const canvasBlob = (c, type = 'image/png') => new Promise(r => c.toBlob(r, type, 0.92));
async function exportPNG(spec, { scale = 2, bg = '#ffffff', fmt = 'png' } = {}) {
  const region = regionOf(spec);
  if (!region) { toast('出力する要素がありません'); return; }
  const srcMap = await srcMapFor(region.list);
  const svgStr = buildSVG(region, { bg: fmt === 'jpg' && bg === 'none' ? '#ffffff' : bg, srcMap, frameAsSlide: !!region.frame });
  const name = safeName($('#boardName').value) + (region.frame ? '_' + safeName(region.frame.text) : '');
  if (fmt === 'svg') { downloadBlob(new Blob([svgStr], { type: 'image/svg+xml' }), name + '.svg'); return; }
  const c = await svgToCanvas(svgStr, region.box.w, region.box.h, scale);
  downloadBlob(await canvasBlob(c, fmt === 'jpg' ? 'image/jpeg' : 'image/png'), name + (fmt === 'jpg' ? '.jpg' : '.png'));
}
function quickExportPNG(spec) { exportPNG(spec, { scale: 2 }).then(() => toast('PNGを保存しました')).catch(err => toast(err.message, 4000)); }

const hex = c => (c || '#000000').replace('#', '').toUpperCase().slice(0, 6);
const pptDash = d => d === 'dashed' ? 'dash' : d === 'dotted' ? 'sysDot' : 'solid';
async function rasterEl(el, srcMap, scale = 3) {
  const B = extBox(el);
  const svgStr = buildSVG({ box: B, list: [el] }, { bg: 'none', srcMap });
  const c = await svgToCanvas(svgStr, B.w, B.h, scale);
  return { data: c.toDataURL('image/png'), box: B };
}
async function exportPPTX(specs, { mode = 'shapes', bg = '#ffffff' } = {}) {
  if (typeof PptxGenJS === 'undefined') { toast('PptxGenJS が読み込めませんでした'); return; }
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
  pptx.title = $('#boardName').value || 'Whiteboard';
  const SW = 13.333, SH = 7.5;
  let count = 0;
  for (const spec of specs) {
    const region = regionOf(spec);
    if (!region) continue;
    const slide = pptx.addSlide();
    const bgc = region.frame && region.frame.fill && region.frame.fill !== 'none' ? region.frame.fill : bg;
    if (bgc && bgc !== 'none') slide.background = { color: hex(bgc) };
    const { box } = region;
    const margin = region.frame ? 0 : 0.25;
    const k = Math.min((SW - margin * 2) / box.w, (SH - margin * 2) / box.h);
    const ox = (SW - box.w * k) / 2, oy = (SH - box.h * k) / 2;
    const X = v => ox + (v - box.x) * k, Y = v => oy + (v - box.y) * k, D = v => v * k, PT = v => Math.max(0.25, v * k * 72);
    const srcMap = await srcMapFor(region.list);
    if (mode === 'image') {
      const svgStr = buildSVG(region, { bg: bgc, srcMap, frameAsSlide: !!region.frame });
      const c = await svgToCanvas(svgStr, box.w, box.h, Math.min(4, 2400 / Math.max(box.w, box.h) * 1.6));
      slide.addImage({ data: c.toDataURL('image/png'), x: ox, y: oy, w: box.w * k, h: box.h * k });
      count++; continue;
    }
    const txtOpts = el => ({
      fontFace: FONTS[el.font || 'gothic']?.ppt || 'Meiryo', fontSize: Math.max(4, Math.round(PT(el.fs || 18) * 10) / 10), bold: !!el.bold, italic: !!el.italic,
      underline: el.underline ? { style: 'sng' } : undefined, color: hex(el.color || '#1e1e1e'),
    });
    const lineOpt = el => (!el.stroke || el.stroke === 'none' || !el.sw) ? { type: 'none' } : { color: hex(el.stroke), width: PT(el.sw), dashType: pptDash(el.dash) };
    const transp = el => el.opacity != null && el.opacity < 1 ? Math.round((1 - el.opacity) * 100) : undefined;
    for (const el of sortedEls([...region.list])) {
      try {
        switch (el.type) {
          case 'rect': case 'ellipse': case 'diamond': case 'sticky': {
            const shape = el.type === 'ellipse' ? pptx.ShapeType.ellipse : el.type === 'diamond' ? pptx.ShapeType.diamond : (el.type === 'rect' && el.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect);
            const o = {
              shape, x: X(el.x), y: Y(el.y), w: D(el.w), h: D(el.h),
              fill: el.fill && el.fill !== 'none' ? { color: hex(el.fill), transparency: transp(el) } : { type: 'none' },
              line: el.type === 'sticky' ? { type: 'none' } : lineOpt(el),
              align: el.align || 'center', valign: el.type === 'sticky' && el.valign === 'top' ? 'top' : 'middle',
              margin: PT(el.type === 'sticky' ? 14 : 6) , ...txtOpts(el),
            };
            if (shape === pptx.ShapeType.roundRect) o.rectRadius = D(Math.min(el.radius, el.w / 2, el.h / 2));
            if (el.type === 'sticky') o.shadow = { type: 'outer', blur: 3, offset: 2, angle: 90, color: '000000', opacity: 0.15 };
            slide.addText(el.text || '', o);
            break;
          }
          case 'text': {
            const wrap = el.autoW === false;
            slide.addText(el.text || '', { x: X(el.x), y: Y(el.y), w: D(el.w) * (wrap ? 1.02 : 1.15) + 0.05, h: D(el.h), align: el.align || 'left', valign: 'top', margin: 0, wrap, lineSpacingMultiple: 1.0, ...txtOpts(el) });
            break;
          }
          case 'line': {
            const p = linePts(el);
            slide.addShape(pptx.ShapeType.line, {
              x: X(Math.min(p.x1, p.x2)), y: Y(Math.min(p.y1, p.y2)), w: Math.max(D(Math.abs(p.x2 - p.x1)), 0.001), h: Math.max(D(Math.abs(p.y2 - p.y1)), 0.001),
              flipH: p.x1 > p.x2, flipV: p.y1 > p.y2,
              line: { ...lineOpt(el), beginArrowType: el.ah1 ? 'triangle' : undefined, endArrowType: el.ah2 ? 'triangle' : undefined },
            });
            if (el.text) {
              const L = layoutText(el.text, el, 0), cx = (p.x1 + p.x2) / 2, cy = (p.y1 + p.y2) / 2;
              slide.addText(el.text, { x: X(cx - L.w / 2 - 6), y: Y(cy - L.h / 2 - 2), w: D(L.w + 12) * 1.15, h: D(L.h + 4), align: 'center', valign: 'middle', margin: 0, fill: { color: 'FFFFFF' }, ...txtOpts(el) });
            }
            break;
          }
          case 'pen': {
            const r = await rasterEl(el, srcMap);
            slide.addImage({ data: r.data, x: X(r.box.x), y: Y(r.box.y), w: D(r.box.w), h: D(r.box.h) });
            break;
          }
          case 'icon': {
            const iconOnly = { ...el, text: '' };
            const r = await rasterEl(iconOnly, srcMap, Math.max(2, 256 / Math.max(el.w, el.h)));
            slide.addImage({ data: r.data, x: X(r.box.x), y: Y(r.box.y), w: D(r.box.w), h: D(r.box.h), transparency: transp(el) });
            if (el.text) {
              const L = layoutText(el.text, el, 0), cx = el.x + el.w / 2, tw = L.w * 1.2 + 16;
              slide.addText(el.text, { x: X(cx - tw / 2), y: Y(el.y + el.h + 2), w: D(tw), h: D(L.h + 6), align: 'center', valign: 'top', margin: 0, ...txtOpts(el) });
            }
            break;
          }
          case 'frame': {
            if (region.frame) break;
            slide.addShape(pptx.ShapeType.rect, { x: X(el.x), y: Y(el.y), w: D(el.w), h: D(el.h), fill: el.fill && el.fill !== 'none' ? { color: hex(el.fill) } : { type: 'none' }, line: { color: 'ADB5BD', width: PT(1.5) } });
            slide.addText(el.text || '', { x: X(el.x), y: Y(el.y - 26), w: D(Math.max(el.w, 200)), h: D(22), fontSize: PT(14), bold: true, color: '868E96', fontFace: FONTS[el.font || 'gothic'].ppt, margin: 0, valign: 'bottom' });
            break;
          }
        }
      } catch (err) { console.warn('pptx element error', el, err); }
    }
    if (region.frame && specs.length > 1 && region.frame.text) slide.addNotes(region.frame.text);
    count++;
  }
  if (!count) { toast('出力する要素がありません'); return; }
  await pptx.writeFile({ fileName: safeName($('#boardName').value) + '.pptx' });
}

$('#exportBtn').onclick = () => {
  const fr = frames();
  const hasSel = selection.size > 0;
  modal(`<h3>エクスポート</h3>
    <div class="f"><label>形式</label><div class="radios" id="exFmt">
      <label><input type="radio" name="fmt" value="pptx" checked> PowerPoint (.pptx)</label>
      <label><input type="radio" name="fmt" value="png"> PNG画像</label>
      <label><input type="radio" name="fmt" value="jpg"> JPEG画像</label>
      <label><input type="radio" name="fmt" value="svg"> SVG</label>
      <label><input type="radio" name="fmt" value="json"> JSON（バックアップ）</label></div></div>
    <div class="f" id="exRangeF"><label>範囲</label><select id="exRange">
      ${fr.length ? `<option value="frames">すべてのフレーム（${fr.length}枚 → 1フレーム＝1スライド/1画像）</option>` : ''}
      <option value="all">ボード全体</option>
      ${hasSel ? `<option value="selection">選択中の要素（${selection.size}個）</option>` : ''}
      ${fr.map(f => `<option value="frame:${f.id}">フレーム: ${esc(f.text || '無題')}</option>`).join('')}
    </select>${fr.length ? '' : '<div style="font-size:11px;color:var(--muted);margin-top:4px">ヒント: フレーム（F）で囲むと、フレームごとにスライド/画像を分けて出力できます</div>'}</div>
    <div class="f" id="exPptF"><label>スライドの作り方</label><div class="radios">
      <label><input type="radio" name="pmode" value="shapes" checked> 編集できる図形として出力</label>
      <label><input type="radio" name="pmode" value="image"> 見た目そのまま（画像1枚）</label></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">16:9ワイド。Googleスライドにもそのまま取り込めます。</div></div>
    <div class="f" id="exScaleF"><label>解像度</label><div class="radios">
      <label><input type="radio" name="scale" value="1"> 1x</label><label><input type="radio" name="scale" value="2" checked> 2x（推奨）</label><label><input type="radio" name="scale" value="3"> 3x</label><label><input type="radio" name="scale" value="4"> 4x（印刷用）</label></div></div>
    <div class="f" id="exBgF"><label>背景</label><div class="radios">
      <label><input type="radio" name="bg" value="#ffffff" checked> 白</label><label><input type="radio" name="bg" value="none"> 透明（PNG/SVG）</label></div></div>
    <div class="foot"><button class="btn" data-close>キャンセル</button><button class="btn primary" id="exGo">出力する</button></div>`, (m, close) => {
    const sync = () => {
      const f = $('input[name=fmt]:checked', m).value;
      $('#exPptF', m).classList.toggle('hidden', f !== 'pptx');
      $('#exScaleF', m).classList.toggle('hidden', !['png', 'jpg'].includes(f));
      $('#exBgF', m).classList.toggle('hidden', !['png', 'svg'].includes(f));
      $('#exRangeF', m).classList.toggle('hidden', f === 'json');
    };
    $('#exFmt', m).onchange = sync; sync();
    $('#exGo', m).onclick = async () => {
      const fmt = $('input[name=fmt]:checked', m).value, range = $('#exRange', m).value;
      const btn = $('#exGo', m); btn.disabled = true; btn.textContent = '出力中…';
      try {
        if (fmt === 'json') {
          const data = { format: 'it-whiteboard', version: 1, name: $('#boardName').value, exported: Date.now(), elements: Object.fromEntries(els) };
          downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), safeName(data.name) + '.json');
        } else {
          const specs = range === 'frames' ? frames().map(f => 'frame:' + f.id) : [range];
          if (fmt === 'pptx') await exportPPTX(specs, { mode: $('input[name=pmode]:checked', m).value });
          else for (const s of specs) await exportPNG(s, { fmt, scale: +$('input[name=scale]:checked', m).value, bg: $('input[name=bg]:checked', m).value });
        }
        close(); toast('エクスポートしました');
      } catch (err) { console.error(err); toast('エクスポート失敗: ' + err.message, 5000); btn.disabled = false; btn.textContent = '出力する'; }
    };
  });
};

/* ================================================================== */
/* ボード一覧                                                          */
/* ================================================================== */
function thumbSVG(data) {
  const map = new Map(Object.entries(data.elements || {}));
  const list = [...map.values()];
  if (!list.length) return '<span style="color:#adb5bd">（空のボード）</span>';
  try {
    const B = unionBox(list, el => extBox(el, map));
    const pad = 20;
    const used = new Set(list.filter(e => e.type === 'icon' && e.icon).map(e => e.icon));
    const defs = WB_ICONS.ICONS.filter(i => used.has(i.id)).map(i => `<symbol id="ic-${i.id}" viewBox="0 0 64 64">${i.svg}</symbol>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${B.x - pad} ${B.y - pad} ${B.w + pad * 2} ${B.h + pad * 2}" preserveAspectRatio="xMidYMid meet"><defs>${defs}</defs>${sortedEls(list).map(el => renderEl(el, { exp: true, map })).join('')}</svg>`;
  } catch { return ''; }
}
async function showHome() {
  $('#home').classList.remove('hidden');
  document.title = 'ITホワイトボード';
  const grid = $('#boardGrid');
  let boards = [];
  try { boards = await (await fetch('api/boards')).json(); } catch { grid.innerHTML = '<div>サーバに接続できません</div>'; return; }
  if (!boards.length) { grid.innerHTML = '<div style="color:var(--muted)">ボードがありません。「新しいボード」から作成してください。</div>'; return; }
  grid.innerHTML = boards.map(b => `<div class="bcard" data-id="${b.id}">
    <div class="thumb" data-open="${b.id}"><span style="color:#ced4da">…</span></div>
    <div class="meta"><div class="name" data-open="${b.id}" title="${esc(b.name)}">${esc(b.name)}</div>
    <div class="info">更新: ${new Date(b.updated).toLocaleString('ja-JP')}・${b.count}要素 ${b.online ? `<span class="online">● ${b.online}人が編集中</span>` : ''}</div>
    <div class="ops"><button class="btn sm" data-open="${b.id}">開く</button><button class="btn sm" data-rename="${b.id}">名前変更</button><button class="btn sm" data-copy="${b.id}">複製</button><button class="btn sm danger" data-del="${b.id}">削除</button></div></div></div>`).join('');
  // サムネイル（少しずつ読み込み）
  for (const b of boards.slice(0, 60)) {
    fetch(`api/boards/${b.id}`).then(r => r.json()).then(d => { const t = $(`.bcard[data-id="${b.id}"] .thumb`); if (t) t.innerHTML = thumbSVG(d); }).catch(() => {});
  }
}
async function createBoard(name, elements) {
  const r = await (await fetch('api/boards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, elements }) })).json();
  return r.id;
}
$('#newBoard').onclick = async () => {
  const name = prompt('ボード名', 'ネットワーク構成図');
  if (name === null) return;
  const id = await createBoard(name || '新しいボード');
  location.href = '?board=' + id;
};
$('#importBoard').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.elements) throw new Error('形式が違います');
    const id = await createBoard((d.name || f.name.replace(/\.json$/, '')) + '（取り込み）', d.elements);
    location.href = '?board=' + id;
  } catch (err) { alert('取り込みに失敗しました: ' + err.message); }
};
$('#boardGrid').addEventListener('click', async e => {
  const t = e.target.closest('[data-open],[data-rename],[data-del],[data-copy]'); if (!t) return;
  if (t.dataset.open) location.href = '?board=' + t.dataset.open;
  if (t.dataset.rename) {
    const cur = $(`.bcard[data-id="${t.dataset.rename}"] .name`).textContent;
    const name = prompt('新しいボード名', cur); if (!name) return;
    await fetch(`api/boards/${t.dataset.rename}/rename`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    showHome();
  }
  if (t.dataset.copy) {
    const d = await (await fetch(`api/boards/${t.dataset.copy}`)).json();
    await createBoard(d.name + ' のコピー', d.elements); showHome();
  }
  if (t.dataset.del) {
    const cur = $(`.bcard[data-id="${t.dataset.del}"] .name`).textContent;
    if (!confirm(`「${cur}」を削除しますか？\n（サーバの data/trash に退避されます）`)) return;
    await fetch(`api/boards/${t.dataset.del}`, { method: 'DELETE' }); showHome();
  }
});

/* ================================================================== */
/* 起動                                                                */
/* ================================================================== */
if (!boardId) { showHome(); }
else {
  $('#app').classList.remove('hidden');
  const r = stage.getBoundingClientRect();
  view = { x: r.width / 2, y: r.height / 2, z: 1 };
  setTool('select');
  renderPalette(); loadLibrary(); renderPeers(); updateProps();
  setSaveState('connecting');
  connect();
  askName(false);
  window.addEventListener('resize', () => { positionEditor(); invalidate(false); });
  window.addEventListener('beforeunload', e => { if (pendingOps.size || unacked.size) { flushOps(); e.preventDefault(); e.returnValue = ''; } });
  // デバッグ / 自動テスト用
  window.__wb = { els: () => els, view: () => view, selection: () => selection, exportPPTX, exportPNG, buildSVG, regionOf, setTool, fitView };
}
})();
