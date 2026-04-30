// variant-lines.jsx — V1: 시계열 추이 중심
function V1Dashboard() {
  const driver = genMonthlyDistance(7).Driver;
  const weight = genWeight(12, 30);
  return (
    <div className="wf">
      <WFTopbar current="dashboard" accent="var(--w-accent)" />
      <WFPageHead title="2026년 5월 4일 · 월요일" sub="진님, 3일째 연속 기록 중"
        right={<div style={{ display: 'flex', gap: 6 }}>
          <button className="wf-btn">+ 체중</button>
          <button className="wf-btn accent">+ 오늘 기록</button>
        </div>} />
      <div className="wf-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MiniStat label="드라이버 최고" value="231" unit="m" delta="+5 vs 4월" hand="늘고있어!" />
        <MiniStat label="이번 달 라운드" value="12" unit="회" delta="22.5h" />
        <MiniStat label="체중" value="74.2" unit="kg" delta="−0.6 kg" />
        <MiniStat label="BMI" value="22.8" delta="정상범위" />

        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">드라이버 일별 최고기록 · 최근 12개월</div>
          <LineChart width={420} height={170} series={[{ values: driver, accent: true }]} showDots bestMarker />
          <HandNote style={{ marginTop: 4 }}>↗ 2월부터 꾸준히 상승</HandNote>
        </div>
        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">체중 · 최근 30일</div>
          <LineChart width={420} height={170} series={[{ values: weight }]} />
        </div>

        <div className="wf-box" style={{ gridColumn: 'span 4' }}>
          <div className="h">이번 주 일별 최고기록</div>
          <table className="wf-table">
            <thead><tr><th>날짜</th><th>드라이버</th><th>3W</th><th>5I</th><th>7I</th><th>9I</th><th>PW</th><th>운동시간</th></tr></thead>
            <tbody>
              {[['5/3 일', '231', '208', '178', '156', '131', '112', '70분'],
                ['5/1 금', '224', '—', '174', '152', '—', '108', '90분'],
                ['4/28 화', '218', '202', '170', '148', '128', '—', '45분']].map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 && j < 7 ? 'num' : ''}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function V1LogWorkout() {
  return (
    <div className="wf">
      <WFTopbar current="log" />
      <WFPageHead title="오늘의 기록 · 5월 4일" sub="클럽별 오늘의 최고기록 1개씩만 입력" />
      <div className="wf-grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">운동 정보</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Field label="유형" value="● 스크린  ○ 라운드  ○ 연습장" mono={false} w={280} />
              <Field label="시작 시간" value="14:30" w={120} />
              <Field label="총 시간" value="90분" w={120} />
            </div>
          </div>
          <div className="wf-box">
            <div className="h">컨디션 · 1~5점</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {['컨디션', '집중도', '체감'].map(k => (
                <div key={k} style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--w-muted)', marginBottom: 4 }}>{k}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} style={{ flex: 1, height: 24, border: '1px solid var(--w-line)', borderRadius: 3, display: 'grid', placeItems: 'center', fontSize: 11, background: n <= 3 ? 'var(--w-teal-soft)' : 'transparent' }}>{n}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="wf-box">
            <div className="h">메모</div>
            <div className="wf-input placeholder" style={{ height: 70, alignItems: 'flex-start', padding: 10 }}>
              오늘의 느낌, 개선할 점…
            </div>
          </div>
        </div>

        <div className="wf-col">
          <div className="wf-box">
            <div className="h">클럽별 오늘의 최고 (한 개씩)</div>
            <HandNote style={{ marginBottom: 6 }}>비거리만 적어도 OK</HandNote>
            <table className="wf-table">
              <thead><tr><th>클럽</th><th>비거리</th><th>vs 평균</th></tr></thead>
              <tbody>
                {[['드라이버','231 m','+5'],['3W','208 m','+3'],['5I','178 m','+0'],['7I','156 m','+0'],
                  ['9I','—','—'],['PW','—','—'],['52°','—','—']].map((r, i) => (
                  <tr key={i}>
                    <td>{r[0]}</td>
                    <td className={'num' + (r[1] === '—' ? ' placeholder' : '')} style={r[1] === '—' ? { color: 'var(--w-faint)', fontFamily: 'var(--w-font-mono)' } : {}}>{r[1]}</td>
                    <td className="num" style={{ color: r[2].startsWith('+') ? 'var(--w-accent)' : 'var(--w-muted)' }}>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="wf-btn ghost sm" style={{ marginTop: 6 }}>+ 클럽 추가</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wf-btn">취소</button>
            <button className="wf-btn accent" style={{ flex: 1 }}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function V1Distance() {
  const data = genMonthlyDistance(7);
  return (
    <div className="wf">
      <WFTopbar current="distance" />
      <WFPageHead title="비거리 추이" sub="필드 위에 날아간 거리를 시각화"
        right={<div className="wf-seg"><button className="on">12개월</button><button>3개월</button><button>올해</button></div>} />
      <div className="wf-grid" style={{ gridTemplateColumns: '1fr 280px' }}>
        <div className="wf-col">
          <div className="wf-box" style={{ padding: 0, overflow: 'hidden', borderRadius: 6 }}>
            <div className="h" style={{ padding: '12px 12px 0' }}>드라이버 페어웨이 · 이번 주 베스트 vs 평균</div>
            <Fairway width={620} height={220} maxYards={300}
              trails={[
                { d: 226, lateral: -8, club: '평균', label: '226' },
                { d: 231, lateral: -2, club: '5/3', label: '231', hi: true },
              ]} />
          </div>
          <div className="wf-box">
            <div className="h">클럽별 라인 · 12개월</div>
            <LineChart width={620} height={200} series={Object.entries(data).map(([k, v]) => ({ values: v, accent: k === 'Driver' }))} showAxis bestMarker />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {['드라이버','3W','5I','7I','9I','PW','52°','56°'].map((c, i) => (
                <span key={c} className={'wf-chip' + (i === 0 ? ' accent' : '')}>{c}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="wf-col">
          <div className="wf-box">
            <div className="h">클럽별 자기 최고기록</div>
            <table className="wf-table">
              <tbody>
                {[['드라이버','231 m','5/3'],['3W','215 m','4/22'],['5I','182 m','5/3'],['7I','158 m','4/12'],['9I','135 m','4/19'],['PW','115 m','4/28'],['52°','92 m','3/30']].map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className={j === 1 ? 'num' : (j === 2 ? '' : '')} style={j === 2 ? { color: 'var(--w-faint)', fontSize: 11 } : {}}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wf-box muted">
            <HandNote>드라이버 +5m / 5I +4m. 이번 달 폼이 좋다 ✓</HandNote>
          </div>
        </div>
      </div>
    </div>
  );
}

function V1Health() {
  const w = genWeight(12, 90);
  return (
    <div className="wf">
      <WFTopbar current="health" />
      <WFPageHead title="건강 지표" sub="키 175 · 35세 · 마지막 입력 09:12"
        right={<button className="wf-btn accent">+ 오늘 기록</button>} />
      <div className="wf-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <MiniStat label="BMI" value="22.8" delta="정상 18.5–25" hand="OK존" />
        <MiniStat label="건강지수" value="84" unit="%" delta="+3 지난주" />
        <MiniStat label="평균 수면" value="6.8" unit="h" delta="목표 미달" />
        <div className="wf-box" style={{ gridColumn: 'span 3' }}>
          <div className="h">체중 · 90일 추이</div>
          <LineChart width={760} height={180} series={[{ values: w }]} showAxis />
          <HandNote style={{ marginTop: 4 }}>목표 구간 73–76kg</HandNote>
        </div>
        <div className="wf-box" style={{ gridColumn: 'span 2' }}>
          <div className="h">혈압 · 30일</div>
          <LineChart width={500} height={140} series={[
            { values: Array.from({length:30},(_,i)=>118+Math.round(Math.sin(i/3)*4)) },
            { values: Array.from({length:30},(_,i)=>76+Math.round(Math.cos(i/3)*3)), accent: true },
          ]} showAxis />
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--w-muted)', marginTop: 4 }}>
            <span style={{ color: 'var(--w-fill-4)' }}>━ 수축기</span><span style={{ color: 'var(--w-accent)' }}>━ 이완기</span>
          </div>
        </div>
        <div className="wf-box">
          <div className="h">수면 · 14일</div>
          <LineChart width={240} height={120} series={[{ values: Array.from({length:14},(_,i)=>6+(i*73%17)/8) }]} />
        </div>
      </div>
    </div>
  );
}

function V1Calendar() {
  return (
    <div className="wf">
      <WFTopbar current="calendar" />
      <WFPageHead title="2026년 5월" sub="● 친 날 · 칸 클릭하면 그날 기록 페어웨이 표시"
        right={<div className="wf-seg"><button>‹</button><button className="on">오늘</button><button>›</button></div>} />
      <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, flex: 1 }}>
        {['월','화','수','목','금','토','일'].map(d => (
          <div key={d} style={{ fontSize: 11, color: 'var(--w-faint)', letterSpacing: '0.06em', padding: '8px 4px' }}>{d}요일</div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => {
          const day = i - 3;
          const has = [4, 6, 9, 12, 14, 18, 21, 24].includes(day);
          const isToday = day === 4;
          return (
            <div key={i} style={{
              minHeight: 80, border: '1px solid var(--w-line)', borderRadius: 4, padding: 6,
              background: has ? 'var(--w-teal-soft)' : 'var(--w-paper)',
              outline: isToday ? '2px solid var(--w-accent)' : 'none', outlineOffset: -2,
              opacity: day < 1 || day > 31 ? 0.35 : 1,
            }}>
              <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: isToday ? 700 : 400, color: 'var(--w-muted)' }}>{day > 0 && day <= 31 ? day : ''}</div>
              {has && (
                <div style={{ marginTop: 4, fontSize: 10, fontFamily: 'var(--w-font-mono)', color: 'var(--w-ink)' }}>
                  <span style={{ color: 'var(--w-accent)' }}>●</span> 드 226<br/>
                  <span style={{ color: 'var(--w-teal)' }}>●</span> 7I 154
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { V1Dashboard, V1LogWorkout, V1Distance, V1Health, V1Calendar });
