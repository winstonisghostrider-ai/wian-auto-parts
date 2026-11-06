const WIAN_FORM_ENDPOINT="https://script.google.com/macros/s/AKfycbzUnt38TMEywpq_y8Cl_nJ7BzDNgJVuOrNuFVImAzQ1Q7H4TzgoWJsOWkRphuCtMEuE/exec";
const WIAN_SUBMISSION_TIMEOUT_MS=15000;
const WIAN_EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function submitEnquiry(e){
 e.preventDefault();
 const f=document.getElementById('wianEnquiry'),b=document.getElementById('sendBtn'),s=document.getElementById('formStatus');
 if(b.disabled)return;
 if(document.getElementById('fwebsite').value){return}
 const data={email:document.getElementById('femail').value.trim(),name:document.getElementById('fname').value.trim(),phone:document.getElementById('fphone').value.trim(),vehicle:document.getElementById('fvehicle').value.trim(),service:document.getElementById('fservice').value,message:document.getElementById('fmessage').value.trim()};
 if(!WIAN_EMAIL_PATTERN.test(data.email)){s.textContent='Please enter a valid email address.';document.getElementById('femail').focus();return}
 b.disabled=true;b.textContent='Sending...';s.textContent='Submitting your enquiry securely...';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),WIAN_SUBMISSION_TIMEOUT_MS);
 try{
   await fetch(WIAN_FORM_ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),signal:controller.signal});
   const reference=[data.vehicle,data.service].filter(Boolean).join(' / ')||'my enquiry';
   document.getElementById('ackWhatsapp').href='https://wa.me/919108327761?text='+encodeURIComponent("Hi WIAN, I'm "+data.name+". I'm following up on my enquiry regarding "+reference+".");
   f.reset();document.getElementById('enquiryFormHead').hidden=true;document.getElementById('enquiryFields').hidden=true;
   const acknowledgement=document.getElementById('enquiryAcknowledgement');acknowledgement.hidden=false;acknowledgement.focus();
 }catch(err){
   b.disabled=false;b.textContent='➤ Send Message';
   s.textContent=err&&err.name==='AbortError'?'The submission timed out. Please try again or contact us by phone/WhatsApp.':'We could not send your enquiry. Please try again or contact us by phone/WhatsApp.';
 }finally{clearTimeout(timeout)}
}
const finderMethods={
 registration:{tab:'tabRegistration',panel:'panelRegistration',required:['finderRegistration']},
 vin:{tab:'tabVin',panel:'panelVin',required:['finderVin']},
 make:{tab:'tabMake',panel:'panelMake',required:['finderMake','finderModel']}
};
let activeFinderMethod='registration';
function setFinderMethod(method,focusFirst){
 activeFinderMethod=method;
 Object.entries(finderMethods).forEach(function(entry){
   const key=entry[0],config=entry[1],active=key===method,tab=document.getElementById(config.tab),panel=document.getElementById(config.panel);
   tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));panel.hidden=!active;
   panel.querySelectorAll('input,select').forEach(function(field){field.disabled=!active});
 });
 document.getElementById('finderStatus').textContent='';
 updateFinderSteps();
 const first=document.getElementById(finderMethods[method].required[0]);if(focusFirst!==false&&first)first.focus();
}
function activeFinderData(){
 if(activeFinderMethod==='registration')return{methodLabel:'Registration Number',idLabel:'Registration',idValue:document.getElementById('finderRegistration').value.trim().toUpperCase(),year:document.getElementById('finderRegYear').value,fuel:document.getElementById('finderRegFuel').value};
 if(activeFinderMethod==='vin')return{methodLabel:'VIN / Chassis Number',idLabel:'VIN / Chassis',idValue:document.getElementById('finderVin').value.trim().toUpperCase(),year:document.getElementById('finderVinYear').value,fuel:document.getElementById('finderVinFuel').value};
 return{methodLabel:'Make & Model',idLabel:'Make / Model',idValue:[document.getElementById('finderMake').value.trim(),document.getElementById('finderModel').value.trim()].filter(Boolean).join(' '),make:document.getElementById('finderMake').value.trim(),model:document.getElementById('finderModel').value.trim(),year:document.getElementById('finderMakeYear').value,fuel:document.getElementById('finderMakeFuel').value};
}
function finderVehicleReady(){return finderMethods[activeFinderMethod].required.every(function(id){return document.getElementById(id).value.trim()})}
function setFinderStepState(id,state){const step=document.getElementById(id);step.classList.remove('active','complete');if(state)step.classList.add(state)}
function updateFinderSteps(){
 const vehicleReady=finderVehicleReady(),partReady=document.getElementById('finderPart').value.trim().length>0;
 setFinderStepState('finderStep1',vehicleReady?'complete':'active');
 setFinderStepState('finderStep2',vehicleReady?(partReady?'complete':'active'):'');
 setFinderStepState('finderStep3',vehicleReady&&partReady?'active':'');
}
function submitPartsFinder(e){
 e.preventDefault();
 const activePanel=document.getElementById(finderMethods[activeFinderMethod].panel),partField=document.getElementById('finderPart');
 const invalid=[].slice.call(activePanel.querySelectorAll('input,select')).concat([partField]).find(function(field){return !field.checkValidity()});
 if(invalid){document.getElementById('finderStatus').textContent='Please complete the required vehicle and part fields.';invalid.focus();invalid.reportValidity();return}
 const data=activeFinderData(),part=partField.value.trim(),notes=document.getElementById('finderNotes').value.trim();
 const lines=['Vehicle Identification: '+data.methodLabel];
 if(activeFinderMethod==='make'){lines.push('Make: '+data.make,'Model: '+data.model)}else{lines.push(data.idLabel+': '+data.idValue)}
 if(data.year)lines.push('Year: '+data.year);
 if(data.fuel)lines.push('Engine / Fuel Type: '+data.fuel);
 lines.push('Part Required: '+part);
 if(notes)lines.push('Additional Notes: '+notes);
 const vehicleReference=[data.idValue,data.year,data.fuel].filter(Boolean).join(' | ');
 document.getElementById('fvehicle').value=vehicleReference;
 const serviceMap={'Engine Parts':'Engine Parts','Filters':'Filters','Brake System':'Brake Pads / Brakes','Suspension & Steering':'Suspension / Steering','Oils & Fluids':'Oils / Fluids','Diagnostics':'Diagnostics','VCDS Coding / Tweaks':'VCDS Coding / Tweaks','Performance Remapping':'Performance Remapping','Parts Sourcing':'Parts Sourcing'};
 document.getElementById('fservice').value=serviceMap[part]||'Other';
 document.getElementById('fmessage').value=lines.join('\n');
 setFinderStepState('finderStep1','complete');setFinderStepState('finderStep2','complete');setFinderStepState('finderStep3','complete');
 document.getElementById('finderStatus').textContent='Vehicle and part details added to the enquiry form.';
 document.getElementById('contact').scrollIntoView({behavior:'smooth'});
 setTimeout(function(){document.getElementById('femail').focus()},450);
}
document.querySelectorAll('.finder-tab').forEach(function(tab){tab.addEventListener('click',function(){setFinderMethod(tab.dataset.method)})});
document.getElementById('partsFinder').addEventListener('input',updateFinderSteps);
document.getElementById('finderRegistration').addEventListener('input',function(e){e.target.value=e.target.value.toUpperCase()});
document.getElementById('finderVin').addEventListener('input',function(e){e.target.value=e.target.value.toUpperCase()});
setFinderMethod('registration',false);

