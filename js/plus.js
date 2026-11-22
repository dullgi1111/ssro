/* 스스로 — 추가 기능 (2026-11-21)
   A. 복습(간격 반복) · B. 시험 D-day + 하루 분량 · C. 학습 리포트 · D. QR 친구 대결 · E. 공부 탑 보상·스킨
   새 경로: #/plan 시험 계획 · #/report 학습 리포트 · #/duel 친구 대결
   기존 코드는 연결 지점만 고치고([추가] 주석), 새 기능은 이 파일에 모음 */
'use strict';

const Plus = (() => {
  const DOW = '일월화수목금토';
  const me = () => Profiles.cur;
  const today = () => U.day();
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const md = d => { const [, m, dd] = d.split('-'); return `${Number(m)}/${Number(dd)}`; };
  const pk = k => `p.${me().id}.${k}`;

  /* ---------- 라이브러리: 필요할 때만 불러오기 ---------- */
  const libs = {};
  function lib(name) {
    if (!libs[name]) libs[name] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = `lib/${name}.min.js`; s.onload = res; s.onerror = () => { delete libs[name]; rej(new Error('라이브러리를 불러오지 못했어요')); };
      document.head.appendChild(s);
    });
    return libs[name];
  }

  /* ================= E. 공부 탑 보상 · 스킨 ================= */
  const SKINS = [
    ['basic', 0, '기본 블록', '🧱', '알록달록 (원래 색)'],
    ['stone', 10, '돌', '🪨', '점박이 회색'],
    ['iron', 20, '철', '⚙️', '금속 광택'],
    ['gold', 30, '금', '🥇', '반짝이는 금색'],
    ['quartz', 40, '석영', '🔮', '맑은 분홍빛 흰색'],
    ['diamond', 50, '다이아', '💎', '하늘색 보석 면'],
    ['obsidian', 60, '흑요석', '🌑', '보랏빛이 도는 검정'],
  ].map(([id, at, name, ico, desc]) => ({ id, at, name, ico, desc }));
  const unlocked = (best = Prog.best()) => SKINS.filter(k => best >= k.at);
  function skin() {
    if (!me()) return SKINS[0];
    const got = unlocked(), want = me().towerSkin;
    return got.find(k => k.id === want) || SKINS[0];
  }
  const topUnlocked = () => unlocked().slice(-1)[0].at;
  const hasNewReward = () => topUnlocked() > (me().skinSeen || 0);
  function miniTower(k) {
    return `<div class="mini-tower" aria-hidden="true">${[0, 1, 2].map(i => `<i class="blk ${k.id !== 'basic' ? 'skin-' + k.id : ''}" style="--c:${['#e8845a', '#6cbf6a', '#4fa3e0'][i]}"></i>`).join('')}</div>`;
  }
  function towerSide() {
    const best = Prog.best(), k = skin(), next = SKINS.find(x => x.at > best);
    const prev = unlocked(best).slice(-1)[0].at;
    return `<div class="tower-side">
      <div class="row" style="gap:10px;flex-wrap:nowrap">${miniTower(k)}<div><div class="label" style="margin:0">지금 스킨</div><b>${k.ico} ${k.name}</b></div></div>
      ${next ? `<div class="stack" style="gap:4px"><span class="hint">다음 보상 ${next.ico} ${next.name}까지 ${next.at - best}층</span>
        <div class="lvbar thin"><i style="width:${Math.round((best - prev) / (next.at - prev) * 100)}%"></i></div></div>`
        : '<span class="hint">모든 스킨을 얻었어요! 👑</span>'}
      <div class="row" style="gap:6px"><button class="btn sm" data-act="plusDlg" data-v="rewards">🎁 보상 보기${hasNewReward() ? '<i class="reddot" aria-label="새 보상"></i>' : ''}</button>
        <button class="btn sm" data-act="plusDlg" data-v="skins">🎨 스킨 바꾸기</button></div></div>`;
  }
  function rewardsDlg() {
    const best = Prog.best();
    return `<h3>🎁 공부 탑 보상</h3><p class="hint" style="margin:0">최고 기록 ${best}층 · 10층마다 새 스킨이 열려요. 탑이 무너져도 얻은 스킨은 그대로예요.</p>
      <ul class="rewards">${SKINS.map(k => { const got = best >= k.at;
        return `<li class="${got ? 'got' : ''}">${miniTower(k)}<div style="flex:1;min-width:0"><b>${k.ico} ${k.name}</b> <span class="hint">${k.at ? k.at + '층' : '기본'} · ${k.desc}</span>
          ${got ? '' : `<div class="lvbar thin"><i style="width:${Math.round(best / k.at * 100)}%"></i></div>`}</div>
          <span class="chip ${got ? 'ok' : ''}">${got ? '획득' : `${k.at - best}층 남음`}</span></li>`; }).join('')}</ul>`;
  }
  function skinsDlg() {
    const best = Prog.best(), cur = skin();
    return `<h3>🎨 스킨 바꾸기</h3><div class="skin-grid">${SKINS.map(k => best >= k.at
      ? `<button class="skin-opt" data-act="setSkin" data-v="${k.id}" aria-pressed="${cur.id === k.id}">${miniTower(k)}<b>${k.ico} ${k.name}</b></button>`
      : `<button class="skin-opt locked" disabled>${miniTower(k)}<b>🔒 ${k.name}</b><small>${k.at}층에 열려요</small></button>`).join('')}</div>`;
  }
  function onTower(n) {
    if (!n || n % 10 || n > 60 || n < Prog.best()) return;
    const k = SKINS.find(x => x.at === n); if (!k) return;
    setTimeout(() => { toast(`🎁 새 스킨 획득! ${k.ico} ${k.name}`); Sfx.play('level'); celebrate({})(); render(); }, 1800);
  }

  /* ================= A. 복습 (간격 반복) ================= */
  function dueAll() { return Lib.list.map(s => ({ s, n: Prog.due(s.id).length })); }
  function nextAll() {
    let nx = null;
    Lib.list.forEach(s => { const st = Prog.srsStat(s.id); if (st.next && (!nx || st.next.day < nx.day)) nx = { ...st.next }; else if (st.next && nx && st.next.day === nx.day) nx.n += st.next.n; });
    return nx;
  }
  function reviewCard() {
    if (!Lib.list.length) return '';
    const d = dueAll(), total = d.reduce((a, x) => a + x.n, 0), nx = nextAll();
    if (!total && !nx) return '';
    return `<section class="panel review-card"><div class="row between"><h2 style="margin:0">🔁 오늘의 복습 ${total}문항</h2><span class="hint">틀린 문제를 1·3·7·14·30일 뒤에 다시 풀어요</span></div>
      ${total ? `<div class="rv-list">${d.filter(x => x.n).map(x => `<div class="row between"><b data-notr>${esc(x.s.name)}</b>
          <button class="btn primary sm" data-act="reviewStart" data-sid="${esc(x.s.id)}">복습 시작 (${Math.min(x.n, 30)})</button></div>`).join('')}</div>`
        : `<p class="hint" style="margin:0">✅ 오늘 복습을 모두 끝냈어요${nx ? ` · 다음 복습: ${md(nx.day)} · ${nx.n}문항` : ''}</p>`}</section>`;
  }
  function reviewDone(s) {
    const st = Prog.srsStat(s.id);
    return st.due ? `<div class="notice">남은 복습 ${st.due}문항 · <button class="btn sm" data-act="reviewStart" data-sid="${esc(s.id)}">이어서 복습</button></div>`
      : `<div class="notice ok">✅ 오늘 복습을 모두 끝냈어요${st.next ? ` · 다음 복습: ${md(st.next.day)} · ${st.next.n}문항` : ''}</div>`;
  }
  function srsPanel(s) {
    const st = Prog.srsStat(s.id), mx = Math.max(1, ...st.box, st.mastered);
    const row = (l, n, cls) => `<div class="b"><span>${l}</span><div class="prog"><i class="${cls}" style="width:${n / mx * 100}%"></i></div><span class="mono">${n}</span></div>`;
    return `<section class="panel stack"><div class="row between"><h2 style="margin:0">🔁 복습 일정</h2>
        ${st.due ? `<button class="btn primary sm" data-act="reviewStart" data-sid="${esc(s.id)}">오늘 복습 ${Math.min(st.due, 30)}문항 풀기</button>` : ''}</div>
      <div class="bars">${st.box.map((n, i) => row(`${i + 1}단계 · ${SRS.GAP[i]}일 간격`, n, 'a')).join('')}${row('🏆 완전 습득', st.mastered, 'g')}</div>
      <p class="hint" style="margin:0">${st.due ? `오늘 복습할 문제 ${st.due}개` : '오늘 복습할 문제가 없어요'}${st.next ? ` · 다음 복습: ${md(st.next.day)} · ${st.next.n}문항` : ''}</p></section>`;
  }

  /* ================= B. 시험 D-day + 하루 분량 ================= */
  function examsOf(s) { return (s.exams || []).slice().sort((a, b) => a.date < b.date ? -1 : 1); }
  function upcoming() {
    const t = today(), out = [];
    Lib.list.forEach(s => examsOf(s).forEach(e => { if (e.date >= t) out.push({ s, e, dd: dayDiff(t, e.date) }); }));
    return out.sort((a, b) => a.dd - b.dd);
  }
  const ddText = dd => dd === 0 ? 'D-DAY' : 'D-' + dd;
  function examCard() {
    const up = upcoming().slice(0, 3);
    if (!up.length) return '';
    return `<section class="panel"><div class="row between"><h2 style="margin:0">📅 다가오는 시험</h2><button class="btn sm ghost" data-act="go" data-to="#/plan">시험 계획 →</button></div>
      <div class="dd-list">${up.map(x => `<button class="dd-item ${x.dd <= 3 ? 'hot' : ''}" data-act="go" data-to="#/plan"><span class="dd">${ddText(x.dd)}</span>
        <span><b data-notr>${esc(x.e.name)}</b><small data-notr>${esc(x.s.name)} · ${md(x.e.date)}</small></span></button>`).join('')}</div></section>`;
  }
  function rangeOf(s, e) { const r = (e.units || []).filter(u => s.uById[u]); return r.length ? r : s.units.map(u => u.id); }
  function planOf(s, e) {
    const t = today(), p = Prog.of(s.id), rest = me().restDays || [];
    const dd = dayDiff(t, e.date);
    let days = 0;
    for (let i = 0; i < dd; i++) { const d = new Date(SRS.addDays(i) + 'T00:00:00'); if (!rest.includes(d.getDay())) days++; }
    const restToday = rest.includes(new Date().getDay());
    days = Math.max(1, days);
    const range = rangeOf(s, e);
    const unlearned = range.filter(u => !p.learned[u]);
    const weak = range.filter(u => { const st = Prog.unitStat(s, u); return p.learned[u] && st.seen >= 3 && st.acc < 0.7; });
    const todo = [...unlearned, ...weak];
    const perDay = todo.length ? Math.ceil(todo.length / days) : 0;
    const learnedToday = range.filter(u => p.learned[u] && U.day(p.learned[u]) === t).length;
    const units = todo.slice(0, Math.max(0, perDay - learnedToday));
    const goal = U.clamp(Math.max(perDay, 1) * 10, 10, 40);
    const solved = Daily.on(t, s.id)[0];
    const review = Prog.due(s.id).length;
    return { dd, days, restToday, range, unlearned, weak, perDay, learnedToday, units, goal, solved, review,
      learnedN: range.filter(u => p.learned[u]).length };
  }
  function vPlan() {
    const p = me(), rest = p.restDays || [], up = upcoming(), t = today();
    const past = [];
    Lib.list.forEach(s => examsOf(s).forEach(e => { if (e.date < t) past.push({ s, e }); }));
    past.sort((a, b) => a.e.date < b.e.date ? 1 : -1);
    const ck = (done, body) => `<li class="${done ? 'done' : ''}"><span class="ck">${done ? '✓' : ''}</span><div class="row between" style="flex:1">${body}</div></li>`;
    return {
      crumb: '📅 시험 계획',
      body: `<div class="page wrap" style="max-width:900px"><div class="row between"><h1 style="font-size:24px">📅 시험 계획</h1>
          <button class="btn sm" data-act="go" data-to="#/manage">시험 일정 넣기 (과목 수정)</button></div>
        <section class="panel stack" style="gap:10px"><h2 style="margin:0">쉬는 요일</h2>
          <div class="seg">${[...DOW].map((d, i) => `<button data-act="restDay" data-v="${i}" aria-pressed="${rest.includes(i)}">${d}</button>`).join('')}</div>
          <p class="hint" style="margin:0">고른 요일은 공부일에서 빼고 하루 분량을 계산해요.</p></section>
        ${up.length ? up.map(({ s, e, dd }) => { const P = planOf(s, e);
          return `<section class="panel stack plan ${dd <= 3 ? 'hot' : ''}">
            <div class="row between"><div class="row" style="gap:10px"><span class="dd big">${ddText(dd)}</span><div><b style="font-size:18px" data-notr>${esc(e.name)}</b><br>
              <span class="hint"><span data-notr>${esc(s.name)}</span> · ${e.date} · 남은 공부일 ${dd ? P.days + '일' : '오늘 시험'}</span></div></div>
              <button class="btn sm ghost" data-act="go" data-to="${L('s', s.id, 'concept')}">과목으로 →</button></div>
            <div><div class="row between"><span class="label" style="margin:0">개념 진행 (범위 ${P.range.length}단원)</span><span class="mono hint">${P.learnedN}/${P.range.length}</span></div>
              <div class="lvbar thin"><i style="width:${U.pct(P.learnedN, P.range.length)}%"></i></div></div>
            ${P.restToday ? '<div class="notice">오늘은 쉬는 요일이에요. 하고 싶으면 아래 할 일을 해도 좋아요.</div>' : ''}
            <div><div class="label">오늘 할 일</div><ul class="todo">
              ${ck(P.perDay === 0 || P.learnedToday >= P.perDay, `<span>개념 ${P.perDay}단원${P.weak.length ? ` <span class="hint">(약한 단원 ${P.weak.length} 포함)</span>` : ''}</span>
                <span class="row" style="gap:4px">${P.units.map(u => `<button class="chip acc" data-act="go" data-to="${L('s', s.id, 'concept', u)}" data-notr>${esc(s.uById[u].title)}</button>`).join('')}</span>`)}
              ${ck(P.solved >= P.goal, `<span>문제 ${P.goal}개 풀기 <span class="hint">(오늘 ${P.solved}개)</span></span>
                <button class="btn sm" data-act="planPractice" data-sid="${esc(s.id)}" data-eid="${esc(e.id)}">문제 풀기</button>`)}
              ${ck(!P.review, `<span>복습 ${P.review}문항</span>${P.review ? `<button class="btn sm" data-act="reviewStart" data-sid="${esc(s.id)}">복습 시작</button>` : ''}`)}
              ${dd <= 3 ? ck(false, `<span>🔥 CBT 모의고사 보기 <span class="hint">시험 3일 전부터 추천</span></span>
                <button class="btn sm primary" data-act="planExam" data-sid="${esc(s.id)}" data-eid="${esc(e.id)}">모의고사</button>`) : ''}
            </ul></div></section>`; }).join('')
          : `<div class="empty">다가오는 시험이 없어요.<br><span class="hint">[과목 추가·수정] → 과목 → 📅 시험 일정에서 시험 날짜와 범위를 넣어 주세요.</span><br><br>
              <button class="btn primary" data-act="go" data-to="#/manage">시험 일정 넣으러 가기</button></div>`}
        ${past.length ? `<section class="panel stack"><h2 style="margin:0">지난 시험</h2><p class="hint" style="margin:0">실제 시험 점수를 넣으면 학습 리포트에 함께 나와요.</p>
          <ul class="hist">${past.map(({ s, e }) => `<li><span class="mono hint">${e.date}</span><span><b data-notr>${esc(e.name)}</b> <span class="hint" data-notr>${esc(s.name)}</span></span>
            <label class="row" style="gap:6px"><input type="number" class="input numin" min="0" max="100" value="${e.real ?? ''}" placeholder="점수" data-ch="realScore" data-sid="${esc(s.id)}" data-eid="${esc(e.id)}" aria-label="실제 점수">점</label></li>`).join('')}</ul></section>` : ''}
      </div>`,
    };
  }
  function examEditor(s) {
    const list = examsOf(s), t = today();
    return `<section class="panel stack"><h2>📅 시험 일정</h2>
      ${list.length ? `<ul class="hist">${list.map(e => `<li><span class="mono hint">${e.date}</span>
          <span><b data-notr>${esc(e.name)}</b> <span class="hint">${(e.units || []).length ? '범위 ' + e.units.filter(u => s.uById[u]).map(u => s.units.findIndex(x => x.id === u) + 1).join('·') + '단원' : '전체 범위'}</span>
            ${e.date >= t ? `<span class="chip ${dayDiff(t, e.date) <= 3 ? 'bad' : 'acc'}">${ddText(dayDiff(t, e.date))}</span>` : '<span class="chip">지난 시험</span>'}</span>
          <button class="btn sm danger" data-act="examDel" data-sid="${esc(s.id)}" data-eid="${esc(e.id)}">삭제</button></li>`).join('')}</ul>` : '<p class="hint" style="margin:0">아직 시험 일정이 없어요.</p>'}
      <div class="grid2"><label class="field"><span class="label">시험 이름</span><input type="text" id="exName" placeholder="예: 중간고사" maxlength="30"></label>
        <label class="field"><span class="label">날짜</span><input type="date" id="exDate" class="input" min="${t}"></label></div>
      <div><div class="label">범위 (안 고르면 전체)</div><div class="seg">${s.units.map((u, i) => `<label class="unit-ck"><input type="checkbox" class="exUnit" value="${esc(u.id)}"> ${i + 1}. <span data-notr>${esc(u.title)}</span></label>`).join('')}</div></div>
      <div class="row end"><button class="btn primary" data-act="examAdd" data-sid="${esc(s.id)}">시험 추가</button></div>
      <p class="hint" style="margin:0">시험을 넣으면 홈과 📅 시험 계획에 D-day와 오늘 할 일이 나와요.</p></section>`;
  }

  /* ================= C. 학습 리포트 ================= */
  function reportRange() {
    const v = App.ui.rp || 'week', t = today();
    if (v.startsWith('ex:')) {
      const [, sid, eid] = v.split(':'), s = Lib.get(sid), e = s && (s.exams || []).find(x => x.id === eid);
      if (s && e) { const from = U.day(e.createdAt || Date.now()); const to = e.date < t ? e.date : t; return { from: from < to ? from : to, to, label: `${e.name} (${s.name})`, s, e }; }
    }
    const n = v === 'month' ? 30 : 7;
    return { from: SRS.addDays(-(n - 1)), to: t, label: v === 'month' ? '이번 달 (최근 30일)' : '이번 주 (최근 7일)' };
  }
  function reportData() {
    const R = reportRange(), days = [];
    for (let d = R.from; d <= R.to; d = SRS.addDays(1, d)) days.push(d);
    const set = new Set(Prog.days()), xd = XP.get().days, daily = Daily.get();
    const subs = R.s ? [R.s] : Lib.list;
    const inR = ts => { const d = U.day(ts); return d >= R.from && d <= R.to; };
    let solved = 0, correct = 0, mastered = 0;
    const rows = subs.map(s => {
      let n = 0, c = 0;
      days.forEach(d => { const v = (daily[d] || {})[s.id]; if (v) { n += v[0]; c += v[1]; } });
      solved += n; correct += c;
      Object.values(Prog.of(s.id).q).forEach(r => { if (r.mastered && inR(r.mastered)) mastered++; });
      const st = Prog.subjStat(s), sr = Prog.srsStat(s.id);
      return { s, n, c, acc: st.acc, learned: st.learned, units: st.units, due: sr.due };
    });
    const cbt = [];
    subs.forEach(s => Prog.of(s.id).exams.forEach(x => { if (inR(x.at)) cbt.push({ s, at: x.at, score: x.score }); }));
    cbt.sort((a, b) => a.at - b.at);
    const real = [];
    subs.forEach(s => (s.exams || []).forEach(e => { if (e.real != null && e.real !== '' && (R.e ? e.id === R.e.id : e.date >= R.from && e.date <= R.to)) real.push({ s, e }); }));
    const srs = { box: [0, 0, 0, 0, 0], mastered: 0 };
    subs.forEach(s => { const st = Prog.srsStat(s.id); st.box.forEach((v, i) => srs.box[i] += v); srs.mastered += st.mastered; });
    return { R, days, studied: days.filter(d => set.has(d)).length, xp: days.reduce((a, d) => a + (xd[d] || 0), 0), xpDays: days.map(d => ({ d, xp: xd[d] || 0 })),
      solved, correct, mastered, rows, cbt, real, srs, streak: Prog.streak(), best: Prog.best() };
  }
  function xpSvg(list) {
    const W = 640, H = 160, mx = Math.max(10, ...list.map(x => x.xp)), bw = W / list.length;
    return `<svg class="xpsvg" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="날짜별 XP">${list.map((x, i) => { const h = Math.round(x.xp / mx * H);
      return `<rect x="${i * bw + bw * .15}" y="${H - h}" width="${bw * .7}" height="${Math.max(h, 2)}" rx="${Math.min(6, bw * .2)}" class="${x.xp ? 'on' : ''}"><title>${x.d} · ${x.xp} XP</title></rect>
        ${list.length <= 10 || i % 5 === 0 || i === list.length - 1 ? `<text x="${i * bw + bw / 2}" y="${H + 16}" text-anchor="middle">${md(x.d)}</text>` : ''}`; }).join('')}</svg>`;
  }
  function vReport() {
    const D = reportData(), p = me(), hide = !!App.ui.rpHide, v = App.ui.rp || 'week';
    const exOpts = []; Lib.list.forEach(s => examsOf(s).forEach(e => exOpts.push([`ex:${s.id}:${e.id}`, `${e.name} · ${s.name}`])));
    const stat = (val, l) => `<div class="stat"><b>${val}</b><span>${l}</span></div>`;
    return {
      crumb: '📊 학습 리포트',
      body: `<div class="page wrap" style="max-width:900px">
        <div class="row between no-print"><h1 style="font-size:24px">📊 학습 리포트</h1>
          <div class="row"><button class="btn" data-act="rpPrint">🖨️ PDF로 저장</button><button class="btn primary" data-act="rpImage">🖼️ 이미지로 저장</button></div></div>
        <section class="panel stack no-print" style="gap:10px">
          <div class="seg">${[['week', '이번 주'], ['month', '이번 달']].map(([k, l]) => `<button data-act="rpSet" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}
            ${exOpts.length ? `<select class="input" style="width:auto" data-ch="rpExam" data-notr><option value="">시험 하나 기준…</option>${exOpts.map(([k, l]) => `<option value="${esc(k)}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}</div>
          <label class="row" style="gap:8px"><input type="checkbox" data-in="rpHide" ${hide ? 'checked' : ''}> 이름 숨기기 <span class="hint">(익명으로 표시)</span></label></section>
        <article class="report panel stack">
          <div class="row between"><div><div class="label" style="margin:0">스스로 학습 리포트</div><h2 style="font-size:22px;margin:2px 0 0" data-notr>${hide ? '익명' : esc(p.name)}</h2></div>
            <div style="text-align:right"><b data-notr>${esc(D.R.label)}</b><br><span class="hint">${D.R.from} ~ ${D.R.to}</span></div></div>
          <div class="stats">${stat(D.studied + '일', '공부한 날')}${stat(`${D.streak} / ${D.best}층`, '공부 탑 (현재 / 최고)')}${stat(D.xp, '얻은 XP')}
            ${stat(D.solved, '푼 문제')}${stat(D.solved ? U.pct(D.correct, D.solved) + '%' : '–', '정답률')}${stat(D.mastered, '완전 습득 문제')}</div>
          <div><div class="label">날짜별 XP</div>${xpSvg(D.xpDays)}</div>
          <div><div class="label">과목별</div><div class="tblwrap"><table class="summary-tbl rp-tbl"><tr><th>과목</th><th>이 기간 푼 문제</th><th>이 기간 정답률</th><th>누적 정답률</th><th>개념 단원</th><th>복습 대기</th></tr>
            ${D.rows.map(r => `<tr><td data-notr>${esc(r.s.name)}</td><td>${r.n}</td><td>${r.n ? U.pct(r.c, r.n) + '%' : '–'}</td><td>${r.acc == null ? '–' : Math.round(r.acc * 100) + '%'}</td><td>${r.learned}/${r.units}</td><td>${r.due}</td></tr>`).join('') || '<tr><td colspan="6">과목이 없어요</td></tr>'}</table></div></div>
          <div class="grid2"><div><div class="label">CBT 시험 점수</div>${D.cbt.length ? `<ul class="hist">${D.cbt.map(x => `<li><span class="mono hint">${U.date(x.at)}</span><span data-notr>${esc(x.s.name)}</span><b class="mono">${fmt(x.score)}점</b></li>`).join('')}</ul>` : '<p class="hint">이 기간에 본 시험이 없어요.</p>'}</div>
            <div><div class="label">실제 시험 점수</div>${D.real.length ? `<ul class="hist">${D.real.map(x => `<li><span class="mono hint">${x.e.date}</span><span data-notr>${esc(x.e.name)} · ${esc(x.s.name)}</span><b class="mono">${x.e.real}점</b></li>`).join('')}</ul>` : '<p class="hint">📅 시험 계획의 지난 시험에서 실제 점수를 넣을 수 있어요.</p>'}</div></div>
          <div><div class="label">복습 현황</div><div class="row" style="gap:6px">${D.srs.box.map((n, i) => `<span class="chip">${i + 1}단계 ${n}</span>`).join('')}<span class="chip ok">완전 습득 ${D.srs.mastered}</span></div></div>
          <p class="hint" style="margin:0">※ XP는 최근 120일, CBT 기록은 과목당 50개까지만 보관돼요. 날짜별 푼 문제 수는 이 기능을 넣은 뒤부터 쌓여요.</p>
        </article></div>`,
    };
  }
  async function reportImage() {
    const D = reportData(), p = me(), hide = !!App.ui.rpHide;
    const F = '"Jua","Nanum Gothic","Malgun Gothic",sans-serif', FB = '"Nanum Gothic","Malgun Gothic",sans-serif';
    try { await Promise.all([document.fonts.load('30px Jua'), document.fonts.load('bold 20px "Nanum Gothic"')]); } catch { }
    const W = 1080, rows = D.rows.length, H = 860 + rows * 46 + Math.max(D.cbt.length, D.real.length, 1) * 34;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue(k).trim() || '#2f6f66';
    const acc = col('--accent');
    g.fillStyle = '#f6f8f7'; g.fillRect(0, 0, W, H);
    const rr = (x, y, w, h, r, fill) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fillStyle = fill; g.fill(); };
    rr(40, 40, W - 80, H - 80, 32, '#ffffff');
    g.fillStyle = acc; g.font = `30px ${F}`; g.fillText('스스로 학습 리포트', 80, 104);
    g.fillStyle = '#1d2422'; g.font = `44px ${F}`; g.fillText(hide ? '익명' : p.name, 80, 162);
    g.textAlign = 'right'; g.font = `bold 24px ${FB}`; g.fillText(D.R.label, W - 80, 104);
    g.fillStyle = '#5d6763'; g.font = `20px ${FB}`; g.fillText(`${D.R.from} ~ ${D.R.to}`, W - 80, 136); g.textAlign = 'left';
    const tiles = [[D.studied + '일', '공부한 날'], [`${D.streak} / ${D.best}층`, '공부 탑'], [D.xp, '얻은 XP'], [D.solved, '푼 문제'], [D.solved ? U.pct(D.correct, D.solved) + '%' : '–', '정답률'], [D.mastered, '완전 습득']];
    tiles.forEach(([v, l], i) => {
      const x = 80 + (i % 3) * 312, y = 200 + Math.floor(i / 3) * 122;
      rr(x, y, 292, 104, 22, '#eef3f1');
      g.fillStyle = '#1d2422'; g.font = `38px ${F}`; g.fillText(String(v), x + 24, y + 56);
      g.fillStyle = '#5d6763'; g.font = `20px ${FB}`; g.fillText(l, x + 24, y + 88);
    });
    let y = 470;
    g.fillStyle = '#5d6763'; g.font = `bold 20px ${FB}`; g.fillText('날짜별 XP', 80, y);
    const ch = 150, bw = (W - 160) / D.xpDays.length, mx = Math.max(10, ...D.xpDays.map(x => x.xp));
    D.xpDays.forEach((x, i) => { const h = Math.max(3, x.xp / mx * ch); rr(80 + i * bw + bw * .15, y + 20 + ch - h, bw * .7, h, Math.min(8, bw * .2), x.xp ? acc : '#dfe5e2');
      if (D.xpDays.length <= 10 || i % 5 === 0) { g.fillStyle = '#5d6763'; g.font = `16px ${FB}`; g.textAlign = 'center'; g.fillText(md(x.d), 80 + i * bw + bw / 2, y + ch + 46); g.textAlign = 'left'; } });
    y += ch + 100;
    g.fillStyle = '#5d6763'; g.font = `bold 20px ${FB}`; g.fillText('과목별', 80, y);
    const cols = [[80, '과목'], [440, '푼 문제'], [580, '정답률'], [720, '누적'], [850, '개념'], [960, '복습']];
    y += 36; g.font = `bold 18px ${FB}`; cols.forEach(([x, l]) => g.fillText(l, x, y));
    g.font = `20px ${FB}`; g.fillStyle = '#1d2422';
    D.rows.forEach(r => { y += 46; const name = r.s.name.length > 16 ? r.s.name.slice(0, 15) + '…' : r.s.name;
      [name, r.n, r.n ? U.pct(r.c, r.n) + '%' : '–', r.acc == null ? '–' : Math.round(r.acc * 100) + '%', `${r.learned}/${r.units}`, r.due].forEach((v, i) => g.fillText(String(v), cols[i][0], y)); });
    y += 70; const y0 = y;
    g.fillStyle = '#5d6763'; g.font = `bold 20px ${FB}`; g.fillText('CBT 시험 점수', 80, y); g.fillText('실제 시험 점수', 560, y);
    g.font = `20px ${FB}`; g.fillStyle = '#1d2422';
    (D.cbt.length ? D.cbt.slice(-8) : [null]).forEach((x, i) => g.fillText(x ? `${U.date(x.at)}  ${x.s.name.slice(0, 10)}  ${fmt(x.score)}점` : '없음', 80, y0 + 36 + i * 34));
    (D.real.length ? D.real.slice(-8) : [null]).forEach((x, i) => g.fillText(x ? `${x.e.date}  ${x.e.name.slice(0, 10)}  ${x.e.real}점` : '없음', 560, y0 + 36 + i * 34));
    g.fillStyle = '#8a9590'; g.font = `16px ${FB}`; g.fillText('스스로(SSRO) · 기기 안 기록으로 만든 리포트', 80, H - 64);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const name = `스스로_리포트_${U.day()}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '스스로 학습 리포트' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    saveBlob(name, blob); toast('리포트 이미지를 저장했어요');
  }

  /* ================= D. QR 친구 대결 ================= */
  const b64e = s => { const b = new TextEncoder().encode(s); let t = ''; b.forEach(x => t += String.fromCharCode(x)); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const b64d = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = atob(s); return new TextDecoder().decode(Uint8Array.from(t, ch => ch.charCodeAt(0))); };
  const sig = body => U.fnv('ssro-qr-1|' + body + '|' + body.length);
  function code(obj) { const body = b64e(JSON.stringify(obj)); return `SSRO1.${body}.${sig(body)}`; }
  function parse(str) {
    const m = String(str || '').match(/SSRO1\.([A-Za-z0-9_-]+)\.([0-9a-z]+)/);
    if (!m) throw new Error('스스로 QR 코드가 아니에요');
    if (sig(m[1]) !== m[2]) throw new Error('QR 내용이 바뀌었어요');
    return JSON.parse(b64d(m[1]));
  }
  const myKey = () => U.fnv('ssro-me|' + me().id + '|' + (me().createdAt || ''));
  const nick = () => me().nick || me().name;
  const friends = () => LS.get(pk('friends'), {});
  const duels = () => LS.get(pk('duels'), {});
  const setFriends = v => LS.set(pk('friends'), v);
  const setDuels = v => LS.set(pk('duels'), v);
  // 과목 고유값: 자료 내용으로 계산 → 과목 파일을 주고받으면 같은 값
  const fpCache = {};
  function fp(s) {
    const k = s.id + '|' + (s.updatedAt || 0);
    if (!fpCache[k]) fpCache[k] = U.fnv(s.materials.map(m => m.sections.map(x => (x.title || '') + '\n' + x.lines.join('\n')).join('\n\n')).join('\n----\n'));
    return fpCache[k];
  }
  const subjByFp = f => Lib.list.find(s => fp(s) === f);
  function weekXP() { return XP.week().reduce((a, x) => a + x.xp, 0); }
  function myCard() {
    const sc = Lib.list.map(s => [fp(s), Prog.of(s.id).exams.reduce((m, e) => Math.max(m, e.score), 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { t: 'c', k: myKey(), nk: nick(), av: me().photo ? '🙂' : me().avatar, lv: XP.level().lv, xp: XP.get().total, st: Prog.streak(), wk: weekXP(), sc: Object.fromEntries(sc), at: Date.now() };
  }
  function qrImg(text, cls = '') {
    if (!window.qrcode) { lib('qrcode').then(() => render()).catch(e => toast(e.message)); return '<div class="qrimg wait">QR 만드는 중…</div>'; }
    const qr = qrcode(0, 'L'); qr.addData(text); qr.make();
    return `<img class="qrimg ${cls}" src="${qr.createDataURL(6, 3)}" alt="QR 코드">`;
  }
  function seeded(seed, fn) {
    const orig = Math.random; let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return fn(); } finally { Math.random = orig; }
  }
  function buildDuel(s, d) { return seeded(d.seed, () => Gen.build(s, { units: [], count: d.n, objPct: 70, diff: d.diff, weak: null })); }
  function rankRows(d) {
    return Object.entries(d.res || {}).map(([k, r]) => ({ k, ...r })).sort((a, b) => b.score - a.score || a.used - b.used);
  }
  function duelTable(d) {
    const rows = rankRows(d), mk = myKey();
    return rows.length ? `<table class="summary-tbl duel-tbl"><tr><th>순위</th><th>이름</th><th>점수</th><th>걸린 시간</th></tr>${rows.map((r, i) => `<tr class="${r.k === mk ? 'me' : ''}"><td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
      <td data-notr>${esc(r.av || '')} ${esc(r.nk)}${r.k === mk ? ' (나)' : ''}</td><td class="mono">${fmt(r.score)}점</td><td class="mono">${U.mmss(r.used)}</td></tr>`).join('')}</table>`
      : '<p class="hint" style="margin:0">아직 결과가 없어요.</p>';
  }
  function startDuel(id) {
    const d = duels()[id]; if (!d) return toast('대결을 찾을 수 없어요');
    const s = subjByFp(d.fp);
    if (!s) return toast('같은 과목 파일이 없어요. 친구에게 과목 파일을 받아 먼저 불러와 주세요');
    if (App.exam && App.exam.phase === 'run' && !ask('보고 있던 시험을 그만두고 대결을 시작할까요?')) return;
    const { list } = buildDuel(s, d);
    if (!list.length) return toast('문제를 만들지 못했어요');
    App.exam = { sid: s.id, qs: list, resp: {}, idx: 0, start: Date.now(), dur: d.min * 60, set: { count: list.length, objPct: 70, diff: d.diff, minutes: d.min }, notes: [`⚔️ 대결 시험 · ${d.hn}님이 만든 시험지`], phase: 'run', scores: {}, judge: {}, self: {}, duel: { id } };
    App.ui.rvFilter = 'all'; App.ui.sheetOpen = false; App.ui.dialog = null;
    startTimer(); go(L('s', s.id, 'exam', 'run'));
  }
  function duelFinish(E) {
    const all = duels(), d = all[E.duel.id]; if (!d) return;
    d.res = d.res || {};
    d.res[myKey()] = { nk: nick(), av: me().avatar, score: E.result.score, used: E.result.used, at: Date.now() };
    setDuels(all);
  }
  function resultCode(d) { const r = d.res[myKey()]; return code({ t: 'r', id: d.id, k: myKey(), nk: r.nk, av: r.av, score: r.score, used: r.used, at: r.at }); }
  function duelResult(s, E) {
    const d = duels()[E.duel.id]; if (!d || !d.res || !d.res[myKey()]) return '';
    return `<section class="panel duel-res"><div class="row between"><h2 style="margin:0">⚔️ 대결 결과</h2><button class="btn sm" data-act="plusDlg" data-v="scan">📷 친구 결과 QR 찍기</button></div>
      <div class="duel-grid"><div class="qrwrap">${qrImg(resultCode(d))}<span class="hint">친구가 이 QR을 찍으면 내 결과가 들어가요</span></div>
        <div class="stack" style="gap:8px">${duelTable(d)}<p class="hint" style="margin:0">서로 결과 QR을 찍으면 순위가 맞춰져요 (점수가 같으면 시간이 짧은 쪽이 이겨요).</p></div></div></section>`;
  }
  function handleCode(str) {
    let o;
    try { o = parse(str); } catch (e) { toast(e.message); return false; }
    App.ui.dialog = null;
    if (o.t === 'c') {
      if (o.k === myKey()) { toast('내 카드예요'); render(); return true; }
      const f = friends(); const isNew = !f[o.k]; f[o.k] = { ...o, got: Date.now() }; setFriends(f);
      toast(isNew ? `${o.nk}님을 친구로 추가했어요` : `${o.nk}님의 기록을 새로 받았어요`);
      App.ui.duelTab = 'rank'; go('#/duel'); render(); return true;
    }
    if (o.t === 'd') {
      const all = duels(); all[o.id] = { ...(all[o.id] || {}), ...o, res: (all[o.id] || {}).res || {} }; setDuels(all);
      App.ui.duelTab = 'match';
      if (!subjByFp(o.fp)) { toast('같은 과목 파일이 없어요. 친구에게 과목 파일을 받아 주세요'); go('#/duel'); render(); return true; }
      toast(`${o.hn}님의 대결 초대! 같은 시험지로 시작해요`); startDuel(o.id); return true;
    }
    if (o.t === 'r') {
      const all = duels(); const d = all[o.id] || (all[o.id] = { id: o.id, sn: '알 수 없는 대결', res: {} });
      d.res = d.res || {}; d.res[o.k] = { nk: o.nk, av: o.av, score: o.score, used: o.used, at: o.at }; setDuels(all);
      toast(`${o.nk}님의 결과(${fmt(o.score)}점)를 넣었어요`); render(); return true;
    }
    toast('알 수 없는 QR이에요'); render(); return false;
  }
  function vDuel() {
    const tab = App.ui.duelTab || 'rank';
    const t = (id, l) => `<button data-act="duelTab" data-v="${id}" aria-current="${tab === id ? 'page' : 'false'}">${l}</button>`;
    let body = '';
    if (tab === 'rank') {
      const by = App.ui.rankBy || 'wk', mc = myCard();
      const rows = [{ ...mc, mine: true }, ...Object.values(friends())];
      const val = r => by === 'wk' ? r.wk : by === 'st' ? r.st : r.xp;
      rows.sort((a, b) => val(b) - val(a));
      body = `<section class="panel stack"><div class="seg">${[['wk', '이번 주 XP'], ['st', '연속 공부일'], ['xp', '누적 XP']].map(([k, l]) => `<button data-act="rankBy" data-v="${k}" aria-pressed="${by === k}">${l}</button>`).join('')}</div>
        <ol class="rank">${rows.map((r, i) => { const ago = r.mine ? 0 : dayDiff(U.day(r.at), today());
          return `<li class="${r.mine ? 'me' : ''}"><span class="rk">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span><span class="av sm" style="background:var(--accent-soft)">${esc(r.av || '🙂')}</span>
            <div style="flex:1;min-width:0"><b data-notr>${esc(r.nk)}${r.mine ? ' (나)' : ''}</b><br><span class="hint">Lv.${r.lv} · 🧱 ${r.st}층${r.mine ? '' : ` · ${ago ? ago + '일 전 기록' : '오늘 기록'}`}</span></div>
            <b class="mono">${val(r)}${by === 'st' ? '일' : ' XP'}</b>${r.mine ? '' : `<button class="btn sm ghost" data-act="friendDel" data-k="${esc(r.k)}" aria-label="친구 삭제">✕</button>`}</li>`; }).join('')}</ol>
        ${rows.length === 1 ? '<p class="hint" style="margin:0">아직 친구가 없어요. [🪪 내 카드]에서 서로의 QR을 찍어 보세요.</p>' : ''}
        <div class="row"><button class="btn primary" data-act="plusDlg" data-v="scan">📷 친구 카드 찍기</button></div></section>`;
    } else if (tab === 'card') {
      const c = code(myCard());
      body = `<section class="panel duel-grid"><div class="qrwrap">${qrImg(c)}<span class="hint">친구가 스스로 앱으로 이 QR을 찍으면 순위표에 들어가요</span></div>
        <div class="stack" style="gap:12px"><label class="field"><span class="label">대결 닉네임 (실명 대신 권장)</span>
          <input type="text" value="${esc(me().nick || '')}" placeholder="${esc(me().name)}" maxlength="12" data-ch="nick"></label>
          <div class="row"><button class="btn primary" data-act="plusDlg" data-v="scan">📷 친구 카드 찍기</button><button class="btn" data-act="qrCopy" data-code="${esc(c)}">📋 코드 복사</button></div>
          ${App.ui.codeShow ? `<textarea class="input" rows="3" readonly data-notr>${esc(App.ui.codeShow)}</textarea>` : ''}
          <p class="hint" style="margin:0">카드에는 닉네임, 레벨, 누적 XP, 연속 공부일, 이번 주 XP, 과목별 최고 점수만 들어가요 (실시간이 아니라 찍은 순간의 기록이에요).</p></div></section>`;
    } else {
      const D = App.ui.duelNew || (App.ui.duelNew = { sid: (Lib.list[0] || {}).id || '', n: 10, diff: 'mix', min: 10 });
      const all = Object.values(duels()).sort((a, b) => (b.at || 0) - (a.at || 0));
      const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="duelOpt" data-k="${k}" data-v="${v}" aria-pressed="${String(D[k]) === String(v)}">${l}</button>`).join('')}</div>`;
      body = `<section class="panel stack"><h2 style="margin:0">대결 만들기</h2>
          ${Lib.list.length ? `<label class="field"><span class="label">과목</span><select class="input" data-ch="duelSubj" data-notr>${Lib.list.map(s => `<option value="${esc(s.id)}" ${D.sid === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
          <div><div class="label">문제 수</div>${seg('n', [[10, '10문항'], [20, '20문항'], [30, '30문항']])}</div>
          <div><div class="label">난이도</div>${seg('diff', [['mix', '섞기'], [1, '쉬움'], [2, '보통'], [3, '어려움']])}</div>
          <div><div class="label">제한 시간</div>${seg('min', [[5, '5분'], [10, '10분'], [20, '20분'], [30, '30분']])}</div>
          <div class="row end"><button class="btn primary" data-act="duelMake">⚔️ 대결 만들기</button></div>` : '<p class="hint">과목이 있어야 대결을 만들 수 있어요.</p>'}
          <p class="hint" style="margin:0">두 사람이 <b>같은 과목 파일</b>을 갖고 있어야 해요. 먼저 [과목 수정 → 과목 파일로 내보내기]로 공유하세요.</p></section>
        <section class="panel stack"><div class="row between"><h2 style="margin:0">대결 목록</h2><button class="btn sm" data-act="plusDlg" data-v="scan">📷 초대·결과 QR 찍기</button></div>
          ${all.length ? all.map(d => { const s = d.fp && subjByFp(d.fp), mine = d.res && d.res[myKey()];
            return `<details class="duel-item" ${App.ui.duelOpen === d.id ? 'open' : ''}><summary><b data-notr>${esc(d.sn || '대결')}</b> <span class="hint">${d.n || '?'}문항 · ${d.diff === 'mix' ? '섞기' : DIFF[d.diff] || ''} · ${d.min || '?'}분 · ${esc(d.hn || '')}</span>
              <span class="chip ${mine ? 'ok' : ''}">${mine ? fmt(mine.score) + '점' : '안 풀었음'}</span></summary>
              <div class="body stack" style="gap:10px">
                <div class="duel-grid"><div class="qrwrap">${qrImg(mine ? resultCode(d) : code({ t: 'd', id: d.id, fp: d.fp, sn: d.sn, n: d.n, diff: d.diff, min: d.min, seed: d.seed, hn: d.hn, at: d.at }))}
                  <span class="hint">${mine ? '내 결과 QR' : '초대 QR · 친구가 찍으면 같은 시험지로 시작해요'}</span></div>
                  <div class="stack" style="gap:8px">${duelTable(d)}
                    ${!s ? '<div class="notice">이 기기에 같은 과목 파일이 없어요. 친구에게 과목 파일을 받아 불러와 주세요.</div>' : ''}
                    <div class="row">${s && !mine ? `<button class="btn primary sm" data-act="duelStart" data-id="${esc(d.id)}">이 시험지 풀기</button>` : ''}
                      ${s && mine ? `<button class="btn sm" data-act="duelShowInvite" data-id="${esc(d.id)}">초대 QR 보기</button>` : ''}
                      ${s ? `<button class="btn sm" data-act="exportSubj" data-sid="${esc(s.id)}">과목 파일 내보내기</button>` : ''}
                      <button class="btn sm ghost" data-act="duelDel" data-id="${esc(d.id)}">삭제</button></div></div></div></div></details>`; }).join('')
            : '<p class="hint" style="margin:0">아직 대결이 없어요.</p>'}</section>`;
    }
    return {
      crumb: '⚔️ 친구 대결',
      body: `<div class="page wrap" style="max-width:900px"><h1 style="font-size:24px">⚔️ 친구 대결</h1>
        <nav class="tabs" aria-label="대결 메뉴">${t('rank', '🏆 순위표')}${t('card', '🪪 내 카드')}${t('match', '📝 같은 시험지')}</nav>
        ${body}
        <p class="hint">서버 없이 QR로 주고받는 친선 경쟁이에요. 실시간이 아니고, 점수 조작을 완전히 막을 수는 없어요.</p></div>`,
    };
  }

  /* ---------- QR 읽기 창 (카메라 · 사진 · 코드 붙여넣기) ---------- */
  let cam = null;
  function scanDlg() {
    const can = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
    return `<h3>📷 QR 읽기</h3>
      ${can ? '<div class="qrcam"><video id="qrVideo" playsinline muted></video><p id="qrCamMsg" class="hint">카메라를 켜는 중…</p></div>'
        : '<div class="notice">이 화면에서는 카메라를 쓸 수 없어요. QR 사진 올리기나 코드 붙여넣기를 써 주세요.</div>'}
      <label class="btn" style="cursor:pointer">🖼️ QR 사진 올리기<input type="file" accept="image/*" data-ch="qrPhoto" hidden></label>
      <textarea id="qrPaste" class="input" rows="2" placeholder="SSRO1.로 시작하는 코드를 붙여넣으세요" data-notr></textarea>
      <div class="row end"><button class="btn" data-act="dlgCancel">닫기</button><button class="btn primary" data-act="qrPasteGo">코드로 읽기</button></div>`;
  }
  function stopCam() { if (cam) { cam.stop = true; (cam.stream && cam.stream.getTracks() || []).forEach(t => t.stop()); cam = null; } }
  function after() {
    const v = document.getElementById('qrVideo');
    if (App.ui.dialog !== 'scan' || !v) { stopCam(); return; }
    if (cam && cam.stream) { v.srcObject = cam.stream; v.play().catch(() => { }); return; }
    if (cam) return;
    cam = { stop: false };
    const my = cam;
    Promise.all([lib('jsQR'), navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })]).then(([, stream]) => {
      if (my.stop) { stream.getTracks().forEach(t => t.stop()); return; }
      my.stream = stream;
      const vid = document.getElementById('qrVideo'); if (!vid) return stopCam();
      vid.srcObject = stream; vid.play().catch(() => { });
      const m = document.getElementById('qrCamMsg'); if (m) m.textContent = 'QR을 네모 안에 맞춰 주세요';
      const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
      const loop = () => {
        if (my.stop) return;
        const vv = document.getElementById('qrVideo');
        if (vv && vv.videoWidth) {
          const k = Math.min(1, 720 / vv.videoWidth); c.width = vv.videoWidth * k; c.height = vv.videoHeight * k;
          g.drawImage(vv, 0, 0, c.width, c.height);
          const r = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' });
          if (r && r.data && /SSRO1\./.test(r.data)) { stopCam(); Sfx.play('ok'); handleCode(r.data); return; }
        }
        setTimeout(() => requestAnimationFrame(loop), 120);
      };
      loop();
    }).catch(() => { const m = document.getElementById('qrCamMsg'); if (m) m.textContent = '카메라를 켜지 못했어요. 권한을 허용하거나 사진 올리기를 써 주세요.'; });
  }
  async function readPhoto(file) {
    await lib('jsQR');
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('사진을 읽지 못했어요')); i.src = URL.createObjectURL(file); });
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    const side = Math.max(img.width, img.height);
    // 작은 사진은 키우고, 큰 사진은 줄여서 여러 번 시도
    for (const target of [1000, 1600, 600, side]) {
      const k = target / side; c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      g.imageSmoothingEnabled = k < 1; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const r = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (r && r.data) { URL.revokeObjectURL(img.src); return r.data; }
    }
    URL.revokeObjectURL(img.src);
    throw new Error('사진에서 QR을 찾지 못했어요');
  }

  /* ---------- 창 (보상 · 스킨 · QR 읽기 · 초대 QR) ---------- */
  function overlay() {
    const d = App.ui.dialog;
    if (!me() || !['rewards', 'skins', 'scan', 'invite'].includes(d)) return '';
    let inner = '';
    if (d === 'rewards') inner = rewardsDlg();
    if (d === 'skins') inner = skinsDlg();
    if (d === 'scan') inner = scanDlg();
    if (d === 'invite') {
      const x = duels()[App.ui.inviteId];
      inner = x ? `<h3>⚔️ 대결 초대 QR</h3><div class="qrwrap">${qrImg(code({ t: 'd', id: x.id, fp: x.fp, sn: x.sn, n: x.n, diff: x.diff, min: x.min, seed: x.seed, hn: x.hn, at: x.at }))}</div>
        <p class="hint" style="margin:0" data-notr>${esc(x.sn)} · ${x.n}문항 · ${x.min}분 — 친구가 찍으면 같은 시험지로 시작해요</p>` : '<p>대결을 찾을 수 없어요.</p>';
    }
    return `<div class="overlay" data-act="dlgClose"><div class="dialog plus-dlg" role="dialog" aria-modal="true">${inner}
      ${d === 'scan' ? '' : '<div class="row end"><button class="btn" data-act="dlgCancel">닫기</button></div>'}</div></div>`;
  }

  /* ---------- 홈 화면 추가 부분 ---------- */
  function home() {
    return `<div class="quick3">
        <button class="qbtn" data-act="go" data-to="#/plan"><span class="ico">📅</span><b>시험 계획</b></button>
        <button class="qbtn" data-act="go" data-to="#/report"><span class="ico">📊</span><b>학습 리포트</b></button>
        <button class="qbtn" data-act="go" data-to="#/duel"><span class="ico">⚔️</span><b>친구 대결</b></button></div>
      ${reviewCard()}${examCard()}`;
  }

  /* ---------- 경로 연결: 기존 dispatch를 감쌈 ---------- */
  const baseDispatch = dispatch;
  dispatch = function (r) {
    if (Profiles.cur) {
      if (r[0] === 'plan') return vPlan();
      if (r[0] === 'report') return vReport();
      if (r[0] === 'duel') return vDuel();
    }
    return baseDispatch(r);
  };

  /* ---------- 동작 ---------- */
  Object.assign(ACT, {
    plusDlg(el) {
      App.ui.dialog = el.dataset.v; App.ui.themeOpen = false;
      if (el.dataset.v === 'rewards') Profiles.update(me().id, { skinSeen: topUnlocked() });
      render();
    },
    setSkin(el) { Profiles.update(me().id, { towerSkin: el.dataset.v }); toast('스킨을 바꿨어요'); render(); },
    reviewStart(el) {
      const s = Lib.get(el.dataset.sid);
      const qs = Prog.due(s.id).slice(0, 30).map(r => r.snap);
      if (!qs.length) return toast('오늘 복습할 문제가 없어요');
      App.play = newPlay(s, 'review|' + Date.now(), 'practice', qs, '🔁 오늘의 복습', { fromLog: true, review: true });
      go(L('s', s.id, 'practice'));
    },
    restDay(el) {
      const v = Number(el.dataset.v), cur = me().restDays || [];
      const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
      if (next.length >= 7) return toast('모든 요일을 쉴 수는 없어요');
      Profiles.update(me().id, { restDays: next }); render();
    },
    planPractice(el) {
      const s = Lib.get(el.dataset.sid), e = (s.exams || []).find(x => x.id === el.dataset.eid), P = planOf(s, e);
      const all = P.range.length === s.units.length;
      App.ui.gen = { sid: s.id, units: P.units.length ? P.units : all ? [] : P.range, count: Math.max(10, P.goal - P.solved), objPct: 70, diff: 'mix', mode: 'practice', minutes: 30, weak: true };
      go(L('s', s.id, 'gen'));
    },
    planExam(el) {
      const s = Lib.get(el.dataset.sid), e = (s.exams || []).find(x => x.id === el.dataset.eid);
      const range = rangeOf(s, e);
      App.ui.gen = { sid: s.id, units: range.length === s.units.length ? [] : range, count: 20, objPct: 70, diff: 'mix', mode: 'exam', minutes: 30, weak: false };
      go(L('s', s.id, 'gen'));
    },
    examAdd(el) {
      const name = document.getElementById('exName').value.trim(), date = document.getElementById('exDate').value;
      if (!name) return toast('시험 이름을 입력해 주세요');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('시험 날짜를 골라 주세요');
      const units = [...document.querySelectorAll('.exUnit:checked')].map(x => x.value);
      mutateSubject(el.dataset.sid, s => { s.exams = [...(s.exams || []), { id: U.uid('e'), name, date, units, createdAt: Date.now(), real: null }]; }, '시험 일정을 추가했어요');
    },
    examDel(el) {
      if (!ask('이 시험 일정을 삭제할까요?')) return;
      mutateSubject(el.dataset.sid, s => { s.exams = (s.exams || []).filter(x => x.id !== el.dataset.eid); }, '시험 일정을 삭제했어요');
    },
    rpSet(el) { App.ui.rp = el.dataset.v; render(); },
    rpPrint() { window.print(); },
    rpImage() { reportImage().catch(e => toast(e.message || '이미지를 만들지 못했어요')); },
    duelTab(el) { App.ui.duelTab = el.dataset.v; App.ui.codeShow = null; render(); },
    rankBy(el) { App.ui.rankBy = el.dataset.v; render(); },
    friendDel(el) {
      const f = friends(), x = f[el.dataset.k]; if (!x) return;
      if (!ask(`「${x.nk}」님을 순위표에서 뺄까요?`)) return;
      delete f[el.dataset.k]; setFriends(f); render();
    },
    qrCopy(el) {
      const c = el.dataset.code;
      const show = () => { App.ui.codeShow = c; render(); toast('코드를 길게 눌러 복사해 주세요'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c).then(() => toast('코드를 복사했어요'), show); else show();
    },
    qrPasteGo() { const v = (document.getElementById('qrPaste') || {}).value; if (!v || !v.trim()) return toast('코드를 붙여넣어 주세요'); stopCam(); handleCode(v); },
    duelOpt(el) { const D = App.ui.duelNew, k = el.dataset.k, v = el.dataset.v; D[k] = k === 'diff' ? (v === 'mix' ? 'mix' : Number(v)) : Number(v); render(); },
    duelMake() {
      const D = App.ui.duelNew, s = Lib.get(D.sid);
      if (!s || !s.materials.length) return toast('자료가 있는 과목을 골라 주세요');
      const d = { id: U.uid('d'), fp: fp(s), sn: s.name, n: D.n, diff: D.diff, min: D.min, seed: (Math.random() * 2 ** 31) >>> 0, hn: nick(), at: Date.now(), res: {} };
      if (!buildDuel(s, d).list.length) return toast('이 과목으로는 문제를 만들 수 없어요');
      const all = duels(); all[d.id] = d; setDuels(all);
      App.ui.duelOpen = d.id; App.ui.inviteId = d.id; App.ui.dialog = 'invite';
      toast('대결을 만들었어요! 친구에게 초대 QR을 보여 주세요'); render();
    },
    duelStart(el) { startDuel(el.dataset.id); },
    duelShowInvite(el) { App.ui.inviteId = el.dataset.id; App.ui.dialog = 'invite'; render(); },
    duelDel(el) {
      if (!ask('이 대결 기록을 삭제할까요?')) return;
      const all = duels(); delete all[el.dataset.id]; setDuels(all); render();
    },
  });
  Object.assign(IN, { rpHide(el) { App.ui.rpHide = el.checked; render(); } });
  Object.assign(CH, {
    realScore(el) {
      const v = el.value === '' ? null : U.clamp(Number(el.value), 0, 100);
      mutateSubject(el.dataset.sid, s => { const e = (s.exams || []).find(x => x.id === el.dataset.eid); if (e) e.real = v; }, '실제 점수를 저장했어요');
    },
    rpExam(el) { App.ui.rp = el.value || 'week'; render(); },
    nick(el) { Profiles.update(me().id, { nick: el.value.trim().slice(0, 12) }); toast('닉네임을 저장했어요'); render(); },
    duelSubj(el) { App.ui.duelNew.sid = el.value; },
    async qrPhoto(el) {
      const f = el.files && el.files[0]; el.value = ''; if (!f) return;
      try { stopCam(); handleCode(await readPhoto(f)); } catch (e) { toast(e.message); }
    },
  });

  return { home, towerSide, skin, onTower, reviewDone, srsPanel, examEditor, duelFinish, duelResult, overlay, after, handleCode, fp, buildDuel, code, parse, SKINS };
})();
