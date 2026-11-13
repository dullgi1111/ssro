/* 스스로 — 화면(뷰)과 동작
   경로: #/login 프로필 고르기 · #/login/new 새 프로필 · #/profile · #/profile/edit
         #/ 홈 · #/study 과목 고르기
         #/s/과목/concept[/단원] 개념 정리 · …/drill/단원 개념 문제 · …/gen 문제 생성 · …/log 기록 보기
         …/practice/run 연습 풀이 · …/exam/run · …/exam/grade · …/exam/result
         #/manage 과목 관리 · #/manage/new 새 과목 · #/manage/edit/과목 */
'use strict';

const CIRC = '①②③④⑤⑥⑦⑧⑨⑩';
const THEMES = [
  ['calm', '침착함', '차분한 초록빛 회색 (기본)', ['#eef1ef', '#2f6f66', '#23302d']],
  ['dark', '다크', '밤 공부용 어두운 화면', ['#121615', '#6cc4b2', '#0b0e0d']],
  ['focus', '집중', '눈이 편한 종이색', ['#f1e9d8', '#8a5a2b', '#3b3125']],
  ['fresh', '산뜻함', '밝고 경쾌한 파랑', ['#f3f8fd', '#2a6fdb', '#1f4fa3']],
];
const AVATARS = ['🦊', '🐻', '🐰', '🐱', '🐶', '🐼', '🐧', '🦉', '🐳', '🐢', '🌱', '⭐', '📘', '🔬', '⚙️', '🧪'];
const COLORS = ['#2f6f66', '#2a6fdb', '#8a5a2b', '#b8392e', '#7a4fb5', '#c47a12', '#3d7a3a', '#4a5560'];
const App = {
  play: null, exam: null, ctx: null, timer: null,
  ui: { themeOpen: false, cardLimit: {}, rvFilter: 'all', dialog: null, sheetOpen: false, gen: null, up: null, pf: null, pinFor: null, newSubj: null },
};
const $app = document.getElementById('app');
const esc = U.esc;
const L = (...p) => '#/' + p.map(x => encodeURIComponent(x)).join('/');
const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
const scoreWord = v => v >= 1 ? '맞음' : v > 0 ? '부분' : '틀림';
const rnd = n => Math.floor(Math.random() * n);

