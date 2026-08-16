import { useMemo, useState } from 'react';
import { useGame } from '../store/useGame';
import { dateKey } from '../game/formulas';
import { ACHIEVEMENTS } from '../game/achievements';
import type { DayStats } from '../types';

/**
 * Statistik & riwayat. Semua chart satu seri (magnitude harian) sehingga
 * memakai satu hue ungu; nilai/label memakai warna teks, bukan warna seri.
 * Heatmap memakai ramp sekuensial satu hue terang→gelap.
 */

const DAY_LABEL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABEL = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const SERIES = '#6133b4';
const SERIES_DIM = 'rgba(97, 51, 180, 0.14)';
const GRID = '#e7e3ee';
const INK_MUTED = '#878190';
// ramp sekuensial (terang → gelap, satu hue) untuk heatmap
const HEAT = ['#eeeaf4', '#d6c4ef', '#b190dd', '#8657c6', '#54289b'];

interface DayPoint {
  key: string;
  date: Date;
  stats: DayStats;
}

function lastNDays(history: Record<string, DayStats>, n: number): DayPoint[] {
  const out: DayPoint[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = dateKey(cursor);
    out.push({
      key,
      date: new Date(cursor),
      stats: history[key] ?? { done: 0, xp: 0, gold: 0 },
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function fmtDate(d: Date): string {
  return `${DAY_LABEL[d.getDay()]} ${d.getDate()} ${MONTH_LABEL[d.getMonth()]}`;
}

/** Batang dengan ujung atas membulat, kaki menempel baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  if (v <= 8) return 8;
  return Math.ceil(v / 5) * 5;
}

/** Chart batang: tugas selesai per hari (14 hari). */
function DoneBarChart({ days }: { days: DayPoint[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 336;
  const H = 132;
  const padL = 22;
  const padB = 18;
  const padT = 8;
  const plotW = W - padL - 4;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(...days.map((d) => d.stats.done)));
  const step = plotW / days.length;
  const barW = Math.min(18, step - 4);
  const maxIdx = days.reduce(
    (best, d, i) => (d.stats.done > days[best].stats.done ? i : best),
    0
  );

  return (
    <div className="chart-block">
      <h4 className="chart-title">Tugas selesai · 14 hari</h4>
      {sel !== null && (
        <div className="chart-tip">
          {fmtDate(days[sel].date)} — <b>{days[sel].stats.done}</b> tugas ·{' '}
          {days[sel].stats.xp} XP · {days[sel].stats.gold.toFixed(1)} gold
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
        aria-label="Grafik batang tugas selesai per hari">
        {[0, 0.5, 1].map((f) => {
          const y = padT + plotH * (1 - f);
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - 2} y2={y} stroke={GRID} strokeWidth="1" />
              <text x={padL - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill={INK_MUTED}>
                {Math.round(max * f)}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const h = (d.stats.done / max) * plotH;
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + plotH - h;
          const active = sel === i;
          const showLabel =
            d.stats.done > 0 && (i === maxIdx || i === days.length - 1 || active);
          return (
            <g key={d.key} onClick={() => setSel(active ? null : i)}>
              {/* target sentuh lebih besar dari batangnya */}
              <rect x={padL + i * step} y={padT} width={step} height={plotH + padB}
                fill="transparent" />
              {d.stats.done > 0 ? (
                <path d={barPath(x, y, barW, h, 4)} fill={SERIES}
                  opacity={sel === null || active ? 1 : 0.45} />
              ) : (
                <rect x={x} y={padT + plotH - 2} width={barW} height={2} rx="1"
                  fill={GRID} />
              )}
              {active && (
                <path d={barPath(x - 2, y - 2, barW + 4, h + 2, 5)} fill="none"
                  stroke="#fff" strokeWidth="2" />
              )}
              {showLabel && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9.5"
                  fontWeight="700" fill="#34313a">
                  {d.stats.done}
                </text>
              )}
              {i % 2 === (days.length - 1) % 2 && (
                <text x={padL + i * step + step / 2} y={H - 5} textAnchor="middle"
                  fontSize="8.5" fill={INK_MUTED}>
                  {d.date.getDate()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Chart garis+area: XP per hari (14 hari). */
function XpAreaChart({ days }: { days: DayPoint[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 336;
  const H = 122;
  const padL = 30;
  const padB = 18;
  const padT = 8;
  const plotW = W - padL - 8;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(...days.map((d) => d.stats.xp)));
  const px = (i: number) => padL + (i / (days.length - 1)) * plotW;
  const py = (v: number) => padT + plotH * (1 - v / max);

  const line = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.stats.xp)}`).join(' ');
  const area = `${line} L ${px(days.length - 1)} ${padT + plotH} L ${px(0)} ${padT + plotH} Z`;

  return (
    <div className="chart-block">
      <h4 className="chart-title">XP per hari · 14 hari</h4>
      {sel !== null && (
        <div className="chart-tip">
          {fmtDate(days[sel].date)} — <b>{days[sel].stats.xp}</b> XP
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
        aria-label="Grafik XP per hari">
        {[0, 0.5, 1].map((f) => {
          const y = padT + plotH * (1 - f);
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - 2} y2={y} stroke={GRID} strokeWidth="1" />
              <text x={padL - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill={INK_MUTED}>
                {Math.round(max * f)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={SERIES_DIM} />
        <path d={line} fill="none" stroke={SERIES} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {days.map((d, i) => (
          <g key={d.key} onClick={() => setSel(sel === i ? null : i)}>
            <rect x={px(i) - plotW / days.length / 2} y={padT}
              width={plotW / days.length} height={plotH + padB} fill="transparent" />
            {sel === i && (
              <>
                <line x1={px(i)} y1={padT} x2={px(i)} y2={padT + plotH}
                  stroke={INK_MUTED} strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={px(i)} cy={py(d.stats.xp)} r="4.5" fill={SERIES}
                  stroke="#fff" strokeWidth="2" />
              </>
            )}
            {i % 2 === (days.length - 1) % 2 && (
              <text x={px(i)} y={H - 5} textAnchor="middle" fontSize="8.5" fill={INK_MUTED}>
                {d.date.getDate()}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Heatmap 12 minggu ala kalender kontribusi. */
function Heatmap({ history }: { history: Record<string, DayStats> }) {
  const [sel, setSel] = useState<DayPoint | null>(null);
  const WEEKS = 12;
  const cell = 22;
  const gap = 4;

  const days = useMemo(() => lastNDays(history, WEEKS * 7), [history]);
  // geser supaya kolom terakhir berakhir hari ini; baris = hari (Min..Sab)
  const firstDow = days[0].date.getDay();

  const level = (done: number) => {
    if (done <= 0) return 0;
    if (done <= 1) return 1;
    if (done <= 3) return 2;
    if (done <= 5) return 3;
    return 4;
  };

  const W = WEEKS * (cell + gap) + 24;
  const H = 7 * (cell + gap) + 6;

  return (
    <div className="chart-block">
      <h4 className="chart-title">Peta aktivitas · 12 minggu</h4>
      {sel && (
        <div className="chart-tip">
          {fmtDate(sel.date)} — <b>{sel.stats.done}</b> tugas
        </div>
      )}
      <div className="heatmap-scroll">
        <svg width={W} height={H} role="img" aria-label="Heatmap aktivitas harian">
          {['Sen', 'Rab', 'Jum'].map((label, idx) => (
            <text key={label} x={0} y={(1 + idx * 2) * (cell + gap) + cell - 6}
              fontSize="9" fill={INK_MUTED}>
              {label}
            </text>
          ))}
          {days.map((d, i) => {
            const gridIdx = i + firstDow;
            const col = Math.floor(gridIdx / 7);
            const row = gridIdx % 7;
            const active = sel?.key === d.key;
            return (
              <rect
                key={d.key}
                x={24 + col * (cell + gap)}
                y={row * (cell + gap)}
                width={cell}
                height={cell}
                rx="5"
                fill={HEAT[level(d.stats.done)]}
                stroke={active ? SERIES : 'none'}
                strokeWidth={active ? 2 : 0}
                onClick={() => setSel(active ? null : d)}
              />
            );
          })}
        </svg>
      </div>
      <div className="heat-legend">
        <span>Sedikit</span>
        {HEAT.map((c) => (
          <span key={c} className="heat-swatch" style={{ background: c }} />
        ))}
        <span>Banyak</span>
      </div>
    </div>
  );
}

export function StatsModal({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.player);
  const tasks = useGame((s) => s.tasks);
  const history = useGame((s) => s.history);
  const achievements = useGame((s) => s.achievements);
  const unlockedCount = Object.keys(achievements).length;

  const days14 = useMemo(() => lastNDays(history, 14), [history]);
  const bestStreak = tasks.reduce(
    (best, t) => (t.type === 'daily' && t.streak > best ? t.streak : best),
    0
  );
  const hasData = Object.values(history).some((d) => d.done > 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 Statistik</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="stats-grid">
          <div>
            <b>{player.level}</b>
            <span>level</span>
          </div>
          <div>
            <b>{player.totalTasksDone}</b>
            <span>tugas selesai</span>
          </div>
          <div>
            <b>{bestStreak}</b>
            <span>streak terbaik</span>
          </div>
          <div>
            <b>{player.perfectDays}</b>
            <span>perfect day</span>
          </div>
          <div>
            <b>{player.pets.length}</b>
            <span>pet</span>
          </div>
          <div>
            <b>{player.ownedGear.length}</b>
            <span>perlengkapan</span>
          </div>
        </div>

        <h3 className="ach-heading">
          🏆 Pencapaian · {unlockedCount}/{ACHIEVEMENTS.length}
        </h3>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const unlockedAt = achievements[a.id];
            return (
              <div
                key={a.id}
                className={`ach-tile ${unlockedAt ? 'unlocked' : ''}`}
                title={unlockedAt ? `${a.desc} — terbuka ${unlockedAt}` : a.desc}
              >
                <span className="ach-emoji">{unlockedAt ? a.emoji : '🔒'}</span>
                <span className="ach-name">{a.name}</span>
              </div>
            );
          })}
        </div>

        {hasData ? (
          <>
            <DoneBarChart days={days14} />
            <XpAreaChart days={days14} />
            <Heatmap history={history} />
            <p className="muted chart-hint">Ketuk batang / titik / kotak untuk detail.</p>
          </>
        ) : (
          <p className="muted chart-hint">
            Belum ada riwayat — selesaikan tugas pertamamu hari ini dan grafiknya
            akan mulai terisi! 📈
          </p>
        )}
      </div>
    </div>
  );
}
