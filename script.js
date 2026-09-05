const tabs = document.querySelectorAll('.search-tab');
const vehicleFields = document.getElementById('vehicle-fields');
const singleField = document.getElementById('single-field');
const singleLabel = document.getElementById('single-label');
const singleInput = document.getElementById('single-input');
const finderNote = document.getElementById('finder-note');
const form = document.getElementById('finder-form');
const make = document.getElementById('make');
const model = document.getElementById('model');

const models = {
  'Volkswagen': ['Polo','Virtus','Taigun','Tiguan','Vento'],
  'Skoda': ['Octavia','Kushaq','Slavia','Kodiaq','Superb'],
  'Maruti Suzuki': ['Swift','Baleno','Celerio','Celerio X','Brezza','Ertiga'],
  'Hyundai': ['i20','Creta','Venue','Verna','Grand i10'],
  'Tata': ['Nexon','Punch','Altroz','Harrier','Safari'],
  'Mahindra': ['Thar','XUV700','Scorpio','Bolero','XUV300'],
  'Ford': ['Fiesta','EcoSport','Endeavour','Figo'],
  'Mercedes-Benz': ['C-Class','E-Class','GLC','Sprinter'],
  'BMW': ['3 Series','5 Series','X1','X3','X5'],
  'Audi': ['A3','A4','A6','Q3','Q5']
};

make?.addEventListener('change', () => {
  const options = models[make.value] || [];
  if (model) model.innerHTML = '<option value="">Select model</option>' + options.map(item => `<option>${item}</option>`).join('');
});

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  const type = tab.dataset.tab;
  if (type === 'vehicle') {
    vehicleFields?.classList.remove('hidden');
    singleField?.classList.add('hidden');
    if (finderNote) finderNote.textContent = 'Select your vehicle. Live catalogue matching will be connected next.';
    return;
  }
  vehicleFields?.classList.add('hidden');
  singleField?.classList.remove('hidden');
  const config = {
    registration: ['Registration number','e.g. GA 01 AB 1234'],
    vin: ['VIN / Chassis number','Enter 17-character VIN or chassis number'],
    part: ['Part number','e.g. 03L 115 562']
  }[type];
  if (singleLabel && singleInput && config) {
    singleLabel.firstChild.textContent = config[0];
    singleInput.placeholder = config[1];
    singleInput.value = '';
  }
  if (finderNote) finderNote.textContent = 'Enter your details. Validation and live matching will be connected next.';
}));

form?.addEventListener('submit', event => {
  event.preventDefault();
  const active = document.querySelector('.search-tab.active')?.dataset.tab;
  let message = 'Tell us your vehicle details and we will help identify the correct part.';
  if (active === 'vehicle') {
    const year = document.getElementById('year')?.value;
    message = make?.value && model?.value && year
      ? `Search prepared for ${make.value} ${model.value} (${year}). The live catalogue is the next connection.`
      : 'Please select make, model and year to prepare your search.';
  } else if (singleInput?.value.trim()) {
    message = `Search prepared for: ${singleInput.value.trim()}. The live catalogue is the next connection.`;
  } else {
    message = 'Please enter the requested details first.';
  }
  if (finderNote) finderNote.textContent = message;
});

// WIAN advertising slideshow — placed inside the FIRST hero section as its visual background.
(function initAdSlideshow(){
  const hero = document.querySelector('.hero');
  if (!hero || document.querySelector('.ad-slider-section')) return;

  const style = document.createElement('style');
  style.textContent = `
    .hero{position:relative;isolation:isolate;overflow:hidden}
    .hero-grid{position:relative;z-index:3}
    .ad-background{position:absolute!important;inset:0!important;z-index:1!important;padding:0!important;margin:0!important;background:transparent!important;pointer-events:none!important}
    .ad-background .ad-slider{position:absolute!important;inset:0!important;min-height:100%!important;height:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:radial-gradient(circle at 76% 48%,rgba(229,9,9,.20),transparent 30%),linear-gradient(115deg,rgba(5,5,5,.98) 32%,rgba(18,3,3,.78) 100%)!important;opacity:1!important}
    .ad-background .ad-slider:before{opacity:.55}
    .ad-background .ad-slide{padding:0!important;grid-template-columns:1fr 1fr!important;transform:none!important;transition:opacity .8s ease!important;opacity:0!important}
    .ad-background .ad-slide.active{opacity:1!important}
    .ad-background .ad-copy{display:none!important}
    .ad-background .ad-mark{height:100%!important;width:100%!important;transform:translateX(22%) scale(1.55)!important;opacity:.46!important;filter:drop-shadow(0 25px 35px rgba(0,0,0,.75))}
    .ad-background .ad-ring{width:420px!important;height:420px!important}
    .ad-background .ad-wheel{width:215px!important;height:215px!important}
    .ad-background .ad-filter{width:115px!important;height:180px!important}
    .ad-background .ad-turbo-mini{width:215px!important;height:215px!important}
    .ad-background .ad-label{font-size:22px!important;letter-spacing:.25em!important;color:#777!important}
    @media(max-width:700px){.ad-background .ad-mark{transform:translateX(28%) scale(.95)!important;opacity:.28!important}.ad-background .ad-ring{width:300px!important;height:300px!important}.ad-background .ad-wheel,.ad-background .ad-turbo-mini{width:155px!important;height:155px!important}}
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.className = 'ad-slider-section ad-background';
  section.setAttribute('aria-label','WIAN featured advertisements');
  section.innerHTML = `
    <div class="ad-slider" id="ad-slider">
      <article class="ad-slide active"><div class="ad-copy"><p class="eyebrow">WIAN FEATURED OFFER</p><h2>Brake parts.<br><span>Built to stop.</span></h2><p>Quality brake pads, discs and related components for everyday cars and performance builds.</p></div><div class="ad-mark"><div class="ad-ring"></div><div class="ad-wheel"></div><div class="ad-label">BRAKES</div></div></article>
      <article class="ad-slide"><div class="ad-copy"><p class="eyebrow">SERVICE PARTS</p><h2>Keep your car<br><span>running right.</span></h2><p>Filters, oils, belts and essential maintenance parts from OEM and trusted aftermarket brands.</p></div><div class="ad-mark"><div class="ad-ring"></div><div class="ad-filter"></div><div class="ad-label">SERVICE</div></div></article>
      <article class="ad-slide"><div class="ad-copy"><p class="eyebrow">OEM + AFTERMARKET</p><h2>The right part.<br><span>First time.</span></h2><p>Give us your registration, VIN, vehicle details or part number and let WIAN help match it.</p></div><div class="ad-mark"><div class="ad-ring"></div><div class="ad-turbo-mini"></div><div class="ad-label">WIAN</div></div></article>
    </div>`;
  hero.insertBefore(section, hero.firstChild);

  const slides = [...section.querySelectorAll('.ad-slide')];
  let current = 0;
  const show = index => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide,i) => slide.classList.toggle('active', i === current));
  };
  setInterval(() => show(current + 1), 5000);
})();

// Load the live WIAN product catalogue layer.
(() => {
  const script = document.createElement('script');
  script.src = '/catalogue.js?v=20260906';
  script.defer = true;
  document.head.appendChild(script);
})();
