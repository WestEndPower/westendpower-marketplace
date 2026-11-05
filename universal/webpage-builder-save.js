/* Confirm saves before leaving the editor, and preserve its current revision. */
(() => {
 'use strict';
 const form=document.getElementById('wep-builder-form');
 if(!form||form.dataset.builderAsyncSave!=='1')return;
 const status=form.querySelector('[data-builder-save-status]'),reopen=form.querySelector('[data-builder-save-reopen]');
 if(!status||!reopen)return;
 let saving=false;
 function localURL(value,paths){
  const url=new URL(value,location.origin);
  if(url.origin!==location.origin||!paths.includes(url.pathname))throw Error('The save response could not be confirmed. Check the saved draft before retrying.');
  return url.href;
 }
 form.addEventListener('submit',async event=>{
  const action=event.submitter?.value;
  if(!['save','preview','publish'].includes(action))return;
  event.preventDefault();if(saving)return;
  const body=new URLSearchParams(new FormData(form));body.set('action',action);
  const controls=[...form.elements].filter(el=>el.type!=='hidden').map(el=>[el,el.disabled]);
  saving=true;let navigating=false,confirmedResponse=false;
  controls.forEach(([el])=>{el.disabled=true;});form.setAttribute('aria-busy','true');
  status.hidden=false;status.classList.remove('issue');status.textContent='Saving…';reopen.hidden=true;
  try{
   const response=await fetch(form.getAttribute('action'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body});
   let result;try{result=await response.json();}catch{throw Error('The save could not be confirmed. Reopen the builder or sign in, and check the saved draft before retrying.');}
   if(!result||typeof result!=='object')throw Error('The save response could not be confirmed. Check the saved draft before retrying.');
   confirmedResponse=true;
   if(!response.ok||!result.ok){
    if(result.editorUrl){reopen.href=localURL(result.editorUrl,['/webpage-builder']);reopen.hidden=false;}
    throw Error(result.error||'The page was not saved. Please retry.');
   }
   if(!Number.isSafeInteger(result.version)||result.version<1||typeof result.changeId!=='string'||!result.changeId||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug))throw Error('The save response could not be confirmed. Check the saved draft before retrying.');
   const editor=localURL(result.editorUrl,['/webpage-builder']),next=localURL(result.nextUrl,['/webpage-builder','/webpage-builder/preview']);
   if(new URL(editor).searchParams.get('slug')!==result.slug||new URL(next).searchParams.get('slug')!==result.slug)throw Error('The saved page address could not be confirmed. Reopen the builder before retrying.');
   form.elements.version.value=String(result.version);form.elements.changeId.value=result.changeId;
   form.elements.slug.value=result.slug;form.elements.slug.readOnly=true;
   // Back from preview must reopen this saved draft, not a stale New page form.
   history.replaceState(null,'',editor);
   status.textContent=action==='preview'?'Saved. Opening preview…':action==='publish'?'Published. Opening saved page settings…':'Draft saved. Opening saved page settings…';
   location.assign(next);navigating=true;
  }catch(error){status.classList.add('issue');status.textContent=confirmedResponse?error.message:'The save could not be confirmed. Reopen the builder or sign in, and check the saved draft before retrying. Your entries remain in this editor.';}
  finally{
   if(!navigating){saving=false;form.removeAttribute('aria-busy');controls.forEach(([el,disabled])=>{el.disabled=disabled;});}
  }
 });
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
})();
