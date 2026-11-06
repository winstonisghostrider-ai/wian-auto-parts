/* WIAN shared catalogue list renderer.
   Page config lives on <main id="catalogue" data-source="WINDOW_VAR" data-noun="product" data-ask="...">.
   Data shape: window[VAR] = { meta, items: [{ group, segment?, brand, title, part, detail, mrp, apps }] } */
(function () {
  const root = document.getElementById("catalogue");
  if (!root) return;
  const cfg = root.dataset;
  const payload = window[cfg.source] || { items: [] };
  const items = Array.isArray(payload.items) ? payload.items : [];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const grid = document.getElementById("listGrid");
  const search = document.getElementById("listSearch");
  const count = document.getElementById("listCount");
  const groupChips = document.getElementById("groupChips");
  const segChips = document.getElementById("segmentChips");
  const PAGE = 48;
  let shown = PAGE, group = "All", segment = "All";

  function chipRow(el, values, onPick) {
    if (!el) return;
    el.innerHTML = ["All"].concat(values).map((v) => `<button type="button" class="chip${v === "All" ? " active" : ""}" data-v="${esc(v)}">${esc(v)}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      el.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === b));
      onPick(b.dataset.v); shown = PAGE; render();
    });
  }
  const uniq = (key) => [...new Set(items.map((i) => i[key]).filter(Boolean))];
  const groupOrder = uniq("group").sort((a, b) => items.filter((i) => i.group === b).length - items.filter((i) => i.group === a).length);
  chipRow(groupChips, groupOrder, (v) => (group = v));
  if (segChips) { const segs = uniq("segment"); if (segs.length > 1) chipRow(segChips, segs, (v) => (segment = v)); else segChips.remove(); }

  // Deep link: ?q=swift
  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) search.value = q0.slice(0, 60);
  search.addEventListener("input", () => { shown = PAGE; render(); });

  function wa(i) {
    const what = [i.brand, i.title, i.part && `(${i.part})`, i.detail].filter(Boolean).join(" ");
    const text = `Hi WIAN, I'm interested in ${what}. ${cfg.ask || ""}`.trim();
    return "https://wa.me/919108327761?text=" + encodeURIComponent(text);
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const list = items.filter((i) =>
      (group === "All" || i.group === group) &&
      (segment === "All" || i.segment === segment) &&
      (!q || [i.brand, i.title, i.part, i.detail, i.apps, i.group].join(" ").toLowerCase().includes(q)));
    count.textContent = `${list.length} ${list.length === 1 ? cfg.noun : cfg.noun + "s"}`;
    if (!list.length) {
      grid.innerHTML = `<div class="empty"><b>Not listed here?</b> We source most parts within 24–48 hours. <a href="https://wa.me/919108327761?text=${encodeURIComponent("Hi WIAN, I'm looking for: " + search.value)}" target="_blank" rel="noopener">Ask on WhatsApp</a></div>`;
      return;
    }
    grid.innerHTML = list.slice(0, shown).map((i) => `
      <article class="pcard">
        <span class="pmake">${esc(i.brand)} · ${esc(i.group)}</span>
        <h3>${esc(i.title)}</h3>
        ${i.part || i.detail ? `<p class="pline">${[i.part && `<b>${esc(i.part)}</b>`, esc(i.detail)].filter(Boolean).join(" · ")}</p>` : ""}
        ${i.apps ? `<p class="papps">${esc(i.apps)}</p>` : ""}
        <p class="pprice">${i.mrp ? "MRP " + inr(i.mrp) : '<span class="ask">Price on WhatsApp</span>'}</p>
        <a class="pbtn" href="${wa(i)}" target="_blank" rel="noopener">${esc(cfg.cta || "Enquire on WhatsApp")}</a>
      </article>`).join("") +
      (list.length > shown ? `<div class="more"><button type="button" id="loadMore">Show more (${list.length - shown} left)</button></div>` : "");
    const more = document.getElementById("loadMore");
    if (more) more.addEventListener("click", () => { shown += PAGE; render(); });
  }
  render();
})();
