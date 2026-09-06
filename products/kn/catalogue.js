(() => {
  "use strict";

  const DATA_URL = "/data/kn-products.json?v=20260907";
  const PRODUCT_IMAGES_URL = "/data/kn-product-images.json?v=20260907";
  const VEHICLE_IMAGES_URL = "/data/kn-vehicle-images.json?v=20260907";
  const GENERIC_PRODUCT_IMAGE = "/assets/products/kn/kn-generic-conical.webp?v=20260907";
  const WHATSAPP_NUMBER = "919108327761";
  const state = { products: [], imageManifest: new Map(), vehicleManifest: new Map(), query: "", makes: new Set(), statuses: new Set(), sort: "relevance" };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const searchText = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/(\d)\.(\d)/g, "$1decimal$2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const elements = {
    form: $("#catalogueSearch"),
    query: $("#q"),
    grid: $("#grid"),
    meta: $("#meta"),
    makes: $("#makes"),
    makeSearch: $("#makeSearch"),
    sort: $("#sort"),
    clear: $("#clearFilters"),
    activeSearch: $("#activeSearch"),
    activeFilterCount: $("#activeFilterCount"),
    mobileFilterButton: $("#mobileFilterButton"),
    filters: $("#filtersPanel"),
    filterClose: $("#filterClose"),
    filterBackdrop: $("#filterBackdrop"),
    applyFilters: $("#applyFilters"),
    dialog: $("#detailsDialog"),
    dialogTitle: $("#dialogTitle"),
    dialogContent: $("#dialogContent"),
    dialogClose: $("#dialogClose")
  };

  function canonicalStatus(value) {
    const key = searchText(value);
    if (key === "verified") return "Verified";
    if (key === "verify vin") return "Verify VIN";
    if (key === "verify india variant") return "Verify India Variant";
    if (key === "global listing") return "Global Listing";
    return String(value || "Fitment check required");
  }

  function statusClass(status) {
    return searchText(canonicalStatus(status)).replace(/\s+/g, "-");
  }

  function applications(product) {
    return Array.isArray(product.a) ? product.a : [];
  }

  function normaliseProducts(data) {
    const byPart = new Map();
    data.filter((product) => product && product.p && Array.isArray(product.a)).forEach((product) => {
      const sourcePart = String(product.p).trim();
      const parts = sourcePart.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
      parts.forEach((part) => {
        let item = byPart.get(part);
        if (!item) {
          item = { ...product, p: part, sourcePart, sourceRows: [sourcePart], compoundParts: parts.length > 1 ? [...parts] : null, applicationKeys: [] };
          item.a = [];
          byPart.set(part, item);
        } else {
          item.sourceRows = [...new Set([...(item.sourceRows || []), sourcePart])];
          if (parts.length > 1) item.compoundParts = [...new Set([...(item.compoundParts || []), ...parts])];
        }
        product.a.forEach((application, index) => {
          const key = JSON.stringify(application);
          if (!item.a.some((existing) => JSON.stringify(existing) === key)) {
            item.a.push(application);
            item.applicationKeys.push(`${sourcePart}|${index}`);
          }
        });
      });
    });
    return [...byPart.values()];
  }

  function productIndex(product) {
    return searchText([
      product.p,
      product.sourcePart,
      product.t,
      "performance air filter",
      ...applications(product).flatMap((application) => application)
    ].join(" "));
  }

  function configuredImagePath(product) {
    const manifest = state.imageManifest.get(product.p);
    if (!manifest || manifest.verification !== "VERIFIED EXACT" || typeof manifest.image_path !== "string") return "";
    const path = manifest.image_path.trim().replace(/^\/+/, "");
    if (!/^assets\/products\/kn\/[a-z0-9][a-z0-9._-]*\.(?:avif|webp|png|jpe?g)$/i.test(path)) return "";
    return `/${path}`;
  }

  function vehicleKey(application) {
    return [application[0], application[1], application[2]]
      .map((value) => String(value || "").toLowerCase())
      .join("-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function configuredVehicleImage(application) {
    const manifest = state.vehicleManifest.get(vehicleKey(application));
    if (!manifest || manifest.verification !== "VERIFIED EXACT") return null;
    if (manifest.make !== application[0] || manifest.model !== application[1] || manifest.year_range !== application[2]) return null;
    if (typeof manifest.image_path !== "string") return null;
    const path = manifest.image_path.trim().replace(/^\/+/, "");
    if (!/^assets\/vehicles\/[a-z0-9][a-z0-9._\/-]*\.(?:avif|webp|png|jpe?g)$/i.test(path)) return null;
    return { source: `/${path}`, manifest };
  }

  function productStatuses(product) {
    return [...new Set(applications(product).map((application) => canonicalStatus(application[4])))];
  }

  function productMakes(product) {
    return [...new Set(applications(product).map((application) => application[0]).filter(Boolean))];
  }

  function relevanceScore(product, query) {
    if (!query) return 0;
    const part = searchText(product.p);
    const title = searchText(product.t);
    if (part === query) return 1000;
    if (part.startsWith(query)) return 800;
    if (title.includes(query)) return 500;
    const exactVehicle = applications(product).some((application) => searchText(`${application[0]} ${application[1]}`) === query);
    if (exactVehicle) return 400;
    return productIndex(product).includes(query) ? 100 : 0;
  }

  function visibleProducts() {
    const query = searchText(state.query);
    const terms = query.split(" ").filter(Boolean);
    const filtered = state.products.filter((product) => {
      const index = productIndex(product);
      if (terms.length && !terms.every((term) => index.includes(term))) return false;
      if (state.makes.size && !productMakes(product).some((make) => state.makes.has(make))) return false;
      if (state.statuses.size && !productStatuses(product).some((status) => state.statuses.has(status))) return false;
      return true;
    });

    if (state.sort === "part") return filtered.sort((a, b) => String(a.p).localeCompare(String(b.p), undefined, { numeric: true }));
    if (state.sort === "make") return filtered.sort((a, b) => (productMakes(a)[0] || "").localeCompare(productMakes(b)[0] || ""));
    if (query) return filtered.sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query));
    return filtered;
  }

  function whatsappUrl(product) {
    const message = `Hi WIAN Auto Parts, I am enquiring about K&N performance air filter ${product.p}. Please confirm fitment and availability.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  function imageMarkup(product) {
    const source = configuredImagePath(product);
    if (source) {
      return `<div class="product-media"><img class="product-image" src="${escapeHtml(source)}" alt="K&amp;N performance air filter ${escapeHtml(product.p)}" loading="lazy" decoding="async" data-part="${escapeHtml(product.p)}" data-image-kind="exact"></div>`;
    }
    return genericProductImageMarkup(product);
  }

  function genericProductImageMarkup(product) {
    return `<div class="product-media is-representative"><img class="product-image product-image-generic" src="${GENERIC_PRODUCT_IMAGE}" alt="Representative K&amp;N conical performance air filter" loading="lazy" decoding="async" data-part="${escapeHtml(product.p)}" data-image-kind="generic"><span class="representative-label">Representative K&amp;N filter image</span></div>`;
  }

  function pendingImageMarkup(product) {
    return `<div class="product-media"><div class="image-pending"><div><strong>Product image unavailable</strong><span>Exact ${escapeHtml(product.p)} product image is being verified</span></div></div></div>`;
  }

  function pendingVehicleMarkup(context = "card") {
    const className = context === "details" ? "vehicle-placeholder" : "vehicle-card-placeholder";
    return `<div class="${className}" aria-label="Vehicle image being verified">Vehicle image<br>being verified</div>`;
  }

  function vehicleImageMarkup(application, context = "card") {
    const configured = configuredVehicleImage(application);
    if (!configured) return pendingVehicleMarkup(context);
    const className = context === "details" ? "fitment-vehicle-image" : "vehicle-card-photo";
    const alt = `${application[0]} ${application[1]} ${application[2]}`;
    return `<img class="vehicle-image ${className}" src="${escapeHtml(configured.source)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" data-vehicle-context="${context}">`;
  }

  function cardMarkup(product) {
    const first = applications(product)[0] || [];
    const makeAndModel = [first[0], first[1]].filter(Boolean).join(" ");
    const extraApplications = Math.max(0, applications(product).length - 1);
    const vehicleSummary = `${makeAndModel || "Vehicle application pending"}${extraApplications ? ` + ${extraApplications} more` : ""}`;
    const detailLine = [first[2], first[3]].filter(Boolean).join(" · ");
    const badges = productStatuses(product).map((status) => `<span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>`).join("");

    return `<article class="product-card" data-part="${escapeHtml(product.p)}">
      ${imageMarkup(product)}
      <div class="product-body">
        <span class="product-kicker">PERFORMANCE AIR FILTER</span>
        <h3 class="part-number">${escapeHtml(product.p)}</h3>
        <div class="vehicle-card-summary">
          ${vehicleImageMarkup(first)}
          <div>
            <p class="vehicle-summary">${escapeHtml(vehicleSummary)}</p>
            <p class="application-meta">${escapeHtml(detailLine)}</p>
            <p class="vehicle-image-status">${configuredVehicleImage(first) ? "Verified vehicle generation image" : "Vehicle image being verified"}</p>
          </div>
        </div>
        ${product.compoundParts ? `<p class="compound-note">Catalogue rows include ${escapeHtml((product.sourceRows || [product.sourcePart]).join("; "))} · Verify VIN before ordering</p>` : ""}
        <div class="status-list" aria-label="Fitment status">${badges}</div>
        <p class="price-note">Enquire for Price</p>
        <div class="card-actions">
          <button class="button button-secondary view-details" type="button" data-part="${escapeHtml(product.p)}">View Details</button>
          <a class="button button-whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener">WhatsApp Enquiry</a>
        </div>
      </div>
    </article>`;
  }

  function bindProductActions() {
    $$(".view-details", elements.grid).forEach((button) => {
      button.addEventListener("click", () => openDetails(button.dataset.part));
    });
    $$(".product-image", elements.grid).forEach((image) => {
      image.addEventListener("error", () => {
        const product = state.products.find((item) => item.p === image.dataset.part);
        if (!product) return;
        const media = image.closest(".product-media");
        const card = media.closest(".product-card");
        if (image.dataset.imageKind === "exact") {
          media.outerHTML = genericProductImageMarkup(product);
          const replacement = $(".product-image-generic", card);
          if (replacement) replacement.addEventListener("error", () => {
            replacement.closest(".product-media").outerHTML = pendingImageMarkup(product);
          }, { once: true });
        } else {
          media.outerHTML = pendingImageMarkup(product);
        }
      }, { once: true });
    });
    $$(".vehicle-image", elements.grid).forEach((image) => {
      image.addEventListener("error", () => {
        image.outerHTML = pendingVehicleMarkup(image.dataset.vehicleContext);
      }, { once: true });
    });
  }

  function updateActiveState(items) {
    const applicationKeys = new Set();
    items.forEach((product) => (product.applicationKeys || applications(product).map((_, index) => `${product.sourcePart || product.p}|${index}`)).forEach((key) => applicationKeys.add(key)));
    const applicationCount = applicationKeys.size;
    elements.meta.textContent = `${items.length} ${items.length === 1 ? "SKU" : "SKUs"} · ${applicationCount} vehicle ${applicationCount === 1 ? "application" : "applications"}`;
    const filterCount = state.makes.size + state.statuses.size;
    elements.activeFilterCount.textContent = filterCount;
    if (state.query) {
      elements.activeSearch.hidden = false;
      elements.activeSearch.innerHTML = `Showing matches for <strong>“${escapeHtml(state.query)}”</strong><button type="button" id="clearSearch">Clear search</button>`;
      $("#clearSearch").addEventListener("click", () => {
        state.query = "";
        elements.query.value = "";
        updateQueryUrl();
        render();
      });
    } else {
      elements.activeSearch.hidden = true;
      elements.activeSearch.textContent = "";
    }
  }

  function render() {
    const items = visibleProducts();
    updateActiveState(items);
    elements.grid.innerHTML = items.length
      ? items.map(cardMarkup).join("")
      : `<div class="empty-state"><strong>No matching filters found</strong>Try another part number, vehicle, year or engine, or clear the selected filters.</div>`;
    elements.grid.setAttribute("aria-busy", "false");
    bindProductActions();
  }

  function buildMakeFilters() {
    const makeCounts = new Map();
    state.products.forEach((product) => productMakes(product).forEach((make) => makeCounts.set(make, (makeCounts.get(make) || 0) + 1)));
    const makes = [...makeCounts.keys()].sort((a, b) => a.localeCompare(b));
    elements.makes.innerHTML = makes.map((make) => `<label class="check" data-make="${escapeHtml(make)}"><input type="checkbox" class="make-filter" value="${escapeHtml(make)}"><span>${escapeHtml(make)}</span><span class="count">${makeCounts.get(make)}</span></label>`).join("");
    $$(".make-filter", elements.makes).forEach((checkbox) => checkbox.addEventListener("change", () => {
      checkbox.checked ? state.makes.add(checkbox.value) : state.makes.delete(checkbox.value);
      render();
    }));
  }

  function openDetails(partNumber) {
    const product = state.products.find((item) => item.p === partNumber);
    if (!product) return;
    elements.dialogTitle.textContent = `K&N ${product.p}`;
    const rows = applications(product).map((application) => {
      const status = canonicalStatus(application[4]);
      return `<div class="fitment-row">
        ${vehicleImageMarkup(application, "details")}
        <div><strong>${escapeHtml(application[0])} ${escapeHtml(application[1])}</strong><small>Vehicle application</small></div>
        <div><strong>${escapeHtml(application[2])}</strong><small>Model year</small></div>
        <div><strong>${escapeHtml(application[3])}</strong><small>Engine / fuel</small></div>
        <span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>
      </div>`;
    }).join("");
    const compoundNote = product.compoundParts ? `<p class="dialog-warning">This SKU appears in catalogue rows ${escapeHtml((product.sourceRows || [product.sourcePart]).join("; "))}. Verify VIN before ordering.</p>` : "";
    elements.dialogContent.innerHTML = `<div class="dialog-intro"><p>Performance Air Filter · ${applications(product).length} ${applications(product).length === 1 ? "application" : "applications"}</p><strong>Enquire for Price</strong></div>${compoundNote}<div class="fitment-list">${rows}</div><div class="dialog-actions"><a class="button button-whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener">WhatsApp Enquiry</a></div>`;
    $$(".vehicle-image", elements.dialogContent).forEach((image) => {
      image.addEventListener("error", () => {
        image.outerHTML = pendingVehicleMarkup("details");
      }, { once: true });
    });
    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    else elements.dialog.setAttribute("open", "");
  }

  function closeDetails() {
    if (typeof elements.dialog.close === "function") elements.dialog.close();
    else elements.dialog.removeAttribute("open");
  }

  function openFilters() {
    elements.filters.classList.add("is-open");
    elements.filterBackdrop.hidden = false;
    elements.mobileFilterButton.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    elements.filterClose.focus();
  }

  function closeFilters() {
    elements.filters.classList.remove("is-open");
    elements.filterBackdrop.hidden = true;
    elements.mobileFilterButton.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function clearFilters() {
    state.makes.clear();
    state.statuses.clear();
    $$(".make-filter, .status-filter").forEach((checkbox) => { checkbox.checked = false; });
    elements.makeSearch.value = "";
    $$("[data-make]", elements.makes).forEach((label) => { label.hidden = false; });
    render();
  }

  function updateQueryUrl() {
    const url = new URL(window.location.href);
    state.query ? url.searchParams.set("q", state.query) : url.searchParams.delete("q");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function bindPageEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = elements.query.value.trim();
      updateQueryUrl();
      render();
      $("#catalogueTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.sort.addEventListener("change", () => { state.sort = elements.sort.value; render(); });
    elements.makeSearch.addEventListener("input", () => {
      const query = searchText(elements.makeSearch.value);
      $$("[data-make]", elements.makes).forEach((label) => { label.hidden = !searchText(label.dataset.make).includes(query); });
    });
    $$(".status-filter").forEach((checkbox) => checkbox.addEventListener("change", () => {
      checkbox.checked ? state.statuses.add(checkbox.value) : state.statuses.delete(checkbox.value);
      render();
    }));
    elements.clear.addEventListener("click", clearFilters);
    elements.mobileFilterButton.addEventListener("click", openFilters);
    elements.filterClose.addEventListener("click", closeFilters);
    elements.filterBackdrop.addEventListener("click", closeFilters);
    elements.applyFilters.addEventListener("click", closeFilters);
    elements.dialogClose.addEventListener("click", closeDetails);
    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) closeDetails();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.filters.classList.contains("is-open")) closeFilters();
    });
  }

  async function initialise() {
    bindPageEvents();
    const initialQuery = new URL(window.location.href).searchParams.get("q") || "";
    state.query = initialQuery;
    elements.query.value = initialQuery;
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Catalogue data is not an array");
      let imageManifest = [];
      let vehicleManifest = [];
      try {
        const imageResponse = await fetch(PRODUCT_IMAGES_URL, { cache: "no-store" });
        if (imageResponse.ok) imageManifest = await imageResponse.json();
      } catch (manifestError) {
        console.warn("K&N product image manifest unavailable; using pending placeholders", manifestError);
      }
      if (Array.isArray(imageManifest)) imageManifest.forEach((item) => { if (item && item.part_number) state.imageManifest.set(item.part_number, item); });
      try {
        const vehicleResponse = await fetch(VEHICLE_IMAGES_URL, { cache: "no-store" });
        if (vehicleResponse.ok) vehicleManifest = await vehicleResponse.json();
      } catch (manifestError) {
        console.warn("K&N vehicle image manifest unavailable; using verification placeholders", manifestError);
      }
      if (Array.isArray(vehicleManifest)) vehicleManifest.forEach((item) => { if (item && item.vehicle_key) state.vehicleManifest.set(item.vehicle_key, item); });
      state.products = normaliseProducts(data);
      buildMakeFilters();
      render();
    } catch (error) {
      console.error("Unable to load K&N catalogue", error);
      elements.meta.textContent = "Catalogue unavailable";
      elements.grid.setAttribute("aria-busy", "false");
      elements.grid.innerHTML = `<div class="empty-state"><strong>The catalogue could not be loaded</strong>Please try again shortly or contact WIAN on WhatsApp.</div>`;
    }
  }

  initialise();
})();
