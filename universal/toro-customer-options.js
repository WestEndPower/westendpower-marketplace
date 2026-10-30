/* Public Toro choices. Prices, eligibility and freight availability come from the quote service. */
(function(){
 'use strict';
 const allowed=['FirstResponders','NALP','FleetTier1','FleetTier2','FleetTier3'];
 let selected=null,method='DEALER_SHIP_DAY',options={programs:[],freight:{available:false}},host,dialog,lastItems='',cache=new Map();
 const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function change(kind='program'){window.dispatchEvent(new CustomEvent('wep:toro-choice',{detail:{kind}}));}
 function choices(){return {...(selected?{dealerPrograms:{TORO:{...selected}}}:{}),...(lastItems?{toroFreightMethod:method}:{})};}
 function restore(draft){const saved=draft?.dealerPrograms?.TORO;if(saved?.verified===true&&allowed.includes(saved.key))selected={key:saved.key,verified:true,reference:String(saved.reference||'')};if(['DEALER_SHIP_DAY','SHIP_NOW'].includes(draft?.toroFreightMethod))method=draft.toroFreightMethod;}
 function confirmProgram(program){
  dialog?.remove();dialog=make('dialog');dialog.className='wep-toro-confirm';
  const heading=make('h2',program.label),message=make('p',program.message),form=make('form');form.method='dialog';
  const buttons=make('div'),cancel=make('button','Cancel'),confirm=make('button','Confirm eligibility');cancel.type='button';confirm.type='submit';cancel.onclick=()=>dialog.close();buttons.append(cancel,confirm);form.append(buttons);
  form.addEventListener('submit',event=>{event.preventDefault();selected={key:program.key,verified:true,reference:''};dialog.close();render();change();});
  dialog.append(heading,message,form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 }
 function render(){
  if(!host)return;host.replaceChildren();host.hidden=!options.programs.length;
  if(host.hidden)return;
  host.append(make('h3','TORO Programs'));
  const row=make('div');row.className='wep-toro-choice-row';
  for(const program of options.programs){const button=make('button',program.label),active=selected?.key===program.key;button.type='button';button.setAttribute('aria-pressed',String(active));button.onclick=()=>{if(active){selected=null;render();change();}else confirmProgram(program);};row.append(button);}
  host.append(row,make('p',selected?options.programs.find(p=>p.key===selected.key)?.message+' Eligibility confirmed by customer.':'Select a program to review and confirm eligibility.'));
 }
 function mount(parent){host=make('section');host.className='wep-toro-programs';host.hidden=true;parent.append(host);render();}
 async function load(snapshot,post,signal){
  const toro=snapshot.items?.some(l=>l.brandId==='TORO');
  if(!toro){selected=null;method='DEALER_SHIP_DAY';lastItems='';options={programs:[],freight:{available:false}};render();return;}
  const key=JSON.stringify(snapshot.items),cached=cache.get(key);let value=cached&&Date.now()-cached.time<60000?cached.value:null;
  if(!value){value=await post('/marketplace-toro-options',{items:snapshot.items},signal);if(signal.aborted)return;cache.set(key,{value,time:Date.now()});if(cache.size>20)cache.delete(cache.keys().next().value);}
  if(signal.aborted)return;lastItems=key;options=value;
  if(selected&&!options.programs.some(p=>p.key===selected.key))selected=null;
  if(!options.freight.available)method='DEALER_SHIP_DAY';render();
 }
 function freightControl(container){
  if(!options.freight.available)return;
  const row=make('span');row.className='wep-toro-choice-row wep-toro-freight';
  row.setAttribute('role','group');row.setAttribute('aria-label','Factory freight option');
  for(const [value,label] of [['DEALER_SHIP_DAY','Standard Freight'],['SHIP_NOW','Expedited']]){
   if(row.children.length){const separator=make('span',' / ');separator.setAttribute('aria-hidden','true');row.append(separator);}
   const button=make('button',label);button.type='button';button.setAttribute('aria-pressed',String(method===value));button.onclick=()=>{const next=value==='SHIP_NOW'&&method==='SHIP_NOW'?'DEALER_SHIP_DAY':value;if(method===next)return;method=next;change('freight');};row.append(button);
  }
  container.replaceChildren(row);
 }
 window.WEPToroCustomerOptions={choices,restore,load,mount,freightControl};
})();
