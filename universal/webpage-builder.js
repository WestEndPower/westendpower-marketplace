/* The editor receives only the same public product fields used on the website. */
(() => {
 'use strict';
 const seed=document.getElementById('wep-builder-data'),form=document.getElementById('wep-builder-form');if(!seed||!form)return;
 let data;try{data=JSON.parse(seed.textContent);}catch{return;}

 const socialForm=document.getElementById('wep-social-form');
 if(socialForm)socialForm.addEventListener('submit',async event=>{
  event.preventDefault();const button=socialForm.querySelector('button'),status=socialForm.querySelector('[data-social-status]');
  button.disabled=true;status.textContent='Saving links…';
  try{
   const response=await fetch(socialForm.getAttribute('action'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams(new FormData(socialForm))});
   let result;try{result=await response.json();}catch{throw Error('Links were not saved. Reopen the builder or sign in again, then retry.');}
   if(!response.ok||!result.ok)throw Error(result.error||'Links were not saved. Please retry.');
   socialForm.elements.socialVersion.value=result.version;
   for(const input of socialForm.querySelectorAll('input[name^="social_"]'))input.value=result.links.find(link=>'social_'+link.key===input.name)?.url||'';
   const summary=socialForm.closest('details')?.querySelector('summary');if(summary)summary.textContent='Social media links · '+result.links.length+' configured';
   status.textContent='Saved. All generated pages now use these links.';
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 });

 const products=data.products||[],controls=[...form.querySelectorAll('[data-builder-select]')],skuInput=form.elements.skus;
 const dimensions={brands:'brand',categories:'category',subcategories:'subcategory',seriesValues:'series'};
 const brandName=b=>({YANMAR:'Yanmar',STIHL:'STIHL',HONDA:'Honda',TORO:'Toro',BILLYGOAT:'Billy Goat',REDMAX:'RedMax',MITM:'Mi-T-M',GREENWORKS:'Greenworks'}[b]||b);
 const element=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;return el;};
 const selected=c=>[...c.selectedOptions].map(o=>o.value).filter(Boolean);
 let titleEdited=data.saved||!!data.definition.sourceUrl;
 for(const key of ['title','description','intro','slug'])form.elements[key].addEventListener('input',()=>{titleEdited=true;});
 function manualMatches(p,limit=controls.length){return controls.slice(0,limit).every(c=>{const values=selected(c);return !values.length||values.includes(p[dimensions[c.name]]);});}
 function skuTokens(){return skuInput.value.split(/[,\r\n]+/).map(s=>s.trim()).filter(Boolean);}
 function matches(p){
  if(!manualMatches(p))return false;
  const tokens=skuTokens();if(tokens.length&&!tokens.some(t=>t.toUpperCase()===(p.brand+':'+p.sku).toUpperCase()||(!t.includes(':')&&t.toUpperCase()===p.sku.toUpperCase())))return false;
  if(form.elements.stockOnly.checked&&!(p.stock>0))return false;
  if(form.elements.clearanceOnly.checked&&!(p.clearance&&p.stock>0))return false;
  if(form.elements.clearImported?.checked)return true;
  const d=data.definition;
  if(d.power&&p.power!==d.power)return false;
  if(d.model&&p.model!==d.model)return false;
  if(d.promoOnly&&!p.rebate&&!p.saleActive)return false;
  if(d.buyOnline&&!p.buyOnline)return false;
  if(d.search&&![p.brand,p.sku,p.model,p.name,p.category,p.subcategory,p.series].join(' ').toLowerCase().includes(d.search.toLowerCase()))return false;
  if(d.availability?.length&&!d.availability.some(v=>p.stock>0?['stock','Normally In Stock'].includes(v):['order','Available to Order'].includes(v)))return false;
  return (d.fields||[]).every(f=>!f.values.length||f.values.includes((p.fields||[]).find(v=>v.field===f.field)?.value||''));
 }
 function cascade(changed=-1){
  controls.forEach((c,index)=>{
   const values=selected(c),allowed=[...new Set(products.filter(p=>manualMatches(p,index)).map(p=>p[dimensions[c.name]]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
   const keep=changed>=0&&index>changed?values.filter(v=>allowed.includes(v)):values;
   const all=element('option','All '+({brands:'brands',categories:'categories',subcategories:'subcategories',seriesValues:'series'}[c.name]));all.value='';
   c.replaceChildren(all,...[...new Set([...allowed,...keep])].map(value=>{const o=element('option',(c.name==='brands'?brandName(value):value)+(allowed.includes(value)?'':' — no longer available'));o.value=value;o.selected=keep.includes(value);return o;}));
  });
  update();
 }
 function suggest(){
  const values=Object.fromEntries(controls.map(c=>[c.name,selected(c)])),matchesNow=products.filter(matches);
  const parts=[values.brands.map(brandName).join(' & '),values.subcategories.join(' & ')||values.categories.join(' & '),values.seriesValues.join(' & '),form.elements.clearanceOnly.checked?'Clearance':''].filter(Boolean);
  const title=(skuTokens().length===1&&matchesNow.length===1?matchesNow[0].name:parts.join(' ')||'Equipment').slice(0,120);
  form.elements.title.value=title;form.elements.description.value=('Explore '+title+' at West End Power Equipment in New Milford and Danbury, CT. Compare specifications, current promotions and availability.').slice(0,300);
  form.elements.intro.value='Explore '+title+' and compare equipment for your needs. Review current promotions, configure your equipment, and request a quote or buy through West End Power Equipment.';
  if(!data.saved){const base=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,74)||'equipment';let slug=base,n=2;while((data.existingSlugs||[]).includes(slug))slug=base+'-'+n++;form.elements.slug.value=slug;}
 }
 function updateSuggestions(){
  const text=skuInput.value,index=Math.max(text.lastIndexOf(','),text.lastIndexOf('\n')),prefix=index>=0?text.slice(0,index+1)+' ':'';
  const list=document.getElementById('wep-builder-skus');list.replaceChildren(...products.filter(p=>manualMatches(p)).map(p=>{const o=element('option');o.value=prefix+p.brand+':'+p.sku;o.label=p.name;return o;}));
 }
 function update(){
  const matchesNow=products.filter(matches),tokens=skuTokens(),issues=[];
  for(const token of tokens){const found=products.filter(p=>manualMatches(p)&&(token.includes(':')?(p.brand+':'+p.sku).toUpperCase()===token.toUpperCase():p.sku.toUpperCase()===token.toUpperCase()));if(!found.length)issues.push('Unknown or unavailable SKU: '+token);else if(new Set(found.map(p=>p.brand)).size>1)issues.push('Add BRAND: before '+token+' to choose the manufacturer.');}
  const families=new Set(matchesNow.map(p=>JSON.stringify(tokens.length?[p.brand,p.sku]:[p.brand,p.category,p.series,p.model])));
  document.querySelector('[data-builder-count]').textContent=families.size+' models ('+matchesNow.length+' matching SKUs)';
  const message=document.querySelector('[data-builder-client-message]');message.textContent=issues.length?issues.join(' '):matchesNow.length?'These products match your current selection. Preview the page before publishing.':'No matching products. A saved published page with this selection will hide until eligible equipment is available.';message.classList.toggle('issue',!!issues.length);
  const host=document.querySelector('[data-builder-match-list]'),details=element('details'),summary=element('summary','Review matching SKUs ('+matchesNow.length+')');details.append(summary);
  const list=element('ul');for(const p of matchesNow.slice(0,100))list.append(element('li',p.brand+':'+p.sku+' — '+p.name));if(matchesNow.length>100)list.append(element('li','Showing the first 100 matches. All '+matchesNow.length+' matching SKUs are included.'));details.append(list);host.replaceChildren(details);
  updateSuggestions();if(!titleEdited&&!data.saved)suggest();
 }
 controls.forEach((c,i)=>c.addEventListener('change',()=>{if([...c.selectedOptions].some(o=>!o.value))for(const o of c.options)o.selected=false;cascade(i);}));
 skuInput.addEventListener('input',update);
 for(const name of ['stockOnly','clearanceOnly','clearImported'])form.elements[name]?.addEventListener('change',update);
 document.querySelector('[data-builder-suggest]').addEventListener('click',()=>{suggest();titleEdited=true;});
 cascade();
})();
