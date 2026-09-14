(() => {
  "use strict";

  const MANIFEST_URL = "/data/bmc-products.json?v=20260915-bmc-phase1";
  const WHATSAPP_NUMBER = "919108327761";
  const state = { products: [], query: "" };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function formatINR(value) {
    if (typeof value !== "number") return null;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  }

  function normalize(raw) {
    return {
      part_number: raw.p,
      mrp: raw.m,
      price_status: raw.s === "M" ? "SOURCE_MRP" : "MRP_CONFLICT",
      applications: (raw.a || []).map((a) => ({
        vehicle_make: a[0],
        model_application_raw: a[1],
        year_generation: a[2],
        engine_fuel: a[3],
        fitment_status: a[4]
      }))
    };
  }

  function searchable(product) {
    return [
      product.part_number,
      ...product.applications.flatMap((a) => [
        a.vehicle_make, a.model_application_raw, a.year_generation, a.engine_fuel, a.fitment_status
      ])
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function firstApplication(product) { return product.applications[0] || {}; }

  function priceMarkup(product) {
    if (product.price_status === "SOURCE_MRP" && typeof product.mrp === "number") {
      return `<div class="price">MRP ${esc(formatINR(product.mrp))}<small>incl. GST · BMC India July 2024 source</small></div>`;
    }
    return `<div class="price enquire">Enquire for Price<small>Source MRP requires review</small></div>`;
  }

  function card(product) {
    const first = firstApplication(product);
    const more = Math.max(0, product.applications.length - 1);
    const vehicle = [first.vehicle_make, first.model_application_raw].filter(Boolean).join(" ");
    const meta = [first.year_generation, first.engine_fuel].filter(Boolean).join(" · ");
    const waText = encodeURIComponent(`Hi WIAN Auto Parts, I would like to enquire about BMC Performance Air Filter ${product.part_number}${vehicle ? ` for ${vehicle}` : ""}.`);
    return `<article class="product-card">
      <div class="product-media"><div class="product-placeholder">Exact SKU image<br>being verified</div></div>
      <div class="card-body">
        <p class="product-type">BMC PERFORMANCE AIR FILTER</p>
        <h3 class="part">${esc(product.part_number)}</h3>
        <p class="vehicle-summary">${esc(vehicle || "Multiple applications")}${more ? ` +${more} more` : ""}</p>
        <p class="application-meta">${esc(meta || "See source applications")}</p>
        <span class="status">Source Listed</span>
        ${priceMarkup(product)}
        <div class="actions">
          <button class="btn" data-details="${esc(product.part_number)}">View Details</button>
          <a class="btn whatsapp" href="https://wa.me/${WHATSAPP_NUMBER}?text=${waText}" target="_blank" rel="noopener">WhatsApp Enquiry</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const q = state.query.trim().toLowerCase();
    const filtered = q ? state.products.filter((p) => searchable(p).includes(q)) : state.products;
    $("productGrid").innerHTML = filtered.map(card).join("");
    $("resultCount").textContent = filtered.length;
    $("emptyState").hidden = filtered.length !== 0;
    document.querySelectorAll("[data-details]").forEach((button) => button.addEventListener("click", () => openDetails(button.dataset.details)));
  }

  function openDetails(partNumber) {
    const product = state.products.find((p) => p.part_number === partNumber);
    if (!product) return;
    const fitments = product.applications.map((a) => {
      const heading = [a.vehicle_make, a.model_application_raw].filter(Boolean).join(" ");
      const detail = [a.year_generation, a.engine_fuel, a.fitment_status].filter(Boolean).join(" · ");
      return `<div class="fitment"><strong>${esc(heading)}</strong><small>${esc(detail || "Source listed application")}</small></div>`;
    }).join("");
    const price = product.price_status === "SOURCE_MRP" ? `MRP ${formatINR(product.mrp)} · incl. GST` : "Enquire for Price · MRP conflict under source review";
    $("modalContent").innerHTML = `
      <span class="eyebrow">BMC PERFORMANCE AIR FILTER</span>
      <h2 id="modalTitle">${esc(product.part_number)}</h2>
      <div class="modal-price">${esc(price)}</div>
      <div class="fitment-list">${fitments}</div>
      <div class="source-note"><strong>Fitment note:</strong> Applications are preserved from the supplied BMC India July 2024 source. Confirm exact vehicle and airbox fitment before ordering.</div>`;
    $("modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDetails() {
    $("modalBackdrop").hidden = true;
    document.body.style.overflow = "";
  }

  async function init() {
    try {
      const manifestResponse = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!manifestResponse.ok) throw new Error(`BMC manifest request failed: ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      const chunks = await Promise.all((manifest.chunks || []).map(async (name) => {
        const res = await fetch(`/data/${name}?v=20260915-bmc-phase1`, { cache: "no-store" });
        if (!res.ok) throw new Error(`BMC data chunk failed: ${name} (${res.status})`);
        return res.json();
      }));
      state.products = chunks.flat().map(normalize);
      if (state.products.length !== 240) throw new Error(`Expected 240 BMC public products, got ${state.products.length}`);
      render();
    } catch (error) {
      console.error(error);
      $("productGrid").innerHTML = `<div class="empty-state">BMC catalogue data could not be loaded. Please contact WIAN Auto Parts.</div>`;
    }
  }

  $("searchInput").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  $("clearSearch").addEventListener("click", () => { state.query = ""; $("searchInput").value = ""; render(); $("searchInput").focus(); });
  $("modalClose").addEventListener("click", closeDetails);
  $("modalBackdrop").addEventListener("click", (e) => { if (e.target === $("modalBackdrop")) closeDetails(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetails(); });

  init();
})();