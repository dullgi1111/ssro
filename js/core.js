/* 스스로 — 핵심 로직: 유틸 · 저장소 · 프로필 · 과목 · 학습 기록 · 채점 */
'use strict';

const U = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  uid(p = 'x') { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  pct(a, b) { return b ? Math.round(a / b * 100) : 0; },
  mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
  },
  date(t) {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
  day(t = Date.now()) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  plain(html) { return String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); },
  // 답안 비교용 정규화: 공백·기호 제거, 소문자, 전각→반각
  norm(s) {
    return String(s ?? '').normalize('NFKC').toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[\s·.,\-–—_()\[\]{}'"`~∼:;!?/\\]+/g, '');
  },
  fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); },
};

/* ---------- 로컬 저장 ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ssro.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ssro.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('ssro.' + k); } catch { } },
  keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('ssro.' + prefix)) out.push(k.slice(5)); } } catch { } return out; },
};

// 과목(자료 포함)은 IndexedDB에 저장 (용량 큼). 안 되면 localStorage로.
const DB = {
  db: null, mode: 'idb',
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('ssro', 2);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('subjects')) r.result.createObjectStore('subjects', { keyPath: 'id' }); };
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => { this.mode = 'ls'; res(); };
      } catch { this.mode = 'ls'; res(); }
    });
  },
  tx(mode) { return this.db.transaction('subjects', mode).objectStore('subjects'); },
  all() {
    if (this.mode === 'ls') return Promise.resolve(LS.get('subjects', []));
    return new Promise(res => { const r = this.tx('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
  },
  put(s) {
    if (this.mode === 'ls') {
      const all = LS.get('subjects', []).filter(x => x.id !== s.id); all.push(s);
      return Promise.resolve(LS.set('subjects', all));
    }
    return new Promise(res => { const r = this.tx('readwrite').put(s); r.onsuccess = () => res(true); r.onerror = () => res(false); });
  },
  del(id) {
    if (this.mode === 'ls') { LS.set('subjects', LS.get('subjects', []).filter(x => x.id !== id)); return Promise.resolve(); }
    return new Promise(res => { const r = this.tx('readwrite').delete(id); r.onsuccess = r.onerror = () => res(); });
  },
};

const TYPES = { mc: '객관식', ox: 'OX', blank: '빈칸', short: '서술형' };
const OBJ_TYPES = ['mc', 'ox'];         // 고르는 문제 = 객관식
const SUBJ_TYPES = ['blank', 'short'];  // 쓰는 문제 = 주관식
const DIFF = { 1: '쉬움', 2: '보통', 3: '어려움' };
const KIND = { pdf: 'PDF', pptx: 'PPT', hwp: '한글', hwpx: '한글', docx: '워드', text: '텍스트' };

/* ---------- 프로필 (기기 안 로그인) ---------- */
const Profiles = {
  cur: null,
  all() { return LS.get('profiles', []); },
  get(id) { return this.all().find(p => p.id === id) || null; },
  pinHash(id, pin) { return U.fnv('ssro|' + id + '|' + pin); },
  restore() { const id = LS.get('current', null); this.cur = id ? this.get(id) : null; },
  create(d) {
    const id = U.uid('p');
    const p = { id, name: d.name, school: d.school || '', major: d.major || '', grade: d.grade || '', motto: d.motto || '',
      avatar: d.avatar || '🦊', photo: d.photo || '', color: d.color || '#2f6f66', theme: d.theme || 'calm', goal: 50, sound: true,
      pin: d.pin ? this.pinHash(id, d.pin) : null, createdAt: Date.now() };
    LS.set('profiles', [...this.all(), p]);
    return p;
  },
  update(id, patch) {
    const list = this.all().map(p => p.id === id ? { ...p, ...patch } : p);
    LS.set('profiles', list);
    if (this.cur && this.cur.id === id) this.cur = list.find(p => p.id === id);
  },
  checkPin(p, pin) { return !p.pin || p.pin === this.pinHash(p.id, String(pin)); },
  login(id) { LS.set('current', id); this.cur = this.get(id); Prog.cache = {}; },
  logout() { LS.del('current'); this.cur = null; Prog.cache = {}; },
  async remove(id) {
    for (const s of await DB.all()) if (s.owner === id) await DB.del(s.id);
    LS.keys('p.' + id + '.').forEach(k => LS.del(k));
    LS.set('profiles', this.all().filter(p => p.id !== id));
    if (this.cur && this.cur.id === id) this.logout();
  },
  // 백업: 프로필 + 과목(자료) + 학습 기록을 파일 하나로
  async backup(id) {
    const p = this.get(id);
    const subjects = (await DB.all()).filter(s => s.owner === id);
    const prog = {};
    subjects.forEach(s => { prog[s.id] = LS.get(`p.${id}.prog.${s.id}`, null); });
    return { format: 'ssro-backup-1', exportedAt: Date.now(), profile: p, subjects, prog, days: LS.get(`p.${id}.days`, []), xp: LS.get(`p.${id}.xp`, null),
      // [추가] 날짜별 풀이 기록 · 친구 카드 · 대결 기록
      daily: LS.get(`p.${id}.daily`, null), friends: LS.get(`p.${id}.friends`, null), duels: LS.get(`p.${id}.duels`, null),
      // [추가] 포인트 · 교환 내역 · 학점 계산기
      pts: LS.get(`p.${id}.pts`, null), gpa: LS.get(`p.${id}.gpa`, null) };
  },
  async restoreBackup(b) {
    if (!b || b.format !== 'ssro-backup-1' || !b.profile) throw new Error('스스로 백업 파일이 아니에요.');
    const old = b.profile, id = U.uid('p');
    const p = { ...old, id, pin: null, createdAt: old.createdAt || Date.now() };
    if (this.all().some(x => x.name === p.name)) p.name += ' (가져옴)';
    LS.set('profiles', [...this.all(), p]);
    const sidMap = {};
    for (const s of b.subjects || []) {
      const nid = U.uid('s');
      sidMap[s.id] = nid;
      await DB.put({ ...s, id: nid, owner: id });
      if (b.prog && b.prog[s.id]) LS.set(`p.${id}.prog.${nid}`, b.prog[s.id]);
    }
    LS.set(`p.${id}.days`, b.days || []);
    if (b.xp) LS.set(`p.${id}.xp`, b.xp);
    // [추가] 예전 백업에는 없으면 건너뜀. 날짜별 기록은 과목 id를 새 id로 바꿔 넣음
    if (b.daily) {
      const d = {};
      for (const [day, per] of Object.entries(b.daily)) { d[day] = {}; for (const [sid, v] of Object.entries(per)) d[day][sidMap[sid] || sid] = v; }
      LS.set(`p.${id}.daily`, d);
    }
    if (b.friends) LS.set(`p.${id}.friends`, b.friends);
    if (b.duels) LS.set(`p.${id}.duels`, b.duels);
    if (b.pts) LS.set(`p.${id}.pts`, b.pts);
    if (b.gpa) LS.set(`p.${id}.gpa`, b.gpa);
    return p;
  },
};

