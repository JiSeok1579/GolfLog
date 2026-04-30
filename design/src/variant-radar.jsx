// variant-radar.jsx — Variant 4: Radar / multi-dimensional skill profile
// Best for "where am I strong vs weak across many metrics".

function V4Dashboard() {
  return (
    <div className="wf">
      <WFTopbar current="dashboard" />
      <WFPageHead title="Skill profile" sub="multi-dimensional view of your game · this month vs last"
        right={<button className="wf-btn accent">+ Log session</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="wf-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="h" style={{ alignSelf: 'flex-start' }}>Driver profile · this vs last month</div>
          <RadarChart size={280}
            axes={['Ball spd','Head spd','Launch°','Carry','Smash','Accuracy']}
            values={[8.2, 7.8, 7.1, 8.5, 8.0, 6.4]}
            compareValues={[7.5, 7.4, 6.8, 8.0, 7.7, 6.2]}
            max={10} />
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--w-muted)', marginTop: 6 }}>
            <span>━ this month</span><span>━ last month</span>
          </div>
        </div>
        <div className="wf-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="h" style={{ alignSelf: 'flex-start' }}>Health profile · 5 axes</div>
          <RadarChart size={280}
            axes={['BMI','Sleep','BP','Activity','Weight stability']}
            values={[9.2, 6.8, 9.0, 7.5, 8.5]}
            max={10} accent />
          <HandNote style={{ marginTop: 6 }}>sleep is the weak axis</HandNote>
        </div>

        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">Today's quick stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              ['Driver avg', '226', 'm'],
              ['Range time', '2.5', 'h'],
              ['Weight', '74.2', 'kg'],
              ['BMI', '22.8', ''],
              ['Health', '84', '%'],
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 10, color: 'var(--w-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s[0]}</div>
                <div className="bignum" style={{ fontSize: 22 }}>{s[1]}<span className="unit">{s[2]}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function V4Screen() {
  return (
    <div className="wf">
      <WFTopbar current="screen" />
      <WFPageHead title="Screen golf result" sub="enter values, see your shot DNA below" />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="wf-box">
          <div className="h">Driver shot · enter values</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Ball speed" value="68.2 m/s" />
            <Field label="Head speed" value="46.8 m/s" />
            <Field label="Launch angle" value="14.2 °" />
            <Field label="Backspin" value="2840 rpm" />
            <Field label="Sidespin" value="−180 rpm" />
            <Field label="Carry" value="226 m" />
            <Field label="Total" value="245 m" />
            <Field label="Side dev" value="3.2 L" />
          </div>
          <button className="wf-btn accent" style={{ marginTop: 12 }}>Add another club</button>
        </div>
        <div className="wf-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="h" style={{ alignSelf: 'flex-start' }}>Shot DNA · this vs your average</div>
          <RadarChart size={300}
            axes={['Ball spd','Head spd','Launch°','Backspin','Smash','Accuracy','Carry','Total']}
            values={[8.5, 8.0, 7.2, 6.8, 8.2, 6.5, 8.5, 8.7]}
            compareValues={[7.8, 7.6, 7.0, 7.5, 7.7, 6.8, 7.9, 8.1]}
            max={10} />
          <HandNote style={{ marginTop: 8 }}>strong day · backspin lower than usual (good)</HandNote>
        </div>
      </div>
    </div>
  );
}

function V4Distance() {
  return (
    <div className="wf">
      <WFTopbar current="distance" />
      <WFPageHead title="Per-club skill radar"
        sub="every club, six axes — pick a club to focus" />
      <div style={{ padding: '0 20px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CLUBS.map((c, i) => (
          <span key={c} className={'wf-chip' + (i === 0 ? ' solid' : '')}>{c}</span>
        ))}
      </div>
      <div className="wf-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {['Driver','7I','PW'].map((c, i) => (
          <div key={c} className="wf-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="h" style={{ alignSelf: 'flex-start' }}>{c}</div>
            <RadarChart size={220}
              axes={['Carry','Total','Spd','Spin','Acc','Consist.']}
              values={[8 - i*0.6, 8.2 - i*0.5, 8 - i*0.4, 7 + i*0.3, 6.5 + i*0.5, 7 + i*0.4]}
              compareValues={[7.5 - i*0.5, 7.7 - i*0.4, 7.5 - i*0.3, 7.2 + i*0.2, 6.2 + i*0.4, 6.8 + i*0.3]}
              max={10} accent={i === 0} />
          </div>
        ))}
        <div className="wf-box" style={{ gridColumn: 'span 3' }}>
          <div className="h">Strengths & weaknesses · all clubs</div>
          <table className="wf-table">
            <thead><tr><th>Club</th><th>Strongest axis</th><th>Weakest axis</th><th>Overall</th></tr></thead>
            <tbody>
              {[['Driver','Carry (8.5)','Accuracy (6.4)','7.7'],
                ['7I','Consistency (8.0)','Spin (6.2)','7.4'],
                ['PW','Accuracy (8.5)','Spd (6.8)','7.5'],
                ['56°','Spin (8.8)','Carry (5.2)','7.0']].map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j === 3 ? 'num' : ''}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function V4Health() {
  return (
    <div className="wf">
      <WFTopbar current="health" />
      <WFPageHead title="Health · multi-axis"
        right={<button className="wf-btn accent">+ Today's entry</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="wf-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="h" style={{ alignSelf: 'flex-start' }}>Now · vs target zone</div>
          <RadarChart size={300}
            axes={['BMI','Sleep','BP sys','BP dia','Resting HR','Adherence','Weight stab']}
            values={[9.2, 6.8, 8.5, 8.7, 7.5, 7.0, 8.5]}
            compareValues={[8, 8, 8, 8, 8, 8, 8]}
            max={10} />
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--w-muted)', marginTop: 6 }}>
            <span>━ you</span><span>━ target</span>
          </div>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Health score</div>
            <div className="bignum" style={{ fontSize: 48 }}>84<span className="unit">%</span></div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--w-fill-1)', overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: '84%', height: '100%', background: 'var(--w-accent)' }} />
            </div>
          </div>
          <div className="wf-box">
            <div className="h">Today's input</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Weight" value="74.2 kg" />
              <Field label="Sleep" value="6.5 h" />
              <Field label="BP" value="118 / 76" />
              <Field label="Resting HR" value="62 bpm" />
            </div>
          </div>
          <HandNote>health % weights all axes equally · adjustable in settings</HandNote>
        </div>
      </div>
    </div>
  );
}

