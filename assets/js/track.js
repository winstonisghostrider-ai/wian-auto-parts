/* WIAN conversion tracking (Google Ads + Google Analytics 4).
   OFF until the IDs below are filled in. When an ID is empty, nothing loads and nothing is sent.
   To switch on: paste the IDs from Google Ads (Tools > Conversions) and GA4 (Admin > Data streams),
   and add Google's tag domains to each page's Content-Security-Policy (see README section "Ads tracking").
   No personal details are ever sent: only the type of action (WhatsApp click, call click, form sent) and the page. */
(function () {
  var CONFIG = {
    ga4: "",                 // e.g. "G-XXXXXXXXXX"
    ads: "",                 // e.g. "AW-123456789"
    labels: {                // Google Ads conversion labels, e.g. "AbCdEf123"
      whatsapp: "",
      call: "",
      enquiry: "",
      home_service: ""
    }
  };
  if (!CONFIG.ga4 && !CONFIG.ads) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.ga4 || CONFIG.ads);
  document.head.appendChild(s);
  gtag("js", new Date());
  if (CONFIG.ga4) gtag("config", CONFIG.ga4, { anonymize_ip: true });
  if (CONFIG.ads) gtag("config", CONFIG.ads);

  function fire(kind) {
    var page = location.pathname;
    if (CONFIG.ga4) gtag("event", "generate_lead", { lead_type: kind, page_path: page });
    var label = CONFIG.labels[kind];
    if (CONFIG.ads && label) gtag("event", "conversion", { send_to: CONFIG.ads + "/" + label });
  }

  // WhatsApp and phone clicks anywhere on the site
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var h = a.getAttribute("href") || "";
    if (/^https:\/\/wa\.me\//i.test(h)) fire("whatsapp");
    else if (/^tel:/i.test(h)) fire("call");
  }, true);

  // Forms: homepage enquiry and home-service booking
  document.addEventListener("submit", function (e) {
    var id = e.target && e.target.id;
    if (id === "wianEnquiry" || id === "partsFinder") fire("enquiry");
    else if (id === "homeService") fire("home_service");
  }, true);
})();