/* ---------- 과목 라이브러리 (현재 프로필 것만) ---------- */
const Lib = {
  list: [], map: {},
  async load() {
    const me = Profiles.cur && Profiles.cur.id;
    const all = me ? (await DB.all()).filter(s => s.owner === me) : [];
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    this.list = all.map(s => this.prep(s));
    this.map = Object.fromEntries(this.list.map(s => [s.id, s]));
  },
  prep(s) {
    s = { ...s, materials: s.materials || [] };
    Object.defineProperty(s, 'units', { value: s.materials.map(m => ({ id: m.id, title: m.name, kind: m.kind })), enumerable: false });
    Object.defineProperty(s, 'uById', { value: Object.fromEntries(s.units.map(u => [u.id, u])), enumerable: false });
    return s;
  },
  get(id) { return this.map[id]; },
  async save(subj) {
    const clean = JSON.parse(JSON.stringify(subj));
    clean.owner = Profiles.cur.id;
    if (!clean.createdAt) clean.createdAt = Date.now();
    clean.updatedAt = Date.now();
    const ok = await DB.put(clean);
    await this.load();
    return ok;
  },
  async remove(id) { await DB.del(id); Prog.reset(id); await this.load(); },
};

/* ---------- [추가] 복습 일정 (간격 반복) ----------
   틀리면 1단계(내일). 복습 날에 맞히면 다음 단계: 1일 → 3일 → 7일 → 14일 → 30일 → 완전 습득.
   복습 중 틀리면 다시 1단계. 복습 날이 아직 안 된 문제는 맞혀도 단계 그대로 */
