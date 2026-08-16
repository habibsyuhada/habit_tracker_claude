import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/useGame';
import type { Citizen } from '../types';
import {
  BUILDING_BY_ID,
  DECOR_BY_ID,
  JOB_BY_ID,
  THREAT_BY_ID,
  buildingCost,
  dailyYield,
  decorCost,
  kingdomEffects,
  titleFor,
} from '../game/kingdom';
import { dateKey, parseDateKey } from '../game/formulas';
import {
  MAP_H,
  MAP_W,
  ROAD_TILES,
  THREAT_SPOT,
  TILE,
  layoutKingdom,
  roadNeighbors,
  type MapObject,
} from '../game/mapLayout';
import {
  ANIMALS,
  CHAR_FALLBACK,
  GRASS_TILES,
  JOB_CHAR,
  NATURE_COMPS,
  ROAD_TILE,
  SHEET_COLS,
  SHEET_SRC,
  SIGN_STAMP,
  type SheetName,
  type Stamp,
} from '../game/tiny';
import { PixelSprite } from './PixelSprite';

function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

/* ================= penduduk & hewan ================= */

interface Mover {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  speed: number;
  idleUntil: number;
  flip: boolean;
}

interface Walker extends Mover {
  citizen: Citizen;
}

interface Animal extends Mover {
  key: string;
  name: string;
  stamp: Stamp;
}

function spawnWalkers(citizens: Citizen[], max = 12): Walker[] {
  const n = Math.min(citizens.length, max);
  const walkers: Walker[] = [];
  for (let i = 0; i < n; i++) {
    const start = ROAD_TILES[(i * 37 + 11) % ROAD_TILES.length];
    const nb = roadNeighbors(start.x, start.y);
    const to = nb[i % nb.length] ?? start;
    walkers.push({
      citizen: citizens[i],
      fx: start.x,
      fy: start.y,
      tx: to.x,
      ty: to.y,
      t: Math.random(),
      speed: 0.8 + Math.random() * 0.5,
      idleUntil: 0,
      flip: to.x < start.x,
    });
  }
  return walkers;
}

/* ================= tipe seleksi ================= */

type Selection =
  | { type: 'overview' }
  | { type: 'object'; obj: MapObject }
  | { type: 'villager'; citizen: Citizen }
  | { type: 'animal'; name: string }
  | { type: 'threat' };

/* ================= komponen utama ================= */

