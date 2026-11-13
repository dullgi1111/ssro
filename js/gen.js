/* 스스로 — 자료에서 개념 카드·문제를 규칙으로 만들기 (AI·인터넷 불필요)
   빈칸: 핵심 용어·숫자 가리기 / OX: 숫자·용어 바꿔치기 / 객관식: 같은 자료 속 다른 용어를 오답 보기로
   서술형: 소제목을 묻고 본문 키워드로 채점 기준 생성 / 난이도: 문장 길이·가리는 칸 수·보기 유사도로 결정 */
'use strict';

const Gen = (() => {
  const CI = '①②③④⑤⑥⑦⑧⑨⑩';
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  const esc = s => U.esc(s);
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  /* ---------- 낱말 다루기 ---------- */
  const STOP = new Set(('것 등 수 및 또는 그리고 하지만 그러나 따라서 때문 경우 위해 통해 대해 관련 사용 이용 가능 필요 중요 정도 이상 이하 미만 초과 이후 이전 다음 아래 위의 각각 모두 가장 매우 주로 대부분 일반 일반적 여러 다양 기타 예시 예를 구분 종류 특징 방법 과정 내용 설명 정의 의미 결과 문제 부분 사항 목적 개요 요약 정리 참고 그림 사진 자료 슬라이드 페이지 이번 우리 해당 자체 전체 일부 하나 처음 마지막 현재 최근 항상 반드시 보통 특히 또한 예 약 총 각 기본 주요 다른 같은 새로운 있음 없음 이것 그것 여기 거기 무엇 어디 언제 누구 모든 어떤 이러한 그러한 이런 그런 정말 너무 조금 많이 거의 바로 이미 아직 다시 함께 서로 계속 먼저 나중 이제 그때 오늘 내일 어제 대한 위한 통한 의한 따른 인한 관한 있는 없는 하는 되는 같이 처럼 만큼 때문에 경우에 위하여 대하여 관하여 이며 이고 있다 없다 한다 된다 했다 ' +
    '불가 가능 강화 증가 감소 확대 축소 개선 향상 저하 발생 진행 실시 제공 확인 적용 활용 대응 관리 운영 지원 추진 마련 구축 검토 ' +
    '측면 분야 대상 기준 요인 요소 수준 정책 방안 영향 효과 이유 문제점 현황 상황 사례 연구 분석 조사 비교 차이 관계 역할 기능 ' +
    '구조 형태 상태 특성 성격 개념 이론 원리 원칙 단점 장점 한계 의의 목표 계획 시간 기간 당시 이상의 이하의 여부 사용한 사람 ' +
    '본 연구 논문 저자 표본 자료로 위의 아래의 다음과').split(' '));
  const EN_STOP = new Set('the and for are was were with that this from into have has had not but its their there which when what who how why can will may also than then them they these those such each other more most some any all one two three per via etc vs'.split(' '));
  const SAFE_P = ['에서는', '에서도', '으로는', '으로써', '으로서', '이라는', '이라고', '에게서', '까지는', '부터는', '에서', '에게', '으로', '부터', '까지', '처럼', '보다', '마다', '이나', '이며', '이고', '이다', '이란', '라는', '에는', '에도', '와는', '과는', '로는', '로써', '로서', '은', '는', '을', '를', '의', '에', '로', '와', '과', '란'];
  const AMBI_P = ['이', '가', '도', '만', '들'];
  const VERBISH = /(하는|되는|있는|없는|한다|된다|이다|하며|되며|하고|되고|하여|되어|해서|하면|되면|했다|됐다|있다|없다|같은|위한|대한|통한|의한|따른|인한|높은|낮은|많은|적은|중요한|필요한|가능한|다양한|이러한|이런|그런|어떤|모든|시킨|시켜|하기|되기|니다|였다|었다|았다|으며|으면|도록|려고|어서|아서|적인|적으로|나타내|만들|이루|가지|보이|알리|불리|여기|지니|따르|다르|이르|부르|흐르|모르|못한|않은|[다요며면서게지음함됨야았었하되])$/;
  const JUNK = new Set('것은 것이 것을 것의 것도 것과 등의 등은 등을 등이 등과 이에 인해 이들 이를 이는 이와 이의 사이 수가 수는 수도 때문에 위해서 대해서 그는 그것 이것 저것 이번에 또한 때는 때의 경우는 경우의 그대로 이대로 스스로 서로의 라고 라고도 이라고 이라고도 라는 이라는 라고는 하여 또는 및 혹은'.split(' '));

  // 조사 떼기: '은·는·을·를…'은 바로 떼고, '이·가·도…'는 자료 안에 뗀 형태가 따로 나올 때만 뗀다 (베르누이 → 베르누 방지)
  let BARE = new Set();
  function stripParticle(t) {
    for (const p of SAFE_P) if (t.endsWith(p) && t.length - p.length >= 2) return t.slice(0, -p.length);
    for (const p of AMBI_P) {
      if (!t.endsWith(p) || t.length - p.length < 2) continue;
      const s = t.slice(0, -p.length);
      if (BARE.has(s) || (t.length >= 4 && p !== '이' && p !== '인')) return s;
    }
    return t;
  }
  function collectBare(texts) {
    const set = new Set();
    for (const text of texts) for (let tok of text.split(/[\s,.;:!?()\[\]{}<>「」『』“”"'‘’·ㆍ/~∼=+→←↔⇒…|]+/)) {
      tok = tok.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9₀-₉]+$/g, '');
      if (!/[가-힣]/.test(tok)) continue;
      set.add(tok);
      for (const p of SAFE_P) if (tok.endsWith(p) && tok.length - p.length >= 2) { set.add(tok.slice(0, -p.length)); break; }
    }
    return set;
  }
  // 문제로 쓸 만한 문장인지 (숫자·기호 위주 줄, 출처·주소 줄 제외)
  function goodFact(s) {
    const lt = (s.match(/[가-힣A-Za-z]/g) || []).length;
    const open = (s.match(/[(（[]/g) || []).length, close = (s.match(/[)）\]]/g) || []).length;
    const words = s.split(/\s+/).filter(w => (w.match(/[가-힣A-Za-z]/g) || []).length >= 2).length;   // 두 글자 이상 낱말 수
    if (s.includes('[수식]')) return false;   // 깨진 수식이 섞인 문장은 출제하지 않음
    return s.length >= 15 && lt / s.length >= 0.45 && words >= 4 && open <= close && !/[(,·]$/.test(s) && !/^[:;,)\]·]/.test(s)
      && !/https?:|www\.|doi[:.]|\bpp?\.\s*\d|ISBN|\.do\?|\d+\(\d+\),\s*\d+\s*[-–]\s*\d+|\(\d{4}[a-z]?\)\s*[.,]/i.test(s);
  }
  function terms(text) {
    const out = new Set();
    for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9₀-₉\-+/]*[A-Za-z0-9₀-₉]/g)) {
      const w = m[0];
      if (w.length < 2 || EN_STOP.has(w.toLowerCase())) continue;
      if (/[A-Z]/.test(w) || w.length >= 4) out.add(w);
    }
    for (let tok of text.split(/[\s,.;:!?()\[\]{}<>「」『』“”"'‘’·ㆍ/~∼=+→←↔⇒…|]+/)) {
      tok = tok.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9₀-₉]+$/g, '');
      if (!/[가-힣]/.test(tok) || JUNK.has(tok)) continue;
      if (SAFE_P.some(p => tok.endsWith(p) && tok.length - p.length === 1)) continue;   // 양의, 수는 같은 한 글자+조사
      const w = stripParticle(tok);
      if (w.length < 2 || w.length > 14 || !/^[가-힣A-Za-z0-9₀-₉\-]+$/.test(w)) continue;
      if (VERBISH.test(w) || STOP.has(w) || /^\d/.test(w)) continue;
      out.add(w);
    }
    return [...out];
  }
  const kindOf = t => /[가-힣]/.test(t) ? 'ko' : 'en';

  /* ---------- 숫자(값+단위) ---------- */
  const UNIT = '℃|°C|°F|wt%|vol%|%|‰|ppm|ppb|kg|mg|g|톤|mL|L|ℓ|m³|㎥|m²|㎡|km|cm|mm|㎛|μm|nm|kPa|MPa|Pa|atm|bar|psi|mmHg|kcal|cal|kJ|J|kWh|kW|MW|W|Hz|rpm|dB|lx|년|개월|일|시간|분|초|개|배|명|회|종|가지|층|단계|차|번|원|만원|억|bbl|배럴|BPD|gal|mol|K|V|A';
  const NUM_RE = new RegExp(`(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)(?:\\s*[~∼]\\s*(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?))?\\s*(${UNIT})?(?![A-Za-z가-힣])`, 'g');
  function nums(text) {
    const out = [];
    for (const m of text.matchAll(NUM_RE)) {
      const raw = m[0].trim(), unit = m[3] || '';
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (!unit && !(v >= 10 || m[1].includes('.') || m[2])) continue;
      if (m.index === 0 && /^[.)]/.test(text.slice(m[0].length))) continue;   // "1." 같은 번호
      if (!unit && /^(19|20)\d\d$/.test(m[1])) continue;
      out.push({ raw, v, v2: m[2] ? parseFloat(m[2].replace(/,/g, '')) : null, unit });
    }
    return out;
  }
  function numAlts(n) {
    const a = new Set([n.raw, n.raw.replace(/\s+/g, ''), n.raw.replace(/[~∼]/, '-')]);
    if (n.unit) a.add(n.raw.replace(n.unit, '').trim());
    return [...a];
  }
  function fakeNums(n, k) {
    const out = new Set(), fmtN = x => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('en-US');
    const mul = U.shuffle([2, 0.5, 1.5, 10, 0.1, 3, 0.75, 1.25, 4]);
    for (const f of mul) {
      if (out.size >= k) break;
      let s = fmtN(n.v * f);
      if (n.v2 != null) s += '~' + fmtN(n.v2 * f);
      s += n.unit;
      if (s !== n.raw.replace(/\s+/g, '')) out.add(s);
    }
    return [...out];
  }

  /* ---------- 문장 나누기 · 정의 찾기 ---------- */
  function sentences(line) {
    return line.split(/(?<=[.!?。])\s+(?=\S)/).map(s => s.trim()).filter(s => s.length >= 8 && s.length <= 220);
  }
  function termAlts(t) {
    const m = t.match(/^(.+?)\s*\((.+)\)$/);
    return m ? [t, m[1].trim(), m[2].trim()] : [t];
  }
  function defOf(line) {
    let m = line.match(/^([^:：=]{2,30}?)\s*[:：=]\s*(.{6,})$/)
      || line.match(/^(.{2,25}?)\s*(?:이란|란)\s+(.{6,})$/)
      || line.match(/^(.{2,20}?)(?:은|는)\s+(.{6,}?)(?:을|를)?\s*(?:말한다|의미한다|뜻한다)\.?$/);
    if (!m) return null;
    const term = m[1].replace(/^[\d.)\s]+/, '').trim(), desc = m[2].trim();
    if (term.split(/\s+/).length > 4 || !/[가-힣A-Za-z]/.test(term) || desc.length < 6) return null;
    if (/https?|www|^\/\//i.test(term + ' ' + desc.slice(0, 4)) || !goodFact(term + ' ' + desc)) return null;
    return { term, desc };
  }

  /* ---------- 자료 분석 (과목별로 한 번) ---------- */
  const cache = new Map();
  function analyze(subj) {
    const ck = subj.id + '|' + (subj.updatedAt || 0) + '|' + subj.materials.length;
    if (cache.has(ck)) { const A = cache.get(ck); BARE = A.bare; return A; }
    const facts = [], secs = [], defs = [], stat = new Map();
    const bump = t => { if (!stat.has(t)) stat.set(t, { n: 0, units: new Set(), defn: false, title: false }); return stat.get(t); };
    // 예전에 올린 자료도 깨진 글자를 정리해서 사용 (Extract.tidy)
    const mats = subj.materials.map(m => ({ ...m, sections: m.sections.map(s => ({ ...s, title: Extract.tidy(s.title), lines: s.lines.map(Extract.tidy).filter(Boolean) })) }));
    BARE = collectBare(mats.flatMap(m => m.sections.flatMap(s => [s.title, ...s.lines])));
    for (const m of mats) {
      m.sections.forEach((sec, si) => {
        const sid = m.id + ':' + si, sf = [];
        for (const line of sec.lines) {
          for (const s of sentences(line)) {
            if (!goodFact(s)) continue;
            const f = { id: hash(m.id + '|' + s), unit: m.id, sec: sid, title: sec.title, text: s, terms: terms(s), nums: nums(s) };
            facts.push(f); sf.push(f);
          }
          const d = defOf(line);
          if (d) defs.push({ ...d, unit: m.id, sec: sid, title: sec.title, id: hash('d|' + m.id + '|' + line) });
        }
        if (sec.title) terms(sec.title).forEach(t => { bump(t).title = true; });
        secs.push({ id: sid, unit: m.id, title: sec.title, lines: sec.lines, facts: sf });
      });
    }
    facts.forEach(f => f.terms.forEach(t => { const r = bump(t); r.n++; r.units.add(f.unit); }));
    defs.forEach(d => { bump(d.term).defn = true; });
    const limit = Math.max(4, facts.length * 0.35);
    const key = new Map();
    for (const [t, r] of stat) {
      if (r.n > limit) continue;
      if (r.n >= 2 || r.defn || r.title) key.set(t, r.n + (r.defn ? 3 : 0) + (r.title ? 2 : 0) + Math.min(t.length, 6) * 0.15);
    }
    const termFact = new Map();
    facts.forEach(f => {
      f.key = f.terms.filter(t => key.has(t)).sort((a, b) => key.get(b) - key.get(a));
      if (!f.key.length) f.key = f.terms.filter(t => t.length >= 2 && stat.get(t)).sort((a, b) => b.length - a.length).slice(0, 2);
      f.terms.forEach(t => { if (!termFact.has(t)) termFact.set(t, f); });
    });
    let pool = [...key.keys()];
    if (pool.length < 8) pool = [...new Set([...pool, ...stat.keys()])];
    const numPool = facts.flatMap(f => f.nums.map(n => ({ ...n, unit_: f.unit })));
    const A = { facts, secs, defs, key, pool, numPool, termFact, bare: BARE, units: subj.materials.map(m => ({ id: m.id, title: m.name })) };
    cache.set(ck, A);
    return A;
  }

  /* ---------- 오답 보기 고르기 ---------- */
  function distract(A, ans, n, hard, f) {
    if (typeof ans === 'object') {   // 숫자: 단위가 같은 다른 값 → 없으면 값을 변형
      const same = !ans.unit ? [] : U.shuffle(A.numPool.filter(x => x.unit === ans.unit && x.raw.replace(/\s/g, '') !== ans.raw.replace(/\s/g, '') && !f.text.includes(x.raw)));
      const out = [];
      for (const x of same) { const r = x.raw.replace(/\s+/g, ''); if (!out.includes(r)) out.push(r); if (out.length >= n) break; }
      for (const x of fakeNums(ans, n)) { if (out.length >= n) break; if (!out.includes(x)) out.push(x); }
      return out.slice(0, n);
    }
    // 같은 단원(자료) 안의 다른 핵심 용어를 우선 사용. 어려움 = 같은 소단원·비슷한 길이 / 쉬움 = 단원 안에서 무작위
    const k = kindOf(ans);
    const cand = A.pool.filter(t => t !== ans && kindOf(t) === k && !t.includes(ans) && !ans.includes(t) && !f.text.includes(t));
    const sameUnit = cand.filter(t => A.termFact.get(t)?.unit === f.unit);
    const base = sameUnit.length >= n ? sameUnit : cand;
    if (hard) {
      const sameSec = base.filter(t => A.termFact.get(t)?.sec === f.sec);
      const close = (sameSec.length >= n ? sameSec : base).slice().sort((a, b) => Math.abs(a.length - ans.length) - Math.abs(b.length - ans.length) || (A.key.get(b) || 0) - (A.key.get(a) || 0));
      return U.shuffle(close.slice(0, n + 2)).slice(0, n);
    }
    const far = base.filter(t => A.termFact.get(t)?.sec !== f.sec);
    return U.shuffle(far.length >= n ? far : base).slice(0, n);
  }
  function whereNote(A, t) {
    const f = A.termFact.get(t);
    return f ? `자료의 다른 곳에 나온 말: “${esc(cut(f.text, 60))}”` : '자료 내용과 다른 값';
  }

  // 원문에서 대상 낱말을 표시로 바꾸기 (HTML 안전)
  function markText(text, targets, fn) {
    let s = text;
    const marks = [];
    targets.forEach((t, i) => {
      const at = s.indexOf(t);
      if (at < 0) return;
      s = s.slice(0, at) + '\u0001' + i + '\u0002' + s.slice(at + t.length);
      marks.push(i);
    });
    return esc(s).replace(/\u0001(\d+)\u0002/g, (_, i) => fn(Number(i), targets[i]));
  }
  const quote = h => `<div class="quote">${h}</div>`;

  /* ---------- 문제 만들기 ---------- */
  function qBlank(A, f, want) {
    const ks = f.key.filter(t => f.text.includes(t)), ns = f.nums;
    let tg = [];
    if (want === 1) tg = ks.length ? [ks[0]] : ns.length ? [ns[0]] : [];
    else if (want === 2) tg = ns.length && Math.random() < 0.5 ? [ns[0]] : ks.slice(0, 2);
    else tg = [...ks.slice(0, 2), ...ns.slice(0, 1)];
    if (!tg.length) tg = ks.length ? [ks[0]] : ns.slice(0, 1);
    if (!tg.length) return null;
    const raw = tg.map(t => typeof t === 'object' ? t.raw : t);
    // 앞에서 나오는 순서대로 번호 매기기
    const order = raw.map((t, i) => [t, i, f.text.indexOf(t)]).filter(x => x[2] >= 0).sort((a, b) => a[2] - b[2]);
    if (!order.length) return null;
    const tgts = order.map(x => x[0]), objs = order.map(x => tg[x[1]]);
    // 빈칸을 뚫고 남은 글자가 너무 적으면 힌트가 없는 문제라 버림
    if ((tgts.reduce((s, t) => s.replace(t, ''), f.text).match(/[가-힣A-Za-z]/g) || []).length < 10) return null;
    const hasNum = objs.some(o => typeof o === 'object');
    const score = tgts.length + (hasNum ? 1 : 0) + (f.text.length > 90 ? 1 : 0);
    return {
      id: 'q' + hash('blank|' + f.id), type: 'blank', unit: f.unit, src: f.title,
      diff: score <= 1 ? 1 : score === 2 ? 2 : 3,
      q: '다음 빈칸에 알맞은 말을 쓰시오.' + quote(markText(f.text, tgts, i => `<span class="bk">( ${CI[i]} )</span>`)),
      blanks: objs.map(o => typeof o === 'object' ? numAlts(o) : termAlts(o)),
      explain: '원문: ' + quote(markText(f.text, tgts, (i, t) => `<mark>${esc(t)}</mark>`)),
    };
  }

  function falsify(A, f, hard) {
    const useNum = f.nums.length && (hard || Math.random() < 0.4);
    if (useNum) {
      const n = pick(f.nums), alt = distract(A, n, 1, hard, f)[0];
      if (alt) return { text: f.text.replace(n.raw, alt), from: n.raw, to: alt, num: true };
    }
    const ks = f.key.filter(t => f.text.includes(t));
    if (!ks.length) return null;
    const t = hard ? ks[0] : pick(ks), alt = distract(A, t, 1, hard, f)[0];
    if (!alt) return null;
    return { text: f.text.replace(t, alt), from: t, to: alt, num: false };
  }

  function qOx(A, f, want) {
    const truth = want === 1 ? Math.random() < 0.6 : Math.random() < 0.35;
    let text = f.text, fv = null;
    if (!truth) { fv = falsify(A, f, want === 3); if (!fv) return null; text = fv.text; }
    const diff = truth ? (f.text.length < 70 ? 1 : 2) : (fv.num || want === 3 ? 3 : 2);
    return {
      id: 'q' + hash('ox|' + f.id), type: 'ox', unit: f.unit, src: f.title, diff,
      q: '다음 문장이 자료 내용과 맞으면 O, 틀리면 X를 고르시오.' + quote(esc(text)),
      answer: truth,
      explain: truth ? '자료에 나온 문장 그대로예요.' + quote(esc(f.text))
        : `<b>${esc(fv.to)}</b>이(가) 틀렸어요. 맞는 말은 <mark>${esc(fv.from)}</mark>예요.` + quote('원문: ' + markText(f.text, [fv.from], (i, t) => `<mark>${esc(t)}</mark>`)),
    };
  }

  function qMc(A, f, want, defs) {
    // ① 정의형: "다음 설명에 해당하는 것은?"
    const d = defs && defs.find(x => x.sec === f.sec && f.text.includes(x.desc.slice(0, 12)));
    if (d && Math.random() < 0.6) {
      const ds = distract(A, d.term, 3, want >= 2, f);
      if (ds.length === 3) {
        const opts = U.shuffle([d.term, ...ds]);
        return {
          id: 'q' + hash('mcd|' + d.id), type: 'mc', unit: f.unit, src: f.title, diff: want >= 2 ? 2 : 1,
          q: '다음 설명에 해당하는 것은?' + quote(esc(d.desc)),
          options: opts.map(esc), answer: opts.indexOf(d.term),
          optionNotes: opts.map(o => o === d.term ? '정답 · 자료에서 이 설명의 용어' : whereNote(A, o)),
          explain: `<b>${esc(d.term)}</b>: ${esc(d.desc)}`,
        };
      }
    }
    // ② 옳은 문장 고르기 (어려움)
    if (want === 3 && Math.random() < 0.45) {
      const others = U.shuffle(A.facts.filter(x => x.unit === f.unit && x.id !== f.id && x.text.length < 120)).slice(0, 8);
      const wrong = [];
      for (const o of others) { const fv = falsify(A, o, true); if (fv) wrong.push({ text: fv.text, fv, o }); if (wrong.length === 3) break; }
      if (wrong.length === 3 && f.text.length < 140) {
        const opts = U.shuffle([{ text: f.text, ok: true }, ...wrong]);
        return {
          id: 'q' + hash('mct|' + f.id), type: 'mc', unit: f.unit, src: f.title, diff: 3,
          q: '다음 중 자료 내용과 <b>맞는</b> 것은?',
          options: opts.map(o => esc(o.text)), answer: opts.findIndex(o => o.ok),
          optionNotes: opts.map(o => o.ok ? '정답 · 자료 원문 그대로' : `틀림: ${esc(o.fv.to)} → 원래는 ${esc(o.fv.from)}`),
          explain: '원문: ' + quote(esc(f.text)),
        };
      }
    }
    // ③ 빈칸 채우기형
    const ks = f.key.filter(t => f.text.includes(t));
    const useNum = f.nums.length && (want === 3 || !ks.length || Math.random() < 0.3);
    const target = useNum ? f.nums[0] : ks[0];
    if (!target) return null;
    const ansText = typeof target === 'object' ? target.raw.replace(/\s+/g, '') : target;
    const ds = distract(A, target, 3, want >= 2, f);
    if (ds.length < 3) return null;
    const opts = U.shuffle([ansText, ...ds]);
    const rawT = typeof target === 'object' ? target.raw : target;
    const diff = want === 1 ? (f.text.length > 100 ? 2 : 1) : want === 2 ? 2 : 3;
    return {
      id: 'q' + hash('mc|' + f.id), type: 'mc', unit: f.unit, src: f.title, diff,
      q: '빈칸에 들어갈 알맞은 것은?' + quote(markText(f.text, [rawT], () => '<span class="bk">( ? )</span>')),
      options: opts.map(esc), answer: opts.indexOf(ansText),
      optionNotes: opts.map(o => o === ansText ? '정답 · 원문에 쓰인 말' : typeof target === 'object' ? '자료와 다른 값' : whereNote(A, o)),
      explain: '원문: ' + quote(markText(f.text, [rawT], (i, t) => `<mark>${esc(t)}</mark>`)),
    };
  }

  const GENERIC_T = /^(p\.?\s*\d+|\d+|슬라이드\s*\d+|목차|contents?|index|q\s*&\s*a|감사합니다|thank you)$/i;
  function qShortSec(A, sec, want) {
    if (!sec.title || sec.title.length < 2 || sec.title.length > 50 || GENERIC_T.test(sec.title.trim())) return null;
    if ((sec.title.match(/[가-힣A-Za-z]/g) || []).length < Math.max(3, sec.title.length * 0.5)) return null;   // "95%, 더 안정5%" 같은 제목 제외
    const items = sec.lines.map(l => ({ l, k: terms(l).filter(t => A.key.has(t) && !sec.title.includes(t)) })).filter(x => x.k.length);
    if (items.length < 2) return null;
    const n = Math.min(items.length, want === 3 ? 5 : want === 2 ? 3 : 2);
    const chosen = items.slice(0, n);
    return {
      id: 'q' + hash('short|' + sec.id), type: 'short', unit: sec.unit, src: sec.title,
      diff: n >= 4 ? 3 : 2,
      q: n >= 3 ? `「${esc(sec.title)}」에 대해 자료의 핵심 내용을 ${n}가지 쓰시오.` : `「${esc(sec.title)}」에 대해 설명하시오.`,
      model: sec.lines.slice(0, 7).map(l => '• ' + esc(l)).join('\n'),
      rubric: chosen.map(x => ({ pts: 1, point: cut(x.l, 50), keywords: [x.k.slice(0, 3).join('|')] })),
      explain: `채점 기준은 자료 각 줄의 핵심 용어예요. 용어가 답안에 들어 있으면 그 포인트를 맞힌 것으로 봐요.`,
    };
  }
  function qShortDef(A, d) {
    const ks = terms(d.desc).filter(t => t !== d.term).sort((a, b) => (A.key.get(b) || 0) - (A.key.get(a) || 0)).slice(0, 3);
    if (ks.length < 1) return null;
    return {
      id: 'q' + hash('shortd|' + d.id), type: 'short', unit: d.unit, src: d.title, diff: ks.length >= 3 ? 2 : 1,
      q: `「${esc(d.term)}」의 뜻을 쓰시오.`,
      model: esc(d.desc),
      rubric: ks.map(k => ({ pts: 1, point: k, keywords: [k] })),
      explain: `<b>${esc(d.term)}</b>: ${esc(d.desc)}`,
    };
  }

  /* ---------- 문제 세트 만들기 ---------- */
  // o: { units:[], count, objPct, diff:'mix'|1|2|3, weak: {문제id: 가중치} }
  function build(subj, o) {
    const A = analyze(subj);
    const inU = x => !o.units || !o.units.length || o.units.includes(x.unit);
    const facts = A.facts.filter(inU), secs = A.secs.filter(inU), defs = A.defs.filter(inU);
    const notes = [];
    if (!facts.length) return { list: [], notes: ['이 범위에는 문제를 만들 문장이 없어요.'] };
    const nObj = Math.round(o.count * o.objPct / 100), nSub = o.count - nObj;
    const used = new Set(), ids = new Set();
    const w = o.weak || {};
    const factW = f => 1 + Math.max(w['q' + hash('blank|' + f.id)] || 0, w['q' + hash('ox|' + f.id)] || 0, w['q' + hash('mc|' + f.id)] || 0);
    const drawFact = () => {
      const pool = facts.filter(f => !used.has(f.id));
      const src = pool.length ? pool : facts;
      const sum = src.reduce((s, f) => s + factW(f), 0);
      let r = Math.random() * sum;
      for (const f of src) { r -= factW(f); if (r <= 0) return f; }
      return src[src.length - 1];
    };
    const target = () => o.diff === 'mix' ? (Math.random() < 0.3 ? 1 : Math.random() < 0.72 ? 2 : 3) : Number(o.diff);
    const make = (type, want) => {
      if (type === 'short') {
        const useDef = defs.length && (Math.random() < 0.4 || !secs.length);
        const seeds = useDef ? U.shuffle(defs).slice(0, 6) : U.shuffle(secs).slice(0, 8);
        for (const sd of seeds) {
          if (used.has(sd.id)) continue;
          const q = useDef ? qShortDef(A, sd) : qShortSec(A, sd, want);
          if (q) { used.add(sd.id); return q; }
        }
        return null;
      }
      const f = drawFact();
      used.add(f.id);
      return type === 'mc' ? qMc(A, f, want, defs) : type === 'ox' ? qOx(A, f, want) : qBlank(A, f, want);
    };
    const fill = (n, types) => {
      const out = [];
      let guard = 0;
      while (out.length < n && guard < n * 25) {
        guard++;
        const want = target();
        const type = types();
        let q = make(type, want);
        if (!q && type === 'short') q = make('blank', want);
        if (!q || ids.has(q.id)) continue;
        if (q.diff !== want && guard < n * 12 && o.diff !== 'mix') continue;
        ids.add(q.id); out.push(q);
      }
      return out;
    };
    const objList = fill(nObj, () => Math.random() < 0.6 ? 'mc' : 'ox');
    const subList = fill(nSub, () => Math.random() < (secs.length || defs.length ? 0.35 : 0) ? 'short' : 'blank');
    if (objList.length < nObj) notes.push(`객관식을 ${objList.length}개만 만들 수 있었어요.`);
    if (subList.length < nSub) notes.push(`주관식을 ${subList.length}개만 만들 수 있었어요.`);
    if (o.diff !== 'mix') {
      const off = [...objList, ...subList].filter(q => q.diff !== Number(o.diff)).length;
      if (off) notes.push(`${DIFF[o.diff]} 난이도로 만들 수 없는 ${off}문항은 가까운 난이도로 채웠어요.`);
    }
    return { list: [...U.shuffle(objList), ...U.shuffle(subList)], notes };
  }

  /* ---------- 개념 카드 ---------- */
  function highlight(A, line) {
    BARE = A.bare;
    const ks = terms(line).filter(t => A.key.has(t)).sort((a, b) => b.length - a.length).slice(0, 3);
    return ks.length ? markText(line, ks, (i, t) => `<mark>${esc(t)}</mark>`) : esc(line);
  }
  function unitInfo(subj, uid) {
    const A = analyze(subj);
    const facts = A.facts.filter(f => f.unit === uid);
    const secs = A.secs.filter(s => s.unit === uid);
    const tc = new Map();
    facts.forEach(f => f.key.forEach(t => tc.set(t, (tc.get(t) || 0) + 1)));
    const top = [...tc.entries()].sort((a, b) => b[1] - a[1] || (A.key.get(b[0]) || 0) - (A.key.get(a[0]) || 0)).slice(0, 14).map(x => x[0]);
    return { A, facts: facts.length, secs, top, defs: A.defs.filter(d => d.unit === uid) };
  }
  function capacity(subj, uid) {
    const A = analyze(subj);
    const f = A.facts.filter(x => !uid || x.unit === uid).length;
    return { facts: f, approx: f * 3 + A.secs.filter(x => !uid || x.unit === uid).length };
  }
  return { analyze, build, unitInfo, highlight, capacity, hash, terms };
})();