const SRS = {
  GAP: [1, 3, 7, 14, 30],
  addDays(n, from = U.day()) { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return U.day(d.getTime()); },
  apply(r, q, score) {
    const today = U.day();
    if (score >= 1) {
      if (!r.box) { delete r.snap; return; }                 // 복습 대상이 아니면 예전처럼 사본을 지움
      if (r.due > today) return;                             // 아직 복습 날이 아님 → 단계 그대로
      if (r.box >= this.GAP.length) { r.mastered = Date.now(); delete r.box; delete r.due; delete r.snap; return; }
      r.box++; r.due = this.addDays(this.GAP[r.box - 1]); r.snap = q;
    } else {
      r.box = 1; r.due = this.addDays(1); r.snap = q; delete r.mastered;
    }
  },
  // 채점을 바꿀 때 되돌리기용 (문제 사본은 크니까 있었는지만 기억)
  keep(r) { return { box: r.box, due: r.due, mastered: r.mastered, sn: r.snap ? 1 : 0 }; },
  restore(r, k, q) {
    for (const f of ['box', 'due', 'mastered']) { if (k[f] === undefined) delete r[f]; else r[f] = k[f]; }
    if (k.sn) r.snap = q; else delete r.snap;
  },
};

/* ---------- [추가] 날짜별 · 과목별 푼 문제 수와 맞힌 수 (최근 400일) ---------- */
const Daily = {
  key() { return `p.${Profiles.cur.id}.daily`; },
  get() { return LS.get(this.key(), {}); },
  add(sid, n, c) {
    const d = this.get(), t = U.day();
    const per = d[t] || (d[t] = {}), v = per[sid] || (per[sid] = [0, 0]);
    v[0] += n; v[1] += c;
    const ks = Object.keys(d).sort();
    if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(k => delete d[k]);
    LS.set(this.key(), d);
  },
  on(day, sid) { const per = this.get()[day] || {}; return sid ? per[sid] || [0, 0] : Object.values(per).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]); },
};

