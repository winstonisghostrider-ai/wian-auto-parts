(function () {
  const data = Array.isArray(window.WIAN_SERVICE_PARTS) ? window.WIAN_SERVICE_PARTS : [];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const grid = document.getElementById("partsGrid");
  const search = document.getElementById("partsSearch");
  const chips = document.getElementById("makeChips");
  const count = document.getElementById("partsCount");
  const makes = ["All"].concat([...new Set(data.map((d) => d.make))].sort());
  let activeMake = "All";

  chips.innerHTML = makes.map((m) => `<button type="button" class="chip${m === "All" ? " active" : ""}" data-make="${esc(m)}">${esc(m)}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    activeMake = b.dataset.make;
    chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === b));
    render();
  });
  search.addEventListener("input", render);

  function waLink(d) {
    const text = `Hi WIAN, I need a cabin air filter for my ${d.make} (${d.vehicles}). Listed part: ${d.brand} ${d.part}. My registration number is: `;
    return "https://wa.me/919108327761?text=" + encodeURIComponent(text);
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const list = data.filter((d) =>
      (activeMake === "All" || d.make === activeMake) &&
      (!q || [d.make, d.vehicles, d.brand, d.part].join(" ").toLowerCase().includes(q)));
    count.textContent = `${list.length} ${list.length === 1 ? "filter" : "filters"}`;
    if (!list.length) {
      grid.innerHTML = `<div class="empty"><b>No listed match.</b> We source most cabin filters within 24–48 hours. <a href="https://wa.me/919108327761?text=${encodeURIComponent("Hi WIAN, I need a cabin air filter. My registration number is: ")}" target="_blank" rel="noopener">Ask on WhatsApp</a></div>`;
      return;
    }
    grid.innerHTML = list.map((d) => `
      <article class="pcard">
        <span class="pmake">${esc(d.make)}</span>
        <h3>${esc(d.vehicles)}</h3>
        <p class="pline"><b>${esc(d.brand)}</b> · ${esc(d.part)}</p>
        <p class="pprice">MRP ${inr(d.mrp)}</p>
        <a class="pbtn" href="${waLink(d)}" target="_blank" rel="noopener">Check fit &amp; order</a>
      </article>`).join("");
  }
  render();
})();
