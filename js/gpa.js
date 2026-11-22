/* 스스로 — 학점 계산기 (2026-11-22)
   학기별 과목(학점·성적·전공 여부)을 넣으면 학기 평점·전체 평점·전공 평점·이수 학점을 계산하고,
   목표 평점까지 남은 학점에서 필요한 평균도 알려 줌. 새 경로: #/gpa
   P/NP는 평점에서 빼고 P만 이수 학점에 넣음. F는 평점 계산에 넣고 이수 학점에서 뺌 */
'use strict';

const Gpa = (() => {
  const SCALES = {
    '4.5': [['A+', 4.5], ['A0', 4.0], ['B+', 3.5], ['B0', 3.0], ['C+', 2.5], ['C0', 2.0], ['D+', 1.5], ['D0', 1.0], ['F', 0]],
    '4.3': [['A+', 4.3], ['A0', 4.0], ['A-', 3.7], ['B+', 3.3], ['B0', 3.0], ['B-', 2.7], ['C+', 2.3], ['C0', 2.0], ['C-', 1.7], ['D+', 1.3], ['D0', 1.0], ['D-', 0.7], ['F', 0]],
  };
  const PASS = [['P', null], ['NP', null]];
  const CREDITS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6];

  /* ---------- 저장 ---------- */
  const key = () => `p.${Profiles.cur.id}.gpa`;
  const get = () => {
    const d = LS.get(key(), null);
    if (d && d.sems) return d;
    // 처음 열 때 빈 표를 바로 저장해야 화면의 과목 id와 저장된 id가 같아짐
    const fresh = { scale: '4.5', sems: [newSem(1)], target: { gpa: '', remain: '' } };
    LS.set(key(), fresh);
    return fresh;
  };
  const put = d => LS.set(key(), d);
  function newSem(n) { return { id: U.uid('g'), name: `${n}학기`, courses: [newCourse(), newCourse(), newCourse()] }; }
  function newCourse() { return { id: U.uid('c'), name: '', cr: 3, gr: '', major: false }; }

  /* ---------- 계산 ---------- */
  // 다른 체계에서 넣은 성적(예: 4.3의 A-)은 4.5에서 같은 글자의 0 성적으로 계산
  function point(scale, gr) {
    if (!gr || gr === 'P' || gr === 'NP') return null;
    const tb = SCALES[scale];
    let hit = tb.find(x => x[0] === gr);
    if (!hit) hit = tb.find(x => x[0] === gr[0] + '0') || tb.find(x => x[0] === gr[0]);
    return hit ? hit[1] : null;
  }
  function sum(scale, courses, onlyMajor = false) {
    let gc = 0, pts = 0, earned = 0, n = 0;
    for (const c of courses) {
      if (onlyMajor && !c.major) continue;
      if (!c.gr) continue;
      n++;
      const cr = Number(c.cr) || 0, p = point(scale, c.gr);
      if (p != null) { gc += cr; pts += cr * p; if (c.gr !== 'F') earned += cr; }
      else if (c.gr === 'P') earned += cr;
    }
    return { gc, pts, earned, n, gpa: gc ? pts / gc : null };
  }
  function stats(d = get()) {
    const all = d.sems.flatMap(s => s.courses);
    const per = d.sems.map(s => ({ s, ...sum(d.scale, s.courses) }));
    return { per, total: sum(d.scale, all), major: sum(d.scale, all, true) };
  }
  // 목표 평점 T, 앞으로 들을 학점 R → 남은 과목에서 받아야 할 평균
  function need(d, tot) {
    const T = parseFloat(d.target.gpa), R = parseFloat(d.target.remain), max = Number(d.scale);
    if (!(T > 0) || !(R > 0)) return null;
    const v = (T * (tot.gc + R) - tot.pts) / R;
    return { v, T, R, max, state: v > max ? 'no' : v <= 0 ? 'done' : 'ok' };
  }
  const f2 = v => v == null ? '–' : (Math.floor(v * 100 + 1e-9) / 100).toFixed(2);   // 학교처럼 소수 둘째 자리 버림
  const fc = v => Number.isInteger(v) ? String(v) : v.toFixed(1);

  /* ---------- 화면 ---------- */
  function homeBtn() {
    const raw = Profiles.cur && LS.get(key(), null);   // 홈에서는 빈 표를 새로 저장하지 않음
    const t = raw && raw.sems ? stats(raw).total : null;
    return `<button class="qbtn" data-act="go" data-to="#/gpa"><span class="ico">🎓</span><b>학점 계산기</b>${t && t.gpa != null ? `<small class="qsub">${f2(t.gpa)} / ${raw.scale}</small>` : ''}</button>`;
  }
  function vGpa() {
    const d = get(), S = stats(d), tb = [...SCALES[d.scale], ...PASS], N = need(d, S.total);
    const subjNames = Lib.list.map(s => s.name);
    const grOpts = cur => `<option value="">성적</option>` + tb.map(([g]) => `<option ${g === cur ? 'selected' : ''}>${g}</option>`).join('')
      + (cur && !tb.some(x => x[0] === cur) ? `<option selected>${esc(cur)}</option>` : '');
    const crOpts = cur => CREDITS.map(c => `<option value="${c}" ${Number(cur) === c ? 'selected' : ''}>${fc(c)}학점</option>`).join('');
    const maxBar = Number(d.scale);
    const sems = S.per.map(({ s, gpa, earned }, si) => `
      <section class="panel gpa-sem">
        <div class="gpa-sem-head"><input type="text" class="input gpa-sname" value="${esc(s.name)}" maxlength="20" data-ch="gpaSemName" data-sem="${s.id}" aria-label="학기 이름">
          <span class="chip acc">평점 ${f2(gpa)}</span><span class="chip">이수 ${fc(earned)}학점</span>
          <button class="btn sm danger" data-act="gpaSemDel" data-sem="${s.id}" aria-label="학기 삭제">삭제</button></div>
        <div class="gpa-rows">
          <div class="gpa-row gpa-th"><span>과목명</span><span>학점</span><span>성적</span><span>전공</span><span></span></div>
          ${s.courses.map(c => `<div class="gpa-row">
            <input type="text" class="input" value="${esc(c.name)}" placeholder="과목명" maxlength="30" list="gpaSubj" data-ch="gpaName" data-sem="${s.id}" data-c="${c.id}" data-notr>
            <select class="input" data-ch="gpaCr" data-sem="${s.id}" data-c="${c.id}" aria-label="학점">${crOpts(c.cr)}</select>
            <select class="input${c.gr ? '' : ' gr-none'}" data-ch="gpaGr" data-sem="${s.id}" data-c="${c.id}" aria-label="성적">${grOpts(c.gr)}</select>
            <label class="gpa-mj"><input type="checkbox" ${c.major ? 'checked' : ''} data-ch="gpaMajor" data-sem="${s.id}" data-c="${c.id}"><span>전공</span></label>
            <button class="btn sm ghost" data-act="gpaDel" data-sem="${s.id}" data-c="${c.id}" aria-label="과목 삭제">✕</button></div>`).join('')}
        </div>
        <div class="row"><button class="btn sm" data-act="gpaAdd" data-sem="${s.id}">＋ 과목 추가</button></div>
      </section>`).join('');
    const chart = S.per.filter(x => x.gpa != null);
    return {
      crumb: '🎓 학점 계산기',
      body: `<div class="page wrap" style="max-width:900px"><h1 style="font-size:24px">🎓 학점 계산기</h1>
        <section class="panel gpa-sum">
          <div class="gpa-big"><span class="hint">전체 평점</span><b>${f2(S.total.gpa)}</b><small>/ ${d.scale}</small></div>
          <div class="gpa-kv"><div><span class="hint">전공 평점</span><b>${f2(S.major.gpa)}</b></div>
            <div><span class="hint">이수 학점</span><b>${fc(S.total.earned)}</b></div>
            <div><span class="hint">평점 반영 학점</span><b>${fc(S.total.gc)}</b></div></div>
          <div class="seg" role="group" aria-label="만점 기준">${['4.5', '4.3'].map(k => `<button data-act="gpaScale" data-v="${k}" aria-pressed="${d.scale === k}">${k} 만점</button>`).join('')}</div>
        </section>
        ${chart.length > 1 ? `<section class="panel"><h2 style="margin-top:0">학기별 평점</h2><div class="gpa-chart">${chart.map(x => `<div class="gc-col"><b>${f2(x.gpa)}</b><div class="gc-bar"><i style="height:${Math.round(x.gpa / maxBar * 100)}%"></i></div><span data-notr>${esc(x.s.name)}</span></div>`).join('')}</div></section>` : ''}
        ${sems}
        <div class="row"><button class="btn" data-act="gpaSemAdd">＋ 학기 추가</button></div>
        <section class="panel stack"><h2 style="margin:0">🎯 목표 평점 계산</h2>
          <div class="grid2"><label class="field"><span class="label">목표 전체 평점</span><input type="number" class="input" step="0.01" min="0" max="${d.scale}" value="${esc(d.target.gpa)}" placeholder="예: 4.0" data-ch="gpaT" data-k="gpa"></label>
            <label class="field"><span class="label">앞으로 들을 학점</span><input type="number" class="input" step="0.5" min="0" value="${esc(d.target.remain)}" placeholder="예: 36" data-ch="gpaT" data-k="remain"></label></div>
          ${!N ? '<p class="hint" style="margin:0">목표 평점과 남은 학점을 넣으면 앞으로 받아야 할 평균을 알려 줘요.</p>'
            : N.state === 'no' ? `<div class="notice">남은 ${fc(N.R)}학점을 모두 ${d.scale}로 받아도 ${f2(N.T)}에 닿기 어려워요. (필요한 평균 ${f2(N.v)})</div>`
            : N.state === 'done' ? `<div class="notice ok">이미 목표를 넘었어요! 남은 과목을 어떻게 받아도 ${f2(N.T)} 이상이에요.</div>`
            : `<div class="gpa-need">남은 ${fc(N.R)}학점에서 평균 <b>${(Math.ceil(N.v * 100 - 1e-9) / 100).toFixed(2)}</b> 이상 받으면 목표 ${f2(N.T)} 달성!</div>`}
        </section>
        <datalist id="gpaSubj">${subjNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <p class="hint">P/NP 과목은 평점에서 빠지고, P는 이수 학점에 들어가요. F는 평점에 0점으로 들어가고 이수 학점에서는 빠져요. 평점은 소수 셋째 자리에서 버려요. 학교마다 재수강·환산 규칙이 다를 수 있어요.</p></div>`,
    };
  }

  /* ---------- 고치기 ---------- */
  function edit(fn, rerender = true) { const d = get(); fn(d); put(d); if (rerender) render(); }
  const findC = (d, el) => { const s = d.sems.find(x => x.id === el.dataset.sem); return { s, c: s && s.courses.find(x => x.id === el.dataset.c) }; };

  const baseDispatch = dispatch;
  dispatch = function (r) { if (Profiles.cur && r[0] === 'gpa') return vGpa(); return baseDispatch(r); };
  Object.assign(ACT, {
    gpaScale(el) { edit(d => { d.scale = el.dataset.v; }); },
    gpaAdd(el) { edit(d => { const s = d.sems.find(x => x.id === el.dataset.sem); if (s) s.courses.push(newCourse()); }); },
    gpaDel(el) { edit(d => { const { s } = findC(d, el); if (s) s.courses = s.courses.filter(x => x.id !== el.dataset.c); }); },
    gpaSemAdd() { edit(d => { d.sems.push(newSem(d.sems.length + 1)); }); },
    gpaSemDel(el) {
      const d = get(), s = d.sems.find(x => x.id === el.dataset.sem);
      if (!s || !ask(`「${s.name}」을(를) 삭제할까요? 이 학기의 과목도 함께 지워져요.`)) return;
      edit(x => { x.sems = x.sems.filter(y => y.id !== s.id); if (!x.sems.length) x.sems.push(newSem(1)); });
    },
  });
  Object.assign(CH, {
    gpaName(el) { edit(d => { const { c } = findC(d, el); if (c) c.name = el.value.trim(); }, false); },
    gpaSemName(el) { edit(d => { const s = d.sems.find(x => x.id === el.dataset.sem); if (s) s.name = el.value.trim() || s.name; }); },
    gpaCr(el) { edit(d => { const { c } = findC(d, el); if (c) c.cr = Number(el.value); }); },
    gpaGr(el) { edit(d => { const { c } = findC(d, el); if (c) c.gr = el.value; }); },
    gpaMajor(el) { edit(d => { const { c } = findC(d, el); if (c) c.major = el.checked; }); },
    gpaT(el) { edit(d => { d.target[el.dataset.k] = el.value; }); },
  });

  return { SCALES, get, key, stats, point, need, homeBtn };
})();
