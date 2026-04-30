// wireframe-parts.jsx — shared bits for all wireframe variants
// Charts (Line/Bar/Heatmap/Radar), shell pieces (Topbar, Sidebar, PageHead),
// fake data generators, and small atoms.

const CLUBS = ['Driver', '3W', '5I', '7I', '9I', 'PW', '52°', '56°'];
const NAV_PAGES = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'log',       label: '오늘 기록' },
  { id: 'distance',  label: '비거리' },
  { id: 'screen',    label: '스크린골프' },
  { id: 'health',    label: '건강' },
  { id: 'calendar',  label: '캘린더' },
];

// ── Tiny seeded PRNG so demo data is deterministic ─────────────────────
function rng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function genMonthlyDistance(seed = 7) {
  const r = rng(seed);
  const data = {};
  for (const c of CLUBS) {
    const base = c === 'Driver' ? 220 : c === '3W' ? 195 : c === '5I' ? 170 : c === '7I' ? 150 : c === '9I' ? 125 : c === 'PW' ? 105 : c === '52°' ? 85 : 70;
    data[c] = Array.from({ length: 12 }, (_, i) => Math.round(base + (i - 5) * 0.6 + (r() - 0.5) * 8));
  }
  return data;
}

function genWeight(seed = 12, days = 30) {
  const r = rng(seed);
  let w = 74.5;
  return Array.from({ length: days }, () => {
    w += (r() - 0.5) * 0.4;
    return +w.toFixed(1);
  });
}

function genSessions(seed = 3, days = 84) {
  const r = rng(seed);
  return Array.from({ length: days }, () => {
    const v = r();
    if (v < 0.45) return 0;
    if (v < 0.7) return 1;
    if (v < 0.88) return 2;
    if (v < 0.97) return 3;
    return 4;
  });
}

// ── Shared shell ────────────────────────────────────────────────────────
function WFTopbar({ user = '진', current, accent }) {
  return (
    <div className="wf-topbar">
      <div className="wf-logo"><span className="dot">●</span> 스윙.로그</div>
      <div className="wf-nav">
        {NAV_PAGES.map(p => (
          <div key={p.id} className={'wf-nav-item' + (p.id === current ? ' active' : '')}>{p.label}</div>
        ))}
      </div>
      <div className="wf-user">
        <span style={{ fontFamily: 'var(--w-font-mono)' }}>m · kg</span>
        <span className="wf-avatar" style={{ background: accent || 'var(--w-fill-2)', color: accent ? '#fff' : 'var(--w-ink)' }}>{user[0]}</span>
        <span>{user}</span>
      </div>
    </div>
  );
}

