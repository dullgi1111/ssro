/* 스스로 — 포인트 · 기프티콘 상점 (2026-11-22)
   지금은 "기능만 하는 구조": 포인트 적립·차감·교환 신청·취소(환불)·내역까지 동작하고,
   실제 기프티콘 발급은 PROVIDER 한 곳만 서버 연결로 바꾸면 되게 나눠 둠.
   새 경로: #/shop  ·  기존 코드는 gainXP를 감싸서 적립만 연결 */
'use strict';

const Shop = (() => {
  /* ---------- 설정 (여기만 고치면 규칙·상품이 바뀜) ---------- */
  const CFG = {
    rate: 1,          // XP 1당 포인트 (공부해서 얻은 XP만큼 포인트가 쌓임)
    dailyCap: 300,    // 하루 최대 적립 포인트
    logKeep: 300,     // 포인트 내역 보관 개수
  };
  // 예시 상품 (실제 브랜드·상품명 아님). active:false면 목록에서 숨김, stock:null이면 수량 제한 없음
  const ITEMS = [
    { id: 'snack',  ico: '🍫', name: '편의점 간식 교환권',   desc: '예시 상품 · 2천 원 상당',  price: 2000,  stock: null, active: true },
    { id: 'drink',  ico: '🥤', name: '편의점 음료 교환권',   desc: '예시 상품 · 3천 원 상당',  price: 3000,  stock: null, active: true },
    { id: 'ice',    ico: '🍦', name: '아이스크림 교환권',    desc: '예시 상품 · 4천 원 상당',  price: 4000,  stock: null, active: true },
    { id: 'coffee', ico: '☕', name: '카페 아메리카노 교환권', desc: '예시 상품 · 5천 원 상당',  price: 5000,  stock: null, active: true },
    { id: 'book',   ico: '📚', name: '도서 상품권 1만 원',    desc: '예시 상품 · 1만 원 상당',  price: 10000, stock: 5,    active: true },
  ];

  /* ---------- 발급 담당 (지금은 가짜: 신청만 받아 '발급 대기'로 둠) ----------
     나중에 서버를 붙이면 request()에서 fetch로 신청을 보내고,
     서버가 준 결과({status:'issued', code:'…'})를 돌려주면 화면은 그대로 동작함. */
  const PROVIDER = {
    name: 'demo',
    async request(order) { return { status: 'pending' }; },
    async cancel(order) { return { ok: true }; },
  };

  /* ---------- 저장 ---------- */
  const key = () => `p.${Profiles.cur.id}.pts`;
  const blank = () => ({ bal: 0, earned: 0, spent: 0, days: {}, log: [], orders: [] });
  const get = () => ({ ...blank(), ...LS.get(key(), {}) });
  const put = d => {
    if (d.log.length > CFG.logKeep) d.log = d.log.slice(-CFG.logKeep);
    const ks = Object.keys(d.days).sort(); if (ks.length > 60) ks.slice(0, ks.length - 60).forEach(k => delete d.days[k]);
    LS.set(key(), d);
  };
  const fmt = n => Number(n || 0).toLocaleString('ko-KR');
  const when = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const STATUS = { pending: ['발급 대기', 'acc'], issued: ['발급 완료', 'ok'], canceled: ['취소 · 환불됨', ''] };

  /* ---------- 포인트 ---------- */
  function balance() { return Profiles.cur ? get().bal : 0; }
  function todayEarned() { return get().days[U.day()] || 0; }
  // XP를 얻을 때마다 호출됨. 하루 한도를 넘으면 넘는 만큼은 쌓지 않음
  function earn(xp, why = '공부') {
    if (!Profiles.cur || !(xp > 0)) return 0;
    const d = get(), t = U.day(), room = Math.max(0, CFG.dailyCap - (d.days[t] || 0));
    const n = Math.min(room, Math.floor(xp * CFG.rate));
    if (!n) return 0;
    d.bal += n; d.earned += n; d.days[t] = (d.days[t] || 0) + n;
    d.log.push({ at: Date.now(), n, why });
    put(d);
    if ((d.days[t] || 0) >= CFG.dailyCap && room > 0) setTimeout(() => toast(`🪙 오늘 받을 수 있는 포인트(${fmt(CFG.dailyCap)}P)를 다 모았어요`), 900);
    return n;
  }
  function stockLeft(it) {
    if (it.stock == null) return null;
    const used = get().orders.filter(o => o.item === it.id && o.status !== 'canceled').length;
    return Math.max(0, it.stock - used);
  }

  /* ---------- 교환 ---------- */
  async function exchange(id) {
    const it = ITEMS.find(x => x.id === id && x.active);
    if (!it) return toast('지금은 교환할 수 없는 상품이에요');
    const d = get();
    if (d.bal < it.price) return toast(`포인트가 ${fmt(it.price - d.bal)}P 부족해요`);
    if (stockLeft(it) === 0) return toast('품절된 상품이에요');
    if (!ask(`「${it.name}」을(를) ${fmt(it.price)}P로 교환할까요?\n\n※ 지금은 기능 시험용이라 실제 기프티콘은 발송되지 않아요.`)) return;
    const order = { id: U.uid('o'), item: it.id, name: it.name, ico: it.ico, price: it.price, at: Date.now(), status: 'pending', code: null };
    d.bal -= it.price; d.spent += it.price; d.orders.unshift(order);
    d.log.push({ at: order.at, n: -it.price, why: `교환: ${it.name}` });
    put(d);
    try {
      const r = await PROVIDER.request(order);
      const d2 = get(), o = d2.orders.find(x => x.id === order.id);
      if (o && r) { o.status = r.status || o.status; if (r.code) o.code = r.code; put(d2); }
      toast('교환을 신청했어요. 교환 내역에서 확인할 수 있어요');
    } catch (e) {
      refund(order.id, '신청 실패');
      toast('신청하지 못해 포인트를 돌려드렸어요');
    }
    App.ui.shopTab = 'orders'; render();
  }
  function refund(oid, why) {
    const d = get(), o = d.orders.find(x => x.id === oid);
    if (!o || o.status !== 'pending') return false;
    o.status = 'canceled'; o.canceledAt = Date.now();
    d.bal += o.price; d.spent -= o.price;
    d.log.push({ at: Date.now(), n: o.price, why: `${why}: ${o.name}` });
    put(d); return true;
  }
  async function cancel(oid) {
    const o = get().orders.find(x => x.id === oid);
    if (!o || o.status !== 'pending') return toast('발급 대기 중인 신청만 취소할 수 있어요');
    if (!ask(`「${o.name}」 교환을 취소하고 ${fmt(o.price)}P를 돌려받을까요?`)) return;
    try { await PROVIDER.cancel(o); } catch (e) { return toast('취소하지 못했어요. 잠시 뒤 다시 해 주세요'); }
    refund(oid, '교환 취소'); toast('취소하고 포인트를 돌려드렸어요'); render();
  }

  /* ---------- 화면 ---------- */
  function homeBtn() {
    return `<button class="qbtn" data-act="go" data-to="#/shop"><span class="ico">🎁</span><b>포인트 상점</b><small class="qsub">🪙 ${fmt(balance())}P</small></button>`;
  }
  function vShop() {
    const d = get(), tab = App.ui.shopTab || 'items', te = d.days[U.day()] || 0;
    const t = (id, l) => `<button data-act="shopTab" data-v="${id}" aria-current="${tab === id ? 'page' : 'false'}">${l}</button>`;
    let body = '';
    if (tab === 'items') {
      body = `<div class="shop-grid">${ITEMS.filter(x => x.active).map(it => {
        const left = stockLeft(it), short = Math.max(0, it.price - d.bal), soldout = left === 0;
        const pct = Math.min(100, Math.round(d.bal / it.price * 100));
        return `<div class="shop-item${soldout ? ' soldout' : ''}"><div class="si-ico">${it.ico}</div>
          <b>${esc(it.name)}</b><span class="hint">${esc(it.desc)}${left != null ? ` · 남은 수량 ${left}개` : ''}</span>
          <div class="si-price">🪙 ${fmt(it.price)}P</div>
          ${soldout ? '<button class="btn" disabled>품절</button>'
            : short ? `<div class="bar-mini"><i style="width:${pct}%"></i></div><button class="btn" disabled>${fmt(short)}P 부족</button>`
            : `<button class="btn primary" data-act="shopBuy" data-v="${it.id}">교환하기</button>`}</div>`;
      }).join('')}</div>`;
    } else if (tab === 'orders') {
      body = d.orders.length ? `<ul class="hist shop-orders">${d.orders.map(o => {
        const [label, cls] = STATUS[o.status] || [o.status, ''];
        return `<li><span class="si-ico sm">${o.ico || '🎁'}</span><div style="flex:1;min-width:0"><b>${esc(o.name)}</b><br>
            <span class="hint">${when(o.at)} · ${fmt(o.price)}P${o.code ? ` · 코드 <span class="mono">${esc(o.code)}</span>` : ''}</span></div>
          <div class="so-right"><span class="chip ${cls}">${label}</span>
          ${o.status === 'pending' ? `<button class="btn sm" data-act="shopCancel" data-v="${o.id}">취소</button>` : ''}</div></li>`;
      }).join('')}</ul>` : '<p class="hint">아직 교환한 상품이 없어요.</p>';
    } else {
      const rows = d.log.slice().reverse().slice(0, 100);
      body = rows.length ? `<ul class="hist">${rows.map(l => `<li><span class="mono hint">${when(l.at)}</span><span style="flex:1">${esc(l.why)}</span><b class="${l.n < 0 ? 'neg' : 'pos'}">${l.n > 0 ? '+' : ''}${fmt(l.n)}P</b></li>`).join('')}</ul>`
        : '<p class="hint">문제를 풀면 포인트가 쌓여요.</p>';
    }
    return {
      crumb: '🎁 포인트 상점',
      body: `<div class="page wrap" style="max-width:900px"><h1 style="font-size:24px">🎁 포인트 상점</h1>
        <div class="notice">지금은 <b>기능 시험용</b>이에요. 교환을 신청해도 실제 기프티콘은 발송되지 않아요.</div>
        <section class="panel shop-head">
          <div><span class="hint">보유 포인트</span><div class="pts">🪙 ${fmt(d.bal)}<small>P</small></div></div>
          <div class="shop-sub"><span>오늘 적립 <b>${fmt(te)}</b> / ${fmt(CFG.dailyCap)}P</span><div class="bar-mini"><i style="width:${Math.min(100, Math.round(te / CFG.dailyCap * 100))}%"></i></div>
            <span class="hint">누적 적립 ${fmt(d.earned)}P · 사용 ${fmt(d.spent)}P</span></div></section>
        <nav class="tabs" aria-label="상점 메뉴">${t('items', '🛍️ 상품')}${t('orders', `📦 교환 내역${d.orders.filter(o => o.status === 'pending').length ? ` (${d.orders.filter(o => o.status === 'pending').length})` : ''}`)}${t('log', '🧾 포인트 내역')}</nav>
        ${body}
        <p class="hint">공부해서 얻은 XP만큼 포인트가 쌓여요 (하루 최대 ${fmt(CFG.dailyCap)}P). 포인트는 이 기기에만 저장되고 백업 파일에 함께 들어가요.</p></div>`,
    };
  }

  /* ---------- 연결 ---------- */
  // 1) XP를 줄 때마다 같은 양의 포인트 적립 (기존 gainXP를 감쌈)
  const baseGain = gainXP;
  gainXP = function (n) { baseGain(n); earn(n); };
  // 2) 새 경로 #/shop
  const baseDispatch = dispatch;
  dispatch = function (r) { if (Profiles.cur && r[0] === 'shop') return vShop(); return baseDispatch(r); };
  // 3) 동작
  Object.assign(ACT, {
    shopTab(el) { App.ui.shopTab = el.dataset.v; render(); },
    shopBuy(el) { exchange(el.dataset.v); },
    shopCancel(el) { cancel(el.dataset.v); },
  });

  return { CFG, ITEMS, PROVIDER, balance, todayEarned, earn, exchange, cancel, homeBtn, get, key };
})();
