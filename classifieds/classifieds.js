const listingsEl = document.getElementById('listings');
    const listingCount = document.getElementById('listingCount');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const locationFilter = document.getElementById('locationFilter');
    const categoryCards = [...document.querySelectorAll('[data-category]')];
    const allListings = Array.isArray(window.WIAN_CLASSIFIEDS) ? window.WIAN_CLASSIFIEDS : [];

    const money = value => {
      if (typeof value === 'number') return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
      return esc(value || 'Price on request');
    };

    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const safeImage = value => { const v = String(value || ''); const rest = v.replace(/^(\.\.\/|\/)/, ''); return /^assets\/[\w\-./]+\.(webp|jpe?g|png)$/i.test(rest) && !rest.includes('..') ? v : ''; };
    const cleanPhone = value => String(value || '').replace(/\D/g,'');
    const waPhone = value => {
      let p = cleanPhone(value);
      if (p.length === 10) p = '91' + p;
      return p;
    };

    function renderListings(){
      const q = searchInput.value.trim().toLowerCase();
      const category = categoryFilter.value;
      const location = locationFilter.value;
      const filtered = allListings.filter(item => {
        const haystack = [item.title,item.category,item.location,item.description,item.year,item.fuel,item.transmission,item.kilometres].join(' ').toLowerCase();
        const matchesSearch = !q || haystack.includes(q);
        const matchesCategory = category === 'All' || item.category === category;
        const matchesLocation = location === 'All Goa' || String(item.location || '').toLowerCase().includes(location.toLowerCase().replace(' goa',''));
        return matchesSearch && matchesCategory && matchesLocation;
      }).sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));

      listingCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'listing' : 'listings'}`;

      if (!filtered.length){
        listingsEl.innerHTML = `<div class="empty"><div class="icon">🚘</div><h3>No live listings here yet.</h3><p>Be among the first sellers on WIAN Classifieds. Submit your vehicle, part or automotive item for review.</p><a class="btn red" href="#post">Post the First Ad</a></div>`;
        return;
      }

      listingsEl.innerHTML = filtered.map(item => {
        const phone = waPhone(item.phone);
        const rawTitle = String(item.title || 'Automotive Listing');
        const safeTitle = esc(rawTitle);
        const img = safeImage(item.image);
        const waText = encodeURIComponent(`Hi, I am interested in your WIAN Classifieds listing: ${rawTitle}`);
        const image = img ? `<img src="${esc(img)}" alt="${safeTitle}" loading="lazy">` : 'Photo coming soon';
        const meta = [item.year,item.fuel,item.transmission,item.kilometres,item.location].filter(Boolean).map(v => `<span class="pill">${esc(v)}</span>`).join('');
        return `<article class="listing"><div class="media">${image}${item.featured ? '<span class="badge">FEATURED</span>' : ''}</div><div class="body"><div class="price">${money(item.price)}</div><div class="title">${safeTitle}</div><div class="meta">${meta}</div><div class="desc">${esc(item.description)}</div><div class="seller">${esc(item.sellerType || 'Seller')}${item.contactName ? ' · ' + esc(item.contactName) : ''}</div><div class="cardactions">${phone ? `<a class="wa" href="https://wa.me/${phone}?text=${waText}">WhatsApp</a><a class="call" href="tel:+${phone}">Call Seller</a>` : '<a class="wa" href="https://wa.me/919108327761">Ask WIAN</a><a class="call" href="tel:+919108327761">Call WIAN</a>'}</div></div></article>`;
      }).join('');
    }

    searchInput.addEventListener('input',renderListings);
    categoryFilter.addEventListener('change',renderListings);
    locationFilter.addEventListener('change',renderListings);

    categoryCards.forEach(card => card.addEventListener('click',() => {
      categoryCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      categoryFilter.value = card.dataset.category;
      renderListings();
      document.getElementById('browse').scrollIntoView({behavior:'smooth'});
    }));

    document.getElementById('clearFilters').addEventListener('click',() => {
      searchInput.value='';
      categoryFilter.value='All';
      locationFilter.value='All Goa';
      categoryCards.forEach(c => c.classList.toggle('active',c.dataset.category==='All'));
      renderListings();
    });

    document.getElementById('classifiedForm').addEventListener('submit',event => {
      event.preventDefault();
      const v = id => document.getElementById(id).value.trim();
      const message = [
        'WIAN CLASSIFIED SUBMISSION',
        '',
        `Category: ${v('adCategory')}`,
        `Title: ${v('adTitle')}`,
        `Price: ${v('adPrice')}`,
        `Location: ${v('adLocation')}`,
        `Seller: ${v('sellerName')}`,
        `Phone / WhatsApp: ${v('sellerPhone')}`,
        `Seller Type: ${v('sellerType')}`,
        `Year / Part Number: ${v('adYear') || 'N/A'}`,
        '',
        'Description:',
        v('adDescription'),
        '',
        'I will attach the listing photos in WhatsApp.'
      ].join('\n');
      window.open(`https://wa.me/919108327761?text=${encodeURIComponent(message)}`,'_blank','noopener');
    });

    renderListings();
