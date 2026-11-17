#!/usr/bin/env node
/*
 * IT Whiteboard server
 *  - 依存パッケージなし（Node.js 18+ 標準モジュールのみ）
 *  - 静的ファイル配信 / REST API / WebSocket リアルタイム同期
 *  - ボード単位の自動保存（JSON）と定期スナップショット（履歴）
 *
 *  環境変数:
 *    PORT        待受ポート (default 3100)
 *    HOST        待受アドレス (default 127.0.0.1)
 *    DATA_DIR    データ保存先 (default ./data)
 *    SNAPSHOT_MIN スナップショット間隔(分) (default 5)
 *    SNAPSHOT_KEEP 保持するスナップショット数 (default 100)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3100', 10);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUBLIC_DIR = path.join(__dirname, 'public');
const SNAPSHOT_MS = parseFloat(process.env.SNAPSHOT_MIN || '5') * 60 * 1000;
const SNAPSHOT_KEEP = parseInt(process.env.SNAPSHOT_KEEP || '100', 10);
const SAVE_DEBOUNCE_MS = 1500;
const MAX_WS_PAYLOAD = 32 * 1024 * 1024;
const MAX_UPLOAD = 15 * 1024 * 1024;

const BOARDS_DIR = path.join(DATA_DIR, 'boards');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');
const TRASH_DIR = path.join(DATA_DIR, 'trash');
for (const d of [DATA_DIR, BOARDS_DIR, HISTORY_DIR, ASSETS_DIR, TRASH_DIR]) fs.mkdirSync(d, { recursive: true });

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ------------------------------------------------------------------ */
/* Board store                                                         */
/* ------------------------------------------------------------------ */
const boards = new Map(); // id -> {data, dirty, saveTimer, clients:Set, lastSnapshot, snapDirty}

function newBoardId() {
  return crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');
}
function boardFile(id) { return path.join(BOARDS_DIR, id + '.json'); }

