// variant-heatmap.jsx — Variant 3: Heatmap / consistency-focused
// Calendar-as-grass-graph everywhere. Best for "am I being consistent".

function V3Dashboard() {
  const sessions = genSessions(3, 84);
  return (
    <div className="wf">
      <WFTopbar current="dashboard" />
      <WFPageHead title="Consistency"
        sub="every cell = one day · darker = more practice · 12 weeks back"
        right={<button className="wf-btn accent">+ Today</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MiniStat label="Streak" value="3" unit="days" />
        <MiniStat label="Active days" value="42 / 84" delta="50%" />
        <MiniStat label="Weekly avg" value="3.5" unit="sessions" />
        <MiniStat label="Best week" value="W17" delta="6 sessions" />

        <div className="wf-box" style={{ gridColumn: 'span 4' }}>
          <div className="h">Practice grass · 12 weeks</div>
          <div style={{ padding: '6px 0' }}>
            <Heatmap values={sessions} weeks={12} cellSize={18} gap={3} scale={4} label />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: 'var(--w-muted)', fontFamily: 'var(--w-font-mono)', marginTop: 8 }}>
            <span>less</span>
            {[0,1,2,3,4].map(n => (
              <div key={n} className="wf-heatcell" style={{ width: 12, height: 12, background: n === 0 ? 'var(--w-fill-1)' : `color-mix(in oklab, var(--w-accent) ${n*20+15}%, var(--w-fill-1))` }} />
            ))}
            <span>more</span>
          </div>
        </div>

        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">Weight · daily heatstrip</div>
          <div style={{ display: 'flex', gap: 2, height: 32, marginTop: 4 }}>
            {genWeight(12, 30).map((w, i) => {
              const t = (w - 73) / 3;
              return <div key={i} style={{ flex: 1, background: `color-mix(in oklab, var(--w-accent) ${Math.max(5, t*60)}%, var(--w-fill-1))`, borderRadius: 1 }} />;
            })}
          </div>
          <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--w-muted)', marginTop: 4, fontFamily: 'var(--w-font-mono)' }}>
            <span>30d ago</span><span>74.2 kg</span>
          </div>
        </div>
        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">Today's plan</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
            {['☐ 50 balls — 7I', '☐ 20 driver swings', '☐ Wedge 50/56/60 ladder', '☐ Weight check-in'].map((t, i) => (
              <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--w-line)' }}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function V3Calendar() {
  const sessions = genSessions(5, 31).map(v => v > 0 ? v : 0);
  return (
    <div className="wf">
      <WFTopbar current="calendar" />
      <WFPageHead title="May 2026 · heatmap"
        sub="cell shade = workout intensity · click for details"
        right={<div className="wf-seg"><button>Year</button><button className="on">Month</button></div>} />
      <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, flex: 1 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{ fontSize: 10, color: 'var(--w-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 4px' }}>{d}</div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => {
          const day = i - 3;
          const v = day > 0 && day <= 31 ? sessions[day - 1] : 0;
          const intensity = Math.min(v / 4, 1);
          const isToday = day === 4;
          return (
            <div key={i} style={{
              minHeight: 84,
              borderRadius: 4,
              padding: 8,
              background: v === 0 ? 'var(--w-fill-1)' : `color-mix(in oklab, var(--w-accent) ${Math.round(intensity * 70) + 15}%, var(--w-fill-1))`,
              outline: isToday ? '2px solid var(--w-ink)' : 'none',
              outlineOffset: -2,
              opacity: day < 1 || day > 31 ? 0.3 : 1,
              color: intensity > 0.6 ? '#fff' : 'inherit',
            }}>
              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{day > 0 && day <= 31 ? day : ''}</div>
              {v > 0 && (
                <div style={{ marginTop: 14, fontSize: 10, fontFamily: 'var(--w-font-mono)' }}>
                  {v}× session{v>1?'s':''}<br/>
                  {v * 45}m
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function V3Distance() {
  // year-grid heatmap of best driver distance per day
  const days = genSessions(8, 365).map(v => v > 0 ? v + Math.random() * 2 : 0);
  return (
    <div className="wf">
      <WFTopbar current="distance" />
      <WFPageHead title="Driver carry · year heatmap"
        sub="brighter = longer best of day"
        right={<div className="wf-seg"><button className="on">Driver</button><button>7I</button><button>PW</button></div>} />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 240px' }}>
        <div className="wf-box">
          <div className="h">365 days</div>
          <div style={{ overflowX: 'auto', padding: '6px 0' }}>
            <Heatmap values={days} weeks={52} cellSize={11} gap={2} scale={4} label />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--w-muted)', fontFamily: 'var(--w-font-mono)', marginTop: 8 }}>
            <span>May '25</span><span>Aug</span><span>Nov</span><span>Feb '26</span><span>May</span>
          </div>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Personal records</div>
            {[['Driver','231 m','5/3'],['7I','158 m','4/12'],['PW','112 m','4/28']].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--w-line)' }}>
                <span style={{ fontSize: 12 }}>{r[0]}</span>
                <span className="num" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{r[1]} <span style={{ color: 'var(--w-muted)' }}>{r[2]}</span></span>
              </div>
            ))}
          </div>
          <div className="wf-box muted">
            <HandNote>shaded zones = personal best windows. Apr–May is your strongest stretch ever ✓</HandNote>
          </div>
        </div>
      </div>
    </div>
  );
}

function V3Health() {
  return (
    <div className="wf">
      <WFTopbar current="health" />
      <WFPageHead title="Health · 365 days at a glance" />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {[
          { t: 'Weight check-ins', g: 8 },
          { t: 'Sleep ≥ 7h', g: 14 },
          { t: 'BMI in range', g: 21 },
          { t: 'BP optimal', g: 5 },
        ].map(s => (
          <div key={s.t} className="wf-box">
            <div className="h">{s.t}</div>
            <div style={{ padding: '6px 0' }}>
              <Heatmap values={genSessions(s.g, 84)} weeks={12} cellSize={14} gap={2} scale={4} label />
            </div>
          </div>
        ))}
        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">Health score · breakdown</div>
          <table className="wf-table">
            <thead><tr><th>Metric</th><th>Value</th><th>Weight</th><th>Score</th></tr></thead>
            <tbody>
              {[['BMI', '22.8', '20%', '95'],
                ['Sleep', '6.8h', '25%', '78'],
                ['BP', '118/76', '20%', '92'],
                ['Adherence', '50%', '20%', '70'],
                ['Weight stability', '±0.4', '15%', '88']].map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? 'num' : ''}>{c}</td>)}</tr>
              ))}
              <tr style={{ fontWeight: 600 }}>
                <td>Total</td><td/><td/><td className="num" style={{ color: 'var(--w-accent)' }}>84%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function V3LogWorkout() {
  return (
    <div className="wf">
      <WFTopbar current="log" />
      <WFPageHead title="Quick log · today"
        sub="your last 12 weeks at the bottom — keep the streak alive" />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">What did you do?</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['Range','Screen','Round','Practice','Lesson'].map((t, i) => (
                <span key={t} className={'wf-chip' + (i === 0 ? ' solid' : '')}>{t}</span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Duration" value="90 min" />
              <Field label="Balls hit" value="120" />
            </div>
          </div>
          <div className="wf-box">
            <div className="h">Clubs touched today</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CLUBS.map((c, i) => (
                <span key={c} className={'wf-chip' + (i < 4 ? ' solid' : '')}>{c}</span>
              ))}
            </div>
            <HandNote style={{ marginTop: 8 }}>tap to add distance per club →</HandNote>
          </div>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Your last 12 weeks</div>
            <div style={{ padding: '6px 0' }}>
              <Heatmap values={genSessions(3, 84)} weeks={12} cellSize={14} gap={2} scale={4} label />
            </div>
            <HandNote>3-day streak · don't break it!</HandNote>
          </div>
          <button className="wf-btn accent">Save & extend streak</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { V3Dashboard, V3Calendar, V3Distance, V3Health, V3LogWorkout });
