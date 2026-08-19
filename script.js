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
  model.innerHTML = '<option value="">Select model</option>' + options.map(item => `<option>${item}</option>`).join('');
});

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  const type = tab.dataset.tab;
  if (type === 'vehicle') {
    vehicleFields.classList.remove('hidden');
    singleField.classList.add('hidden');
    finderNote.textContent = 'Select your vehicle. Live catalogue matching will be connected next.';
    return;
  }
  vehicleFields.classList.add('hidden');
  singleField.classList.remove('hidden');
  const config = {
    registration: ['Registration number','e.g. GA 01 AB 1234'],
    vin: ['VIN / Chassis number','Enter 17-character VIN or chassis number'],
    part: ['Part number','e.g. 03L 115 562']
  }[type];
  singleLabel.firstChild.textContent = config[0];
  singleInput.placeholder = config[1];
  singleInput.value = '';
  finderNote.textContent = 'Enter your details. Validation and live matching will be connected next.';
}));

form?.addEventListener('submit', event => {
  event.preventDefault();
  const active = document.querySelector('.search-tab.active')?.dataset.tab;
  let message = 'Tell us your vehicle details and we will help identify the correct part.';
  if (active === 'vehicle') {
    message = make.value && model.value && document.getElementById('year').value
      ? `Search prepared for ${make.value} ${model.value} (${document.getElementById('year').value}). The live catalogue is the next connection.`
      : 'Please select make, model and year to prepare your search.';
  } else if (singleInput.value.trim()) {
    message = `Search prepared for: ${singleInput.value.trim()}. The live catalogue is the next connection.`;
  } else {
    message = 'Please enter the requested details first.';
  }
  finderNote.textContent = message;
});