async function loadBoard(id, createIfMissing = true) {
  if (!ID_RE.test(id)) throw new Error('invalid board id');
  let b = boards.get(id);
  if (b) return b;
  let data;
  try {
    data = JSON.parse(await fsp.readFile(boardFile(id), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    if (!createIfMissing) return null;
    const now = Date.now();
    data = { id, name: '新しいボード', created: now, updated: now, elements: {} };
  }
  if (!data.elements) data.elements = {};
  b = boards.get(id); // 競合防止
  if (b) return b;
  b = { data, dirty: false, saveTimer: null, clients: new Set(), lastSnapshot: Date.now(), snapDirty: false };
  boards.set(id, b);
  if (!fs.existsSync(boardFile(id))) markDirty(b);
  return b;
}

function markDirty(b) {
  b.dirty = true;
  b.snapDirty = true;
  b.data.updated = Date.now();
  if (b.saveTimer) return;
  b.saveTimer = setTimeout(() => { b.saveTimer = null; saveBoard(b).catch(e => log('save error', e)); }, SAVE_DEBOUNCE_MS);
}

async function writeAtomic(file, content) {
  const tmp = file + '.' + process.pid + '.tmp';
  await fsp.writeFile(tmp, content);
  await fsp.rename(tmp, file);
}

async function saveBoard(b) {
  if (!b.dirty) return;
  b.dirty = false;
  const id = b.data.id;
  await writeAtomic(boardFile(id), JSON.stringify(b.data));
  broadcast(b, { t: 'saved', at: Date.now() });
  if (b.snapDirty && Date.now() - b.lastSnapshot >= SNAPSHOT_MS) await snapshot(b);
}

async function snapshot(b, label) {
  const id = b.data.id;
  const dir = path.join(HISTORY_DIR, id);
  await fsp.mkdir(dir, { recursive: true });
  const ts = Date.now();
  await fsp.writeFile(path.join(dir, ts + (label ? '_' + label : '') + '.json'), JSON.stringify(b.data));
  b.lastSnapshot = ts;
  b.snapDirty = false;
  const files = (await fsp.readdir(dir)).filter(f => f.endsWith('.json')).sort();
  while (files.length > SNAPSHOT_KEEP) await fsp.unlink(path.join(dir, files.shift())).catch(() => {});
}

// 定期スナップショット（編集が続いている時も確実に残す）
setInterval(() => {
  for (const b of boards.values()) {
    if (b.snapDirty && Date.now() - b.lastSnapshot >= SNAPSHOT_MS) {
      saveBoard(b).then(() => b.snapDirty && snapshot(b)).catch(e => log('snapshot error', e));
    }
    // 誰も接続していないボードはメモリから解放
    if (b.clients.size === 0 && !b.dirty && !b.saveTimer) boards.delete(b.data.id);
  }
}, 30 * 1000);

async function flushAll() {
  for (const b of boards.values()) {
    if (b.saveTimer) { clearTimeout(b.saveTimer); b.saveTimer = null; }
    await saveBoard(b).catch(e => log('flush error', e));
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { log('shutting down, flushing...'); await flushAll(); process.exit(0); });
}

/* ------------------------------------------------------------------ */
/* Minimal WebSocket (RFC6455) implementation                          */
/* ------------------------------------------------------------------ */
class WS {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.fragOp = 0;
    this.alive = true;
    this.closed = false;
    this.onmessage = null;
    this.onclose = null;
    socket.setNoDelay(true);
    socket.on('data', d => this._data(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }
  _closed() {
    if (this.closed) return;
    this.closed = true;
    if (this.onclose) this.onclose();
  }
  _data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (true) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (this.buf.length < 10) return;
        const hi = this.buf.readUInt32BE(2), lo = this.buf.readUInt32BE(6);
        len = hi * 4294967296 + lo; off = 10;
      }
      if (len > MAX_WS_PAYLOAD) { this.close(1009); return; }
      if (!masked) { this.close(1002); return; }
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this._frame(fin, op, payload);
      if (this.closed) return;
    }
  }
  _frame(fin, op, payload) {
    if (op === 0x8) { this.close(); return; }
    if (op === 0x9) { this._send(0xA, payload); return; }
    if (op === 0xA) { this.alive = true; return; }
    if (op === 0x1 || op === 0x2) {
      if (fin) { this._msg(op, payload); return; }
      this.fragOp = op; this.frags = [payload]; return;
    }
    if (op === 0x0) {
      this.frags.push(payload);
      if (fin) { const p = Buffer.concat(this.frags); this.frags = []; this._msg(this.fragOp, p); }
    }
  }
  _msg(op, payload) {
    this.alive = true;
    if (op !== 0x1 || !this.onmessage) return;
    let m;
    try { m = JSON.parse(payload.toString('utf8')); } catch { return; }
    try { this.onmessage(m); } catch (e) { log('handler error', e); }
  }
  _send(op, payload) {
    if (this.closed || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.from([0x80 | op, len]); }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 127; header.writeUInt32BE(Math.floor(len / 4294967296), 2); header.writeUInt32BE(len >>> 0, 6); }
    this.socket.write(Buffer.concat([header, payload]));
  }
  send(obj) { this._send(0x1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8')); }
  ping() { this._send(0x9, Buffer.alloc(0)); }
  close(code = 1000) {
    if (this.closed) return;
    const p = Buffer.alloc(2); p.writeUInt16BE(code, 0);
    try { this._send(0x8, p); } catch {}
    this.socket.end();
    setTimeout(() => this.socket.destroy(), 1000);
    this._closed();
  }
}

/* ------------------------------------------------------------------ */
/* Real-time collaboration                                             */
/* ------------------------------------------------------------------ */
const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#c2255c', '#7048e8', '#0c8599', '#f08c00', '#5c940d', '#d6336c', '#364fc7'];
let clientSeq = 0;

function broadcast(b, msg, except) {
  const s = JSON.stringify(msg);
  for (const c of b.clients) if (c !== except) c.ws.send(s);
}

function sanitizeEl(el) {
  if (!el || typeof el !== 'object' || typeof el.id !== 'string' || el.id.length > 64) return null;
  if (typeof el.type !== 'string') return null;
  return el;
}

async function handleWs(req, socket, boardId) {
  const key = req.headers['sec-websocket-key'];
  if (!key || !ID_RE.test(boardId)) { socket.destroy(); return; }
  // ボードを先に読み込んでからハンドシェイクする（hello の取りこぼし防止）
  let b;
  try { b = await loadBoard(boardId); } catch (e) { socket.destroy(); return; }
  if (socket.destroyed) return;
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const ws = new WS(socket);
  const client = { ws, cid: 'c' + (++clientSeq), name: 'ゲスト', color: COLORS[clientSeq % COLORS.length], sel: [] };
  b.clients.add(client);

  ws.onmessage = m => {
    switch (m.t) {
      case 'hello': {
        if (typeof m.name === 'string') client.name = m.name.slice(0, 40) || 'ゲスト';
        if (typeof m.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.color)) client.color = m.color;
        ws.send({
          t: 'init', you: client.cid, color: client.color,
          board: b.data,
          peers: [...b.clients].filter(c => c !== client).map(c => ({ cid: c.cid, name: c.name, color: c.color, sel: c.sel })),
        });
        broadcast(b, { t: 'peer', cid: client.cid, name: client.name, color: client.color }, client);
        break;
      }
      case 'ops': {
        if (!Array.isArray(m.ops)) return;
        const applied = [];
        for (const op of m.ops) {
          if (op.o === 'put') {
            const el = sanitizeEl(op.el);
            if (!el) continue;
            b.data.elements[el.id] = el;
            applied.push({ o: 'put', el });
          } else if (op.o === 'del' && typeof op.id === 'string') {
            if (b.data.elements[op.id]) { delete b.data.elements[op.id]; applied.push({ o: 'del', id: op.id }); }
          }
        }
        if (applied.length) {
          markDirty(b);
          broadcast(b, { t: 'ops', ops: applied, from: client.cid }, client);
        }
        if (m.seq != null) ws.send({ t: 'ack', seq: m.seq });
        break;
      }
      case 'cursor':
        if (typeof m.x === 'number' && typeof m.y === 'number')
          broadcast(b, { t: 'cursor', cid: client.cid, x: m.x, y: m.y }, client);
        break;
      case 'sel':
        client.sel = Array.isArray(m.ids) ? m.ids.slice(0, 500) : [];
        broadcast(b, { t: 'sel', cid: client.cid, ids: client.sel }, client);
        break;
      case 'rename':
        if (typeof m.name === 'string') {
          b.data.name = m.name.slice(0, 100) || '無題';
          markDirty(b);
          broadcast(b, { t: 'meta', name: b.data.name });
        }
        break;
      case 'ping':
        ws.send({ t: 'pong' });
        break;
    }
  };
  ws.onclose = () => {
    b.clients.delete(client);
    broadcast(b, { t: 'peer-leave', cid: client.cid });
    if (b.clients.size === 0) saveBoard(b).catch(() => {});
  };
}