function wianPrefillFinder(part,notes){
 const pf=document.getElementById('finderPart');if(part){pf.value=part}
 if(notes){const n=document.getElementById('finderNotes');n.value=notes}
 if(typeof updateFinderSteps==='function'){updateFinderSteps()}
 document.getElementById('finder').scrollIntoView({behavior:'smooth'});
 setTimeout(function(){const first=document.querySelector('#finder .finder-panel:not([hidden]) input');if(first){first.focus()}},450);
}
function submitHeaderSearch(e){
 e.preventDefault();
 const cat=document.getElementById('headerCategory').value,q=document.getElementById('headerQuery').value.trim();
 const map={'Engine Parts':'Engine Parts','Filters':'Filters','Brakes':'Brake System','Suspension':'Suspension & Steering','Oils & Fluids':'Oils & Fluids'};
 const part=q||map[cat]||'';
 wianPrefillFinder(part,q?('Searched for: '+q+(map[cat]?' ('+cat+')':'')):'');
}
document.querySelectorAll('.cat[data-part]').forEach(function(card){
 const go=function(){wianPrefillFinder(card.dataset.part,'')};
 card.addEventListener('click',go);
 card.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}});
});
document.getElementById('headerSearch').addEventListener('submit',submitHeaderSearch);
document.getElementById('wianEnquiry').addEventListener('submit',submitEnquiry);
document.getElementById('partsFinder').addEventListener('submit',submitPartsFinder);
