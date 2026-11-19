# WIAN Auto Parts

Official WIAN Auto Parts website and online automotive spare parts platform.

## Current build

The first website foundation is now in place:

- Responsive WIAN Auto Parts landing page
- Vehicle / registration / VIN / part-number search interface
- Vehicle make and model selection foundation
- OEM and aftermarket positioning
- Parts category structure
- WIAN standard / fitment messaging
- Enquiry workflow placeholder
- Mobile responsive layout

## Project structure

- `index.html` — website structure and content
- `styles.css` — responsive visual system
- `script.js` — search interface interactions and vehicle model data

## Roadmap

1. Connect a real vehicle and parts database.
2. Add OEM and aftermarket catalogue data.
3. Add product pages and vehicle fitment results.
4. Add customer accounts, cart and checkout.
5. Integrate UPI / payment gateway and order management.
6. Add workshop, diagnostics and performance services.
7. Add admin tools for inventory, pricing and catalogue management.

> No API keys, payment secrets or customer data should be committed to this repository.


## Official WIAN business address

The current official address is maintained in [BUSINESS_ADDRESS.md](BUSINESS_ADDRESS.md). Keep the homepage map and all public site footers consistent with that source of truth.

## Ads tracking (Google Ads + GA4)

`assets/js/track.js` is loaded on every page but does nothing until IDs are filled in.

1. Paste the GA4 measurement ID (`G-…`), the Google Ads ID (`AW-…`) and the four conversion labels into `CONFIG` in `assets/js/track.js`.
2. Add Google's tag domains to the Content-Security-Policy meta tag on every page:
   - `script-src`: `https://www.googletagmanager.com`
   - `connect-src`: `https://*.google-analytics.com https://*.analytics.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com`
   - `img-src`: `https://www.googletagmanager.com https://*.google-analytics.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.co.in`
3. Bump `track.js?v=` and deploy. Check in Google Ads > Conversions > (action) > "Tag diagnostics".

Events: `whatsapp` (any wa.me link click), `call` (tel: link), `enquiry` (homepage enquiry/finder form), `home_service` (home-service booking form). No personal data is sent.
