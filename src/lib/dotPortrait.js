// Screen-printed dot portrait. Each dot has a "home" on a halftone grid;
// dots fly in on load, shy away from the pointer, loosen while signing in,
// and scatter on success. The loop stops itself when everything is still.
export function decodeDots(b64, cols, rows) {
  const bin = atob(b64);
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    out[2 * i] = b >> 4;
    if (2 * i + 1 < out.length) out[2 * i + 1] = b & 15;
  }
  return out;
}

export class DotPortrait {
  constructor(canvas, { b64, cols, rows }) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols;
    this.rows = rows;
    const tones = decodeDots(b64, cols, rows);
    const idx = [];
    for (let i = 0; i < tones.length; i++) if (tones[i] > 0) idx.push(i);
    const n = (this.n = idx.length);
    this.gx = new Uint16Array(n); this.gy = new Uint16Array(n); this.t = new Float32Array(n);
    this.hx = new Float32Array(n); this.hy = new Float32Array(n); this.r = new Float32Array(n);
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.delay = new Float32Array(n);
    idx.forEach((i, k) => {
      this.gx[k] = i % cols; this.gy[k] = (i / cols) | 0;
      this.t[k] = tones[i] / 15;
    });
    this.mode = 'rest';          // rest | loose | burst
    this.pointer = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.running = false;
    this.frame = 0;
    this.alpha = 1;
    this._tick = this._tick.bind(this);
    this._bind();
    this.resize();
  }

  _bind() {
    const host = this.c.parentElement;
    const pt = (e) => {
      const b = this.c.getBoundingClientRect();
      this.pointer = { x: e.clientX - b.left, y: e.clientY - b.top };
      this.wake();
    };
    host.addEventListener('pointermove', pt);
    host.addEventListener('pointerdown', pt);
    host.addEventListener('pointerleave', () => { this.pointer = null; this.wake(); });
    this._ro = new ResizeObserver(() => { this.resize(); });
    this._ro.observe(this.c);
    this._mq = matchMedia('(prefers-color-scheme: dark)');
    this._onTheme = () => this.draw();
    this._mq.addEventListener('change', this._onTheme);
  }

  destroy() {
    this._ro.disconnect();
    this._mq.removeEventListener('change', this._onTheme);
    cancelAnimationFrame(this._raf);
  }

  resize() {
    const w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.c.width = w * dpr; this.c.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    const cell = (this.cell = Math.min(w / this.cols, h / this.rows));
    const ox = (w - this.cols * cell) / 2;
    const oy = h - this.rows * cell;           // sit on the bottom edge
    const first = !this.laidOut;
    for (let k = 0; k < this.n; k++) {
      this.hx[k] = ox + (this.gx[k] + 0.5) * cell;
      this.hy[k] = oy + (this.gy[k] + 0.5) * cell;
      this.r[k] = cell * 0.62 * Math.sqrt(this.t[k]);
      if (!first) { this.x[k] = this.hx[k]; this.y[k] = this.hy[k]; }
    }
    this.laidOut = true;
    if (first) this.intro(); else this.draw();
  }

  intro() {
    if (this.reduced) {
      this.x.set(this.hx); this.y.set(this.hy);
      return this.draw();
    }
    // Dots start as loose "ink" across the panel and settle top to bottom,
    // like a print coming off the screen.
    for (let k = 0; k < this.n; k++) {
      this.x[k] = Math.random() * this.w;
      this.y[k] = this.h + Math.random() * this.h * 0.4;
      this.vx[k] = 0; this.vy[k] = 0;
      this.delay[k] = (this.gy[k] / this.rows) * 34 + Math.random() * 18;
    }
    this.frame = 0;
    this.wake();
  }

  setMode(m) {
    this.mode = m;
    if (m === 'burst') {
      const cx = this.w / 2, cy = this.h * 0.45;
      for (let k = 0; k < this.n; k++) {
        const dx = this.x[k] - cx, dy = this.y[k] - cy;
        const d = Math.hypot(dx, dy) || 1, s = 6 + Math.random() * 10;
        this.vx[k] = (dx / d) * s; this.vy[k] = (dy / d) * s - 2;
      }
    }
    if (m === 'rest') this.alpha = 1;
    if (this.reduced) { this.alpha = m === 'burst' ? 0 : 1; this.draw(); return; }
    this.wake();
  }

  wake() {
    if (this.reduced || this.running) return;
    this.running = true;
    this._raf = requestAnimationFrame(this._tick);
  }

  _tick() {
    this.frame++;
    const { n, x, y, vx, vy, hx, hy, delay, mode } = this;
    const p = this.pointer, R = Math.max(70, this.cell * 14), R2 = R * R;
    const k = mode === 'loose' ? 0.012 : 0.05, damp = mode === 'burst' ? 0.985 : 0.82;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      if (this.frame < delay[i]) { energy += 1; continue; }
      let ax = 0, ay = 0;
      if (mode !== 'burst') { ax = (hx[i] - x[i]) * k; ay = (hy[i] - y[i]) * k; }
      if (mode === 'loose') { ax += (Math.random() - 0.5) * 0.9; ay += (Math.random() - 0.5) * 0.9; }
      if (p && mode === 'rest') {
        const dx = x[i] - p.x, dy = y[i] - p.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = (1 - d / R) * 3.2;
          ax += (dx / d) * f; ay += (dy / d) * f;
        }
      }
      vx[i] = (vx[i] + ax) * damp; vy[i] = (vy[i] + ay) * damp;
      x[i] += vx[i]; y[i] += vy[i];
      energy += Math.abs(vx[i]) + Math.abs(vy[i]) + (p ? 0 : Math.abs(hx[i] - x[i]) * 0.02);
    }
    if (mode === 'burst') this.alpha = Math.max(0, this.alpha - 0.025);
    this.draw();
    const still = mode === 'rest' && energy / n < 0.004;
    const gone = mode === 'burst' && this.alpha <= 0;
    if (still || gone) {
      this.running = false;
      if (still && !p) { this.x.set(hx); this.y.set(hy); this.draw(); }
      return;
    }
    this._raf = requestAnimationFrame(this._tick);
  }

  draw() {
    const { ctx, n, x, y, r } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = getComputedStyle(this.c).getPropertyValue('--dot').trim() || '#efe4d2';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (r[i] < 0.35) continue;
      ctx.moveTo(x[i] + r[i], y[i]);
      ctx.arc(x[i], y[i], r[i], 0, 6.2832);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
