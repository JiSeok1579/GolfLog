// variant-bars.jsx — Variant 2: Bar-chart focused
// Comparisons everywhere — club vs club, this month vs last, daily duration.

function V2Dashboard() {
  const data = genMonthlyDistance(11);
  const thisMo = CLUBS.map(c => data[c][data[c].length - 1]);
  const lastMo = CLUBS.map(c => data[c][data[c].length - 2]);
  return (
    <div className="wf">
      <WFTopbar current="dashboard" />
      <WFPageHead title="May overview" sub="3 sessions this week · 6.5h total"
        right={<button className="wf-btn accent">+ Log session</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MiniStat label="Sessions" value="12" unit="" delta="+3 vs Apr" />
        <MiniStat label="Hours" value="22.5" unit="h" delta="+1.5h" />
        <MiniStat label="Driver avg" value="226" unit="m" delta="+4 m" />
        <MiniStat label="Weight" value="74.2" unit="kg" delta="−0.6 kg" />

        <div className="wf-box" style={{ gridColumn: 'span 4' }}>
          <div className="h" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Carry distance · this month vs last</span>
            <span style={{ fontSize: 11, color: 'var(--w-muted)' }}>
              <span className="wf-chip">last</span>{' '}
              <span className="wf-chip accent">this</span>
            </span>
          </div>
          <BarChart width={760} height={200} values={thisMo.flatMap((v, i) => [lastMo[i], v])}
            labels={CLUBS.flatMap(c => [c, ''])}
            accentIdx={-1} showValues />
        </div>

        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">Daily session minutes · this week</div>
          <BarChart width={400} height={140} values={[60, 0, 90, 45, 0, 75, 30]} labels={['M','T','W','T','F','S','S']} accentIdx={2} showValues />
        </div>
        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">Best of the week</div>
          <table className="wf-table">
            <thead><tr><th>Club</th><th>Best</th><th>Δ vs avg</th></tr></thead>
            <tbody>
              {[['Driver','231 m','+5'],['7I','158 m','+8'],['PW','112 m','+7'],['56°','88 m','+3']].map((r,i)=>(
                <tr key={i}>{r.map((c,j)=><td key={j} className={j>0?'num':''}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function V2Distance() {
  const data = genMonthlyDistance(7);
  return (
    <div className="wf">
      <WFTopbar current="distance" />
      <WFPageHead title="Club comparison" sub="bar = average · whisker = min/max"
        right={<div className="wf-seg"><button>Carry</button><button className="on">Total</button><button>Spin</button></div>} />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 260px' }}>
        <div className="wf-box">
          <div className="h">All clubs · current avg</div>
          <BarChart width={620} height={280} values={CLUBS.map(c => data[c][data[c].length - 1])}
            labels={CLUBS} accentIdx={0} showValues />
          <HandNote style={{ marginTop: 8 }}>tap a bar → see month-over-month →</HandNote>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Driver · last 6 mo</div>
            <BarChart width={220} height={140} values={data.Driver.slice(-6)} labels={['D','J','F','M','A','M']} accentIdx={5} />
          </div>
          <div className="wf-box">
            <div className="h">Personal best</div>
            <div className="bignum" style={{ fontSize: 32 }}>231<span className="unit">m</span></div>
            <div style={{ fontSize: 11, color: 'var(--w-muted)' }}>Driver · 5/3 · GDR 강남점</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function V2Screen() {
  return (
    <div className="wf">
      <WFTopbar current="screen" />
      <WFPageHead title="Screen golf · session result" sub="GDR 강남점 · 4 May 14:30"
        right={<button className="wf-btn accent">Save result</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="wf-box">
          <div className="h">Per-club metrics · enter values</div>
          <table className="wf-table">
            <thead><tr><th>Club</th><th>Ball spd</th><th>Head spd</th><th>Launch°</th><th>Spin</th><th>Carry</th></tr></thead>
            <tbody>
              {CLUBS.slice(0,6).map(c => (
                <tr key={c}>
                  <td>{c}</td>
                  {[0,1,2,3,4].map(j => (
                    <td key={j} className="num placeholder" style={{ color: 'var(--w-faint)', fontFamily: 'var(--w-font-mono)' }}>—</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Driver · this vs last 5 sessions</div>
            <BarChart width={360} height={140} values={[218, 222, 219, 224, 226, 231]} labels={['s−5','s−4','s−3','s−2','s−1','now']} accentIdx={5} showValues />
          </div>
          <div className="wf-row" style={{ gap: 12 }}>
            <MiniStat label="Ball speed" value="68.2" unit="m/s" delta="+1.3" />
            <MiniStat label="Launch°" value="14.2" unit="°" delta="ideal" />
          </div>
          <div className="wf-row" style={{ gap: 12 }}>
            <MiniStat label="Smash factor" value="1.46" delta="+0.02" />
            <MiniStat label="Side dev" value="3.2" unit="m" delta="left" />
          </div>
        </div>
      </div>
    </div>
  );
}

function V2Health() {
  return (
    <div className="wf">
      <WFTopbar current="health" />
      <WFPageHead title="Health · this month vs last"
        right={<button className="wf-btn accent">+ Today's entry</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="wf-box" style={{ gridColumn: 'span 3' }}>
          <div className="h">Health Score · weekly</div>
          <BarChart width={760} height={140} values={[72, 78, 75, 80, 82, 79, 81, 84]} labels={['W14','W15','W16','W17','W18','W19','W20','W21']} accentIdx={7} showValues />
          <HandNote>health score = sleep · BMI · session adherence · BP</HandNote>
        </div>
        <MiniStat label="BMI" value="22.8" delta="normal 18.5–25" />
        <MiniStat label="BP avg" value="118/76" delta="optimal" />
        <MiniStat label="Sleep" value="6.8" unit="h" delta="−0.4 vs target" />
        <div className="wf-box" style={{ gridColumn: 'span 3' }}>
          <div className="h">Weight · daily (last 30)</div>
          <BarChart width={760} height={120} values={genWeight(12, 30).map(w => +(w - 70).toFixed(1))} accentIdx={29} />
          <div style={{ fontSize: 11, color: 'var(--w-muted)', marginTop: 4 }}>baseline 70 kg · bars show kg above baseline</div>
        </div>
      </div>
    </div>
  );
}

function V2LogWorkout() {
  return (
    <div className="wf">
      <WFTopbar current="log" />
      <WFPageHead title="Log workout" sub="bars below show how today compares to your weekly avg" />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Session basics</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Date" value="2026-05-04" />
              <Field label="Type" value="Range" mono={false} />
              <Field label="Start" value="14:30" />
              <Field label="Duration" value="90 min" />
            </div>
          </div>
          <div className="wf-box">
            <div className="h">Distance — bar input</div>
            <HandNote>drag bar height to set distance</HandNote>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 160, padding: '12px 0', borderBottom: '1px solid var(--w-line)' }}>
              {CLUBS.map((c, i) => {
                const h = [180, 140, 100, 90, 80, 70, 60, 50][i];
                return (
                  <div key={c} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div className="num" style={{ fontSize: 10, color: 'var(--w-muted)', fontFamily: 'var(--w-font-mono)' }}>{[226,205,178,156,131,112,89,72][i]}</div>
                    <div style={{ width: '100%', height: h, background: i === 0 ? 'var(--w-accent)' : 'var(--w-fill-3)', borderRadius: '2px 2px 0 0' }} />
                    <div style={{ fontSize: 10, color: 'var(--w-muted)' }}>{c}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">vs your weekly average</div>
            <BarChart width={400} height={160} values={CLUBS.map(() => Math.round((Math.random() - 0.4) * 12))} labels={CLUBS} accentIdx={0} />
            <div style={{ fontSize: 11, color: 'var(--w-muted)', marginTop: 4 }}>0 = weekly avg · positive = better</div>
          </div>
          <div className="wf-box">
            <div className="h">Notes</div>
            <div className="wf-input placeholder" style={{ height: 80, alignItems: 'flex-start', padding: 10 }}>session notes…</div>
          </div>
          <button className="wf-btn accent">Save</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { V2Dashboard, V2Distance, V2Screen, V2Health, V2LogWorkout });
