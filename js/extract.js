/* 스스로 — 자료 파일에서 글 뽑기 (모두 기기 안에서 처리, 인터넷·AI 불필요)
   결과 형식: { name, kind, sections: [{ title, lines: [문장…] }] } */
'use strict';

const Extract = (() => {
  const loaded = {};
  function need(name) {
    const src = { pdf: ['lib/pdf.worker.min.js', 'lib/pdf.min.js'], zip: ['lib/jszip.min.js'] }[name];
    if (!loaded[name]) loaded[name] = src.reduce((p, s) => p.then(() => new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = s; el.onload = res; el.onerror = () => rej(new Error(s + ' 를 불러오지 못했어요'));
      document.head.appendChild(el);
    })), Promise.resolve());
    return loaded[name];
  }

  const BULLET = /^[\s•●○◦▪▫■□◆◇►▶▷➢➤✓✔✗\-–—*·∙ㆍ→⇒]+/;
  const MARK = /^[•●○◦▪▫■□◆◇►▶▷➢➤✓✔✗\-–—*·∙ㆍ→⇒]/;
  // 표준 문자로 바꿀 수 없는 글자(사용자 전용 영역 등 — 한글 수식 편집기 글꼴이 대표적) → "[수식]" 표시
  //  * 이 코드는 PDF 읽기 도구가 파일마다 임시로 붙인 번호라 원래 기호로 되돌릴 수 없음
  const ODD = /[-�]/u;
  function fixPUA(s) {
    return String(s || '')
      .replace(/[-�](?:[\s-�=+\-×·*/^_(),.\d])*/gu, m => ODD.test(m) ? ' [수식] ' : m)
      .replace(/(\s*\[수식\]\s*)+/g, ' [수식] ')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  }
  const onlyFormula = s => !s.replace(/\[수식\]/g, '').replace(/[\s=+\-×·*/^_(),.\d]/g, '');
  function cleanLine(s) {
    return fixPUA(s).replace(/ /g, ' ').replace(/[​-‍﻿]/g, '')
      .replace(BULLET, '').replace(/\s+/g, ' ').trim();
  }
  const junk = s => !s || /^[\d\s/.\-–|·]+$/.test(s) || s.length < 2 || onlyFormula(s);

  // 제목처럼 보이는 줄
  const NUMBERED = /^(제\s*\d+\s*[장절과편부]|\d{1,2}(\.\d{1,2}){0,3}[.)]?\s|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.)]?\s|[IVX]{1,4}\.\s|[가-하][.)]\s|#{1,4}\s|\[[^\]]{2,30}\]$|【[^】]{2,30}】$|<[^>]{2,30}>$)/;
  const letters = s => (s.match(/[가-힣A-Za-z]/g) || []).length;
  function isHeading(line, next) {
    if (line.length > 45 || letters(line) < 2) return false;
    if (/[.。!?]$|다\.?$|요\.?$/.test(line)) return false;
    if (NUMBERED.test(line)) return true;
    return line.length <= 22 && !!next && next.length > line.length + 8 && !/[,:;]$/.test(line);
  }
  const stripHeadingMark = s => s.replace(/^#{1,4}\s*/, '').replace(/^\[(.+)\]$/, '$1').replace(/^【(.+)】$/, '$1').replace(/^<(.+)>$/, '$1').trim();

  // 일반 텍스트(줄 목록) → 제목 기준 구역 나누기
  function sectionize(rawLines) {
    const lines = rawLines.map(cleanLine).filter(l => !junk(l));
    const out = [];
    let cur = null;
    lines.forEach((l, i) => {
      if (isHeading(l, lines[i + 1])) { cur = { title: stripHeadingMark(l), lines: [] }; out.push(cur); }
      else { if (!cur) { cur = { title: '', lines: [] }; out.push(cur); } cur.lines.push(l); }
    });
    // 제목만 있고 내용이 없는 구역은 다음 구역과 합치기
    const merged = [];
    for (const s of out) {
      const prev = merged[merged.length - 1];
      if (prev && !prev.lines.length) { prev.title = prev.title ? prev.title + ' · ' + s.title : s.title; prev.lines = s.lines; }
      else merged.push(s);
    }
    // 제목이 하나도 없으면 8줄씩 나누기
    if (merged.length <= 1 && lines.length > 12) {
      const chunks = [];
      for (let i = 0; i < lines.length; i += 8) chunks.push({ title: '', lines: lines.slice(i, i + 8) });
      return chunks;
    }
    return merged.filter(s => s.lines.length || s.title);
  }

  /* ---------- PDF ---------- */
  async function pdf(buf) {
    await need('pdf');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const W = page.view[2] - page.view[0];
      const tc = await page.getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || i.height || 10, w: i.width || 0 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      // 같은 높이의 글자를 줄로 묶되, 간격이 크게 벌어지면 다른 덩어리(다른 단)로 나눈다
      const segs = [];
      for (const it of items) {
        const sg = segs[segs.length - 1];
        if (sg && Math.abs(sg.y - it.y) < Math.max(sg.h, it.h) * 0.55 && it.x - sg.end < Math.max(sg.h, it.h) * 1.1) {
          const gap = it.x - sg.end;
          sg.t += (gap > it.h * 0.2 && !sg.t.endsWith(' ') && !it.s.startsWith(' ') ? ' ' : '') + it.s;
          sg.end = Math.max(sg.end, it.x + it.w); sg.h = Math.max(sg.h, it.h);
        } else segs.push({ t: it.s, x: it.x, y: it.y, h: it.h, end: it.x + it.w });
      }
      // 2단 편집 감지: 가운데를 넘지 않는 왼쪽 덩어리와 가운데 뒤에서 시작하는 오른쪽 덩어리가 모두 많으면
      const mid = W / 2;
      const left = segs.filter(s => s.end <= mid + W * 0.03), right = segs.filter(s => s.x >= mid - W * 0.03);
      const twoCol = segs.length >= 12 && left.length >= segs.length * 0.3 && right.length >= segs.length * 0.3;
      let ordered;
      if (twoCol) {
        const full = segs.filter(s => !left.includes(s) && !right.includes(s));
        const top = full.filter(s => s.y >= Math.max(...left.map(l => l.y), ...right.map(r => r.y)));
        ordered = [...top, ...left, ...right, ...full.filter(s => !top.includes(s))];
      } else {
        // 한 단: 같은 줄의 덩어리를 다시 이어 붙임
        ordered = [];
        for (const s of segs) {
          const ln = ordered[ordered.length - 1];
          if (ln && Math.abs(ln.y - s.y) < Math.max(ln.h, s.h) * 0.55) { ln.t += ' ' + s.t; ln.end = s.end; ln.h = Math.max(ln.h, s.h); }
          else ordered.push({ ...s });
        }
      }
      // b: 글머리표(•, -, ①…)나 번호로 시작하는 줄 = 새 항목의 시작
      pages.push(ordered.map(l => { const t = cleanLine(l.t); return { t, h: l.h, b: MARK.test(l.t.trim()) || NUMBERED.test(t) || /^[①-⑳㉠-㉭※]/.test(t) }; }).filter(l => !junk(l.t)));
      page.cleanup();
    }
    // 여러 쪽에 반복되는 머리말·꼬리말 지우기 (쪽 번호만 다른 것도 같은 것으로 봄)
    const keyOf = t => t.replace(/\d+/g, '#');
    const freq = {};
    pages.forEach(ls => new Set(ls.map(l => keyOf(l.t))).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    const rep = new Set(Object.keys(freq).filter(t => pages.length >= 3 && freq[t] >= Math.max(3, pages.length * 0.4)));
    const sections = [];
    pages.forEach((ls, pi) => {
      ls = ls.filter(l => !rep.has(keyOf(l.t)));
      if (!ls.length) return;
      const hs = ls.map(l => l.h).sort((a, b) => a - b), med = hs[Math.floor(hs.length / 2)];
      let ti = -1;
      for (let i = 0; i < Math.min(3, ls.length); i++) {
        if (ls[i].t.length <= 60 && letters(ls[i].t) >= 2 && ls[i].h >= med * 1.15 && (ti < 0 || ls[i].h > ls[ti].h)) ti = i;
      }
      if (ti < 0 && ls.length > 1 && ls[0].t.length <= 30 && letters(ls[0].t) >= 2 && !/[.。]$/.test(ls[0].t)) ti = 0;
      const title = ti >= 0 ? ls[ti].t : '';
      const body = ls.filter((_, i) => i !== ti);
      sections.push({ title, lines: reflow(body), page: pi + 1 });
    });
    return sections;
  }
  // 줄바꿈 때문에 끊긴 문장 다시 잇기: 앞줄이 오른쪽 끝까지 찼고(그 쪽에서 긴 줄), 문장 끝처럼 끝나지 않았고,
  // 다음 줄이 글머리표·번호로 시작하지 않으면 이어 붙임
  const ENDED = /([.。!?:;…]|다|요|음|함|됨|임|것|등|\))$/;
  const ONE_WORD = new Set('및 등 또 즉 더 잘 각 총 약 곧 꼭 왜 다 그 이 저 한 두 세 네 수 것 때'.split(' '));
  function reflow(lines) {
    const maxLen = Math.max(0, ...lines.map(l => l.t.length));
    const full = Math.max(12, maxLen * 0.55);
    const out = [];
    for (const l of lines) {
      const p = out[out.length - 1];
      if (p && !l.b && !ENDED.test(p.t) && p.last >= full) {
        // 줄 끝이 한 글자로 끊겼으면(예: "가 / 지는") 띄어 쓰지 않고 붙임
        const last = p.t.split(' ').pop();
        const glue = /^[가-힣]$/.test(last) && !ONE_WORD.has(last) && /^[가-힣]/.test(l.t) ? '' : ' ';
        p.t += glue + l.t; p.last = l.t.length;
      } else out.push({ ...l, last: l.t.length });
    }
    return out.map(x => x.t);
  }

  /* ---------- 압축(zip) 기반: PPTX · HWPX · DOCX ---------- */
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const num = n => parseInt((n.match(/(\d+)\.xml$/) || [0, 0])[1], 10);
  // 문단(p)별로 그 문단에 직접 속한 글자(t)만 모은다 (표 안 문단과 중복 방지)
  function paragraphs(doc) {
    const out = [];
    let curP = null, buf = '';
    for (const t of doc.getElementsByTagNameNS('*', 't')) {
      let p = t.parentNode;
      while (p && p.localName !== 'p') p = p.parentNode;
      if (p !== curP) { if (buf.trim()) out.push(buf); buf = ''; curP = p; }
      buf += t.textContent;
    }
    if (buf.trim()) out.push(buf);
    return out;
  }
  async function pptx(buf) {
    await need('zip');
    const z = await JSZip.loadAsync(buf);
    const names = Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
    const sections = [];
    for (const [i, n] of names.entries()) {
      const d = xml(await z.file(n).async('string'));
      let title = '';
      const lines = [];
      for (const sp of d.getElementsByTagNameNS('*', 'sp')) {
        const ph = sp.getElementsByTagNameNS('*', 'ph')[0];
        const type = ph && ph.getAttribute('type');
        const ps = paragraphs(sp).map(cleanLine).filter(l => !junk(l));
        if ((type === 'title' || type === 'ctrTitle') && !title) title = ps.join(' ');
        else if (type !== 'sldNum' && type !== 'dt' && type !== 'ftr') lines.push(...ps);
      }
      for (const tr of d.getElementsByTagNameNS('*', 'tr')) {
        const cells = [...tr.getElementsByTagNameNS('*', 'tc')].map(tc => paragraphs(tc).map(cleanLine).join(' ')).filter(Boolean);
        if (cells.length) lines.push(cells.join(' · '));
      }
      if (!title && lines.length && lines[0].length <= 40) title = lines.shift();
      if (title || lines.length) sections.push({ title, lines, page: i + 1 });
    }
    return sections;
  }
  async function hwpx(buf) {
    await need('zip');
    const z = await JSZip.loadAsync(buf);
    const names = Object.keys(z.files).filter(n => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => num(a) - num(b));
    const all = [];
    for (const n of names) all.push(...paragraphs(xml(await z.file(n).async('string'))));
    return sectionize(all);
  }
  async function docx(buf) {
    await need('zip');
    const z = await JSZip.loadAsync(buf);
    const f = z.file('word/document.xml');
    if (!f) throw new Error('워드 문서 내용을 찾지 못했어요.');
    return sectionize(paragraphs(xml(await f.async('string'))));
  }

  /* ---------- HWP (한글 5.0 바이너리) ---------- */
  function cfb(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    if (!sig.every((b, i) => u8[i] === b)) throw new Error('한글(hwp) 파일 구조가 아니에요.');
    const u32 = o => dv.getUint32(o, true);
    const ss = 1 << dv.getUint16(30, true), ms = 1 << dv.getUint16(32, true);
    const nFat = u32(44), dirStart = u32(48), cutoff = u32(56), mfStart = u32(60), difStart = u32(68), nDif = u32(72);
    const off = s => (s + 1) * ss;
    const END = 0xFFFFFFFA;
    const fatSecs = [];
    for (let i = 0; i < 109; i++) { const v = u32(76 + 4 * i); if (v < END) fatSecs.push(v); }
    for (let d = difStart, k = 0; k < nDif && d < END; k++) {
      for (let j = 0; j < ss / 4 - 1; j++) { const v = u32(off(d) + 4 * j); if (v < END) fatSecs.push(v); }
      d = u32(off(d) + ss - 4);
    }
    const fat = [];
    fatSecs.slice(0, nFat).forEach(s => { for (let j = 0; j < ss / 4; j++) fat.push(u32(off(s) + 4 * j)); });
    const chain = (start, table) => { const out = []; for (let s = start, g = 0; s < END && g < 1e6; s = table[s], g++) out.push(s); return out; };
    const read = (start, size) => {
      const secs = chain(start, fat), buf = new Uint8Array(secs.length * ss);
      secs.forEach((s, i) => buf.set(u8.subarray(off(s), off(s) + ss), i * ss));
      return size == null ? buf : buf.subarray(0, size);
    };
    const dir = read(dirStart);
    const ddv = new DataView(dir.buffer);
    const ents = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = ddv.getUint16(o + 64, true);
      let name = '';
      for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(ddv.getUint16(o + i * 2, true));
      ents.push({ name, type: dir[o + 66], left: ddv.getUint32(o + 68, true), right: ddv.getUint32(o + 72, true), child: ddv.getUint32(o + 76, true), start: ddv.getUint32(o + 116, true), size: ddv.getUint32(o + 120, true) });
    }
    const root = ents[0];
    const mini = read(root.start, root.size);
    const mfat = [];
    if (mfStart < END) { const b = read(mfStart), bdv = new DataView(b.buffer); for (let i = 0; i + 4 <= b.length; i += 4) mfat.push(bdv.getUint32(i, true)); }
    const paths = {};
    const visit = (i, prefix, guard = 0) => {
      if (i >= END || i >= ents.length || guard > 5000) return;
      const e = ents[i];
      visit(e.left, prefix, guard + 1); visit(e.right, prefix, guard + 1);
      const p = prefix + e.name;
      if (e.type === 2) paths[p] = e;
      if (e.type === 1) visit(e.child, p + '/', guard + 1);
    };
    visit(root.child, '');
    return {
      list: () => Object.keys(paths),
      get(p) {
        const e = paths[p]; if (!e) return null;
        if (e.size < cutoff) {
          const secs = chain(e.start, mfat), out = new Uint8Array(secs.length * ms);
          secs.forEach((s, i) => out.set(mini.subarray(s * ms, s * ms + ms), i * ms));
          return out.subarray(0, e.size);
        }
        return read(e.start, e.size);
      },
    };
  }
  // 한글 본문은 deflate 압축. 끝에 여분 바이트가 붙어 있어도 읽은 데까지 쓴다
  async function inflateRaw(u8) {
    const reader = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = [];
    let len = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); len += value.length; }
    } catch (e) { if (!len) throw new Error('한글 파일 본문을 풀지 못했어요. PDF로 저장해서 올려 주세요.'); }
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  async function hwp(buf) {
    const f = cfb(new Uint8Array(buf));
    const fh = f.get('FileHeader');
    if (!fh) throw new Error('한글 파일 정보를 찾지 못했어요.');
    const flags = new DataView(fh.buffer, fh.byteOffset).getUint32(36, true);
    if (flags & 2 || flags & 4) throw new Error('암호가 걸렸거나 배포용으로 저장된 한글 파일이에요. 한글에서 PDF로 저장해서 올려 주세요.');
    const compressed = flags & 1;
    const secs = f.list().filter(p => /^BodyText\/Section\d+$/.test(p)).sort((a, b) => parseInt(a.slice(16), 10) - parseInt(b.slice(16), 10));
    const lines = [];
    for (const p of secs) {
      let d = f.get(p);
      if (compressed) d = await inflateRaw(d);
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
      let o = 0;
      while (o + 4 <= d.length) {
        const h = dv.getUint32(o, true); o += 4;
        const tag = h & 0x3ff;
        let size = h >>> 20;
        if (size === 0xfff) { if (o + 4 > d.length) break; size = dv.getUint32(o, true); o += 4; }
        if (o + size > d.length) size = d.length - o;   // 끝이 잘린 경우 있는 데까지만
        if (tag === 67) {   // HWPTAG_PARA_TEXT
          let s = '';
          for (let i = o; i + 1 < o + size;) {
            const c = dv.getUint16(i, true);
            if (c >= 32) { s += String.fromCharCode(c); i += 2; }
            else if ([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31].includes(c)) { if (c === 10) s += ' '; i += 2; }
            else i += 16;   // 인라인·확장 컨트롤(8글자 분량)
          }
          if (s.trim()) lines.push(s);
        }
        o += size;
      }
    }
    return sectionize(lines);
  }

  /* ---------- 공통 진입점 ---------- */
  async function file(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const name = f.name.replace(/\.[^.]+$/, '');
    const buf = () => f.arrayBuffer();
    let kind = ext, sections;
    if (ext === 'pdf') sections = await pdf(await buf());
    else if (ext === 'pptx') sections = await pptx(await buf());
    else if (ext === 'hwpx') sections = await hwpx(await buf());
    else if (ext === 'hwp') sections = await hwp(await buf());
    else if (ext === 'docx') sections = await docx(await buf());
    else if (ext === 'txt' || ext === 'md') { kind = 'text'; sections = sectionize((await f.text()).split(/\r?\n/)); }
    else if (ext === 'ppt') throw new Error('옛 PPT(.ppt) 형식은 읽을 수 없어요. PowerPoint에서 .pptx나 PDF로 저장해서 올려 주세요.');
    else if (ext === 'doc') throw new Error('옛 워드(.doc) 형식은 읽을 수 없어요. .docx나 PDF로 저장해서 올려 주세요.');
    else throw new Error('지원하지 않는 형식이에요. PDF · PPTX · HWP · HWPX · DOCX · TXT를 올려 주세요.');
    return finish(name, kind, sections);
  }
  function text(name, raw) { return finish(name || '붙여넣은 자료', 'text', sectionize(String(raw).split(/\r?\n/))); }
  function finish(name, kind, sections) {
    sections = sections.map(s => ({ ...s, lines: s.lines.filter(l => l.length >= 2) })).filter(s => s.lines.length || s.title);
    const chars = sections.reduce((a, s) => a + s.title.length + s.lines.join('').length, 0);
    if (chars < 40) {
      throw new Error(kind === 'pdf'
        ? '글자를 거의 찾지 못했어요. 스캔한 PDF(그림으로 된 PDF)는 읽을 수 없어요. 글자가 들어 있는 원본 PDF나 PPT를 올려 주세요.'
        : '자료에서 글자를 거의 찾지 못했어요.');
    }
    return { id: U.uid('m'), name, kind, addedAt: Date.now(), sections, chars };
  }
  // 이미 저장된 자료에도 쓰는 정리 함수 (보여줄 때·문제 만들 때)
  function tidy(line) { const t = cleanLine(line); return junk(t) ? '' : t; }
  return { file, text, sectionize, tidy };
})();
