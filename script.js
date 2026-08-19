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

// WIAN advertising slideshow: uses the same black/red/turbo visual language as the hero.
(function initAdSlideshow(){
  const finder = document.querySelector('.finder');
  if (!finder || document.querySelector('.ad-slider-section')) return;
  const section = document.createElement('section');
  section.className = 'ad-slider-section';
  section.setAttribute('aria-label','WIAN featured advertisements');
  section.innerHTML = `
    <div class="container">
      <div class="ad-slider" id="ad-slider">
        <article class="ad-slide active"><div class="ad-copy"><p class="eyebrow">WIAN FEATURED OFFER</p><h2>Brake parts.<br><span>Built to stop.</span></h2><p>Quality brake pads, discs and related components for everyday cars and performance builds.</p><a class="button button-primary" href="#categories">Shop Brakes →</a></div><div class="ad-mark"><div class="ad-ring"></div><div class="ad-wheel"></div><div class="ad-label">BRAKES</div></div></article>
        <article class="ad-slide"><div class="ad-copy"><p class="eyebrow">SERVICE PARTS</p><h2>Keep your car<br><span>running right.</span></h2><p>Filters, oils, belts and essential maintenance parts from OEM and trusted aftermarket brands.</p><a class="button button-primary" href="#find-parts">Find Service Parts →</a></div><div class="ad-mark"><div class="ad-ring"></div><div class="ad-filter"></div><div class="ad-label">SERVICE</div></div></article>
        <article class="ad-slide"><div class="ad-copy"><p class="eyebrow">OEM + AFTERMARKET</p><h2>The right part.<br><span>First time.</span></h2><p>Give us your registration, VIN, vehicle details or part number and let WIAN help match it.</p><a class="button button-primary" href="#find-parts">Find a Part →</a></div><div class="ad-mark"><div class="ad-ring"></div><div class="ad-turbo-mini"></div><div class="ad-label">WIAN</div></div></article>
        <div class="ad-dots"><button class="ad-dot active" data-slide="0" aria-label="Advertisement 1"></button><button class="ad-dot" data-slide="1" aria-label="Advertisement 2"></button><button class="ad-dot" data-slide="2" aria-label="Advertisement 3"></button></div>
      </div>
    </div>`;
  finder.parentNode.insertBefore(section, finder);
  const slides = [...section.querySelectorAll('.ad-slide')];
  const dots = [...section.querySelectorAll('.ad-dot')];
  let current = 0;
  let timer;
  const show = index => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide,i) => slide.classList.toggle('active', i === current));
    dots.forEach((dot,i) => dot.classList.toggle('active', i === current));
  };
  const restart = () => { clearInterval(timer); timer = setInterval(() => show(current + 1), 5000); };
  dots.forEach(dot => dot.addEventListener('click', () => { show(Number(dot.dataset.slide)); restart(); }));
  restart();
})();