export function KingdomMap() {
  const player = useGame((s) => s.player);
  const kingdom = useGame((s) => s.kingdom);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const layout = useMemo(() => layoutKingdom(kingdom), [kingdom]);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ---- muat tilesheet Kenney ----
  const sheetsRef = useRef<Partial<Record<SheetName, HTMLImageElement>>>({});
  const [sheetsReady, setSheetsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    let loaded = 0;
    const names = Object.keys(SHEET_SRC) as SheetName[];
    for (const name of names) {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        loaded += 1;
        if (loaded === names.length) setSheetsReady(true);
      };
      img.src = SHEET_SRC[name];
      sheetsRef.current[name] = img;
    }
    return () => {
      alive = false;
    };
  }, []);

  const drawStamp = (
    ctx: CanvasRenderingContext2D,
    st: Stamp,
    tx: number,
    ty: number
  ) => {
    const img = sheetsRef.current[st.s];
    if (!img?.complete) return;
    const cols = SHEET_COLS[st.s];
    const sx = (st.i % cols) * TILE;
    const sy = Math.floor(st.i / cols) * TILE;
    ctx.drawImage(
      img,
      sx,
      sy,
      TILE,
      TILE,
      (tx + st.dx) * TILE,
      (ty + st.dy) * TILE,
      TILE,
      TILE
    );
  };

  // ---- lapisan statis peta (digambar ulang saat state/aset berubah) ----
  const staticLayerRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!sheetsReady) return;
    const cv = document.createElement('canvas');
    cv.width = MAP_W * TILE;
    cv.height = MAP_H * TILE;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // rumput dasar
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        const g = GRASS_TILES[tileHash(x, y) % GRASS_TILES.length];
        drawStamp(ctx, { s: 'town', i: g, dx: 0, dy: 0 }, x, y);
      }
    }
    // jalan
    for (const { x, y } of ROAD_TILES) {
      drawStamp(ctx, { s: 'town', i: ROAD_TILE, dx: 0, dy: 0 }, x, y);
    }

    // alam + objek, diurutkan dari utara ke selatan supaya tumpukan benar
    type Drawable = { bottom: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const [k, compKey] of layout.nature) {
      const [x, y] = k.split(',').map(Number);
      const comp = NATURE_COMPS[compKey];
      if (!comp) continue;
      drawables.push({
        bottom: y,
        draw: () => comp.forEach((st) => drawStamp(ctx, st, x, y)),
      });
    }
    for (const obj of layout.objects) {
      const bottom = obj.y + obj.h - 1;
      if (obj.kind === 'sign') {
        drawables.push({
          bottom,
          draw: () => {
            ctx.globalAlpha = 0.75;
            drawStamp(ctx, SIGN_STAMP, obj.x, obj.y);
            ctx.globalAlpha = 1;
          },
        });
      } else if (obj.comp) {
        drawables.push({
          bottom,
          draw: () => obj.comp!.forEach((st) => drawStamp(ctx, st, obj.x, obj.y)),
        });
      }
    }
    drawables.sort((a, b) => a.bottom - b.bottom);
    for (const d of drawables) d.draw();

    staticLayerRef.current = cv;
  }, [layout, sheetsReady]);

  // ---- penduduk ----
  const walkersRef = useRef<Walker[]>([]);
  useEffect(() => {
    walkersRef.current = spawnWalkers(kingdom.citizens);
  }, [kingdom.citizens]);

  // ---- hewan ternak di padang rumput ----
  const animalsRef = useRef<Animal[]>([]);
  const meadowSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const meadowSet = new Set(layout.meadow.map((m) => `${m.x},${m.y}`));
    meadowSetRef.current = meadowSet;
    const count = Math.min(2 + Math.floor(kingdom.citizens.length / 5), 6);
    const animals: Animal[] = [];
    for (let i = 0; i < count && layout.meadow.length > 0; i++) {
      const def = ANIMALS[i % ANIMALS.length];
      const start = layout.meadow[(i * 53 + 17) % layout.meadow.length];
      animals.push({
        key: def.key,
        name: def.name,
        stamp: def.stamp,
        fx: start.x,
        fy: start.y,
        tx: start.x,
        ty: start.y,
        t: 0,
        speed: 0.35 + Math.random() * 0.2,
        idleUntil: performance.now() + Math.random() * 3000,
        flip: false,
      });
    }
    animalsRef.current = animals;
  }, [layout, kingdom.citizens.length]);

  // ---- kamera ----
  const camRef = useRef({ x: 12.5 * TILE, y: 8 * TILE, zoom: 0 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const clampCam = () => {
    const cam = camRef.current;
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const minZoom = Math.max(w / (MAP_W * TILE), h / (MAP_H * TILE));
    cam.zoom = Math.min(8, Math.max(minZoom, cam.zoom));
    const halfW = w / (2 * cam.zoom);
    const halfH = h / (2 * cam.zoom);
    cam.x = Math.min(MAP_W * TILE - halfW, Math.max(halfW, cam.x));
    cam.y = Math.min(MAP_H * TILE - halfH, Math.max(halfH, cam.y));
  };

  // ---- ukuran canvas mengikuti kontainer ----
  useEffect(() => {
    const el = containerRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
      if (camRef.current.zoom === 0 && rect.width > 0) {
        // zoom awal: tampil ± 14 tile melebar, fokus kastil & alun-alun
        camRef.current.zoom = Math.max(rect.width / (TILE * 14), 1.2);
      }
      clampCam();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- ref pendukung loop ----
  const selectionRef = useRef<Selection | null>(null);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const threatRef = useRef(kingdom.threat);
  useEffect(() => {
    threatRef.current = kingdom.threat;
  }, [kingdom.threat]);

  // ---- loop render ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const moveOnRoads = (wk: Mover, now: number, dt: number) => {
      if (wk.idleUntil > now) return;
      wk.t += dt * wk.speed;
      while (wk.t >= 1) {
        wk.t -= 1;
        const px = wk.fx;
        const py = wk.fy;
        wk.fx = wk.tx;
        wk.fy = wk.ty;
        const nb = roadNeighbors(wk.fx, wk.fy).filter(
          (n) => !(n.x === px && n.y === py)
        );
        const pool = nb.length ? nb : roadNeighbors(wk.fx, wk.fy);
        const next = pool[Math.floor(Math.random() * pool.length)];
        if (!next) break;
        wk.tx = next.x;
        wk.ty = next.y;
        if (next.x !== wk.fx) wk.flip = next.x < wk.fx;
        if (Math.random() < 0.12) {
          wk.idleUntil = now + 900 + Math.random() * 2400;
          wk.t = 0;
          break;
        }
      }
    };

    const moveOnMeadow = (an: Animal, now: number, dt: number) => {
      if (an.idleUntil > now) return;
      an.t += dt * an.speed;
      while (an.t >= 1) {
        an.t -= 1;
        an.fx = an.tx;
        an.fy = an.ty;
        const meadow = meadowSetRef.current;
        const opts = [
          { x: an.fx + 1, y: an.fy },
          { x: an.fx - 1, y: an.fy },
          { x: an.fx, y: an.fy + 1 },
          { x: an.fx, y: an.fy - 1 },
        ].filter((n) => meadow.has(`${n.x},${n.y}`));
        const next = opts[Math.floor(Math.random() * opts.length)];
        if (!next) {
          an.idleUntil = now + 2000;
          an.t = 0;
          break;
        }
        an.tx = next.x;
        an.ty = next.y;
        if (next.x !== an.fx) an.flip = next.x < an.fx;
        if (Math.random() < 0.45) {
          an.idleUntil = now + 1500 + Math.random() * 4000;
          an.t = 0;
          break;
        }
      }
    };

    const drawMoverStamp = (
      ctx: CanvasRenderingContext2D,
      st: Stamp,
      wx: number,
      wy: number,
      flip: boolean,
      bob: number
    ) => {
      const img = sheetsRef.current[st.s];
      if (!img?.complete) return;
      const cols = SHEET_COLS[st.s];
      const sx = (st.i % cols) * TILE;
      const sy = Math.floor(st.i / cols) * TILE;
      ctx.save();
      ctx.translate(wx + TILE / 2, wy + bob);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, TILE, TILE, -TILE / 2, 0, TILE, TILE);
      ctx.restore();
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cv = canvasRef.current;
      const layer = staticLayerRef.current;
      const { w, h, dpr } = sizeRef.current;
      if (!cv || !layer || !w || !h) return;
      const ctx = cv.getContext('2d')!;
      const cam = camRef.current;

      for (const wk of walkersRef.current) moveOnRoads(wk, now, dt);
      for (const an of animalsRef.current) moveOnMeadow(an, now, dt);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#2a3d24';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(
        dpr * cam.zoom,
        0,
        0,
        dpr * cam.zoom,
        dpr * (w / 2 - cam.x * cam.zoom),
        dpr * (h / 2 - cam.y * cam.zoom)
      );
      ctx.drawImage(layer, 0, 0);

      // penanda ancaman: monster menyembul dari tepi hutan
      const threat = threatRef.current;
      if (threat) {
        const def = THREAT_BY_ID[threat.defId];
        if (def) {
          const bob = Math.sin(now / 280) * 1.5;
          ctx.font = `${TILE - 4}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText(
            def.emoji,
            THREAT_SPOT.x * TILE + TILE / 2,
            THREAT_SPOT.y * TILE + TILE - 3 + bob
          );
          ctx.font = 'bold 8px sans-serif';
          ctx.fillStyle = '#c22334';
          ctx.fillText(
            '!',
            THREAT_SPOT.x * TILE + TILE - 2,
            THREAT_SPOT.y * TILE + 2 + bob
          );
        }
      }

      // hewan lalu penduduk (bob saat berjalan)
      for (const an of animalsRef.current) {
        const idle = an.idleUntil > now;
        const x = (an.fx + (an.tx - an.fx) * an.t) * TILE;
        const y = (an.fy + (an.ty - an.fy) * an.t) * TILE;
        const bob = idle ? 0 : -Math.abs(Math.sin(now / 180)) * 1;
        drawMoverStamp(ctx, an.stamp, Math.round(x), Math.round(y), an.flip, bob);
      }
      for (const wk of walkersRef.current) {
        const idle = wk.idleUntil > now;
        const st = JOB_CHAR[wk.citizen.job] ?? CHAR_FALLBACK;
        const x = (wk.fx + (wk.tx - wk.fx) * wk.t) * TILE;
        const y = (wk.fy + (wk.ty - wk.fy) * wk.t) * TILE;
        const bob = idle ? 0 : -Math.abs(Math.sin(now / 130)) * 1.5;
        drawMoverStamp(ctx, st, Math.round(x), Math.round(y), wk.flip, bob);
      }

      // highlight objek terpilih
      const sel = selectionRef.current;
      if (sel?.type === 'object') {
        const { obj } = sel;
        const pulse = 0.55 + Math.sin(now / 220) * 0.25;
        ctx.strokeStyle = `rgba(255, 233, 163, ${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          obj.x * TILE + 0.5,
          obj.y * TILE + 0.5,
          obj.w * TILE - 1,
          obj.h * TILE - 1
        );
      }
    };
    raf = requestAnimationFrame(tick);
    if (import.meta.env.DEV) {
      // hook debug: paksa satu frame saat tab tidak tervisualisasi (rAF jeda)
      (window as unknown as Record<string, unknown>).__kmapDraw = () =>
        tick(performance.now());
    }
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- input: geser, cubit, ketuk ----
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0, camX: 0, camY: 0, t: 0 };
    let moved = false;
    let pinchDist = 0;

    const toLocal = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        // pointer sintetis (mis. saat pengujian) tidak bisa di-capture
      }
      const p = toLocal(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        moved = false;
        start = {
          x: p.x,
          y: p.y,
          camX: camRef.current.x,
          camY: camRef.current.y,
          t: performance.now(),
        };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        moved = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const p = toLocal(e);
      pointers.set(e.pointerId, p);
      const cam = camRef.current;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0 && dist > 0) {
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const { w, h } = sizeRef.current;
          const worldX = cam.x + (mid.x - w / 2) / cam.zoom;
          const worldY = cam.y + (mid.y - h / 2) / cam.zoom;
          cam.zoom *= dist / pinchDist;
          clampCam();
          cam.x = worldX - (mid.x - w / 2) / cam.zoom;
          cam.y = worldY - (mid.y - h / 2) / cam.zoom;
          clampCam();
        }
        pinchDist = dist;
      } else if (pointers.size === 1) {
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
        cam.x = start.camX - dx / cam.zoom;
        cam.y = start.camY - dy / cam.zoom;
        clampCam();
      }
    };

    const onUp = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size > 0 || !p) return;
      pinchDist = 0;
      const quick = performance.now() - start.t < 400;
      if (!moved && quick) handleTap(p.x, p.y);
    };

    const handleTap = (sx: number, sy: number) => {
      const cam = camRef.current;
      const { w, h } = sizeRef.current;
      const wx = cam.x + (sx - w / 2) / cam.zoom;
      const wy = cam.y + (sy - h / 2) / cam.zoom;

      // 1) penduduk / hewan (radius kecil, pilih terdekat)
      let bestWalker: Walker | null = null;
      let bestAnimal: Animal | null = null;
      let bestD = 12;
      for (const wk of walkersRef.current) {
        const x = (wk.fx + (wk.tx - wk.fx) * wk.t) * TILE + TILE / 2;
        const y = (wk.fy + (wk.ty - wk.fy) * wk.t) * TILE + TILE / 2;
        const d = Math.hypot(wx - x, wy - y);
        if (d < bestD) {
          bestD = d;
          bestWalker = wk;
          bestAnimal = null;
        }
      }
      for (const an of animalsRef.current) {
        const x = (an.fx + (an.tx - an.fx) * an.t) * TILE + TILE / 2;
        const y = (an.fy + (an.ty - an.fy) * an.t) * TILE + TILE / 2;
        const d = Math.hypot(wx - x, wy - y);
        if (d < bestD) {
          bestD = d;
          bestAnimal = an;
          bestWalker = null;
        }
      }
      if (bestWalker) {
        setSelection({ type: 'villager', citizen: bestWalker.citizen });
        return;
      }
      if (bestAnimal) {
        setSelection({ type: 'animal', name: bestAnimal.name });
        return;
      }

      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);

      // 2) penanda ancaman
      if (
        threatRef.current &&
        Math.abs(tx - THREAT_SPOT.x) <= 1 &&
        Math.abs(ty - THREAT_SPOT.y) <= 1
      ) {
        setSelection({ type: 'threat' });
        return;
      }

      // 3) objek peta
      for (const obj of layoutRef.current.objects) {
        if (tx >= obj.x && tx < obj.x + obj.w && ty >= obj.y && ty < obj.y + obj.h) {
          setSelection({ type: 'object', obj });
          return;
        }
      }
      setSelection(null);
    };

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    return () => {
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // ---- HUD ----
  const tier = titleFor(player.level);
  const threat = kingdom.threat ? THREAT_BY_ID[kingdom.threat.defId] : undefined;

  return (
    <div className="kmap" ref={containerRef}>
      <canvas ref={canvasRef} className="kmap-canvas" />

      <div className="kmap-hud-top">
        <button
          className="kmap-chip kmap-chip-title"
          onClick={() => setSelection({ type: 'overview' })}
        >
          👑 {tier.title} · {tier.realm}
        </button>
        <button className="kmap-chip" onClick={() => setSelection({ type: 'overview' })}>
          🧑‍🌾 {kingdom.citizens.length}
        </button>
      </div>

      {threat && kingdom.threat && (
        <button className="kmap-threat-chip" onClick={() => setSelection({ type: 'threat' })}>
          <span className="kmap-threat-emoji">{threat.emoji}</span>
          <span>
            {threat.name} · {kingdom.threat.progress}/{threat.goal}
          </span>
        </button>
      )}

      <div className="kmap-hint">🖐️ geser · 🤏 cubit · 👆 ketuk objek</div>

      {selection && (
        <div className="kmap-sheet">
          <button
            className="kmap-sheet-close"
            onClick={() => setSelection(null)}
            aria-label="Tutup"
          >
            ✕
          </button>
          <SheetContent selection={selection} />
        </div>
      )}
    </div>
  );
}

