(() => {
  const state = { products: [], query: '' };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalise = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function searchable(product) {
    return normalise([
      product.p,
      product.t,
      ...product.a.flatMap(a => a)
    ].join(' '));
  }

  function badge(status) {
    const verified = /verified/i.test(status) && !/verify /i.test(status);
    return `<span class="kn-badge ${verified ? 'verified' : 'check'}">${esc(status || 'Check fitment')}</span>`;
  }

  function applicationText(app) {
    const [make, model, years, engine, status] = app;
    return `<li><b>${esc(make)} ${esc(model)}</b><span>${esc(years)} · ${esc(engine)}</span>${badge(status)}</li>`;
  }

  function card(product) {
    const first = product.a[0] || [];
    const applicationSummary = product.a.length > 1
      ? `${product.a.length} listed applications`
      : `${first[0] || ''} ${first[1] || ''}`.trim();
    const wa = `https://wa.me/919108327761?text=${encodeURIComponent(`Hi WIAN Auto Parts, I am enquiring about K&N air filter ${product.p}. Please confirm fitment and availability.`)}`;
    return `<article class="kn-card" data-part="${esc(product.p)}">
      <div class="kn-photo pending"><span>K&amp;N</span><small>Exact product image<br>pending verification</small></div>
      <div class="kn-card-body">
        <p class="kn-brand">K&amp;N PERFORMANCE FILTERS</p>
        <h3>${esc(product.t)}</h3>
        <div class="kn-part">Part No. <strong>${esc(product.p)}</strong></div>
        <div class="kn-app-count">${esc(applicationSummary)}</div>
        <ul class="kn-apps">${product.a.map(applicationText).join('')}</ul>
        <p class="kn-fitment-note">Fitment must be confirmed against vehicle year, engine and air-box / OE reference where marked for verification.</p>
        <div class="kn-actions"><a class="kn-enquire" href="${wa}" target="_blank" rel="noopener">WhatsApp Enquiry</a></div>
      </div>
    </article>`;
  }

  function render(items, query='') {
    const grid = document.getElementById('kn-product-grid');
    const meta = document.getElementById('kn-result-meta');
    if (!grid || !meta) return;
    meta.textContent = query
      ? `${items.length} K&N result${items.length === 1 ? '' : 's'} for “${query}”`
      : `${items.length} K&N performance filter products currently indexed`;
    grid.innerHTML = items.length
      ? items.map(card).join('')
      : `<div class="kn-empty"><b>No K&amp;N catalogue match found.</b><span>Try a part number, make, model or engine. You can also WhatsApp WIAN for a manual fitment check.</span></div>`;
  }

  function search(query) {
    state.query = query.trim();
    const needle = normalise(state.query);
    const items = !needle ? state.products : state.products.filter(p => searchable(p).includes(needle));
    render(items, state.query);
    document.getElementById('kn-catalogue')?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .kn-catalogue{padding:56px 0;background:#f7f8fa;border-top:1px solid #eceff2;border-bottom:1px solid #eceff2}
      .kn-head{max-width:900px;margin:0 auto 24px;text-align:center}.kn-head .eyebrow{color:#e50914;font-weight:900;font-size:13px;letter-spacing:.06em}.kn-head h2{font-size:38px;margin:8px 0}.kn-head p{color:#62666c;line-height:1.55;margin:0}
      .kn-tools{max-width:920px;margin:22px auto 26px;display:grid;grid-template-columns:1fr auto;gap:10px}.kn-tools input{height:48px;border:1px solid #d9dde3;border-radius:9px;padding:0 15px;font:inherit;background:#fff;outline:0}.kn-tools input:focus{border-color:#e50914;box-shadow:0 0 0 3px #e5091412}.kn-tools button{border:0;border-radius:9px;background:#e50914;color:#fff;padding:0 22px;font-weight:900;cursor:pointer}.kn-meta{text-align:center;color:#70747a;font-size:13px;margin-bottom:20px}
      .kn-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.kn-card{background:#fff;border:1px solid #e3e6ea;border-radius:16px;overflow:hidden;box-shadow:0 10px 28px #0000000a;display:flex;flex-direction:column}.kn-photo{height:190px;display:grid;place-items:center;background:linear-gradient(135deg,#151515,#252525);color:#fff;text-align:center}.kn-photo span{display:block;font-size:44px;font-weight:900;letter-spacing:-.05em}.kn-photo small{display:block;color:#bbb;font-size:11px;line-height:1.35;margin-top:-52px}.kn-card-body{padding:20px}.kn-brand{margin:0 0 6px;color:#e50914;font-size:11px;font-weight:900;letter-spacing:.06em}.kn-card h3{font-size:20px;line-height:1.25;margin:0 0 10px}.kn-part{font-size:14px;background:#f6f7f9;border-radius:7px;padding:9px 10px;margin-bottom:8px}.kn-app-count{font-size:12px;color:#6b6f75;margin-bottom:11px}.kn-apps{list-style:none;padding:0;margin:0;display:grid;gap:8px}.kn-apps li{border-top:1px solid #eee;padding-top:8px;display:grid;grid-template-columns:1fr auto;gap:3px 8px}.kn-apps b{font-size:13px}.kn-apps li>span:not(.kn-badge){font-size:11px;color:#70747a;grid-column:1}.kn-badge{grid-column:2;grid-row:1/3;align-self:center;font-size:10px;font-weight:900;border-radius:999px;padding:5px 7px;white-space:nowrap}.kn-badge.verified{background:#eaf7ed;color:#247a37}.kn-badge.check{background:#fff4db;color:#946200}.kn-fitment-note{font-size:11px;line-height:1.45;color:#777;margin:14px 0}.kn-actions{margin-top:auto}.kn-enquire{display:flex;justify-content:center;background:#e50914;color:#fff!important;border-radius:8px;padding:11px 14px;font-weight:900;font-size:13px}.kn-empty{grid-column:1/-1;background:#fff;border:1px dashed #cfd4da;border-radius:14px;padding:30px;text-align:center}.kn-empty b,.kn-empty span{display:block}.kn-empty span{margin-top:7px;color:#777}
      @media(max-width:1050px){.kn-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.kn-grid{grid-template-columns:1fr}.kn-tools{grid-template-columns:1fr}.kn-tools button{height:46px}.kn-head h2{font-size:30px}}
    `;
    document.head.appendChild(style);
  }

  function injectSection() {
    if (document.getElementById('kn-catalogue')) return;
    const section = document.createElement('section');
    section.id = 'kn-catalogue';
    section.className = 'kn-catalogue';
    section.innerHTML = `<div class="wrap"><div class="kn-head"><span class="eyebrow">WIAN PERFORMANCE PARTS</span><h2>K&amp;N Performance Air Filters</h2><p>Search the current WIAN K&amp;N catalogue by part number, vehicle make, model, year or engine. India-market fitment notes are shown exactly as catalogued and items marked for verification must be checked before supply.</p></div><div class="kn-tools"><input id="kn-search" type="search" placeholder="Try 33-2955, Polo, Creta, 320d, EcoSport 1.5 diesel..."><button id="kn-search-btn" type="button">Search K&amp;N</button></div><div class="kn-meta" id="kn-result-meta"></div><div class="kn-grid" id="kn-product-grid"></div></div>`;
    const finder = document.getElementById('finder');
    const categories = document.getElementById('categories');
    if (finder?.parentNode) finder.parentNode.insertBefore(section, finder);
    else if (categories?.parentNode) categories.parentNode.insertBefore(section, categories.nextSibling);
    else document.body.appendChild(section);
  }

  function bindSearch() {
    const localInput = document.getElementById('kn-search');
    const localButton = document.getElementById('kn-search-btn');
    localButton?.addEventListener('click', () => search(localInput?.value || ''));
    localInput?.addEventListener('keydown', e => { if (e.key === 'Enter') search(localInput.value); });

    const headerInput = document.querySelector('.searchbar input');
    const headerButton = document.querySelector('.searchbar button');
    const runHeader = () => {
      const q = headerInput?.value || '';
      if (localInput) localInput.value = q;
      search(q);
    };
    headerButton?.addEventListener('click', runHeader);
    headerInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runHeader(); } });
  }

  async function init() {
    try {
      const response = await fetch('/data/kn-products.json?v=20260906', {cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.products = await response.json();
      injectStyles();
      injectSection();
      render(state.products);
      bindSearch();
    } catch (error) {
      console.error('WIAN K&N catalogue failed to load', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