/* ---------- 학습 기록 (프로필 × 과목) ---------- */
const Prog = {
  cache: {},
  key(sid) { return `p.${Profiles.cur.id}.prog.${sid}`; },
  of(sid) {
    if (!this.cache[sid]) {
      const p = LS.get(this.key(sid), { q: {}, learned: {}, exams: [], last: 0 });
      // [추가] 예전 오답은 처음 열 때 "1단계 · 오늘 복습"으로 옮김 (한 번만)
      if (!p.srs) {
        for (const r of Object.values(p.q)) if (r.s < 1 && r.snap && !r.box) { r.box = 1; r.due = U.day(); }
        p.srs = 1; LS.set(this.key(sid), p);
      }
      this.cache[sid] = p;
    }
    return this.cache[sid];
  },
  // [추가] 오늘 복습할 문제 · 단계별 통계 · 다음 복습
  due(sid) {
    const t = U.day();
    return Object.values(this.of(sid).q).filter(r => r.box && r.snap && r.due <= t).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box));
  },
  srsStat(sid) {
    const st = { box: [0, 0, 0, 0, 0], mastered: 0, due: 0, next: null };
    const t = U.day();
    for (const r of Object.values(this.of(sid).q)) {
      if (r.mastered) st.mastered++;
      if (r.box && r.snap) {
        st.box[r.box - 1]++;
        if (r.due <= t) st.due++;
        else if (!st.next || r.due < st.next.day) st.next = { day: r.due, n: 1 };
        else if (r.due === st.next.day) st.next.n++;
      }
    }
    return st;
  },
  save(sid) { LS.set(this.key(sid), this.of(sid)); },
  reset(sid) { delete this.cache[sid]; LS.del(this.key(sid)); },
  // 오늘 처음 공부하면 탑이 한 층 올라감 → onNewDay 알림
  onNewDay: null,
  touchDay() {
    const k = `p.${Profiles.cur.id}.days`, d = LS.get(k, []), t = U.day();
    if (!d.includes(t)) { d.push(t); LS.set(k, d.slice(-400)); if (this.onNewDay) this.onNewDay(this.streak()); }
  },
  // 가장 높이 쌓았던 탑 (가장 길었던 연속 공부일)
  best() {
    const ds = [...new Set(this.days())].sort();
    let best = 0, run = 0, prev = null;
    for (const d of ds) {
      const t = new Date(d + 'T00:00:00').getTime();
      run = prev != null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    }
    return best;
  },
  days() { return LS.get(`p.${Profiles.cur.id}.days`, []); },
  streak() {
    const set = new Set(this.days());
    let n = 0;
    for (let t = Date.now(); ; t -= 86400000) {
      if (set.has(U.day(t))) n++;
      else if (n === 0 && U.day(t) === U.day()) continue;   // 오늘 아직 안 했으면 어제부터 셈
      else break;
    }
    return n;
  },
  // score: 1 맞음, 0.5 부분, 0 틀림. 틀린 문제는 다시 풀 수 있게 문제 자체를 같이 저장
  record(sid, q, score) {
    const p = this.of(sid);
    const r = p.q[q.id] || (p.q[q.id] = { n: 0, c: 0, w: 0, s: 0 });
    r.n++; r.s = score; r.t = Date.now(); r.u = q.unit; r.ty = q.type;
    if (score >= 1) r.c++; else r.w++;
    // [추가] 맞혀도 사본을 바로 지우지 않고 복습 단계에 따라 처리
    r.pk = SRS.keep(r); SRS.apply(r, q, score);
    p.last = Date.now();
    this.save(sid); this.touchDay();
    Daily.add(sid, 1, score >= 1 ? 1 : 0);
  },
  amend(sid, q, prev, next) {
    const r = this.of(sid).q[q.id];
    if (!r) return this.record(sid, q, next);
    if (prev >= 1) r.c--; else r.w--;
    if (next >= 1) r.c++; else r.w++;
    // [추가] 서술형 자기 채점을 바꾸면 복습 단계도 다시 계산
    if (r.pk) SRS.restore(r, r.pk, q);
    SRS.apply(r, q, next);
    if ((prev >= 1) !== (next >= 1)) Daily.add(sid, 0, next >= 1 ? 1 : -1);
    r.s = next; this.save(sid);
  },
  learn(sid, uid, on = true) {
    const p = this.of(sid);
    if (on) p.learned[uid] = Date.now(); else delete p.learned[uid];
    p.last = Date.now(); this.save(sid); if (on) this.touchDay();
  },
  addExam(sid, rec) {
    const p = this.of(sid);
    p.exams.unshift(rec); p.exams = p.exams.slice(0, 50); p.last = Date.now();
    this.save(sid); this.touchDay();
  },
  wrong(sid) {
    return Object.entries(this.of(sid).q).filter(([, r]) => r.s < 1 && r.snap).sort((a, b) => b[1].t - a[1].t).map(([, r]) => r);
  },
  weakMap(sid) {
    const out = {};
    for (const [id, r] of Object.entries(this.of(sid).q)) out[id] = r.s < 1 ? 3 + r.w : 0;
    return out;
  },
  unitStat(subj, uid) {
    let seen = 0, ok = 0;
    for (const r of Object.values(this.of(subj.id).q)) if (r.u === uid) { seen++; if (r.s >= 1) ok++; }
    return { seen, ok, wrong: seen - ok, acc: seen ? ok / seen : null, learned: !!this.of(subj.id).learned[uid] };
  },
  subjStat(subj) {
    const p = this.of(subj.id);
    let seen = 0, ok = 0;
    for (const r of Object.values(p.q)) { seen++; if (r.s >= 1) ok++; }
    const best = p.exams.reduce((m, e) => Math.max(m, e.score), 0);
    return { seen, ok, wrong: seen - ok, acc: seen ? ok / seen : null, learned: subj.units.filter(u => p.learned[u.id]).length,
      units: subj.units.length, exams: p.exams.length, best, last: p.last };
  },
  weakUnits(subj, n = 3) {
    return subj.units.map(u => ({ u, st: this.unitStat(subj, u.id) }))
      .filter(x => x.st.seen >= 3 && x.st.acc < 0.7).sort((a, b) => a.st.acc - b.st.acc).slice(0, n);
  },
};