/* ================= isi bottom sheet ================= */

function SheetContent({ selection }: { selection: Selection }) {
  const player = useGame((s) => s.player);
  const kingdom = useGame((s) => s.kingdom);

  if (selection.type === 'overview') {
    const tier = titleFor(player.level);
    const eff = kingdomEffects(kingdom.buildings);
    const yield_ = dailyYield(kingdom.citizens);
    const bonuses: string[] = [];
    if (eff.goldMult > 1) bonuses.push(`+${Math.round((eff.goldMult - 1) * 100)}% kas`);
    if (eff.xpMult > 1)
      bonuses.push(`+${Math.round((eff.xpMult - 1) * 100)}% kemakmuran`);
    if (eff.damageMult < 1)
      bonuses.push(`-${Math.round((1 - eff.damageMult) * 100)}% damage moral`);
    if (eff.threatDelayBonus > 0)
      bonuses.push(`+${eff.threatDelayBonus} hari tenggat ancaman`);
    const builtCount = Object.values(kingdom.buildings).filter((l) => l > 0).length;

    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          <span className="kmap-sheet-emoji">👑</span>
          <div>
            <div className="kmap-sheet-title">
              {tier.title} {player.name}
            </div>
            <div className="kmap-sheet-sub">
              {tier.realm} · 🧑‍🌾 {kingdom.citizens.length} rakyat · 🏗️ {builtCount}{' '}
              bangunan · 🛡️ {kingdom.threatsRepelled} ancaman ditangkal
            </div>
          </div>
        </div>
        {bonuses.length > 0 && (
          <div className="kmap-sheet-row">✨ {bonuses.join(' · ')}</div>
        )}
        {(yield_.gold > 0 || yield_.xp > 0 || yield_.moral > 0) && (
          <div className="kmap-sheet-row">
            🧺 Hasil kerja rakyat / hari:{' '}
            {[
              yield_.gold > 0 ? `+${yield_.gold} kas` : '',
              yield_.xp > 0 ? `+${yield_.xp} kemakmuran` : '',
              yield_.moral > 0 ? `+${yield_.moral} moral` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
        <div className="kmap-sheet-row muted">
          Tiap 4 titah selesai, satu rakyat baru datang; tiap 3 rakyat mendirikan
          satu rumah. Bangunan & dekorasi dibeli di tab Rewards.
        </div>
        {kingdom.log.length > 0 && (
          <>
            <div className="kmap-sheet-section">📜 Kronik Kerajaan</div>
            <div className="chronicle">
              {kingdom.log.slice(0, 5).map((entry, i) => (
                <div className="chronicle-row" key={`${entry.date}-${i}`}>
                  <span className="chronicle-date">{entry.date.slice(5)}</span>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (selection.type === 'threat') {
    const active = kingdom.threat;
    const def = active ? THREAT_BY_ID[active.defId] : undefined;
    if (!active || !def)
      return <div className="kmap-sheet-body">Ancaman sudah berlalu. 🎉</div>;
    const daysLeft =
      Math.max(
        0,
        Math.round(
          (parseDateKey(active.expiresOn).getTime() -
            parseDateKey(dateKey()).getTime()) /
            86400000
        )
      ) + 1;
    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          <span className="kmap-sheet-emoji">{def.emoji}</span>
          <div>
            <div className="kmap-sheet-title">{def.name}</div>
            <div className="kmap-sheet-sub">
              {def.name} {def.warning}
            </div>
          </div>
        </div>
        <div className="threat-bar">
          <div
            className="threat-fill"
            style={{ width: `${Math.min(100, (active.progress / def.goal) * 100)}%` }}
          />
          <span className="threat-label">
            {active.progress} / {def.goal} titah
          </span>
        </div>
        <div className="kmap-sheet-row">
          ⏳ Sisa {daysLeft} hari · 🎁 hadiah {def.rewardGold} gold · 💔 penalti
          moral -{def.penaltyMoral}
        </div>
        <div className="kmap-sheet-row muted">
          Selesaikan titah apa pun untuk mengisi bar penangkalan.
        </div>
      </div>
    );
  }

  if (selection.type === 'villager') {
    const c = selection.citizen;
    const job = JOB_BY_ID[c.job];
    const parts = [
      job && job.gold > 0 ? `+${job.gold} kas` : '',
      job && job.xp > 0 ? `+${job.xp} kemakmuran` : '',
      job && job.moral > 0 ? `+${job.moral} moral` : '',
    ].filter(Boolean);
    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          <span className="kmap-sheet-emoji">{job?.emoji ?? '🧑'}</span>
          <div>
            <div className="kmap-sheet-title">{c.name}</div>
            <div className="kmap-sheet-sub">{job?.name ?? 'Rakyat'} kerajaanmu</div>
          </div>
        </div>
        <div className="kmap-sheet-row">
          {parts.length > 0
            ? `🧺 Setoran per hari: ${parts.join(' · ')}`
            : '🧺 Belum menyetor apa-apa — tapi selalu ceria di alun-alun.'}
        </div>
      </div>
    );
  }

  if (selection.type === 'animal') {
    const lines: Record<string, string> = {
      Domba: 'Mengembik santai sambil menyubit rumput alun-alun.',
      Sapi: 'Penyumbang susu segar untuk sarapan para rakyat.',
      Ayam: 'Kotek-kotek! Berkeliaran mencari remah roti festival.',
    };
    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          <span className="kmap-sheet-emoji">
            {selection.name === 'Domba' ? '🐑' : selection.name === 'Sapi' ? '🐄' : '🐔'}
          </span>
          <div>
            <div className="kmap-sheet-title">{selection.name} Kerajaan</div>
            <div className="kmap-sheet-sub">{lines[selection.name] ?? 'Hewan ternak.'}</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- objek peta ----
  const { obj } = selection;

  if (obj.kind === 'house') {
    const idx = Number(obj.defId);
    const residents = kingdom.citizens.slice(idx * 3, idx * 3 + 3);
    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          <span className="kmap-sheet-emoji">🏠</span>
          <div>
            <div className="kmap-sheet-title">Rumah Rakyat</div>
            <div className="kmap-sheet-sub">Hunian hangat di distrik barat</div>
          </div>
        </div>
        <div className="citizen-grid">
          {residents.map((c) => {
            const job = JOB_BY_ID[c.job];
            return (
              <span className="citizen-chip" key={c.id}>
                {job?.emoji} {c.name}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (obj.kind === 'sign') {
    const def = BUILDING_BY_ID[obj.defId];
    if (!def) return null;
    const cost = buildingCost(def, 0);
    const locked = kingdom.citizens.length < def.minCitizens;
    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          <span className="kmap-sheet-emoji">{def.emoji}</span>
          <div>
            <div className="kmap-sheet-title">Kavling {def.name}</div>
            <div className="kmap-sheet-sub">Belum dibangun</div>
          </div>
        </div>
        <div className="kmap-sheet-row">{def.desc}</div>
        <div className="kmap-sheet-row">
          🪙 Biaya: {cost} gold
          {def.minCitizens > 0 && ` · butuh ${def.minCitizens} rakyat`}
          {locked && ` (sekarang ${kingdom.citizens.length})`}
        </div>
        <div className="kmap-sheet-row muted">
          Bangun lewat tab Rewards → Bangunan Kerajaan.
        </div>
      </div>
    );
  }

  if (obj.kind === 'decor') {
    const def = DECOR_BY_ID[obj.defId];
    if (!def) return null;
    const next = obj.level < def.maxLevel ? decorCost(def, obj.level) : undefined;
    return (
      <div className="kmap-sheet-body">
        <div className="kmap-sheet-head">
          {obj.sprite ? (
            <span className="kmap-sheet-sprite">
              <PixelSprite sprite={obj.sprite} size={44} />
            </span>
          ) : (
            <span className="kmap-sheet-emoji">{def.emoji}</span>
          )}
          <div>
            <div className="kmap-sheet-title">
              {def.name} · Lv {obj.level}/{def.maxLevel}
            </div>
            <div className="kmap-sheet-sub">Dekorasi kebanggaan kerajaan</div>
          </div>
        </div>
        <div className="kmap-sheet-row">
          {next
            ? `⬆️ Tingkatkan jadi Lv ${obj.level + 1} seharga ${next} gold di tab Rewards.`
            : '🌟 Sudah level maksimal — indah sempurna!'}
        </div>
      </div>
    );
  }

  // bangunan
  const def = BUILDING_BY_ID[obj.defId];
  if (!def) return null;
  const next = obj.level < def.maxLevel ? buildingCost(def, obj.level) : undefined;
  const effects: string[] = [];
  if (def.goldPct > 0) effects.push(`+${def.goldPct * obj.level}% kas`);
  if (def.xpPct > 0) effects.push(`+${def.xpPct * obj.level}% kemakmuran`);
  if (def.damagePct > 0) effects.push(`-${def.damagePct * obj.level}% damage moral`);
  if (def.threatDelay > 0)
    effects.push(`+${def.threatDelay * obj.level} hari tenggat ancaman`);
  return (
    <div className="kmap-sheet-body">
      <div className="kmap-sheet-head">
        {obj.sprite ? (
          <span className="kmap-sheet-sprite">
            <PixelSprite sprite={obj.sprite} size={44} />
          </span>
        ) : (
          <span className="kmap-sheet-emoji">{def.emoji}</span>
        )}
        <div>
          <div className="kmap-sheet-title">
            {def.name} · Lv {obj.level}/{def.maxLevel}
          </div>
          <div className="kmap-sheet-sub">{def.desc}</div>
        </div>
      </div>
      {effects.length > 0 && (
        <div className="kmap-sheet-row">✨ Efek aktif: {effects.join(' · ')}</div>
      )}
      <div className="kmap-sheet-row">
        {next
          ? `⬆️ Upgrade ke Lv ${obj.level + 1} seharga ${next} gold di tab Rewards.`
          : '🌟 Sudah level maksimal!'}
      </div>
    </div>
  );
}