// ── Fairway — top-down golf hole with shot ball + landing trail ────────
// Render a teal field 320m long with rough on either side. Place a tee at
// bottom; a single ball lands at distance d along centerline + lateral offset.
// trails = [{ d, lateral, club, label, hi }] ranks shots together.
function Fairway({ width = 460, height = 220, maxYards = 320, trails = [], showRing = true, vertical = false }) {
  // We render horizontally (tee on left): more width per metre.
  const padL = 30, padR = 16, padT = 12, padB = 30;
  const W = width - padL - padR;
  const H = height - padT - padB;
  const xAt = d => padL + (d / maxYards) * W;
  const yMid = padT + H / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* rough strip */}
      <rect x={0} y={0} width={width} height={height} fill="#dfe9eb" />
      {/* fairway curved blob */}
      <path d={`M ${padL - 8} ${padT + H * 0.15} Q ${padL + W * 0.3} ${padT - 4}, ${padL + W * 0.6} ${padT + 8} T ${padL + W + 4} ${padT + H * 0.25}
                L ${padL + W + 4} ${padT + H * 0.78} Q ${padL + W * 0.6} ${padT + H + 6}, ${padL + W * 0.3} ${padT + H * 0.92} T ${padL - 8} ${padT + H * 0.85} Z`}
        fill="var(--w-teal)" />
      {/* center line */}
      <line x1={padL} y1={yMid} x2={padL + W} y2={yMid} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" />
      {/* yardage gridlines */}
      {[100, 150, 200, 250, 300].filter(y => y <= maxYards).map(y => (
        <g key={y}>
          <line x1={xAt(y)} y1={padT + 4} x2={xAt(y)} y2={padT + H - 4} stroke="rgba(255,255,255,0.18)" strokeDasharray="1 4" />
          <text x={xAt(y)} y={height - 10} textAnchor="middle" className="wf-fairway-yard">{y}m</text>
        </g>
      ))}
      {/* tee */}
      <circle cx={padL} cy={yMid} r="5" fill="#1a2a2e" stroke="#fff" strokeWidth="1.5" />
      <text x={padL} y={padT - 2} textAnchor="middle" className="wf-svg-text" style={{ fontSize: 9, fill: 'var(--w-muted)' }}>티</text>
      {/* shots */}
      {trails.map((s, i) => {
        const x = xAt(s.d);
        const y = yMid + (s.lateral || 0) * 1.4;
        return (
          <g key={i}>
            {/* trail from tee to landing — shallow arc */}
            <path d={`M ${padL} ${yMid} Q ${(padL + x) / 2} ${yMid - 32 - i*4}, ${x} ${y}`}
              fill="none" stroke={s.hi ? 'var(--w-accent)' : 'rgba(255,255,255,0.55)'}
              strokeWidth={s.hi ? 2 : 1.2} strokeDasharray={s.hi ? '' : '3 3'} />
            <circle cx={x} cy={y} r={s.hi ? 5 : 3.5} fill={s.hi ? 'var(--w-accent)' : '#fff'} stroke="#1a2a2e" strokeWidth="1" />
            {s.label && (
              <text x={x} y={y - 9} textAnchor="middle" style={{ fontSize: 10, fill: '#fff', fontFamily: 'var(--w-font-mono)', fontWeight: 600 }}>{s.label}</text>
            )}
            {s.club && (
              <text x={x} y={y + 16} textAnchor="middle" style={{ fontSize: 9, fill: 'rgba(255,255,255,0.85)', fontFamily: 'var(--w-font-mono)' }}>{s.club}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Ball-flight side profile — distance × height arc
function BallFlight({ width = 320, height = 130, distance = 226, apex = 30, launch = 14 }) {
  const padL = 24, padR = 12, padT = 12, padB = 22;
  const W = width - padL - padR, H = height - padT - padB;
  const xEnd = padL + W;
  const yGround = padT + H;
  // simple parabola: control point at midpoint with apex height
  const cx = (padL + xEnd) / 2;
  const cy = yGround - (apex / 50) * H * 1.4;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={padL} y1={yGround} x2={xEnd} y2={yGround} stroke="var(--w-line-strong)" />
      {/* ground tick marks */}
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <g key={i}>
          <line x1={padL + W * p} y1={yGround - 2} x2={padL + W * p} y2={yGround + 2} stroke="var(--w-line-strong)" />
          <text x={padL + W * p} y={yGround + 14} textAnchor="middle" className="wf-svg-text">{Math.round(distance * p)}</text>
        </g>
      ))}
      <text x={padL - 4} y={yGround + 4} textAnchor="end" className="wf-svg-text" style={{ fontSize: 9 }}>0</text>
      <text x={2} y={padT + 8} className="wf-svg-text" style={{ fontSize: 9 }}>↑h</text>
      {/* arc */}
      <path d={`M ${padL} ${yGround} Q ${cx} ${cy}, ${xEnd} ${yGround}`} fill="var(--w-accent-soft)" stroke="var(--w-accent)" strokeWidth="2" />
      <circle cx={padL} cy={yGround} r="3" fill="var(--w-fill-4)" />
      <circle cx={xEnd} cy={yGround} r="4" fill="var(--w-accent)" stroke="#fff" strokeWidth="1" />
      {/* launch angle indicator */}
      <path d={`M ${padL} ${yGround} L ${padL + 30} ${yGround - Math.tan(launch * Math.PI / 180) * 30}`} stroke="var(--w-fill-4)" strokeWidth="1" strokeDasharray="2 2" />
      <text x={padL + 14} y={yGround - 6} className="wf-svg-text" style={{ fontSize: 9, fill: 'var(--w-fill-4)' }}>{launch}°</text>
      <text x={xEnd - 6} y={padT + 18} textAnchor="end" style={{ fontSize: 11, fill: 'var(--w-accent)', fontWeight: 600, fontFamily: 'var(--w-font-mono)' }}>{distance}m</text>
      <text x={cx} y={cy - 4} textAnchor="middle" className="wf-svg-text" style={{ fontSize: 9 }}>apex {apex}m</text>
    </svg>
  );
}

function WFSidebar({ items, current }) {
  return (
    <div className="wf-side">
      <div className="wf-side-item active">
        <span className="dotmark"></span>
        <span>Today</span>
      </div>
      <div className="group">Track</div>
      {items.map(it => (
        <div key={it} className={'wf-side-item' + (it === current ? ' active' : '')}>
          <span className="dotmark"></span><span>{it}</span>
        </div>
      ))}
      <div className="group">Settings</div>
      <div className="wf-side-item"><span className="dotmark"></span><span>Profile</span></div>
      <div className="wf-side-item"><span className="dotmark"></span><span>Units</span></div>
    </div>
  );
}

function WFPageHead({ title, sub, right }) {
  return (
    <div className="wf-pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ── Charts ─────────────────────────────────────────────────────────────
function LineChart({ width = 360, height = 140, series, accent = false, showAxis = true, showDots = false, bestMarker = false, padding = { t: 14, r: 14, b: 22, l: 30 } }) {
  // series: [{ values: number[], accent?: bool }]
  const s = Array.isArray(series[0]) ? [{ values: series }] : series;
  const all = s.flatMap(x => x.values);
  const max = Math.max(...all) * 1.05;
  const min = Math.min(...all) * 0.95;
  const W = width - padding.l - padding.r;
  const H = height - padding.t - padding.b;
  const x = (i, n) => padding.l + (i / (n - 1)) * W;
  const y = v => padding.t + H - ((v - min) / (max - min)) * H;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="wf-spark">
      {showAxis && (
        <>
          <line x1={padding.l} y1={padding.t} x2={padding.l} y2={padding.t + H} className="wf-svg-axis" />
          <line x1={padding.l} y1={padding.t + H} x2={padding.l + W} y2={padding.t + H} className="wf-svg-axis" />
          {[0, 0.5, 1].map((p, i) => (
            <line key={i} x1={padding.l} y1={padding.t + H * p} x2={padding.l + W} y2={padding.t + H * p} className="wf-svg-grid" />
          ))}
          {[0, 0.5, 1].map((p, i) => (
            <text key={i} x={padding.l - 6} y={padding.t + H * p + 3} textAnchor="end" className="wf-svg-text">{Math.round(max - (max - min) * p)}</text>
          ))}
        </>
      )}
      {s.map((line, li) => {
        const path = line.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i, line.values.length)} ${y(v)}`).join(' ');
        return (
          <g key={li}>
            <path d={path} className={'wf-svg-line' + ((accent && li === s.length - 1) || line.accent ? ' accent' : '')} />
            {showDots && line.values.map((v, i) => (
              <circle key={i} cx={x(i, line.values.length)} cy={y(v)} r="2" fill={line.accent || (accent && li === s.length - 1) ? 'var(--w-accent)' : 'var(--w-fill-4)'} />
            ))}
            {bestMarker && (() => {
              const bi = line.values.indexOf(Math.max(...line.values));
              return (
                <g>
                  <circle cx={x(bi, line.values.length)} cy={y(line.values[bi])} r="4" fill="none" stroke="var(--w-accent)" strokeWidth="1.5" />
                  <text x={x(bi, line.values.length)} y={y(line.values[bi]) - 8} textAnchor="middle" className="wf-svg-label" fill="var(--w-accent)" style={{ fontFamily: 'var(--w-font-hand)', fontSize: 13 }}>best</text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

function BarChart({ width = 360, height = 140, values, labels, accentIdx = -1, padding = { t: 14, r: 10, b: 22, l: 28 }, showValues = false }) {
  const max = Math.max(...values) * 1.1;
  const W = width - padding.l - padding.r;
  const H = height - padding.t - padding.b;
  const bw = (W / values.length) * 0.7;
  const gap = (W / values.length) * 0.3;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={padding.l} y1={padding.t + H} x2={padding.l + W} y2={padding.t + H} className="wf-svg-axis" />
      {[0, 0.5].map((p, i) => (
        <line key={i} x1={padding.l} y1={padding.t + H * p} x2={padding.l + W} y2={padding.t + H * p} className="wf-svg-grid" />
      ))}
      {values.map((v, i) => {
        const h = (v / max) * H;
        const xb = padding.l + i * (bw + gap) + gap / 2;
        return (
          <g key={i}>
            <rect x={xb} y={padding.t + H - h} width={bw} height={h} className={'wf-svg-bar' + (i === accentIdx ? ' accent' : '')} rx="1" />
            {showValues && <text x={xb + bw / 2} y={padding.t + H - h - 4} textAnchor="middle" className="wf-svg-text">{v}</text>}
            {labels && <text x={xb + bw / 2} y={padding.t + H + 14} textAnchor="middle" className="wf-svg-text">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function RadarChart({ size = 240, axes, values, compareValues, max, accent = true }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 28;
  const n = axes.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (val, i) => [cx + Math.cos(angle(i)) * r * (val / max), cy + Math.sin(angle(i)) * r * (val / max)];
  const poly = vals => vals.map((v, i) => point(v, i).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((s, i) => (
        <polygon key={i} points={axes.map((_, j) => [cx + Math.cos(angle(j)) * r * s, cy + Math.sin(angle(j)) * r * s].join(',')).join(' ')}
          fill="none" stroke="var(--w-line)" strokeWidth="1" strokeDasharray={i === 3 ? 'none' : '2 3'} />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle(i)) * r} y2={cy + Math.sin(angle(i)) * r} stroke="var(--w-line)" strokeWidth="1" />
      ))}
      {compareValues && (
        <polygon points={poly(compareValues)} fill="var(--w-fill-2)" stroke="var(--w-fill-3)" strokeWidth="1.2" fillOpacity="0.6" />
      )}
      <polygon points={poly(values)} fill={accent ? 'var(--w-accent-soft)' : 'var(--w-fill-2)'}
        stroke={accent ? 'var(--w-accent)' : 'var(--w-fill-4)'} strokeWidth="1.5" />
      {values.map((v, i) => {
        const [px, py] = point(v, i);
        return <circle key={i} cx={px} cy={py} r="2.5" fill={accent ? 'var(--w-accent)' : 'var(--w-fill-4)'} />;
      })}
      {axes.map((a, i) => {
        const [tx, ty] = [cx + Math.cos(angle(i)) * (r + 16), cy + Math.sin(angle(i)) * (r + 16)];
        return <text key={i} x={tx} y={ty + 3} textAnchor="middle" className="wf-svg-label" style={{ fontSize: 10 }}>{a}</text>;
      })}
    </svg>
  );
}

function Heatmap({ values, weeks = 12, cellSize = 14, gap = 3, scale = 4, label = false }) {
  // values: array length = weeks*7, day-major (mon..sun)
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const v = values[w * 7 + d] || 0;
      const intensity = Math.min(v / scale, 1);
      const bg = intensity === 0
        ? 'var(--w-fill-1)'
        : `color-mix(in oklab, var(--w-accent) ${Math.round(intensity * 80) + 15}%, var(--w-fill-1))`;
      cells.push(
        <div key={`${w}-${d}`} className="wf-heatcell"
          style={{ background: bg, width: cellSize, height: cellSize, gridColumn: w + 2, gridRow: d + 1 }} />
      );
    }
  }
  const dayLbls = ['M', '', 'W', '', 'F', '', ''];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `12px repeat(${weeks}, ${cellSize}px)`,
      gridTemplateRows: `repeat(7, ${cellSize}px)`,
      gap,
      alignContent: 'start',
    }}>
      {label && dayLbls.map((d, i) => (
        <div key={i} style={{ gridColumn: 1, gridRow: i + 1, fontSize: 9, color: 'var(--w-faint)', fontFamily: 'var(--w-font-mono)' }}>{d}</div>
      ))}
      {cells}
    </div>
  );
}

// ── Atoms ──────────────────────────────────────────────────────────────
function Field({ label, value, mono = true, w }) {
  return (
    <div className="wf-field" style={{ width: w }}>
      <label>{label}</label>
      <div className={'wf-input' + (mono ? ' placeholder' : '')}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, unit, delta, hand }) {
  return (
    <div className="wf-box">
      <div className="h">{label}</div>
      <div className="bignum">{value}<span className="unit">{unit}</span></div>
      {delta && (
        <div style={{ fontSize: 11, color: 'var(--w-muted)', marginTop: 4 }}>
          <span className="wf-chip accent">{delta}</span>
          {hand && <span className="wf-note" style={{ marginLeft: 6 }}>{hand}</span>}
        </div>
      )}
    </div>
  );
}

// Tweaks-friendly callout
function HandNote({ children, style }) {
  return <div className="wf-note" style={style}>{children}</div>;
}

Object.assign(window, {
  CLUBS, NAV_PAGES,
  rng, genMonthlyDistance, genWeight, genSessions,
  WFTopbar, WFSidebar, WFPageHead,
  LineChart, BarChart, RadarChart, Heatmap, Fairway, BallFlight,
  Field, MiniStat, HandNote,
});