/* ---------- XP · 레벨 · 하루 목표 (프로필별) ---------- */
const XP = {
  key() { return `p.${Profiles.cur.id}.xp`; },
  get() { return LS.get(this.key(), { total: 0, days: {} }); },
  add(n) {
    const x = this.get();
    x.total += n;
    const d = U.day();
    x.days[d] = (x.days[d] || 0) + n;
    const keys = Object.keys(x.days).sort();
    if (keys.length > 120) keys.slice(0, keys.length - 120).forEach(k => delete x.days[k]);
    LS.set(this.key(), x);
    return x;
  },
  today() { return this.get().days[U.day()] || 0; },
  goal() { return (Profiles.cur && Profiles.cur.goal) || 50; },
  // 레벨 n에 오르는 데 필요한 누적 XP: 50·n·(n−1) → 1레벨 0, 2레벨 100, 3레벨 300, 4레벨 600…
  level(total = this.get().total) {
    let n = 1;
    while (total >= 50 * (n + 1) * n) n++;
    const from = 50 * n * (n - 1), to = 50 * (n + 1) * n;
    return { lv: n, from, to, pct: Math.round((total - from) / (to - from) * 100) };
  },
  week() {
    const x = this.get(), out = [];
    for (let i = 6; i >= 0; i--) { const t = Date.now() - i * 86400000; out.push({ d: new Date(t), xp: x.days[U.day(t)] || 0 }); }
    return out;
  },
};

/* ---------- 채점 ---------- */
const Grade = {
  mc(q, r) { return r === q.answer ? 1 : 0; },
  ox(q, r) { return r === q.answer ? 1 : 0; },
  blankEach(q, r) {
    return q.blanks.map((acc, i) => {
      const v = U.norm((r || [])[i]);
      return !!v && acc.some(a => U.norm(a) === v);
    });
  },
  blank(q, r) {
    const each = this.blankEach(q, r), n = each.filter(Boolean).length;
    return n === each.length ? 1 : n === 0 ? 0 : 0.5;
  },
  // 서술형: 자료에서 뽑은 채점 기준(핵심 키워드)으로 판정 → 본인이 최종 확정
  judgeShort(q, text) {
    const t = U.norm(text);
    const items = (q.rubric || []).map(r => {
      const alts = r.keywords.flatMap(k => String(k).split('|')).map(U.norm).filter(Boolean);
      return { ...r, hit: !!t && alts.some(a => t.includes(a)) };
    });
    const total = items.reduce((s, r) => s + r.pts, 0);
    const got = items.filter(r => r.hit).reduce((s, r) => s + r.pts, 0);
    const ratio = total ? got / total : 0;
    const verdict = !t ? 0 : !items.length ? null : ratio >= 0.85 ? 1 : ratio >= 0.4 ? 0.5 : 0;
    return { items, total, got, ratio, verdict };
  },
  auto(q, r) {
    if (q.type === 'short') return null;
    if (!this.answered(q, r)) return 0;
    return this[q.type](q, r);
  },
  answered(q, r) {
    if (r == null) return false;
    if (q.type === 'short') return String(r).trim().length > 0;
    if (q.type === 'blank') return (r || []).some(x => String(x || '').trim());
    return true;
  },
};

/* ---------- 파일 내려받기 ---------- */
// [추가] 파일 저장 공통 함수 (백업 · 과목 파일 · 리포트 이미지)
function saveBlob(fileName, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function downloadJSON(name, obj) {
  saveBlob(name + '.json', new Blob([JSON.stringify(obj)], { type: 'application/json' }));
}
