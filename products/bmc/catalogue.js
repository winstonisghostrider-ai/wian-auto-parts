(() => {
  "use strict";

  const MANIFEST_URL = "/data/bmc-products.json?v=20260915-bmc-phase1";
  const PRODUCT_IMAGES_URL = "/data/bmc-product-images.json?v=20260929-final";
  // Source MRP values are retained in the data; public prices are temporarily hidden.
  const SHOW_BMC_PUBLIC_PRICES = false;
  const WHATSAPP_NUMBER = "919108327761";
  const state = { products: [], query: "", images: new Map(), failedImages: new Set() };

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

  function isPhaseOneReplacement(raw) {
    // Keep all source records intact; only replacement-filter families are public here.
    const applicationText = (raw.a || []).map((a) => a[1] || "").join(" ");
    return /^(?:FB|CRF)\d/.test(raw.p) &&
      !/\b(?:CDA|DIA)\b|oval[\s-]+trumpet|cold[\s-]+air[\s-]+intake|induction[\s-]+kit/i.test(applicationText);
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
    if (SHOW_BMC_PUBLIC_PRICES && product.price_status === "SOURCE_MRP" && typeof product.mrp === "number") {
      return `<div class="price">MRP ${esc(formatINR(product.mrp))}<small>incl. GST</small></div>`;
    }
    return `<div class="price enquire">Enquire for Price</div>`;
  }

  function imageMarkup(product, detail = false) {
    const image = state.images.get(product.part_number);
    if (!image || state.failedImages.has(product.part_number)) return "";
    return `<div class="product-media${detail ? " detail-media" : ""}"><img src="/${esc(image.image_path)}" alt="BMC ${esc(product.part_number)} replacement air filter" width="1200" height="800" loading="${detail ? "eager" : "lazy"}" decoding="async" data-bmc-product-image="${esc(product.part_number)}"></div>`;
  }

  function bindImageFallbacks(root) {
    root.querySelectorAll("[data-bmc-product-image]").forEach((image) => {
      const removeFailedImage = () => {
        state.failedImages.add(image.dataset.bmcProductImage);
        image.closest(".product-media")?.remove();
      };
      image.addEventListener("error", removeFailedImage, { once: true });
      if (image.complete && image.naturalWidth === 0) removeFailedImage();
    });
  }

  function whatsappLink(product) {
    const first = firstApplication(product);
    const vehicle = [first.vehicle_make, first.model_application_raw].filter(Boolean).join(" ");
    const text = encodeURIComponent(`Hi WIAN Auto Parts, I would like to enquire about BMC Performance Air Filter ${product.part_number}${vehicle ? ` for ${vehicle}` : ""}.`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  }

  function card(product) {
    const first = firstApplication(product);
    const more = Math.max(0, product.applications.length - 1);
    const vehicle = [first.vehicle_make, first.model_application_raw].filter(Boolean).join(" ");
    const meta = [first.year_generation, first.engine_fuel].filter(Boolean).join(" · ");
    return `<article class="product-card">
      ${imageMarkup(product)}
      <div class="card-body">
        <p class="product-type">BMC PERFORMANCE AIR FILTER</p>
        <h3 class="part">${esc(product.part_number)}</h3>
        <p class="vehicle-summary">${esc(vehicle || "Multiple applications")}${more ? ` +${more} more` : ""}</p>
        <p class="application-meta">${esc(meta || "View vehicle applications")}</p>
        ${priceMarkup(product)}
        <div class="actions">
          <button class="btn" data-details="${esc(product.part_number)}">View Details</button>
          <a class="btn whatsapp" href="${whatsappLink(product)}" target="_blank" rel="noopener">WhatsApp Enquiry</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const q = state.query.trim().toLowerCase();
    const filtered = q ? state.products.filter((p) => searchable(p).includes(q)) : state.products;
    $("productGrid").innerHTML = filtered.map(card).join("");
    bindImageFallbacks($("productGrid"));
    $("resultCount").textContent = filtered.length;
    $("emptyState").hidden = filtered.length !== 0;
    document.querySelectorAll("[data-details]").forEach((button) => button.addEventListener("click", () => openDetails(button.dataset.details)));
  }

  function openDetails(partNumber) {
    const product = state.products.find((p) => p.part_number === partNumber);
    if (!product) return;
    const fitments = product.applications.map((a) => {
      const heading = [a.vehicle_make, a.model_application_raw].filter(Boolean).join(" ");
      const detail = [a.year_generation, a.engine_fuel].filter(Boolean).join(" · ");
      return `<div class="fitment"><strong>${esc(heading)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</div>`;
    }).join("");
    $("modalContent").innerHTML = `
      <span class="eyebrow">BMC PERFORMANCE AIR FILTER</span>
      <h2 id="modalTitle">${esc(product.part_number)}</h2>
      ${priceMarkup(product)}
      ${imageMarkup(product, true)}
      <h3 class="applications-title">Vehicle applications</h3>
      <div class="fitment-list">${fitments}</div>
      <div class="detail-enquiry"><a class="btn whatsapp" href="${whatsappLink(product)}" target="_blank" rel="noopener">WhatsApp Enquiry</a></div>
      <div class="source-note"><strong>Fitment note:</strong> Confirm exact vehicle and airbox fitment before ordering.</div>`;
    bindImageFallbacks($("modalContent"));
    $("modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDetails() {
    $("modalBackdrop").hidden = true;
    document.body.style.overflow = "";
  }

  async function loadProductImages() {
    try {
      const response = await fetch(PRODUCT_IMAGES_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("BMC image manifest unavailable");
      const entries = await response.json();
      if (!Array.isArray(entries)) throw new Error("Invalid BMC image manifest");
      const images = new Map();
      for (const entry of entries) {
        if (entry && typeof entry.part_number === "string" && entry.verification === "VERIFIED EXACT" &&
            typeof entry.image_path === "string" && /^assets\/[a-z0-9_/-]+\.(?:avif|webp|png|jpe?g)$/i.test(entry.image_path)) {
          images.set(entry.part_number, entry);
        }
      }
      return images;
    } catch {
      // Optional photography must never prevent browsing or enquiries.
      return new Map();
    }
  }

  async function init() {
    const imagesReady = loadProductImages();
    try {
      const manifestResponse = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!manifestResponse.ok) throw new Error(`BMC manifest request failed: ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      const chunks = await Promise.all((manifest.chunks || []).map(async (name) => {
        const res = await fetch(`/data/${name}?v=20260915-bmc-phase1`, { cache: "no-store" });
        if (!res.ok) throw new Error(`BMC data chunk failed: ${name} (${res.status})`);
        return res.json();
      }));
      const sourceProducts = chunks.flat();
      if (sourceProducts.length !== manifest.counts.public_products) throw new Error("BMC catalogue record count mismatch");
      state.products = sourceProducts.filter(isPhaseOneReplacement).map(normalize);
      render();
      state.images = await imagesReady;
      if (state.images.size) render();
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