/* ================= 공통 ================= */
function route() { return (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean).map(decodeURIComponent); }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function toast(msg) {
  msg = I18N.str(String(msg));
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2400);
}
/* 효과음: 파일 없이 브라우저에서 바로 합성 (프로필에서 끌 수 있음) */
const Sfx = {
  ctx: null,
  on() { return !Profiles.cur || Profiles.cur.sound !== false; },
  tone(freq, start, dur, type = 'sine', vol = 0.18, slide = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  play(kind) {
    if (!this.on()) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (kind === 'ok') { this.tone(659, 0, 0.12, 'triangle'); this.tone(880, 0.09, 0.2, 'triangle'); }
      else if (kind === 'bad') { this.tone(196, 0, 0.18, 'square', 0.07, -40); this.tone(147, 0.14, 0.24, 'square', 0.07, -30); }
      else if (kind === 'done') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, 0.22, 'triangle'));
      else if (kind === 'level') [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.08, 0.18, 'sine', 0.15));
    } catch { }
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && touched && matchMedia('(pointer: coarse)').matches) try { navigator.vibrate(kind === 'bad' ? [50, 40, 50] : 15); } catch { }
  },
};
function xpFloat(n) {
  const el = document.createElement('div');
  el.className = 'xpfloat'; el.textContent = `+${n} XP`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
// XP 주기: 레벨업·하루 목표 달성 축하까지
function gainXP(n) {
  if (!n || !Profiles.cur) return;
  const before = XP.get(), lv0 = XP.level(before.total).lv, today0 = before.days[U.day()] || 0;
  const after = XP.add(n), lv1 = XP.level(after.total).lv, goal = XP.goal();
  xpFloat(n);
  if (lv1 > lv0) { setTimeout(() => { toast(`🎉 레벨 업! Lv.${lv1}`); Sfx.play('level'); }, 400); }
  else if (today0 < goal && today0 + n >= goal) { setTimeout(() => { toast('🎯 오늘의 목표 달성! 잘했어요'); Sfx.play('level'); }, 400); }
  Prog.touchDay();
  const hud = document.getElementById('hudXp');
  if (hud) hud.textContent = XP.today();
}
const PRAISE = ['잘했어요!', '정확해요!', '완벽해요!', '최고예요!', '대단해요!', '바로 그거예요!'];
const CHEER = ['아쉬워요!', '괜찮아요, 다시 봐요', '거의 다 왔어요!', '한 번 더 보면 기억나요'];
function applyTheme(t, persist = true) {
  if (!THEMES.some(x => x[0] === t)) t = 'calm';
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = THEMES.find(x => x[0] === t)[3][2];
  LS.set('theme', t);
  if (persist && Profiles.cur) Profiles.update(Profiles.cur.id, { theme: t });
}
function avatar(p, cls = '') {
  if (!p) return '';
  return p.photo ? `<img class="av ${cls}" src="${p.photo}" alt="">`
    : `<span class="av ${cls}" style="background:${esc(p.color)}" aria-hidden="true">${esc(p.avatar)}</span>`;
}
function themePop() {
  const cur = document.documentElement.dataset.theme;
  return `<div class="theme-pop" role="menu">${THEMES.map(([id, name, d, c]) => `
    <button class="theme-opt" data-act="theme" data-v="${id}" aria-pressed="${cur === id}">
      <span class="swatch">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span>
      <span><b>${name}</b><span>${d}</span></span></button>`).join('')}</div>`;
}
/* 풀던 문제·시험 자동 저장 (프로필별) → 앱을 닫거나 다른 화면에 가도 이어서 */
const Session = {
  key() { return `p.${Profiles.cur.id}.session`; },
  save() {
    if (!Profiles.cur) return;
    const play = App.play && App.play.idx < App.play.qs.length && App.play.qs.length ? App.play : null;
    const exam = App.exam && (App.exam.phase === 'run' || App.exam.phase === 'grade') ? App.exam : null;
    if (!play && !exam) return LS.del(this.key());
    LS.set(this.key(), { play, exam, at: Date.now() });
  },
  load() {
    const s = Profiles.cur ? LS.get(this.key(), null) : null;
    App.play = (s && s.play && Lib.get(s.play.sid)) ? s.play : null;
    App.exam = (s && s.exam && Lib.get(s.exam.sid)) ? s.exam : null;
    if (App.exam && App.exam.phase === 'run' && !App.exam.pausedAt) App.exam.pausedAt = s.at;
  },
  clear() { if (Profiles.cur) LS.del(this.key()); },
};
function pauseExam() { const E = App.exam; if (E && E.phase === 'run' && !E.pausedAt) { E.pausedAt = Date.now(); stopTimer(); } }
function resumeExam() { const E = App.exam; if (E && E.pausedAt) { E.start += Date.now() - E.pausedAt; delete E.pausedAt; } if (E && E.phase === 'run' && !App.timer) startTimer(); }
// 다른 화면에 있을 때 오른쪽 아래에 뜨는 [이어서 풀기]
function resumeFab() {
  if (!Profiles.cur || App.ctx === 'exam') return '';
  const h = location.hash, E = App.exam, P = App.play;
  let to = '', title = '', sub = '', ico = '▶';
  if (E && (E.phase === 'run' || E.phase === 'grade') && Lib.get(E.sid)) {
    to = L('s', E.sid, 'exam', E.phase); ico = '📝'; title = '시험 이어서 보기';
    sub = Lib.get(E.sid).name + ' · ' + (E.phase === 'grade' ? '서술형 채점 중' : E.dur ? `남은 시간 ${timerInfo(E).text} (멈춤)` : `${E.qs.filter((q, i) => Grade.answered(q, E.resp[i])).length}/${E.qs.length} 답함`);
  } else if (P && P.idx < P.qs.length && Lib.get(P.sid)) {
    to = P.kind === 'drill' ? L('s', P.sid, 'drill', P.uid) : L('s', P.sid, 'practice');
    title = '이어서 풀기'; sub = `${P.title} · ${P.idx + 1}/${P.qs.length}`;
  }
  if (!to || h === to) return '';
  return `<div class="resume-fab"><button class="rf-main" data-act="go" data-to="${to}"><span class="rf-ico">${ico}</span>
    <span class="rf-t"><b>${title}</b><small>${esc(sub)}</small></span></button>
    <button class="rf-x" data-act="dropSession" aria-label="그만 풀기">✕</button></div>`;
}
function topBar(crumb) {
  const p = Profiles.cur;
  const home = !location.hash || location.hash === '#/' || location.hash === '#/login';
  return `<header class="bar"><div class="wrap">
    ${home ? '' : '<button class="btn back" data-act="back" aria-label="이전 화면으로">←</button>'}
    <button class="logo" data-act="go" data-to="${p ? '#/' : '#/login'}" aria-label="스스로 홈"><img class="logo-img" src="icons/icon-64.png" alt=""><span class="logo-t" data-notr>스스로</span></button>
    <div class="crumb">${crumb}</div>
    ${p ? (() => { const lv = XP.level(), tot = XP.get().total; return `<div class="hud" aria-label="오늘의 학습 현황">
      <span class="hud-i twr" title="공부 탑: 연속으로 공부한 날만큼 층이 올라가요">🧱<b>${Prog.streak()}</b><small>층</small></span>
      <span class="hud-i xp hide-sm" title="오늘 얻은 XP / 하루 목표">⚡<b id="hudXp">${XP.today()}</b><small>/${XP.goal()}</small></span>
      <span class="hud-i lv" title="레벨과 다음 레벨까지 경험치"><span>Lv.<b>${lv.lv}</b></span>
        <span class="hud-exp"><span class="hud-bar"><i style="width:${lv.pct}%"></i></span><small><b>${tot - lv.from}</b>/${lv.to - lv.from} XP</small></span></span></div>`; })() : ''}
    <button class="btn" data-act="themeToggle" aria-expanded="${App.ui.themeOpen}" aria-label="테마">🎨</button>
    <button class="btn" data-act="openGuide" aria-label="사용 설명서" title="사용 설명서">📖</button>
    <button class="btn" data-act="go" data-to="#/settings" aria-label="설정" title="설정">⚙️</button>
    ${p ? `<button class="btn me" data-act="go" data-to="#/profile" aria-label="내 프로필">${avatar(p, 'sm')}<span class="hide-sm" data-notr>${esc(p.name)}</span></button>` : ''}
  </div>${App.ui.themeOpen ? themePop() : ''}</header>`;
}

function render() {
  const r = route();
  let out;
  try { out = dispatch(r); }
  catch (e) {
    console.error(e);
    out = { crumb: '오류', body: `<div class="page wrap"><div class="notice err">화면을 그리다 문제가 생겼어요: ${esc(e.message)}</div><div><button class="btn" data-act="go" data-to="#/">홈으로</button></div></div>` };
  }
  if (out.redirect) { history.replaceState(null, '', out.redirect); lastHash = location.hash; return render(); }
  App.ctx = out.ctx || null;
  $app.innerHTML = (out.bar ?? topBar(out.crumb || '')) + `<main>${out.body}</main>` + (out.overlay || '') + (out.overlay ? '' : resumeFab()) + guideBook();
  I18N.apply($app);
  if (out.after) out.after();
  Session.save();
}

/* ---------- 사용 설명서: 책처럼 한 장씩 넘기는 창 ---------- */
function guideBook() {
  if (App.ui.guide == null) return '';
  const pages = GUIDE[I18N.lang] || GUIDE.ko, ui = GUIDE_UI[I18N.lang] || GUIDE_UI.ko;
  const i = U.clamp(App.ui.guide, 0, pages.length - 1), [ico, title, body] = pages[i], last = i === pages.length - 1;
  return `<div class="overlay guide-ov" data-act="guideClose" data-notr>
    <div class="book" role="dialog" aria-modal="true" aria-label="${ui.title}">
      <div class="book-top"><span class="hint">${ui.title}</span><button class="book-x" data-act="guideClose" aria-label="${ui.close}">✕</button></div>
      <div class="book-page" data-swipe="guide"><div class="book-ico">${ico}</div><h2>${esc(title)}</h2><p>${esc(body).replace(/\n/g, '<br>')}</p></div>
      <div class="book-dots">${pages.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="book-nav"><button class="btn" data-act="guidePrev" ${i === 0 ? 'disabled' : ''}>${ui.prev}</button>
        <span class="mono hint">${i + 1} / ${pages.length}</span>
        <button class="btn primary" data-act="${last ? 'guideDone' : 'guideNext'}">${last ? ui.done : ui.next}</button></div>
    </div></div>`;
}

/* ---------- 설정: 글자 크기 · 언어 ---------- */
function vSettings() {
  const fs = LS.get('fontSize', 'm');
  const FS_LABEL = { s: '작게', m: '보통', l: '크게', xl: '아주 크게' };
  return {
    crumb: '설정',
    body: `<div class="page wrap" style="max-width:720px"><h1 style="font-size:24px">설정</h1>
      <section class="panel stack"><h2>글자 크기</h2>
        <div class="seg">${FONT_SIZES.map(([k]) => `<button data-act="setFont" data-v="${k}" aria-pressed="${fs === k}">${FS_LABEL[k]}</button>`).join('')}</div>
        <p class="hint sample-text" style="margin:0">가나다라 ABC 123</p></section>
      <section class="panel stack"><h2>언어</h2>
        <div class="seg" data-notr>${LANGS.map(([k, l]) => `<button data-act="setLang" data-v="${k}" aria-pressed="${I18N.lang === k}">${l}</button>`).join('')}</div></section>
      <section class="panel row between"><div><b>사용 설명서</b></div><button class="btn" data-act="openGuide">📖</button></section>
    </div>`,
  };
}

function dispatch(r) {
  if (r[0] === 'settings') return vSettings();
  if (r[0] === 'login') return r[1] === 'new' ? vProfileForm(null) : vLogin();
  if (!Profiles.cur) return { redirect: '#/login' };
  if (r[0] === 'profile') return r[1] === 'edit' ? vProfileForm(Profiles.cur) : vProfile();
  if (!r.length) return vHome();
  if (r[0] === 'study') return vStudy();
  if (r[0] === 'manage') {
    if (r[1] === 'new') return vSubjNew();
    const s = r[2] && Lib.get(r[2]);
    if (r[1] === 'edit' && s) return vSubjEdit(s);
    return vManage();
  }
  if (r[0] === 's') {
    const s = Lib.get(r[1]);
    if (!s) return { crumb: '과목 없음', body: `<div class="page wrap"><div class="empty">과목을 찾을 수 없어요.</div><div><button class="btn" data-act="go" data-to="#/study">과목 목록</button></div></div>` };
    const [, , mode, sub] = r;
    if (!s.materials.length && mode !== undefined) return { redirect: L('s', s.id) };
    if (!mode) return s.materials.length ? { redirect: L('s', s.id, 'concept') } : vNoMaterial(s);
    if (mode === 'concept') return sub ? vConceptUnit(s, sub) : vConcept(s);
    if (mode === 'drill') return vDrill(s, sub);
    if (mode === 'gen') return vGen(s);
    if (mode === 'log') return vLog(s);
    if (mode === 'practice') return vPracticeRun(s);
    if (mode === 'exam') {
      const E = App.exam && App.exam.sid === s.id ? App.exam : null;
      if (sub === 'run') { if (E && E.phase === 'run') { resumeExam(); return vExamRun(s, E); } return { redirect: E ? L('s', s.id, 'exam', E.phase) : L('s', s.id, 'gen') }; }
      if (sub === 'grade') return E && E.phase === 'grade' ? vExamGrade(s, E) : { redirect: L('s', s.id, 'gen') };
      if (sub === 'result') return E && E.phase === 'result' ? vExamResult(s, E) : { redirect: L('s', s.id, 'gen') };
      return { redirect: L('s', s.id, 'gen') };
    }
    return { redirect: L('s', s.id, 'concept') };
  }
  return vHome();
}
const crumbOf = (s, ...rest) => ['<span data-notr>' + esc(s.name) + '</span>', ...rest].join(' › ');

/* ================= 프로필 · 로그인 ================= */
function vLogin() {
  const list = Profiles.all();
  const P = App.ui.pinFor && Profiles.get(App.ui.pinFor);
  const overlay = P ? `<div class="overlay" data-act="dlgClose"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pinT">
      <div class="row">${avatar(P, 'md')}<h3 id="pinT">${esc(P.name)}님의 PIN</h3></div>
      <input id="pinIn" class="input pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="● ● ● ●" aria-label="PIN 4자리">
      <p class="hint" id="pinMsg"></p>
      <div class="row end"><button class="btn" data-act="pinCancel">취소</button><button class="btn primary" data-act="pinOk">로그인</button></div></div></div>` : '';
  return {
    bar: topBar(''),
    body: `<div class="page wrap" style="max-width:860px">
      <section class="hero login-hero"><img class="hero-logo" src="icons/logo.png" alt="스스로 SSRO 로고"><h1>${list.length ? '누가 공부하나요?' : '스스로에 오신 걸 환영해요'}</h1>
        <p>${list.length ? '프로필을 골라 로그인하세요. 프로필마다 과목과 학습 기록이 따로 저장돼요.' : '강의자료만 올리면 개념 정리부터 문제·시험까지 자동으로 만들어 주는 자기주도학습 앱이에요. 먼저 프로필을 만들어 주세요.'}</p></section>
      ${list.length ? `<div class="pgrid">${list.map(p => `<button class="pcard" data-act="pickProfile" data-id="${esc(p.id)}">${avatar(p, 'lg')}
          <b data-notr>${esc(p.name)}</b><span class="hint" data-notr>${esc([p.school, p.major].filter(Boolean).join(' · ') || '　')}</span>${p.pin ? '<span class="chip">🔒 PIN</span>' : ''}</button>`).join('')}
        <button class="pcard add" data-act="go" data-to="#/login/new"><span class="av lg plus">＋</span><b>새 프로필</b><span class="hint">　</span></button></div>`
        : `<div><button class="btn primary" data-act="go" data-to="#/login/new">프로필 만들기</button></div>`}
      <div class="panel row between"><div><b>다른 기기에서 쓰던 기록이 있나요?</b><br><span class="hint">프로필 화면에서 내보낸 백업 파일을 불러오면 과목·자료·기록이 그대로 옮겨져요.</span></div>
        <label class="btn" style="cursor:pointer">📂 백업 파일 불러오기<input type="file" accept=".json,application/json" data-ch="restore" hidden></label></div>
      <p class="hint">모든 정보는 이 기기 안에만 저장되고, 어디로도 전송되지 않아요.</p>
    </div>`,
    overlay,
  };
}

function vProfileForm(p) {
  if (!App.ui.pf || App.ui.pf.for !== (p ? p.id : null)) {
    App.ui.pf = p ? { for: p.id, name: p.name, school: p.school, major: p.major, grade: p.grade, motto: p.motto, avatar: p.avatar, photo: p.photo, color: p.color, pin: '', clearPin: false }
      : { for: null, name: '', school: '', major: '', grade: '', motto: '', avatar: '🦊', photo: '', color: '#2f6f66', pin: '', clearPin: false };
  }
  const F = App.ui.pf;
  const field = (k, l, ph = '', extra = '') => `<label class="field"><span class="label">${l}</span><input type="text" value="${esc(F[k])}" placeholder="${ph}" data-in="pf" data-k="${k}" ${extra}></label>`;
  return {
    bar: topBar(p ? '프로필 › 정보 수정' : '새 프로필'),
    body: `<div class="page wrap" style="max-width:720px">
      <h1 style="font-size:24px">${p ? '프로필 수정' : '새 프로필 만들기'}</h1>
      <section class="panel stack">
        <div class="row" style="gap:16px">${avatar(F, 'xl')}<div class="stack" style="gap:8px;flex:1;min-width:220px">
          <div class="label" style="margin:0">아바타</div>
          <div class="avpick">${AVATARS.map(a => `<button data-act="pfAvatar" data-v="${a}" aria-pressed="${!F.photo && F.avatar === a}">${a}</button>`).join('')}</div>
          <div class="row"><label class="btn sm" style="cursor:pointer">📷 사진으로<input type="file" accept="image/*" data-ch="pfPhoto" hidden></label>
            ${F.photo ? '<button class="btn sm ghost" data-act="pfPhotoDel">사진 지우기</button>' : ''}</div>
          <div class="label" style="margin:4px 0 0">색</div>
          <div class="colpick">${COLORS.map(c => `<button data-act="pfColor" data-v="${c}" style="background:${c}" aria-pressed="${F.color === c}" aria-label="색 ${c}"></button>`).join('')}</div>
        </div></div>
        ${field('name', '이름 (필수)', '예: 김스스', 'maxlength="20"')}
        <div class="grid2">${field('school', '학교', '예: 울산과학대학교')}${field('major', '학과', '예: 화학공학과')}</div>
        <div class="grid2"><label class="field"><span class="label">학년</span><select data-in="pf" data-k="grade">
          ${['', '1학년', '2학년', '3학년', '4학년', '졸업·기타'].map(g => `<option value="${g}" ${F.grade === g ? 'selected' : ''}>${g || '선택 안 함'}</option>`).join('')}</select></label>
          ${field('motto', '한 줄 목표', '예: 이번 학기 전과목 A!', 'maxlength="40"')}</div>
        <label class="field"><span class="label">${p ? (p.pin ? 'PIN 바꾸기 (비우면 그대로)' : 'PIN 만들기 (선택)') : 'PIN 4자리 (선택)'}</span>
          <input type="password" inputmode="numeric" maxlength="4" value="" placeholder="숫자 4자리" data-in="pf" data-k="pin" autocomplete="new-password"></label>
        ${p && p.pin ? `<label class="row" style="gap:6px"><input type="checkbox" data-in="pfClear" ${F.clearPin ? 'checked' : ''}> PIN 없애기</label>` : ''}
        <p class="hint">PIN은 같은 기기를 함께 쓰는 사람끼리 프로필을 구분하는 간단한 잠금이에요.</p>
        <div class="row end">${p ? '<button class="btn" data-act="go" data-to="#/profile">취소</button>' : Profiles.all().length ? '<button class="btn" data-act="go" data-to="#/login">취소</button>' : ''}
          <button class="btn primary" data-act="pfSave">${p ? '저장' : '프로필 만들고 시작'}</button></div>
      </section></div>`,
  };
}

function vProfile() {
  const p = Profiles.cur;
  let seen = 0, ok = 0, exams = 0, best = 0;
  Lib.list.forEach(s => { const st = Prog.subjStat(s); seen += st.seen; ok += st.ok; exams += st.exams; best = Math.max(best, st.best); });
  const days = new Set(Prog.days());
  const cal = [];
  for (let i = 27; i >= 0; i--) { const d = U.day(Date.now() - i * 86400000); cal.push(`<i class="${days.has(d) ? 'on' : ''}" title="${d}"></i>`); }
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  const cur = document.documentElement.dataset.theme;
  return {
    crumb: '내 프로필',
    body: `<div class="page wrap" style="max-width:900px">
      <section class="panel prof">${avatar(p, 'xl')}<div class="stack" style="gap:4px">
          <h1 style="font-size:26px" data-notr>${esc(p.name)}</h1>
          <div class="muted">${esc([p.school, p.major, p.grade].filter(Boolean).join(' · ') || '학교·학과를 등록해 보세요')}</div>
          ${p.motto ? `<div class="motto" data-notr>“${esc(p.motto)}”</div>` : ''}
          <div class="row" style="margin-top:6px"><button class="btn sm" data-act="go" data-to="#/profile/edit">정보 수정</button>
            <span class="chip twr">🧱 공부 탑 ${Prog.streak()}층</span><span class="chip">가입 ${U.day(p.createdAt)}</span></div></div></section>
      ${towerCard()}
      <div class="stats">${stat(Lib.list.length, '과목')}${stat(seen, '푼 문제')}${stat(seen ? U.pct(ok, seen) + '%' : '–', '정답률')}${stat(exams, '시험 응시')}${stat(exams ? fmt(best) + '점' : '–', '최고 점수')}${stat(days.size, '총 공부한 날')}</div>
      <section class="panel"><h2>최근 4주 공부 기록</h2><div class="cal">${cal.join('')}</div><p class="hint" style="margin-top:8px">문제를 풀거나 단원 학습을 완료한 날이 칠해져요.</p></section>
      ${goalCard()}
      <section class="panel"><h2>이번 주 XP</h2>${(() => {
        const w = XP.week(), mx = Math.max(XP.goal(), ...w.map(x => x.xp));
        return `<div class="weekxp">${w.map(x => `<div><span class="mono">${x.xp}</span><i style="height:${Math.max(4, x.xp / mx * 100)}%" class="${x.xp >= XP.goal() ? 'hit' : ''}"></i>
          <small>${'일월화수목금토'[x.d.getDay()]}</small></div>`).join('')}</div>`;
      })()}</section>
      <section class="panel stack"><h2>학습 설정</h2>
        <div><div class="label">하루 목표</div><div class="seg">${[[30, '가볍게 30'], [50, '보통 50'], [100, '열심히 100'], [200, '불타게 200']].map(([v, l]) => `<button data-act="setGoal" data-v="${v}" aria-pressed="${XP.goal() === v}">${l} XP</button>`).join('')}</div></div>
        <label class="row" style="gap:8px"><input type="checkbox" data-in="sound" ${Sfx.on() ? 'checked' : ''}> <b>효과음·진동</b> <span class="hint">정답·오답·레벨업 소리</span></label></section>
      <section class="panel"><h2>화면 테마</h2><div class="themes">${THEMES.map(([id, name, d, c]) => `
        <button class="theme-opt" data-act="theme" data-v="${id}" aria-pressed="${cur === id}"><span class="swatch">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span><span><b>${name}</b><span>${d}</span></span></button>`).join('')}</div></section>
      <section class="panel stack"><h2>데이터</h2>
        <p class="hint" style="margin:0">기록은 이 기기 브라우저에만 저장돼요. 다른 기기로 옮기거나 보관하려면 백업 파일을 내보내세요. 로그인 화면에서 불러올 수 있어요.</p>
        <div class="row"><button class="btn" data-act="backup">💾 백업 파일 내보내기</button>
          <button class="btn" data-act="logout">로그아웃</button>
          <button class="btn danger" data-act="profileDel">프로필 삭제</button></div></section>
    </div>`,
  };
}

/* ================= 홈 · 과목 고르기 ================= */
function vHome() {
  const p = Profiles.cur, subs = Lib.list;
  let seen = 0, ok = 0, wrong = 0, last = null;
  subs.forEach(s => { const st = Prog.subjStat(s); seen += st.seen; ok += st.ok; wrong += Prog.wrong(s.id).length; if (st.last && (!last || st.last > last.t)) last = { s, t: st.last }; });
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  return {
    crumb: '',
    body: `<div class="page wrap">
      <section class="hero"><h1><span data-notr>${esc(p.name)}</span>님, 오늘도 스스로!</h1>
        <p>${p.motto ? '<span data-notr>“' + esc(p.motto) + '”</span>' : '강의자료만 올리면 개념 정리부터 문제·시험까지 자동으로 만들어져요.'}</p></section>
      <div class="gate">
        <button class="gate-btn main" data-act="go" data-to="#/study"><span class="ico">📚</span><b>공부하기</b>
          <span>과목 ${subs.length}개 · 개념 정리 · 문제 생성 · 기록 보기</span></button>
        <button class="gate-btn" data-act="go" data-to="#/manage"><span class="ico">🗂️</span><b>과목 추가·수정</b>
          <span>과목을 만들고 강의자료(PDF·PPT·한글·워드·텍스트)를 올려요</span></button>
      </div>
      ${!subs.length ? `<div class="panel row between"><div><b>아직 과목이 없어요</b><br><span class="hint">과목 이름을 정하고 강의자료를 올리면 바로 공부를 시작할 수 있어요.</span></div>
        <button class="btn primary" data-act="go" data-to="#/manage/new">첫 과목 만들기 →</button></div>` : ''}
      ${last ? `<div class="panel row between"><div><div class="label">이어서 공부하기</div><b data-notr>${esc(last.s.name)}</b><span class="hint"> · 마지막 학습 ${U.date(last.t)}</span></div>
        <button class="btn primary" data-act="go" data-to="${L('s', last.s.id)}">계속하기 →</button></div>` : ''}
      <div class="home-duo">${goalCard()}${towerCard()}</div>
      <div class="stats">${stat('🧱 ' + Prog.streak() + '층', '공부 탑')}${stat(seen, '푼 문제')}${stat(seen ? U.pct(ok, seen) + '%' : '–', '정답률')}${stat(wrong, '다시 볼 오답')}</div>
    </div>`,
  };
}
// 공부 탑: 연속으로 공부한 날마다 블록이 한 층씩 쌓임. 하루라도 쉬면 새 탑부터 다시
function towerCard() {
  const n = Prog.streak(), best = Prog.best(), today = Prog.days().includes(U.day());
  const SHOW = 10, shown = Math.min(n, SHOW);
  const COLS = ['#e8845a', '#f2b33d', '#6cbf6a', '#4fa3e0', '#9a7be0', '#e0679a'];
  let blocks = '';
  for (let i = shown - 1; i >= 0; i--) {
    const floor = n - shown + i + 1;
    blocks += `<div class="blk ${i === shown - 1 && today ? 'new' : ''}" style="--c:${COLS[(floor - 1) % COLS.length]}"><span>${floor}층</span></div>`;
  }
  const msg = !n ? '오늘 공부하면 첫 층이 생겨요!' : today ? '오늘 한 층 올렸어요! 내일도 이어서 쌓아요.' : '오늘 공부하면 한 층 더 올라가요. 쉬면 탑이 무너져요!';
  return `<section class="panel towercard">
    <div class="tower" aria-hidden="true">${today ? '<div class="flag">🚩</div>' : `<div class="blk ghost"><span>+1</span></div>`}${blocks}${n > SHOW ? `<div class="blk more"><span>⋮ ${n - SHOW}층 더</span></div>` : ''}<div class="base"></div></div>
    <div class="stack" style="gap:6px;flex:1;min-width:160px">
      <div class="label" style="margin:0">공부 탑</div>
      <div class="tower-n"><b>${n}</b>층</div>
      <p class="hint" style="margin:0">${msg}</p>
      <span class="chip" style="justify-self:start">🏆 최고 기록 ${best}층</span></div></section>`;
}
function goalCard() {
  const t = XP.today(), g = XP.goal(), pc = Math.min(100, Math.round(t / g * 100)), L2 = XP.level();
  return `<section class="panel goal">
    <div class="ring" style="--p:${pc}"><div><b>${t}</b><small>/ ${g} XP</small></div></div>
    <div class="stack" style="gap:8px;flex:1;min-width:200px">
      <div class="row between"><b style="font-size:18px">${t >= g ? '🎯 오늘 목표 달성!' : '오늘의 목표'}</b><span class="chip twr">🧱 ${Prog.streak()}층</span></div>
      <p class="hint" style="margin:0">${t >= g ? '목표를 채웠어요. 더 하면 레벨이 빨리 올라요!' : `${g - t} XP만 더 얻으면 목표 달성! 문제 하나 맞히면 10 XP예요.`}</p>
      <div class="row between" style="margin-top:4px"><b>Lv.${L2.lv}</b><span class="hint">${XP.get().total - L2.from} / ${L2.to - L2.from} XP</span></div>
      <div class="lvbar"><i style="width:${L2.pct}%"></i></div></div></section>`;
}
function subjCard(s) {
  const st = Prog.subjStat(s), weak = Prog.weakUnits(s, 1)[0];
  return `<button class="scard" data-act="go" data-to="${L('s', s.id)}">
    <h3 data-notr>${esc(s.name)}</h3>${s.desc ? `<p class="hint" data-notr>${esc(s.desc)}</p>` : ''}
    <div class="meta"><span class="chip">자료 ${s.materials.length}</span><span class="chip">학습 완료 ${st.learned}/${st.units}</span>${st.exams ? `<span class="chip">시험 ${st.exams}회</span>` : ''}</div>
    <div class="prog"><i class="g" style="width:${U.pct(st.ok, Math.max(st.seen, 1))}%"></i><i class="r" style="width:${U.pct(st.wrong, Math.max(st.seen, 1))}%"></i></div>
    <div class="kv"><span>푼 문제 ${st.seen}</span><span>정답률 ${st.acc == null ? '–' : Math.round(st.acc * 100) + '%'}</span></div>
    ${weak ? `<div><span class="chip bad">약한 단원 · ${esc(weak.u.title)}</span></div>` : ''}</button>`;
}
function vStudy() {
  return {
    crumb: '공부하기',
    body: `<div class="page wrap"><div class="row between"><h1 style="font-size:24px">어떤 과목을 공부할까요?</h1>
        <button class="btn sm" data-act="go" data-to="#/manage/new">＋ 새 과목</button></div>
      ${Lib.list.length ? `<div class="sgrid">${Lib.list.map(subjCard).join('')}</div>`
        : `<div class="empty">아직 과목이 없어요.<br><br><button class="btn primary" data-act="go" data-to="#/manage/new">첫 과목 만들기</button></div>`}</div>`,
  };
}

/* ================= 과목 화면: 탭 ================= */
function subjHead(s, tab) {
  const t = (id, l) => `<button data-act="go" data-to="${L('s', s.id, id)}" aria-current="${tab === id ? 'page' : 'false'}">${l}</button>`;
  return `<div class="subj-head"><div class="row between"><div class="stack" style="gap:2px"><button class="btn ghost sm" style="justify-self:start" data-act="go" data-to="#/study">← 과목 목록</button>
      <h1 data-notr>${esc(s.name)}</h1></div><button class="btn sm" data-act="go" data-to="${L('manage', 'edit', s.id)}">자료 추가·수정</button></div>
    <nav class="tabs" aria-label="과목 메뉴">${t('concept', '📖 개념 정리')}${t('gen', '✏️ 문제 생성')}${t('log', '📊 기록 보기')}</nav></div>`;
}
function vNoMaterial(s) {
  return {
    crumb: crumbOf(s),
    body: `<div class="page wrap">${subjHead(s, '')}<div class="empty">이 과목에는 아직 자료가 없어요.<br><br>
      <button class="btn primary" data-act="go" data-to="${L('manage', 'edit', s.id)}">자료 올리기</button></div></div>`,
  };
}

/* ---------- 개념 정리 ---------- */
function vConcept(s) {
  const p = Prog.of(s.id);
  return {
    crumb: crumbOf(s, '개념 정리'),
    body: `<div class="page wrap">${subjHead(s, 'concept')}
      ${unitPath(s, p)}</div>`,
  };
}
// 단원 길: 지그재그로 이어진 동그란 단계 버튼. 학습 완료 = 금색, 다음 할 단원 = 강조 + "시작!" 말풍선
function unitPath(s, p) {
  const OFF = [0, 1, 2, 1, 0, -1, -2, -1];
  const cur = s.materials.findIndex(m => !p.learned[m.id]);
  const weak = new Set(Prog.weakUnits(s).map(w => w.u.id));
  const nodes = s.materials.map((m, i) => {
    const us = Prog.unitStat(s, m.id);
    const st = p.learned[m.id] ? 'done' : i === cur ? 'cur' : 'todo';
    return `<div class="node-row" style="--off:${OFF[i % 8]}">
      ${st === 'cur' ? '<div class="bubble">시작!</div>' : ''}
      <button class="node ${st} ${weak.has(m.id) ? 'weak' : ''}" data-act="go" data-to="${L('s', s.id, 'concept', m.id)}" aria-label="단원 ${i + 1} ${esc(m.name)}">${st === 'done' ? '✓' : i + 1}</button>
      <div class="node-label"><b data-notr>${esc(m.name)}</b><small>${us.acc == null ? `개념 카드 ${m.sections.length}장` : `정답률 ${Math.round(us.acc * 100)}%${weak.has(m.id) ? ' · 약점' : ''}`}</small></div></div>`;
  }).join('');
  const allDone = s.materials.every(m => p.learned[m.id]);
  return `<div class="path-intro"><b>단원 ${s.materials.length}개 중 ${s.materials.filter(m => p.learned[m.id]).length}개 완료</b>
      <span class="hint">단원을 눌러 개념을 정리하고 개념 문제(10~20문항)를 풀어 보세요. 다 풀면 [학습 완료]로 금색이 돼요.</span></div>
    <div class="path">${nodes}
      <div class="node-row" style="--off:${OFF[s.materials.length % 8]}">
        <button class="node chest ${allDone ? 'cur' : ''}" data-act="pathExam" data-sid="${esc(s.id)}" aria-label="실력 점검 시험">🏆</button>
        <div class="node-label"><b>실력 점검 시험</b><small>전체 단원 CBT</small></div></div></div>`;
}
function vConceptUnit(s, uid) {
  const m = s.materials.find(x => x.id === uid) || s.materials[0];
  const i = s.materials.indexOf(m), p = Prog.of(s.id);
  const info = Gen.unitInfo(s, m.id);
  const lim = App.ui.cardLimit[m.id] || 20;
  const prev = s.materials[i - 1], next = s.materials[i + 1];
  const label = sec => sec.title ? esc(sec.title) : (m.kind === 'pptx' ? '슬라이드 ' : m.kind === 'pdf' ? '' : '') + (sec.page ? (m.kind === 'pdf' ? sec.page + '쪽' : sec.page) : '내용');
  return {
    crumb: crumbOf(s, '개념 정리'),
    body: `<div class="page wrap">${subjHead(s, 'concept')}<div class="learn">
      <nav class="toc" aria-label="단원 목록">${s.materials.map((x, j) => `<button data-act="go" data-to="${L('s', s.id, 'concept', x.id)}" aria-current="${x.id === m.id}">
        <span class="n">${String(j + 1).padStart(2, '0')}</span><span data-notr>${esc(x.name)}</span><span class="ck">${p.learned[x.id] ? '✓' : ''}</span></button>`).join('')}</nav>
      <div class="stack">
        <select data-notr class="input only-sm" data-ch="conceptUnit" data-sid="${esc(s.id)}" aria-label="단원 고르기">${s.materials.map((x, j) => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${j + 1}. ${esc(x.name)}${p.learned[x.id] ? ' ✓' : ''}</option>`).join('')}</select>
        <div class="stack" style="gap:6px"><div class="row" style="gap:6px"><span class="chip acc">단원 ${i + 1}</span><span class="chip">${KIND[m.kind] || m.kind}</span><span class="chip">개념 카드 ${m.sections.length}</span><span class="chip">문장 ${info.facts}</span></div>
          <h1 style="font-size:clamp(21px,3.4vw,27px)" data-notr>${esc(m.name)}</h1></div>
        <div class="drillbox"><div><b>✏️ 이 단원 개념 문제 풀기</b><br><span class="hint">이 단원 자료에서 랜덤으로 10~20문항을 만들어 바로 채점·해설해요.</span></div>
          <button class="btn primary" data-act="go" data-to="${L('s', s.id, 'drill', m.id)}">문제 풀기 →</button></div>
        ${info.top.length ? `<div class="card"><h3>핵심 용어</h3><div class="row" style="gap:6px">${info.top.map(t => `<span class="chip acc">${esc(t)}</span>`).join('')}</div></div>` : ''}
        ${info.defs.length ? `<div class="memo"><span class="h">용어 정리</span><ul>${info.defs.slice(0, 15).map(d => `<li><b>${esc(d.term)}</b> — ${esc(d.desc)}</li>`).join('')}</ul></div>` : ''}
        ${m.sections.slice(0, lim).map(sec0 => { const sec = { ...sec0, title: Extract.tidy(sec0.title), lines: sec0.lines.map(Extract.tidy).filter(Boolean) };
          return `<article class="card" data-notr><h3>${label(sec)}</h3>
          ${sec.lines.length ? `<ul>${sec.lines.map(l => `<li>${Gen.highlight(info.A, l).replace(/\[수식\]/g, '<span class="eqmark" title="' + I18N.str('원본의 수식은 앱에서 표시할 수 없어요') + '">' + I18N.str('수식') + '</span>')}</li>`).join('')}</ul>` : '<p class="hint">(제목만 있는 쪽)</p>'}</article>`; }).join('')}
        ${m.sections.length > lim ? `<button class="btn" data-act="moreCards" data-k="${esc(m.id)}">카드 더 보기 (${m.sections.length - lim}장 남음)</button>` : ''}
        <div class="row">
          <button class="btn ${p.learned[m.id] ? '' : 'primary'}" data-act="learned" data-sid="${esc(s.id)}" data-uid="${esc(m.id)}">${p.learned[m.id] ? '✓ 학습 완료됨 (취소)' : '이 단원 학습 완료'}</button>
          <button class="btn" data-act="go" data-to="${L('s', s.id, 'drill', m.id)}">개념 문제 풀기 →</button></div>
        <div class="row between">
          ${prev ? `<button class="btn ghost" data-act="go" data-to="${L('s', s.id, 'concept', prev.id)}">← ${esc(prev.name)}</button>` : '<span></span>'}
          ${next ? `<button class="btn ghost" data-act="go" data-to="${L('s', s.id, 'concept', next.id)}">${esc(next.name)} →</button>` : `<button class="btn ghost" data-act="go" data-to="${L('s', s.id, 'gen')}">문제 생성으로 →</button>`}</div>
      </div></div></div>`,
  };
}

/* ================= 문제 표시 (공통) ================= */
function initResp(q) { return q.type === 'blank' ? [] : q.type === 'short' ? '' : null; }
function qHead(s, q, no) {
  const u = s.uById[q.unit];
  return `<div class="qhead"><span class="qno">${no}.</span><span class="chip">${TYPES[q.type]}</span><span class="chip d${q.diff}">${DIFF[q.diff]}</span>
    ${u ? `<span class="chip" data-notr>${esc(u.title)}</span>` : ''}${q.src ? `<span class="chip" data-notr>${esc(q.src.length > 30 ? q.src.slice(0, 29) + '…' : q.src)}</span>` : ''}</div>`;
}
// mode: 'study'(바로 채점) · 'exam'(채점 안 보임) · 'review'(읽기 전용 + 채점 표시)
function qBody(q, st, mode) {
  const fb = mode !== 'exam' && st.checked;
  const lock = mode === 'review' || (mode === 'study' && st.checked);
  let h = `<div class="stem">${q.q}</div>`;
  if (q.type === 'mc') {
    h += `<div class="opts">${q.options.map((o, i) => {
      const picked = st.resp === i, isA = q.answer === i;
      let cls = 'opt';
      if (fb) { if (isA) cls += ' ok'; else if (picked) cls += ' bad'; }
      return `<button class="${cls}" data-act="pick" data-i="${i}" aria-pressed="${!fb && picked}" ${lock ? 'disabled' : ''}><span class="mk">${i + 1}</span><span data-notr>${o}</span></button>`;
    }).join('')}</div>`;
  }
  if (q.type === 'ox') {
    h += `<div class="oxs">${[true, false].map(v => {
      let cls = 'opt ox';
      if (fb) { if (q.answer === v) cls += ' ok'; else if (st.resp === v) cls += ' bad'; }
      return `<button class="${cls}" data-act="pick" data-i="${v ? 0 : 1}" aria-pressed="${!fb && st.resp === v}" ${lock ? 'disabled' : ''}><span class="mk">${v ? 'O' : 'X'}</span><span>${v ? '맞다' : '틀리다'}</span></button>`;
    }).join('')}</div>`;
  }
  if (q.type === 'blank') {
    const each = fb ? Grade.blankEach(q, st.resp) : null;
    h += `<div class="bins">${q.blanks.map((_, i) => `<label class="bin"><span>${CIRC[i]}</span>
      <input data-in="blank" data-i="${i}" value="${esc((st.resp || [])[i] || '')}" class="${fb ? (each[i] ? 'ok' : 'bad') : ''}" ${lock ? 'disabled' : ''} autocomplete="off" placeholder="${CIRC[i]} 답 입력">
      <b>${fb ? (each[i] ? '✓' : '✗') : ''}</b></label>`).join('')}</div>`;
    if (mode === 'study' && !st.checked) h += `<div class="row" style="margin-top:12px"><button class="btn primary" data-act="check">정답 확인</button><span class="hint">Enter 키로도 확인</span></div>`;
  }
  if (q.type === 'short') {
    h += `<textarea class="ans" data-in="short" placeholder="답안을 직접 써 보세요" ${lock ? 'disabled' : ''}>${esc(st.resp || '')}</textarea>`;
    if (mode === 'study' && !st.checked) h += `<div class="row" style="margin-top:12px"><button class="btn primary" data-act="check">채점 기준으로 판정</button><span class="hint">몰라도 눌러서 모범답안을 볼 수 있어요</span></div>`;
  }
  return h;
}
function judgeBox(q, j, self, act) {
  const vt = { 1: '정답 수준', 0.5: '부분 정답', 0: '오답 수준' }[j.verdict] || '판정할 기준 없음';
  const hits = j.items.filter(r => r.hit).length;
  return `<div class="ai-judge"><div class="t">자동 채점 기준 판정</div>
    <div class="v">${vt} <span class="hint">· 채점 포인트 ${hits}/${j.items.length} 충족</span></div>
    ${j.items.length ? `<ul class="rubric">${j.items.map(r => `<li class="${r.hit ? 'hit' : 'miss'}"><b>${r.hit ? '✓' : '✗'}</b>
      <div><span data-notr>${esc(r.point)}</span><div class="kw">핵심어: <span data-notr>${esc(r.keywords.join('|').split('|').map(x => x.trim()).join(' / '))}</span></div></div><span class="mono">${fmt(r.pts)}점</span></li>`).join('')}</ul>`
      : '<p class="hint">이 문제에는 채점 기준이 없어요. 모범답안과 비교해 직접 채점하세요.</p>'}
    ${act ? `<div class="label" style="margin:4px 0 0">내 최종 채점 (판정을 보고 직접 고르세요)</div>
      <div class="self">${[[1, '맞음'], [0.5, '부분'], [0, '틀림']].map(([v, l]) => `<button data-act="${act}" data-v="${v}" data-q="${esc(q.id)}" aria-pressed="${self === v}">${l}${j.verdict === v ? ' · 자동 판정' : ''}</button>`).join('')}</div>`
      : self != null ? `<div><span class="label">내 최종 채점</span> <span class="chip ${self >= 1 ? 'ok' : self > 0 ? 'warn' : 'bad'}">${scoreWord(self)}</span></div>` : ''}
  </div>`;
}
function explainHTML(q, st, o = {}) {
  let h = '';
  if (q.type === 'short') {
    h += judgeBox(q, st.judge || Grade.judgeShort(q, st.resp), st.self, o.selfAct);
    h += `<div class="model"><b class="label" style="display:block">모범답안 (자료 내용)</b><span data-notr>${q.model}</span></div>`;
  }
  if (q.type === 'mc') {
    h += `<ul class="xlist">${q.options.map((op, i) => {
      const isA = q.answer === i, me = st.resp === i, note = (q.optionNotes || [])[i];
      return `<li class="${isA ? 'is-a' : me ? 'is-me' : ''}"><div class="xh"><b class="mono">${i + 1}</b><span data-notr>${op}</span>
        ${isA ? '<span class="chip ok">정답</span>' : ''}${me && !isA ? '<span class="chip bad">내 선택</span>' : ''}</div>${note ? `<div class="xw">${note}</div>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  if (q.type === 'ox') h += `<div class="exp"><b class="h">정답</b><b style="font-size:19px">${q.answer ? 'O (맞다)' : 'X (틀리다)'}</b></div>`;
  if (q.type === 'blank') h += `<div class="exp"><b class="h">정답</b>${q.blanks.map((a, i) => `<div>${CIRC[i]} <b>${esc(a[0])}</b>${a.length > 1 ? ` <span class="hint">(인정: ${a.slice(1).map(esc).join(', ')})</span>` : ''}</div>`).join('')}</div>`;
  if (q.explain) h += `<div class="exp"><b class="h">해설</b>${q.explain}</div>`;
  return h;
}

/* ================= 풀이 세션 (개념 문제 · 연습) ================= */
function newPlay(s, key, kind, qs, title, extra = {}) { return { sid: s.id, key, kind, qs, idx: 0, st: {}, title, ...extra }; }
function verdictLine(q, st) {
  if (st.checked && q.type === 'short' && st.self == null) return '<div class="verdict part">판정을 보고 맞음·부분·틀림을 골라 주세요</div>';
  return '';
}
function answerText(q) {
  if (q.type === 'mc') return U.plain(q.options[q.answer]);
  if (q.type === 'ox') return I18N.str(q.answer ? 'O (맞다)' : 'X (틀리다)');
  if (q.type === 'blank') return q.blanks.map((a, i) => (q.blanks.length > 1 ? CIRC[i] + ' ' : '') + a[0]).join(', ');
  return '모범답안을 확인해 보세요';
}
// 아래에서 올라오는 정답·오답 띠
function fbSheet(q, st, P) {
  const v = !st.checked ? null : q.type === 'short' ? st.self : st.score;
  if (v == null) return '';
  const cls = v >= 1 ? 'ok' : v > 0 ? 'part' : 'bad', last = P.idx === P.qs.length - 1;
  return `<div class="fb-sheet ${cls}" role="status"><div class="wrap fb-in">
    <div class="fb-ico" aria-hidden="true">${v >= 1 ? '✓' : v > 0 ? '△' : '✕'}</div>
    <div class="fb-txt"><b>${esc(st.msg || '')}</b>${st.xp ? `<span class="xpchip">+${st.xp} XP</span>` : ''}${v >= 1 && st.combo >= 3 ? `<span class="combo">✨ ${st.combo}연속 정답!</span>` : ''}
      ${v < 1 ? `<div class="fb-ans">정답: <b data-notr>${esc(answerText(q))}</b></div>` : ''}</div>
    <button class="btn big ${cls === 'bad' ? 'bad-solid' : cls === 'part' ? 'part-solid' : 'primary'}" data-act="next" autofocus>${last ? '결과 보기' : '계속'}</button></div></div>`;
}
function vPlay(s, P, extra, crumb, tab) {
  const n = P.qs.length;
  const done = P.qs.filter((_, i) => P.st[i] && P.st[i].checked).length;
  const head = `${subjHead(s, tab)}<div class="stack" style="gap:8px"><div class="row between"><h2 style="font-size:19px">${esc(P.title)}</h2>
    <span class="mono hint">${Math.min(P.idx + 1, n)} / ${n}</span></div><div class="pbar big"><i style="width:${n ? done / n * 100 : 0}%"></i></div>${extra || ''}</div>`;
  if (!n) return { crumb, body: `<div class="page wrap">${head}<div class="empty">만들 수 있는 문제가 없어요. 자료에 문장이 더 필요해요.</div></div>` };
  if (P.idx >= n) return { crumb, body: `<div class="page wrap">${head}${playDone(s, P)}</div>`, after: P.celebrate ? celebrate(P) : null };
  const q = P.qs[P.idx];
  const st = P.st[P.idx] || (P.st[P.idx] = { resp: initResp(q) });
  const sheet = fbSheet(q, st, P);
  const wait = { mc: '보기를 고르면 바로 정답과 보기별 해설이 나와요.', ox: 'O 또는 X를 고르면 바로 해설이 나와요.', blank: '빈칸을 채우고 [정답 확인]을 누르세요.', short: '답안을 쓰고 [채점 기준으로 판정]을 누르면, 자료의 핵심어로 판정한 뒤 직접 최종 채점을 해요.' }[q.type];
  return {
    crumb, ctx: 'play',
    body: `<div class="page wrap">${head}
      <div class="solve"><section class="qcard">${qHead(s, q, P.idx + 1)}${qBody(q, st, 'study')}${verdictLine(q, st)}
          <div class="qnav"><button class="btn" data-act="prev" ${P.idx === 0 ? 'disabled' : ''}>← 이전</button>
            ${sheet ? '' : `<button class="btn ghost" data-act="next">${P.idx === n - 1 ? '결과 보기' : st.checked ? '다음 →' : '건너뛰기 →'}</button>`}</div></section>
        <aside class="sx" aria-live="polite"><div class="row between"><b>해설</b><span class="hint">← → 키로 이동</span></div>
          ${st.checked ? explainHTML(q, st, { selfAct: 'self' }) : `<div class="sx-wait">${wait}</div>`}</aside></div>
      ${sheet ? '<div class="sheet-space"></div>' : ''}</div>`,
    overlay: sheet,
  };
}
// 끝까지 풀었을 때 꽃가루
function celebrate(P) {
  return () => {
    P.celebrate = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#ffc800', '#ff9600', '#58b4f0', '#ff6b8b', '#7ad35a', '#b07cf0'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i');
      c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.4}s;animation-duration:${1.6 + Math.random() * 1.2}s;transform:rotate(${Math.random() * 360}deg)`;
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3400);
  };
}
function playResult(P, i) {
  const q = P.qs[i], st = P.st[i];
  return !st || !st.checked ? null : q.type === 'short' ? st.self : st.score;
}
function playDone(s, P) {
  let ok = 0, part = 0, bad = 0, skip = 0;
  P.qs.forEach((q, i) => { const v = playResult(P, i); if (v == null) skip++; else if (v >= 1) ok++; else if (v > 0) part++; else bad++; });
  const wrongN = part + bad, graded = ok + part + bad, acc = graded ? Math.round((ok + part * 0.5) / graded * 100) : 0;
  const xp = P.qs.reduce((a, q, i) => a + ((P.st[i] && P.st[i].xp) || 0), 0) + (P.bonus || 0);
  return `<div class="panel done-card">
    <div class="done-hero">${acc >= 80 ? '🎉' : acc >= 50 ? '💪' : '📚'}</div>
    <h2>${acc >= 80 ? '레슨 완료! 아주 잘했어요' : acc >= 50 ? '레슨 완료! 조금만 더 힘내요' : '레슨 완료! 틀린 문제를 다시 봐요'}</h2>
    <div class="done-stats">
      <div class="ds xp"><span>획득 XP</span><b>⚡ ${xp}</b></div>
      <div class="ds acc"><span>정답률</span><b>🎯 ${acc}%</b></div>
      <div class="ds ok"><span>맞힌 문제</span><b>✓ ${ok}/${P.qs.length}</b></div></div>
    ${part || bad || skip ? `<p class="hint" style="margin:0;text-align:center">부분 ${part} · 틀림 ${bad}${skip ? ' · 건너뜀 ' + skip : ''}</p>` : ''}
    <div class="row" style="justify-content:center">
      ${wrongN ? `<button class="btn primary" data-act="retryWrong">틀린 문제만 다시 풀기 (${wrongN})</button>` : ''}
      ${P.kind === 'drill' ? `<button class="btn" data-act="regenDrill">🔄 새 문제로 다시 풀기</button><button class="btn" data-act="go" data-to="${L('s', s.id, 'concept', P.uid)}">개념 다시 보기</button>`
        : `<button class="btn" data-act="go" data-to="${L('s', s.id, 'gen')}">새 문제 만들기</button>`}
      <button class="btn ghost" data-act="go" data-to="${L('s', s.id, 'log')}">기록 보기</button></div></div>`;
}
function makeDrill(s, uid) {
  const u = s.uById[uid];
  const { list } = Gen.build(s, { units: [uid], count: 10 + rnd(11), objPct: 65, diff: 'mix' });
  App.play = newPlay(s, `drill|${s.id}|${uid}`, 'drill', list, `개념 문제 · ${u.title}`, { uid });
}
function vDrill(s, uid) {
  if (!s.uById[uid]) return { redirect: L('s', s.id, 'concept') };
  if (!App.play || App.play.key !== `drill|${s.id}|${uid}`) makeDrill(s, uid);
  const extra = `<div class="row"><button class="btn ghost sm" data-act="go" data-to="${L('s', s.id, 'concept', uid)}">← 개념 다시 보기</button>
    <button class="btn ghost sm" data-act="regenDrill">🔄 새 문제로 바꾸기</button></div>`;
  return vPlay(s, App.play, extra, crumbOf(s, '개념 문제'), 'concept');
}
function vPracticeRun(s) {
  if (!App.play || App.play.sid !== s.id || App.play.kind !== 'practice') return { redirect: L('s', s.id, 'gen') };
  return vPlay(s, App.play, '', crumbOf(s, '연습'), App.play.fromLog ? 'log' : 'gen');
}

/* ---------- 문제 생성 탭 ---------- */
function genOpts(s) {
  if (!App.ui.gen || App.ui.gen.sid !== s.id) App.ui.gen = { sid: s.id, units: [], count: 20, objPct: 70, diff: 'mix', mode: 'practice', minutes: 30, weak: true };
  const o = App.ui.gen;
  o.units = o.units.filter(u => s.uById[u]);
  return o;
}
function vGen(s) {
  const o = genOpts(s);
  const cap = o.units.length ? o.units.reduce((a, u) => a + Gen.capacity(s, u).facts, 0) : Gen.capacity(s).facts;
  const nObj = Math.round(o.count * o.objPct / 100), nSub = o.count - nObj;
  const rec = Math.max(5, Math.ceil(nObj * 1.2 + nSub * 3));
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="gopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join('')}</div>`;
  const exam = o.mode === 'exam';
  return {
    crumb: crumbOf(s, '문제 생성'),
    body: `<div class="page wrap">${subjHead(s, 'gen')}
      <div class="setup"><div class="panel">
        <div class="opt-group"><div class="t">풀이 방식</div>
          <div class="modepick"><button data-act="gopt" data-k="mode" data-v="practice" aria-pressed="${!exam}"><b>연습으로 풀기</b><span>한 문제씩 바로 채점·해설</span></button>
            <button data-act="gopt" data-k="mode" data-v="exam" aria-pressed="${exam}"><b>시험 보기 (CBT)</b><span>시간 제한 · 제출 후 한꺼번에 채점</span></button></div></div>
        <div class="opt-group"><div class="t">범위 <span class="hint">${o.units.length ? o.units.length + '개 단원' : '전체 단원'} · 문장 ${cap}개</span></div>
          <div class="seg"><button data-act="gunit" data-v="" aria-pressed="${!o.units.length}">전체</button>
          ${s.units.map((u, i) => `<button data-act="gunit" data-v="${esc(u.id)}" aria-pressed="${o.units.includes(u.id)}">${i + 1}. <span data-notr>${esc(u.title)}</span></button>`).join('')}</div></div>
        <div class="opt-group"><div class="t">문제 수 <span class="mono">${o.count}문항</span></div>
          <div class="row">${seg('count', [[10, '10'], [20, '20'], [30, '30'], [40, '40'], [50, '50']])}
          <input type="number" class="input numin" min="1" max="100" value="${o.count}" data-ch="gCount" aria-label="문제 수 직접 입력"></div></div>
        <div class="opt-group"><div class="t">객관식 : 주관식 비율 <span class="mono">${o.objPct} : ${100 - o.objPct}</span></div>
          <input type="range" class="range" min="0" max="100" step="10" value="${o.objPct}" data-in="gRatio" aria-label="객관식 비율">
          <div class="ratio" id="ratioBar"><i class="o" style="width:${o.objPct}%">${nObj ? '객관식 ' + nObj : ''}</i><i class="s" style="width:${100 - o.objPct}%">${nSub ? '주관식 ' + nSub : ''}</i></div>
          <p class="hint">객관식 = 고르는 문제(4지선다·OX) · 주관식 = 쓰는 문제(빈칸·서술형)</p></div>
        <div class="opt-group"><div class="t">난이도</div>${seg('diff', [['mix', '섞기'], [1, '쉬움'], [2, '보통'], [3, '어려움']])}
          <p class="hint">쉬움: 짧은 문장·한 칸·동떨어진 오답 보기 / 어려움: 긴 문장·여러 칸·숫자·비슷한 오답 보기</p></div>
        ${exam ? `<div class="opt-group"><div class="t">제한 시간 <span class="mono">${o.minutes ? o.minutes + '분' : '무제한'}</span></div>
          <div class="row">${seg('minutes', [[10, '10분'], [20, '20분'], [30, '30분'], [45, '45분'], [60, '60분'], [0, '무제한']])}
          <input type="number" class="input numin" min="0" max="300" value="${o.minutes}" data-ch="gMin" aria-label="시간 직접 입력(분)"></div>
          <button class="btn ghost sm" style="justify-self:start" data-act="gopt" data-k="minutes" data-v="${rec}">추천 시간 ${rec}분으로</button></div>`
          : `<div class="opt-group"><label class="row" style="gap:8px"><input type="checkbox" data-in="gWeak" ${o.weak ? 'checked' : ''}> <b>약점 우선</b> <span class="hint">예전에 틀린 문장에서 더 자주 출제</span></label></div>`}
      </div>
      <div class="panel stack"><h2>${exam ? '시험지' : '연습'} 요약</h2>
        <table class="summary-tbl"><tr><th>범위</th><td>${o.units.length ? o.units.map(u => esc(s.uById[u].title)).join(', ') : '전체 단원'}</td></tr>
          <tr><th>문제</th><td>객관식 ${nObj} + 주관식 ${nSub} = ${o.count}문항</td></tr>
          <tr><th>난이도</th><td>${o.diff === 'mix' ? '섞기 (쉬움 30·보통 50·어려움 20)' : DIFF[o.diff]}</td></tr>
          ${exam ? `<tr><th>시간</th><td>${o.minutes ? o.minutes + '분' : '무제한'}</td></tr><tr><th>배점</th><td>문항당 ${fmt(Math.round(1000 / o.count) / 10)}점 · 부분 정답 절반</td></tr>` : ''}</table>
        ${cap < o.count / 2 ? '<div class="notice">범위의 문장 수가 적어서 만든 문제 수가 줄어들 수 있어요.</div>' : ''}
        <p class="hint" style="margin:0">누를 때마다 자료에서 새 문제를 만들어요. 같은 문장은 같은 문제로 기록돼 오답·약점 분석에 반영돼요.</p>
        <button class="btn primary block" data-act="genStart" data-sid="${esc(s.id)}">${exam ? '📝 시험지 만들고 시작' : '✏️ 문제 만들고 풀기'}</button></div>
      </div></div>`,
  };
}

/* ---------- 기록 보기 탭 ---------- */
function vLog(s) {
  const st = Prog.subjStat(s), p = Prog.of(s.id), wrong = Prog.wrong(s.id), weak = Prog.weakUnits(s);
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  return {
    crumb: crumbOf(s, '기록 보기'),
    body: `<div class="page wrap">${subjHead(s, 'log')}
      <div class="stats">${stat(st.seen, '푼 문제')}${stat(st.acc == null ? '–' : Math.round(st.acc * 100) + '%', '정답률')}${stat(st.learned + '/' + st.units, '학습 완료 단원')}${stat(st.exams, '시험 응시')}${stat(st.exams ? fmt(st.best) + '점' : '–', '최고 점수')}</div>
      <div class="setup"><section class="panel"><h2>단원별 정답률</h2>
          <div class="bars">${s.units.map(u => { const us = Prog.unitStat(s, u.id); const pc = us.acc == null ? 0 : Math.round(us.acc * 100);
            return `<div class="b"><span>${p.learned[u.id] ? '✓ ' : ''}<span data-notr>${esc(u.title)}</span></span><div class="prog"><i class="${pc >= 70 ? 'g' : 'r'}" style="width:${pc}%"></i></div><span class="mono">${us.acc == null ? '–' : pc + '%'}</span></div>`; }).join('')}</div>
          ${weak.length ? `<p style="margin-top:12px"><span class="hint">약한 단원</span> ${weak.map(w => `<button class="chip bad" data-act="go" data-to="${L('s', s.id, 'concept', w.u.id)}"><span data-notr>${esc(w.u.title)}</span> ${Math.round(w.st.acc * 100)}%</button>`).join(' ')}</p>` : ''}</section>
        <section class="panel stack"><h2>다시 볼 오답 ${wrong.length}문항</h2>
          ${wrong.length ? `<button class="btn primary" data-act="wrongOnly" data-sid="${esc(s.id)}">오답만 다시 풀기</button>
            <ul class="wlist">${wrong.slice(0, 8).map(r => `<li><span class="chip">${TYPES[r.ty] || ''}</span><span>${esc(U.plain(r.snap.q).slice(0, 70))}</span></li>`).join('')}</ul>
            ${wrong.length > 8 ? `<p class="hint">외 ${wrong.length - 8}문항</p>` : ''}` : '<p class="hint">틀린 문제가 없어요. 문제를 풀면 여기에 모여요.</p>'}</section></div>
      <section class="panel"><h2>시험 기록</h2>${p.exams.length ? `<ul class="hist">${p.exams.slice(0, 15).map(x => `<li><span class="mono hint">${U.date(x.at)}</span>
          <span>${x.n}문항 · ${x.set.diff === 'mix' ? '난이도 섞기' : DIFF[x.set.diff]} · ${x.set.minutes ? x.set.minutes + '분' : '무제한'} · ${U.mmss(x.used)} 걸림</span><b class="mono">${fmt(x.score)}점</b></li>`).join('')}</ul>`
        : '<p class="hint">아직 시험을 보지 않았어요. [문제 생성] 탭에서 시험 보기를 골라 보세요.</p>'}</section></div>`,
  };
}

/* ================= 시험 (CBT) ================= */
function cellMark(q, r) {
  if (!Grade.answered(q, r)) return '';
  if (q.type === 'mc') return CIRC[r];
  if (q.type === 'ox') return r ? 'O' : 'X';
  return '✓';
}
function sheetHTML(E) {
  const nObj = E.qs.filter(q => OBJ_TYPES.includes(q.type)).length;
  const cells = (from, to) => E.qs.slice(from, to).map((q, k) => {
    const i = from + k, r = E.resp[i];
    return `<button class="cell ${SUBJ_TYPES.includes(q.type) ? 'sub' : ''} ${Grade.answered(q, r) ? 'done' : ''} ${i === E.idx ? 'cur' : ''}" data-act="jump" data-i="${i}" aria-label="${i + 1}번">${i + 1}<small>${cellMark(q, r)}</small></button>`;
  }).join('');
  const done = E.qs.filter((q, i) => Grade.answered(q, E.resp[i])).length;
  return `<aside class="sheet ${App.ui.sheetOpen ? '' : 'closed'}"><h3><span>답안표기란</span><span class="mono" id="doneCount">${done}/${E.qs.length}</span></h3>
    ${nObj ? `<div class="label">객관식</div><div class="cells">${cells(0, nObj)}</div>` : ''}
    ${nObj < E.qs.length ? `<div class="label" style="margin-top:12px">주관식</div><div class="cells">${cells(nObj, E.qs.length)}</div>` : ''}
    <div class="legend"><span>칸을 누르면 그 문제로 이동</span></div>
    <button class="btn primary block" style="margin-top:12px" data-act="submitAsk">답안 제출</button></aside>`;
}
function timerInfo(E) {
  const el = ((E.end || E.pausedAt || Date.now()) - E.start) / 1000;
  if (!E.dur) return { text: '⏱ ' + U.mmss(el), low: false, over: false };
  const rem = E.dur - el;
  return { text: U.mmss(rem), low: rem <= 60, over: rem <= 0 };
}
function vExamRun(s, E) {
  const q = E.qs[E.idx], n = E.qs.length, ti = timerInfo(E);
  const st = { resp: E.resp[E.idx] ?? initResp(q) };
  const unanswered = E.qs.filter((x, i) => !Grade.answered(x, E.resp[i])).length;
  const overlay = App.ui.dialog === 'submit' ? `<div class="overlay" data-act="dlgClose"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgT">
      <h3 id="dlgT">답안을 제출할까요?</h3>
      <p>${unanswered ? `<b style="color:var(--bad)">아직 안 푼 문제가 ${unanswered}개</b> 있어요.` : '모든 문제에 답했어요.'} 제출하면 답을 바꿀 수 없어요.</p>
      <div class="row end"><button class="btn" data-act="dlgCancel">계속 풀기</button><button class="btn primary" data-act="submit">제출하기</button></div></div></div>` : '';
  return {
    ctx: 'exam',
    bar: `<header class="bar"><div class="wrap"><button class="btn back" data-act="back" aria-label="잠시 나가기 (시간 멈춤)" title="잠시 나가기 · 시간이 멈춰요">←</button><span class="crumb">📝 <span data-notr>${esc(s.name)}</span> · 시험 ${E.idx + 1}/${n}</span>
      <span class="timer ${ti.low ? 'low' : ''}" id="timer" aria-label="남은 시간">${ti.text}</span>
      <button class="btn" data-act="sheetToggle">표기란</button><button class="btn go" data-act="submitAsk">제출</button></div></header>`,
    body: `<div class="page wrap"><div class="pbar"><i style="width:${(n - unanswered) / n * 100}%"></i></div>
      ${E.notes.length ? `<div class="notice">${E.notes.map(esc).join('<br>')}</div>` : ''}
      <div class="solve exam"><section class="qcard">${qHead(s, q, E.idx + 1)}${qBody(q, st, 'exam')}
        <div class="qnav"><button class="btn" data-act="prev" ${E.idx === 0 ? 'disabled' : ''}>← 이전</button>
          ${E.idx === n - 1 ? '<button class="btn primary" data-act="submitAsk">답안 제출</button>' : '<button class="btn primary" data-act="next">다음 →</button>'}</div></section>
        ${sheetHTML(E)}</div></div>`,
    overlay,
  };
}
function updateExamSheet() {
  const E = App.exam; if (!E) return;
  const q = E.qs[E.idx], r = E.resp[E.idx];
  const c = document.querySelector(`.cell[data-i="${E.idx}"]`);
  if (c) { c.classList.toggle('done', Grade.answered(q, r)); c.querySelector('small').textContent = cellMark(q, r); }
  const d = document.getElementById('doneCount');
  if (d) d.textContent = E.qs.filter((x, i) => Grade.answered(x, E.resp[i])).length + '/' + E.qs.length;
}
function startTimer() { stopTimer(); App.timer = setInterval(tick, 1000); }
function stopTimer() { clearInterval(App.timer); App.timer = null; }
function tick() {
  const E = App.exam;
  if (!E || E.phase !== 'run') return stopTimer();
  const t = timerInfo(E), el = document.getElementById('timer');
  if (el) { el.textContent = t.text; el.classList.toggle('low', t.low); }
  if (t.over) submitExam(true);
}
function submitExam(auto) {
  const E = App.exam;
  stopTimer();
  E.end = Math.min(Date.now(), E.dur ? E.start + E.dur * 1000 : Date.now());
  App.ui.dialog = null;
  let hasShort = false;
  E.qs.forEach((q, i) => {
    const r = E.resp[i];
    if (q.type === 'short') { hasShort = true; const j = Grade.judgeShort(q, r); E.judge[i] = j; E.self[i] = Grade.answered(q, r) ? j.verdict : 0; }
    else E.scores[i] = Grade.auto(q, r);
  });
  if (auto) toast('시간이 끝나 자동으로 제출했어요.');
  if (hasShort) { E.phase = 'grade'; go(L('s', E.sid, 'exam', 'grade')); }
  else { finishExam(E); go(L('s', E.sid, 'exam', 'result')); }
}
function vExamGrade(s, E) {
  const shorts = E.qs.map((q, i) => [q, i]).filter(([q]) => q.type === 'short');
  const left = shorts.filter(([, i]) => E.self[i] == null).length;
  return {
    crumb: crumbOf(s, '시험', '서술형 채점'),
    body: `<div class="page wrap"><h1 style="font-size:22px">서술형 채점</h1>
      <p class="muted">자료에서 뽑은 채점 기준(핵심어)으로 자동 판정한 결과예요. 모범답안과 비교해 보고 <b>맞음·부분·틀림을 직접 확정</b>하세요.</p>
      ${shorts.map(([q, i]) => {
        const r = E.resp[i];
        return `<section class="panel stack" style="gap:12px">${qHead(s, q, i + 1)}<div class="stem">${q.q}</div>
          <div><div class="label">내 답안</div><div class="mine">${Grade.answered(q, r) ? '<span data-notr>' + esc(r) + '</span>' : '<span class="hint">(답을 쓰지 않았어요)</span>'}</div></div>
          ${judgeBox(q, E.judge[i], E.self[i], 'eself').replace(/data-q="[^"]*"/g, `data-i="${i}"`)}
          <div class="model"><b class="label" style="display:block">모범답안 (자료 내용)</b><span data-notr>${q.model}</span></div></section>`;
      }).join('')}
      <div class="row end"><span class="hint">${left ? `${left}문항 남음` : '모두 확정했어요'}</span>
        <button class="btn primary" data-act="gradeDone" ${left ? 'disabled' : ''}>채점 확정하고 결과 보기</button></div></div>`,
  };
}
function finishExam(E) {
  let sum = 0, ok = 0, part = 0, bad = 0, blank = 0;
  E.qs.forEach((q, i) => {
    const v = q.type === 'short' ? (E.self[i] ?? 0) : (E.scores[i] ?? 0);
    E.scores[i] = v; sum += v;
    if (!Grade.answered(q, E.resp[i])) blank++;
    if (v >= 1) ok++; else if (v > 0) part++; else bad++;
    Prog.record(E.sid, q, v);
  });
  const score = Math.round(sum / E.qs.length * 1000) / 10;
  E.result = { score, ok, part, bad, blank, used: Math.round((E.end - E.start) / 1000) };
  Prog.addExam(E.sid, { at: E.end, score, n: E.qs.length, ok, part, bad, used: E.result.used, set: E.set });
  E.result.xp = Math.round(sum * 10) + 20;   // 맞힌 만큼 + 시험 완주 보너스 20
  E.phase = 'result';
  E.celebrate = true;
  gainXP(E.result.xp); Sfx.play('done');
}
function vExamResult(s, E) {
  const R = E.result;
  const by = f => { let c = 0, t = 0; E.qs.forEach((q, i) => { if (f(q)) { t++; c += E.scores[i]; } }); return t ? { t, pct: Math.round(c / t * 100) } : null; };
  const objR = by(q => OBJ_TYPES.includes(q.type)), subR = by(q => SUBJ_TYPES.includes(q.type));
  const units = s.units.map(u => ({ u, r: by(q => q.unit === u.id) })).filter(x => x.r).sort((a, b) => a.r.pct - b.r.pct);
  const f = App.ui.rvFilter;
  const list = E.qs.map((q, i) => ({ q, i, v: E.scores[i] })).filter(x => f === 'all' || (f === 'bad' ? x.v < 1 : x.v >= 1));
  const wrongN = E.qs.filter((q, i) => E.scores[i] < 1).length;
  const msg = R.score >= 90 ? '아주 좋아요! 실전도 문제없어요.' : R.score >= 70 ? '잘했어요. 틀린 부분만 다시 보면 돼요.' : R.score >= 50 ? '조금만 더! 약한 단원을 집중 복습해요.' : '개념 정리부터 차근차근 다시 해 봐요.';
  return {
    crumb: crumbOf(s, '시험 결과'),
    after: E.celebrate ? celebrate(E) : null,
    body: `<div class="page wrap">
      <section class="panel score"><div class="big">${fmt(R.score)}<small> / 100</small></div>
        <div class="stack" style="gap:10px"><b style="font-size:18px">${msg}</b>
          <div class="parts"><div>획득 XP<b>⚡ ${R.xp || 0}</b></div><div>맞음<b>${R.ok}</b></div><div>부분<b>${R.part}</b></div><div>틀림<b>${R.bad}</b></div><div>안 푼 문제<b>${R.blank}</b></div><div>걸린 시간<b>${U.mmss(R.used)}</b></div></div></div></section>
      <div class="setup"><section class="panel"><h2>단원별 정답률</h2><div class="bars">${units.map(x => `<div class="b"><span data-notr>${esc(x.u.title)}</span>
          <div class="prog"><i class="${x.r.pct >= 70 ? 'g' : 'r'}" style="width:${x.r.pct}%"></i></div><span class="mono">${x.r.pct}%</span></div>`).join('')}</div></section>
        <section class="panel stack"><h2>유형별</h2>
          <table class="summary-tbl">${objR ? `<tr><th>객관식 (${objR.t})</th><td class="mono">${objR.pct}%</td></tr>` : ''}${subR ? `<tr><th>주관식 (${subR.t})</th><td class="mono">${subR.pct}%</td></tr>` : ''}</table>
          <div class="stack" style="gap:8px">
            ${wrongN ? `<button class="btn primary" data-act="examRetryWrong">틀린 문제 다시 풀기 (${wrongN})</button>` : ''}
            <button class="btn" data-act="go" data-to="${L('s', s.id, 'gen')}">새 시험 만들기</button>
            <button class="btn ghost" data-act="go" data-to="${L('s', s.id, 'log')}">기록 보기</button></div></section></div>
      <div class="row between"><h2 style="font-size:18px">문항별 확인</h2>
        <div class="seg">${[['all', '전체'], ['bad', '틀림·부분'], ['ok', '맞음']].map(([v, l]) => `<button data-act="rvFilter" data-v="${v}" aria-pressed="${f === v}">${l}</button>`).join('')}</div></div>
      ${list.map(x => {
        const st = { resp: E.resp[x.i] ?? initResp(x.q), checked: true, judge: E.judge[x.i], self: E.self[x.i] };
        const cls = x.v >= 1 ? 'ok' : x.v > 0 ? 'part' : 'bad';
        return `<details class="rv ${cls}"><summary><span class="n">${x.i + 1}</span><span>${esc(U.plain(x.q.q).slice(0, 90))}</span>
          <span class="chip ${cls === 'part' ? 'warn' : cls}">${scoreWord(x.v)}</span></summary>
          <div class="body">${qBody(x.q, st, 'review')}${explainHTML(x.q, st)}</div></details>`;
      }).join('') || '<div class="empty">해당하는 문항이 없어요.</div>'}</div>`,
  };
}

/* ================= 과목 추가·수정 ================= */
function vManage() {
  return {
    crumb: '과목 추가·수정',
    body: `<div class="page wrap"><div class="row between"><h1 style="font-size:24px">과목 추가·수정</h1>
        <button class="btn primary" data-act="go" data-to="#/manage/new">＋ 새 과목 추가</button></div>
      <p class="muted" style="margin:0">과목을 만들고 강의자료를 올려 두면, [공부하기]에서 개념 정리와 문제가 자동으로 만들어져요.</p>
      <div class="mlist">${Lib.list.map(s => `<div class="mitem"><div class="stack" style="gap:4px"><h3 data-notr>${esc(s.name)}</h3>
          <div class="row" style="gap:6px"><span class="chip">자료 ${s.materials.length}</span>${s.materials.slice(0, 4).map(m => `<span class="chip" data-notr>${KIND[m.kind] || ''} · ${esc(m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name)}</span>`).join('')}${s.materials.length > 4 ? '<span class="chip">…</span>' : ''}</div></div>
          <div class="row"><button class="btn sm" data-act="go" data-to="${L('manage', 'edit', s.id)}">자료 추가·수정</button>
            <button class="btn sm" data-act="go" data-to="${L('s', s.id)}">공부하기</button></div></div>`).join('')
        || '<div class="empty">아직 과목이 없어요. [＋ 새 과목 추가]로 시작해 보세요.</div>'}</div>
      <div class="panel row between"><div><b>친구가 공유한 과목 파일이 있나요?</b><br><span class="hint">과목 수정 화면에서 내보낸 파일(.json)을 불러와요.</span></div>
        <label class="btn" style="cursor:pointer">📂 과목 파일 불러오기<input type="file" accept=".json,application/json" data-ch="importSubj" hidden></label></div></div>`,
  };
}
function uploader(target) {
  const U2 = App.ui.up && App.ui.up.target === target ? App.ui.up : (App.ui.up = { target, items: [], pasteTitle: '', paste: '', showPaste: false });
  return `<div class="drop" data-drop="${esc(target)}">
      <div class="ico">📄</div><b>강의자료를 여기로 끌어다 놓거나</b>
      <label class="btn primary" style="cursor:pointer">파일 고르기<input type="file" multiple accept=".pdf,.pptx,.hwp,.hwpx,.docx,.txt,.md" data-ch="files" data-target="${esc(target)}" hidden></label>
      <span class="hint">PDF · PPT(pptx) · 한글(hwp·hwpx) · 워드(docx) · 텍스트(txt) · 여러 개 한 번에 가능</span>
      <button class="btn ghost sm" data-act="togglePaste">✍️ 글 직접 붙여넣기</button></div>
    ${U2.showPaste ? `<div class="panel stack" style="gap:10px"><label class="field"><span class="label">자료 이름</span><input type="text" value="${esc(U2.pasteTitle)}" placeholder="예: 3주차 필기" data-in="up" data-k="pasteTitle"></label>
      <textarea class="input" rows="8" placeholder="필기나 정리한 글을 붙여넣으세요. '1. 제목', '■ 제목' 같은 줄은 자동으로 소제목이 돼요." data-in="up" data-k="paste">${esc(U2.paste)}</textarea>
      <div class="row end"><button class="btn primary" data-act="addPaste" data-target="${esc(target)}">자료로 추가</button></div></div>` : ''}
    ${U2.items.length ? `<ul class="uplist">${U2.items.map(it => `<li class="${it.status}"><span>${it.status === 'reading' ? '⏳' : it.status === 'done' ? '✅' : '⚠️'}</span>
      <div><b data-notr>${esc(it.name)}</b><div class="hint">${it.status === 'reading' ? '글자를 읽는 중…' : it.status === 'done' ? `${KIND[it.kind] || ''} · 개념 카드 ${it.secs}장 · 글자 ${it.chars.toLocaleString()}자` : esc(it.msg)}</div></div></li>`).join('')}</ul>` : ''}`;
}
function vSubjNew() {
  const N = App.ui.newSubj || (App.ui.newSubj = { name: '', desc: '', mats: [] });
  const busy = App.ui.up && App.ui.up.target === 'new' && App.ui.up.items.some(i => i.status === 'reading');
  return {
    crumb: '과목 추가·수정 › 새 과목',
    body: `<div class="page wrap" style="max-width:860px"><h1 style="font-size:24px">새 과목 추가</h1>
      <div class="stepper">
        <section class="stepbox"><h2>과목 정하기</h2>
          <label class="field"><span class="label">과목 이름 (필수)</span><input type="text" value="${esc(N.name)}" placeholder="예: 석유공업화학, 인간공학" data-in="ns" data-k="name" maxlength="40"></label>
          <label class="field"><span class="label">한 줄 소개 (선택)</span><input type="text" value="${esc(N.desc)}" placeholder="예: 중간고사 범위 1~7주차" data-in="ns" data-k="desc" maxlength="60"></label></section>
        <section class="stepbox"><h2>자료 올리기</h2>${uploader('new')}
          ${N.mats.length ? `<div class="label">추가된 자료 ${N.mats.length}개 (자료 하나 = 단원 하나)</div>
            <ul class="uplist">${N.mats.map((m, i) => `<li class="done"><span>${i + 1}</span><div><b data-notr>${esc(m.name)}</b><div class="hint">${KIND[m.kind]} · 개념 카드 ${m.sections.length}장</div></div>
              <button class="btn sm ghost" data-act="nsDel" data-i="${i}">빼기</button></li>`).join('')}</ul>` : ''}</section>
      </div>
      <div class="row end"><button class="btn" data-act="go" data-to="#/manage">취소</button>
        <button class="btn primary" data-act="nsSave" ${busy ? 'disabled' : ''}>과목 만들기</button></div></div>`,
  };
}
function vSubjEdit(s) {
  const p = Prog.of(s.id);
  return {
    crumb: '과목 추가·수정 › <span data-notr>' + esc(s.name) + '</span>',
    body: `<div class="page wrap" style="max-width:900px">
      <div class="row between"><h1 style="font-size:24px" data-notr>${esc(s.name)}</h1><button class="btn sm" data-act="go" data-to="${L('s', s.id)}">공부하기 →</button></div>
      <section class="panel stack"><h2>기본 정보</h2>
        <label class="field"><span class="label">과목 이름</span><input type="text" id="edName" value="${esc(s.name)}" maxlength="40"></label>
        <label class="field"><span class="label">한 줄 소개</span><input type="text" id="edDesc" value="${esc(s.desc || '')}" maxlength="60"></label>
        <div class="row end"><button class="btn primary" data-act="edMeta" data-sid="${esc(s.id)}">저장</button></div></section>
      <section class="panel stack"><h2>자료 (${s.materials.length})</h2>
        <p class="hint" style="margin:0">자료 하나가 단원 하나예요. 이름을 바꾸면 단원 이름도 바뀌어요.</p>
        ${s.materials.map((m, i) => `<details class="unit-ed"><summary><b>${i + 1}.</b> <span data-notr>${esc(m.name)}</span><span class="chip">${KIND[m.kind] || m.kind}</span><span class="chip">카드 ${m.sections.length}</span>${p.learned[m.id] ? '<span class="chip ok">학습 완료</span>' : ''}</summary>
          <div class="body"><div class="row"><input type="text" class="input" style="flex:1 1 240px" value="${esc(m.name)}" data-ch="matName" data-sid="${esc(s.id)}" data-mid="${esc(m.id)}" aria-label="자료 이름">
              <button class="btn sm" data-act="matUp" data-sid="${esc(s.id)}" data-mid="${esc(m.id)}" ${i === 0 ? 'disabled' : ''} aria-label="위로">↑</button>
              <button class="btn sm danger" data-act="matDel" data-sid="${esc(s.id)}" data-mid="${esc(m.id)}">자료 삭제</button></div>
            <div class="hint">미리보기 (앞부분)</div>
            <div class="preview">${m.sections.slice(0, 4).map(sec => `<div><b>${esc(sec.title || '(제목 없음)')}</b><ul>${sec.lines.slice(0, 4).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}</div></div></details>`).join('')
          || '<div class="empty">아직 자료가 없어요. 아래에서 올려 주세요.</div>'}</section>
      <section class="panel stack"><h2>자료 더 올리기</h2>${uploader(s.id)}</section>
      <section class="panel stack"><h2>기타</h2>
        <div class="row"><button class="btn" data-act="exportSubj" data-sid="${esc(s.id)}">과목 파일로 내보내기</button>
          <button class="btn" data-act="edResetProg" data-sid="${esc(s.id)}">학습 기록 초기화</button>
          <button class="btn danger" data-act="subjDel" data-sid="${esc(s.id)}">과목 삭제</button></div>
        <p class="hint" style="margin:0">내보낸 과목 파일을 친구에게 주면 같은 자료로 공부할 수 있어요 (학습 기록은 빠져요).</p></section></div>`,
  };
}
async function mutateSubject(sid, fn, msg = '저장했어요') {
  const s = JSON.parse(JSON.stringify(Lib.get(sid)));
  fn(s);
  const ok = await Lib.save(s);
  toast(ok ? msg : '저장하지 못했어요. 저장 공간을 확인해 주세요.');
  render();
}
async function handleFiles(files, target) {
  const U2 = App.ui.up && App.ui.up.target === target ? App.ui.up : (App.ui.up = { target, items: [], pasteTitle: '', paste: '', showPaste: false });
  for (const f of files) {
    const it = { name: f.name, status: 'reading' };
    U2.items.unshift(it); render();
    try {
      const m = await Extract.file(f);
      Object.assign(it, { status: 'done', kind: m.kind, secs: m.sections.length, chars: m.chars });
      await addMaterial(target, m);
    } catch (e) { console.error(e); Object.assign(it, { status: 'error', msg: e.message || '읽지 못했어요' }); }
    render();
  }
}
async function addMaterial(target, m) {
  if (target === 'new') {
    const N = App.ui.newSubj || (App.ui.newSubj = { name: '', desc: '', mats: [] });
    N.mats.push(m);
    if (!N.name && N.mats.length === 1) N.name = '';
  } else {
    const s = JSON.parse(JSON.stringify(Lib.get(target)));
    s.materials.push(m);
    await Lib.save(s);
    toast(`「${m.name}」 자료를 추가했어요`);
  }
}
function resizePhoto(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      URL.revokeObjectURL(img.src); res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => rej(new Error('사진을 읽지 못했어요'));
    img.src = URL.createObjectURL(file);
  });
}

/* ================= 동작 ================= */
function curQ() {
  if (App.ctx === 'play' && App.play) { const P = App.play; return P.idx < P.qs.length ? { s: Lib.get(P.sid), q: P.qs[P.idx], st: P.st[P.idx], P } : null; }
  if (App.ctx === 'exam' && App.exam) { const E = App.exam; return { s: Lib.get(E.sid), q: E.qs[E.idx], E }; }
  return null;
}
function checkPlay(c) {
  const { s, q, st, P } = c;
  if (st.checked) return;
  st.checked = true;
  if (q.type === 'short') st.judge = Grade.judgeShort(q, st.resp);
  else { st.score = Grade.auto(q, st.resp); Prog.record(s.id, q, st.score); reward(P, st, st.score); }
  render();
}
// 정답 보상: XP(맞음 10 · 부분 5, 3연속부터 +2), 칭찬 메시지, 효과음
function reward(P, st, v) {
  P.combo = v >= 1 ? (P.combo || 0) + 1 : 0;
  st.combo = P.combo;
  st.xp = v >= 1 ? 10 + (P.combo >= 3 ? 2 : 0) : v > 0 ? 5 : 0;
  st.msg = v >= 1 ? PRAISE[rnd(PRAISE.length)] : v > 0 ? '절반은 맞았어요!' : CHEER[rnd(CHEER.length)];
  gainXP(st.xp);
  Sfx.play(v >= 1 ? 'ok' : 'bad');
}
function move(d) {
  if (App.ctx === 'play' && App.play) {
    const P = App.play;
    P.idx = U.clamp(P.idx + d, 0, P.qs.length);
    // 마지막 문제를 넘기면 레슨 완료 보너스 + 축하
    if (P.idx === P.qs.length && !P.finished && P.qs.some((_, i) => P.st[i] && P.st[i].checked)) {
      P.finished = true; P.bonus = 10; P.celebrate = true;
      gainXP(10); Sfx.play('done');
    }
  }
  else if (App.ctx === 'exam' && App.exam) { const E = App.exam; E.idx = U.clamp(E.idx + d, 0, E.qs.length - 1); }
  else return;
  render(); window.scrollTo(0, 0);
}
function closeGuide() {
  App.ui.guide = null;
  if (Profiles.cur && !Profiles.cur.guideSeen) Profiles.update(Profiles.cur.id, { guideSeen: true });
  render();
}
const ask = m => confirm(I18N.str(m));
async function enterProfile(id) {
  Profiles.login(id);
  applyTheme(Profiles.cur.theme || 'calm', false);
  App.play = App.exam = null; App.ui.gen = App.ui.up = App.ui.newSubj = null;
  await Lib.load();
  Session.load();
  if (!Profiles.cur.guideSeen) App.ui.guide = 0;   // 처음 로그인하면 설명서를 바로 보여줌
  go('#/');
}

const ACT = {
  go(el) { go(el.dataset.to); },
  themeToggle() { App.ui.themeOpen = !App.ui.themeOpen; render(); },
  theme(el) { applyTheme(el.dataset.v); App.ui.themeOpen = false; render(); },
  moreCards(el) { App.ui.cardLimit[el.dataset.k] = (App.ui.cardLimit[el.dataset.k] || 20) + 20; render(); },
  learned(el) {
    const { sid, uid } = el.dataset, p = Prog.of(sid), on = !p.learned[uid];
    Prog.learn(sid, uid, on);
    if (on) {
      toast('학습 완료! 단원이 금색이 됐어요 ✓');
      if (!(p.lx || {})[uid]) { p.lx = { ...(p.lx || {}), [uid]: 1 }; Prog.save(sid); gainXP(20); Sfx.play('done'); }
    }
    render();
  },
  // 로그인·프로필
  pickProfile(el) {
    const p = Profiles.get(el.dataset.id);
    if (p.pin) { App.ui.pinFor = p.id; render(); setTimeout(() => document.getElementById('pinIn')?.focus(), 30); }
    else enterProfile(p.id);
  },
  pinOk() {
    const p = Profiles.get(App.ui.pinFor), v = document.getElementById('pinIn').value;
    if (Profiles.checkPin(p, v)) { App.ui.pinFor = null; enterProfile(p.id); }
    else { document.getElementById('pinMsg').textContent = 'PIN이 맞지 않아요.'; document.getElementById('pinIn').value = ''; }
  },
  pinCancel() { App.ui.pinFor = null; render(); },
  pfAvatar(el) { App.ui.pf.avatar = el.dataset.v; App.ui.pf.photo = ''; render(); },
  pfColor(el) { App.ui.pf.color = el.dataset.v; render(); },
  pfPhotoDel() { App.ui.pf.photo = ''; render(); },
  async pfSave() {
    const F = App.ui.pf;
    if (!F.name.trim()) return toast('이름을 입력해 주세요');
    if (F.pin && !/^\d{4}$/.test(F.pin)) return toast('PIN은 숫자 4자리로 입력해 주세요');
    const data = { name: F.name.trim(), school: F.school.trim(), major: F.major.trim(), grade: F.grade, motto: F.motto.trim(), avatar: F.avatar, photo: F.photo, color: F.color };
    if (F.for) {
      const patch = { ...data };
      if (F.clearPin) patch.pin = null; else if (F.pin) patch.pin = Profiles.pinHash(F.for, F.pin);
      Profiles.update(F.for, patch); App.ui.pf = null; toast('프로필을 저장했어요'); go('#/profile');
    } else {
      const p = Profiles.create({ ...data, pin: F.pin, theme: document.documentElement.dataset.theme });
      App.ui.pf = null; toast(`${p.name}님, 환영해요!`); enterProfile(p.id);
    }
  },
  // 사용 설명서
  openGuide() { App.ui.guide = 0; App.ui.themeOpen = false; render(); },
  guideNext() { App.ui.guide++; render(); },
  guidePrev() { App.ui.guide = Math.max(0, App.ui.guide - 1); render(); },
  guideClose(el, e) { if (el.classList.contains('overlay') && e.target !== el) return; closeGuide(); },
  guideDone() { closeGuide(); },
  // 설정
  setFont(el) { I18N.applyFont(el.dataset.v); render(); },
  setLang(el) { I18N.setLang(el.dataset.v); render(); },
  pathExam(el) { const s = Lib.get(el.dataset.sid); const o = genOpts(s); o.mode = 'exam'; o.units = []; go(L('s', s.id, 'gen')); },
  setGoal(el) { Profiles.update(Profiles.cur.id, { goal: Number(el.dataset.v) }); toast(`하루 목표를 ${el.dataset.v} XP로 정했어요`); render(); },
  async backup() {
    const b = await Profiles.backup(Profiles.cur.id);
    downloadJSON(`스스로_백업_${Profiles.cur.name}_${U.day()}`, b); toast('백업 파일을 내려받았어요');
  },
  back() { if (history.length > 1) history.back(); else go('#/'); },
  dropSession() {
    if (!ask('풀던 문제를 그만둘까요? 지금까지 푼 기록은 남아 있어요.')) return;
    stopTimer(); App.play = null; App.exam = null; Session.clear(); render();
  },
  logout() { pauseExam(); Session.save(); stopTimer(); Profiles.logout(); App.play = App.exam = null; Lib.list = []; Lib.map = {}; go('#/login'); },
  async profileDel() {
    const p = Profiles.cur;
    if (!ask(`「${p.name}」 프로필을 삭제할까요?\n이 프로필의 과목·자료·학습 기록이 모두 지워지고 되돌릴 수 없어요.`)) return;
    await Profiles.remove(p.id); Lib.list = []; Lib.map = {}; toast('프로필을 삭제했어요'); go('#/login');
  },
  // 풀이
  pick(el) {
    const c = curQ(); if (!c) return;
    const i = Number(el.dataset.i), val = c.q.type === 'ox' ? i === 0 : i;
    if (c.E) { c.E.resp[c.E.idx] = val; render(); return; }
    if (c.st.checked) return;
    c.st.resp = val; checkPlay(c);
  },
  check() { const c = curQ(); if (c && c.st) checkPlay(c); },
  self(el) {
    const c = curQ(); if (!c || !c.st) return;
    const v = Number(el.dataset.v), st = c.st;
    if (st.self == null) { Prog.record(c.s.id, c.q, v); reward(c.P, st, v); } else Prog.amend(c.s.id, c.q, st.self, v);
    st.self = v; st.score = v; render();
  },
  next() { move(1); },
  prev() { move(-1); },
  retryWrong() {
    const P = App.play;
    const qs = P.qs.filter((q, i) => { const v = playResult(P, i); return v != null && v < 1; });
    App.play = { ...P, qs, idx: 0, st: {}, finished: false, bonus: 0, combo: 0, celebrate: false, title: P.title.replace(/^(오답 다시 · )?/, '오답 다시 · ') };
    render();
  },
  regenDrill() { const P = App.play, s = Lib.get(P.sid); makeDrill(s, P.uid); toast('새 문제를 만들었어요'); render(); window.scrollTo(0, 0); },
  wrongOnly(el) {
    const s = Lib.get(el.dataset.sid);
    const qs = U.shuffle(Prog.wrong(s.id).map(r => r.snap));
    App.play = newPlay(s, 'practice|' + Date.now(), 'practice', qs, '오답 다시 풀기', { fromLog: true });
    go(L('s', s.id, 'practice'));
  },
  // 문제 생성
  gopt(el) {
    const o = App.ui.gen, k = el.dataset.k, v = el.dataset.v;
    o[k] = k === 'mode' ? v : k === 'diff' ? (v === 'mix' ? 'mix' : Number(v)) : Number(v); render();
  },
  gunit(el) {
    const o = App.ui.gen, v = el.dataset.v;
    o.units = !v ? [] : o.units.includes(v) ? o.units.filter(x => x !== v) : [...o.units, v]; render();
  },
  genStart(el) {
    const s = Lib.get(el.dataset.sid), o = App.ui.gen;
    const { list, notes } = Gen.build(s, { units: o.units, count: o.count, objPct: o.objPct, diff: o.diff, weak: o.mode === 'practice' && o.weak ? Prog.weakMap(s.id) : null });
    if (!list.length) return toast(notes[0] || '문제를 만들지 못했어요');
    if (o.mode === 'exam') {
      App.exam = { sid: s.id, qs: list, resp: {}, idx: 0, start: Date.now(), dur: o.minutes * 60, set: { count: list.length, objPct: o.objPct, diff: o.diff, minutes: o.minutes }, notes, phase: 'run', scores: {}, judge: {}, self: {} };
      App.ui.rvFilter = 'all'; App.ui.sheetOpen = false;
      startTimer(); go(L('s', s.id, 'exam', 'run'));
    } else {
      App.play = newPlay(s, 'practice|' + Date.now(), 'practice', list, `연습 · ${list.length}문항`);
      if (notes.length) toast(notes[0]);
      go(L('s', s.id, 'practice'));
    }
  },
  // 시험
  jump(el) { App.exam.idx = Number(el.dataset.i); App.ui.sheetOpen = false; render(); window.scrollTo(0, 0); },
  sheetToggle() { App.ui.sheetOpen = !App.ui.sheetOpen; render(); },
  submitAsk() { App.ui.dialog = 'submit'; render(); },
  dlgClose(el, e) { if (e.target === el) { App.ui.dialog = null; App.ui.pinFor = null; render(); } },
  dlgCancel() { App.ui.dialog = null; render(); },
  submit() { submitExam(false); },
  eself(el) { App.exam.self[Number(el.dataset.i)] = Number(el.dataset.v); render(); },
  gradeDone() { const E = App.exam; finishExam(E); go(L('s', E.sid, 'exam', 'result')); window.scrollTo(0, 0); },
  rvFilter(el) { App.ui.rvFilter = el.dataset.v; render(); },
  examRetryWrong() {
    const E = App.exam, s = Lib.get(E.sid);
    App.play = newPlay(s, 'practice|' + Date.now(), 'practice', E.qs.filter((q, i) => E.scores[i] < 1), '시험 오답 다시 풀기');
    go(L('s', s.id, 'practice'));
  },
  // 과목·자료
  togglePaste() { App.ui.up.showPaste = !App.ui.up.showPaste; render(); },
  async addPaste(el) {
    const U2 = App.ui.up;
    if (U2.paste.trim().length < 20) return toast('글을 조금 더 붙여넣어 주세요');
    try {
      const m = Extract.text(U2.pasteTitle.trim() || '붙여넣은 자료', U2.paste);
      U2.items.unshift({ name: m.name, status: 'done', kind: 'text', secs: m.sections.length, chars: m.chars });
      await addMaterial(el.dataset.target, m);
      U2.paste = ''; U2.pasteTitle = ''; U2.showPaste = false;
    } catch (e) { toast(e.message); }
    render();
  },
  nsDel(el) { App.ui.newSubj.mats.splice(Number(el.dataset.i), 1); render(); },
  async nsSave() {
    const N = App.ui.newSubj;
    if (!N.name.trim()) return toast('과목 이름을 입력해 주세요');
    if (!N.mats.length) return toast('자료를 하나 이상 올려 주세요');
    const s = { id: U.uid('s'), name: N.name.trim(), desc: N.desc.trim(), materials: N.mats };
    const ok = await Lib.save(s);
    App.ui.newSubj = null; App.ui.up = null;
    toast(ok ? '과목을 만들었어요! 개념 정리부터 시작해 보세요' : '저장하지 못했어요. 저장 공간을 확인해 주세요.');
    if (ok) go(L('s', s.id, 'concept'));
  },
  edMeta(el) {
    const name = document.getElementById('edName').value.trim(), desc = document.getElementById('edDesc').value.trim();
    if (!name) return toast('과목 이름을 입력해 주세요');
    mutateSubject(el.dataset.sid, s => { s.name = name; s.desc = desc; });
  },
  matDel(el) {
    const s = Lib.get(el.dataset.sid), m = s.materials.find(x => x.id === el.dataset.mid);
    if (!ask(`「${m.name}」 자료를 삭제할까요?`)) return;
    mutateSubject(s.id, x => { x.materials = x.materials.filter(y => y.id !== m.id); }, '자료를 삭제했어요');
  },
  matUp(el) {
    mutateSubject(el.dataset.sid, x => { const i = x.materials.findIndex(y => y.id === el.dataset.mid); if (i > 0) [x.materials[i - 1], x.materials[i]] = [x.materials[i], x.materials[i - 1]]; }, '순서를 바꿨어요');
  },
  exportSubj(el) {
    const s = Lib.get(el.dataset.sid);
    downloadJSON(`스스로_과목_${s.name}`, { format: 'ssro-subject-2', name: s.name, desc: s.desc || '', materials: s.materials });
    toast('과목 파일을 내려받았어요');
  },
  edResetProg(el) {
    if (!ask('이 과목의 학습 기록(푼 문제, 오답, 시험 기록, 학습 완료 표시)을 모두 지울까요?')) return;
    Prog.reset(el.dataset.sid); toast('학습 기록을 초기화했어요'); render();
  },
  async subjDel(el) {
    const s = Lib.get(el.dataset.sid);
    if (!ask(`「${s.name}」 과목을 삭제할까요? 자료와 학습 기록이 모두 지워지고 되돌릴 수 없어요.`)) return;
    await Lib.remove(s.id); toast('삭제했어요'); go('#/manage');
  },
};

const IN = {
  blank(el) {
    const c = curQ(); if (!c) return;
    const i = Number(el.dataset.i);
    if (c.E) { const a = (c.E.resp[c.E.idx] || []).slice(); a[i] = el.value; c.E.resp[c.E.idx] = a; updateExamSheet(); }
    else { const a = (c.st.resp || []).slice(); a[i] = el.value; c.st.resp = a; }
  },
  short(el) {
    const c = curQ(); if (!c) return;
    if (c.E) { c.E.resp[c.E.idx] = el.value; updateExamSheet(); } else c.st.resp = el.value;
  },
  gRatio(el) {
    const o = App.ui.gen; o.objPct = Number(el.value);
    const nObj = Math.round(o.count * o.objPct / 100), nSub = o.count - nObj;
    const bar = document.getElementById('ratioBar');
    if (bar) bar.innerHTML = `<i class="o" style="width:${o.objPct}%">${nObj ? '객관식 ' + nObj : ''}</i><i class="s" style="width:${100 - o.objPct}%">${nSub ? '주관식 ' + nSub : ''}</i>`;
    clearTimeout(IN.h); IN.h = setTimeout(render, 350);
  },
  gWeak(el) { App.ui.gen.weak = el.checked; },
  pf(el) { App.ui.pf[el.dataset.k] = el.value; },
  pfClear(el) { App.ui.pf.clearPin = el.checked; },
  sound(el) { Profiles.update(Profiles.cur.id, { sound: el.checked }); if (el.checked) Sfx.play('ok'); },
  ns(el) { App.ui.newSubj[el.dataset.k] = el.value; },
  up(el) { App.ui.up[el.dataset.k] = el.value; },
};

const CH = {
  conceptUnit(el) { go(L('s', el.dataset.sid, 'concept', el.value)); },
  gCount(el) { App.ui.gen.count = U.clamp(parseInt(el.value, 10) || 1, 1, 100); render(); },
  gMin(el) { App.ui.gen.minutes = U.clamp(parseInt(el.value, 10) || 0, 0, 300); render(); },
  files(el) { const fs = [...el.files]; el.value = ''; handleFiles(fs, el.dataset.target); },
  matName(el) {
    const v = el.value.trim(); if (!v) return;
    mutateSubject(el.dataset.sid, s => { const m = s.materials.find(x => x.id === el.dataset.mid); if (m) m.name = v; }, '자료 이름을 바꿨어요');
  },
  async pfPhoto(el) {
    const f = el.files && el.files[0]; if (!f) return;
    try { App.ui.pf.photo = await resizePhoto(f); render(); } catch (e) { toast(e.message); }
  },
  restore(el) {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try { const p = await Profiles.restoreBackup(JSON.parse(String(rd.result))); toast(`「${p.name}」 프로필을 불러왔어요`); render(); }
      catch (e) { toast(e.message || '백업 파일을 읽지 못했어요'); }
    };
    rd.readAsText(f, 'utf-8');
  },
  importSubj(el) {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const d = JSON.parse(String(rd.result));
        if (d.format !== 'ssro-subject-2' || !Array.isArray(d.materials)) throw new Error('스스로 과목 파일이 아니에요.');
        const s = { id: U.uid('s'), name: d.name || '가져온 과목', desc: d.desc || '', materials: d.materials.map(m => ({ ...m, id: U.uid('m') })) };
        await Lib.save(s); toast(`「${s.name}」 과목을 불러왔어요`); render();
      } catch (e) { toast(e.message || '파일을 읽지 못했어요'); }
    };
    rd.readAsText(f, 'utf-8');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (App.ui.themeOpen && !e.target.closest('.theme-pop')) { App.ui.themeOpen = false; render(); } return; }
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
document.addEventListener('dragover', e => { const d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', e => { const d = e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
document.addEventListener('drop', e => {
  const d = e.target.closest('[data-drop]');
  if (!d) return;
  e.preventDefault(); d.classList.remove('over');
  if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files], d.dataset.drop);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (App.ui.themeOpen || App.ui.dialog || App.ui.pinFor)) { App.ui.themeOpen = false; App.ui.dialog = null; App.ui.pinFor = null; render(); return; }
  if (e.key === 'Enter' && e.target.id === 'pinIn') { e.preventDefault(); ACT.pinOk(); return; }
  if (e.key === 'Enter' && App.ctx === 'play' && document.querySelector('.fb-sheet') && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); move(1); return; }
  if (!App.ctx || App.ui.dialog || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (tag === 'INPUT') {
    if (e.key === 'Enter' && e.target.dataset.in === 'blank' && App.ctx === 'play') { e.preventDefault(); ACT.check(); }
    return;
  }
  if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
  else if (/^[1-9]$/.test(e.key)) {
    const c = curQ(); if (!c) return;
    const i = Number(e.key) - 1, max = c.q.type === 'ox' ? 2 : (c.q.options || []).length;
    if ((c.q.type === 'mc' || c.q.type === 'ox') && i < max) ACT.pick({ dataset: { i } });
  }
});

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  const E = App.exam;
  // 시험 중 다른 화면으로 가면 시간을 멈추고 답안은 그대로 저장
  if (E && E.phase === 'run' && !location.hash.endsWith('/exam/run') && !E.pausedAt) {
    pauseExam(); App.ui.dialog = null;
    toast('시험을 잠시 멈췄어요. 오른쪽 아래 버튼으로 이어서 볼 수 있어요');
  }
  lastHash = location.hash;
  App.ui.themeOpen = false;
  document.querySelectorAll('.confetti, .xpfloat').forEach(x => x.remove());
  render();
  window.scrollTo(0, 0);
});
// 앱을 닫거나 다른 앱으로 넘어갈 때도 저장 (글자 입력 중인 답안 포함)
window.addEventListener('pagehide', () => Session.save());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Session.save(); });

// 설명서: 손가락으로 좌우로 밀어 넘기기
let swipeX = null;
document.addEventListener('touchstart', e => { if (e.target.closest('[data-swipe]')) swipeX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', e => {
  if (swipeX == null || App.ui.guide == null) return;
  const dx = e.changedTouches[0].clientX - swipeX; swipeX = null;
  const n = (GUIDE[I18N.lang] || GUIDE.ko).length;
  if (dx < -50 && App.ui.guide < n - 1) ACT.guideNext();
  else if (dx > 50 && App.ui.guide > 0) ACT.guidePrev();
});
document.addEventListener('keydown', e => {
  if (App.ui.guide == null) return;
  if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); if (App.ui.guide < (GUIDE[I18N.lang] || GUIDE.ko).length - 1) ACT.guideNext(); }
  else if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); ACT.guidePrev(); }
  else if (e.key === 'Escape') { e.stopImmediatePropagation(); closeGuide(); }
}, true);

(async function init() {
  I18N.init();
  document.documentElement.lang = I18N.lang;
  await DB.open();
  Profiles.restore();
  applyTheme(Profiles.cur ? Profiles.cur.theme || 'calm' : LS.get('theme', 'calm'), false);
  await Lib.load();
  Session.load();
  Prog.onNewDay = n => setTimeout(() => toast(`🧱 공부 탑이 한 층 올라갔어요! (${n}층)`), 900);
  render();
  // 웹으로 열었을 때만 오프라인 캐시 사용 (안드로이드 앱 안에서는 파일이 이미 들어 있음)
  if (location.protocol.startsWith('http') && 'serviceWorker' in navigator && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