// keepalive
setInterval(() => {
  for (const b of boards.values()) for (const c of b.clients) {
    if (!c.ws.alive) { c.ws.close(1001); continue; }
    c.ws.alive = false;
    c.ws.ping();
  }
}, 30000);

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
const IMG_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const b = await readBody(req, 64 * 1024 * 1024);
  return b.length ? JSON.parse(b.toString('utf8')) : {};
}

async function listBoards() {
  const files = (await fsp.readdir(BOARDS_DIR)).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const id = f.slice(0, -5);
    const live = boards.get(id);
    try {
      const d = live ? live.data : JSON.parse(await fsp.readFile(path.join(BOARDS_DIR, f), 'utf8'));
      out.push({ id, name: d.name, created: d.created, updated: d.updated, count: Object.keys(d.elements || {}).length, online: live ? live.clients.size : 0 });
    } catch {}
  }
  return out.sort((a, b) => b.updated - a.updated);
}

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) throw new Error();
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': rel.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
}

async function serveAsset(req, res, name) {
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|gif|webp|svg)$/.test(name)) { res.writeHead(404); res.end(); return; }
  const file = path.join(ASSETS_DIR, name);
  try {
    const st = await fsp.stat(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(name)], 'Content-Length': st.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // アップロードされたSVG等を直接開かれてもスクリプトを実行させない
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end(); }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    let m;

    if (p === '/api/boards' && req.method === 'GET') return sendJson(res, 200, await listBoards());
    if (p === '/api/boards' && req.method === 'POST') {
      const body = await readJson(req);
      let id; do { id = newBoardId(); } while (fs.existsSync(boardFile(id)));
      const b = await loadBoard(id);
      b.data.name = (body.name || '').toString().slice(0, 100) || '新しいボード';
      if (body.elements && typeof body.elements === 'object') b.data.elements = body.elements; // JSONインポート
      markDirty(b);
      await saveBoard(b);
      return sendJson(res, 200, { id });
    }
    if ((m = p.match(/^\/api\/boards\/([A-Za-z0-9_-]{1,64})$/))) {
      const id = m[1];
      if (req.method === 'GET') {
        const b = await loadBoard(id, false);
        if (!b) return sendJson(res, 404, { error: 'not found' });
        return sendJson(res, 200, b.data);
      }
      if (req.method === 'DELETE') {
        const b = boards.get(id);
        if (b) { if (b.saveTimer) clearTimeout(b.saveTimer); await saveBoard(b).catch(() => {}); for (const c of b.clients) c.ws.close(1001); boards.delete(id); }
        await fsp.rename(boardFile(id), path.join(TRASH_DIR, id + '_' + Date.now() + '.json')).catch(() => {});
        return sendJson(res, 200, { ok: true });
      }
    }
    if ((m = p.match(/^\/api\/boards\/([A-Za-z0-9_-]{1,64})\/rename$/)) && req.method === 'POST') {
      const body = await readJson(req);
      const b = await loadBoard(m[1], false);
      if (!b) return sendJson(res, 404, { error: 'not found' });
      b.data.name = (body.name || '').toString().slice(0, 100) || '無題';
      markDirty(b); broadcast(b, { t: 'meta', name: b.data.name });
      return sendJson(res, 200, { ok: true });
    }
    if ((m = p.match(/^\/api\/boards\/([A-Za-z0-9_-]{1,64})\/history$/)) && req.method === 'GET') {
      const dir = path.join(HISTORY_DIR, m[1]);
      let files = [];
      try { files = (await fsp.readdir(dir)).filter(f => f.endsWith('.json')).sort().reverse(); } catch {}
      return sendJson(res, 200, files.map(f => { const [ts, label] = f.slice(0, -5).split('_'); return { file: f, ts: +ts, label: label || '' }; }));
    }
    if ((m = p.match(/^\/api\/boards\/([A-Za-z0-9_-]{1,64})\/snapshot$/)) && req.method === 'POST') {
      const b = await loadBoard(m[1], false);
      if (!b) return sendJson(res, 404, { error: 'not found' });
      await saveBoard(b); await snapshot(b, 'manual');
      return sendJson(res, 200, { ok: true });
    }
    if ((m = p.match(/^\/api\/boards\/([A-Za-z0-9_-]{1,64})\/history\/([0-9]+(?:_[a-z]+)?\.json)$/))) {
      const file = path.join(HISTORY_DIR, m[1], m[2]);
      if (req.method === 'GET') {
        try { return sendJson(res, 200, JSON.parse(await fsp.readFile(file, 'utf8'))); } catch { return sendJson(res, 404, {}); }
      }
      if (req.method === 'POST') { // restore
        const b = await loadBoard(m[1], false);
        if (!b) return sendJson(res, 404, { error: 'not found' });
        const old = JSON.parse(await fsp.readFile(file, 'utf8'));
        await saveBoard(b); await snapshot(b, 'prerestore'); // 復元前の状態も残す
        b.data.elements = old.elements || {};
        markDirty(b); await saveBoard(b);
        broadcast(b, { t: 'reload' });
        return sendJson(res, 200, { ok: true });
      }
    }
    if (p === '/api/assets' && req.method === 'GET') {
      const files = (await fsp.readdir(ASSETS_DIR)).filter(f => /\.(png|jpg|gif|webp|svg)$/.test(f));
      let meta = {};
      try { meta = JSON.parse(await fsp.readFile(path.join(ASSETS_DIR, 'meta.json'), 'utf8')); } catch {}
      return sendJson(res, 200, files.map(f => ({ file: f, name: (meta[f] && meta[f].name) || f, at: (meta[f] && meta[f].at) || 0 })).sort((a, b) => a.at - b.at));
    }
    if (p === '/api/assets' && req.method === 'POST') {
      const ct = (req.headers['content-type'] || '').split(';')[0].trim();
      const ext = IMG_EXT[ct];
      if (!ext) return sendJson(res, 400, { error: 'unsupported type' });
      const body = await readBody(req, MAX_UPLOAD);
      const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 20);
      const fname = hash + ext;
      await fsp.writeFile(path.join(ASSETS_DIR, fname), body);
      let meta = {};
      try { meta = JSON.parse(await fsp.readFile(path.join(ASSETS_DIR, 'meta.json'), 'utf8')); } catch {}
      const name = decodeURIComponent(req.headers['x-filename'] || fname).slice(0, 100);
      if (!meta[fname]) meta[fname] = { name, at: Date.now(), library: req.headers['x-library'] === '1' };
      else if (req.headers['x-library'] === '1') meta[fname].library = true;
      await writeAtomic(path.join(ASSETS_DIR, 'meta.json'), JSON.stringify(meta));
      return sendJson(res, 200, { file: fname, url: 'assets/' + fname });
    }
    if ((m = p.match(/^\/api\/assets\/([A-Za-z0-9_-]+\.(?:png|jpg|gif|webp|svg))$/)) && req.method === 'DELETE') {
      // ライブラリから外すだけ（ボード上で使われている可能性があるのでファイルは残す）
      let meta = {};
      try { meta = JSON.parse(await fsp.readFile(path.join(ASSETS_DIR, 'meta.json'), 'utf8')); } catch {}
      if (meta[m[1]]) { meta[m[1]].library = false; await writeAtomic(path.join(ASSETS_DIR, 'meta.json'), JSON.stringify(meta)); }
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/library' && req.method === 'GET') {
      let meta = {};
      try { meta = JSON.parse(await fsp.readFile(path.join(ASSETS_DIR, 'meta.json'), 'utf8')); } catch {}
      return sendJson(res, 200, Object.entries(meta).filter(([, v]) => v.library).map(([f, v]) => ({ file: f, name: v.name, at: v.at })).sort((a, b) => a.at - b.at));
    }
    if ((m = p.match(/^\/assets\/(.+)$/)) && (req.method === 'GET' || req.method === 'HEAD')) return serveAsset(req, res, m[1]);
    if (p === '/healthz') return sendJson(res, 200, { ok: true, boards: boards.size });
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
    res.writeHead(405); res.end();
  } catch (e) {
    log('http error', e);
    if (!res.headersSent) sendJson(res, 500, { error: String(e.message || e) });
    else res.end();
  }
});

server.on('upgrade', (req, socket) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  handleWs(req, socket, u.searchParams.get('board') || '').catch(e => { log('ws error', e); socket.destroy(); });
});

server.listen(PORT, HOST, () => log(`IT Whiteboard listening on http://${HOST}:${PORT}  data=${DATA_DIR}`));