function V4LogWorkout() {
  return (
    <div className="wf">
      <WFTopbar current="log" />
      <WFPageHead title="Log session · today"
        sub="see how today shifts your monthly profile" />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">Session</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Date" value="2026-05-04" />
              <Field label="Type" value="Range" mono={false} />
              <Field label="Duration" value="90 min" />
              <Field label="Balls" value="120" />
            </div>
          </div>
          <div className="wf-box">
            <div className="h">Per-club input · driver focused</div>
            <table className="wf-table">
              <thead><tr><th>Club</th><th>Carry</th><th>Spd</th><th>Spin</th></tr></thead>
              <tbody>
                {CLUBS.slice(0, 5).map((c, i) => (
                  <tr key={c}>
                    <td>{c}</td>
                    {[0,1,2].map(j => (
                      <td key={j} className="num placeholder" style={{ color: 'var(--w-faint)', fontFamily: 'var(--w-font-mono)' }}>—</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="wf-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="h" style={{ alignSelf: 'flex-start' }}>Live preview · profile after save</div>
          <RadarChart size={280}
            axes={['Carry','Total','Spd','Spin','Acc','Consist.']}
            values={[8.3, 8.5, 8.1, 6.9, 6.7, 7.2]}
            compareValues={[8.0, 8.2, 7.9, 7.0, 6.5, 7.0]}
            max={10} />
          <HandNote style={{ marginTop: 8 }}>nudges your monthly profile · ↑ Carry, ↓ Spin</HandNote>
          <button className="wf-btn accent" style={{ marginTop: 12 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { V4Dashboard, V4Screen, V4Distance, V4Health, V4LogWorkout });
