(()=>{'use strict';
const q=(s,root=document)=>root.querySelector(s),qa=(s,root=document)=>[...root.querySelectorAll(s)];
// נשמר הכיוון בין דפים, בלי לטעון שלושה אתרים או סרטוני רקע.
const variant=new URLSearchParams(location.search).get('v')||'a';
qa('[data-hero]').forEach(el=>el.hidden=el.dataset.hero!==(['a','b','c'].includes(variant)?variant:'a'));
qa('[data-hero]:not([hidden]) img').forEach((img,i)=>{img.loading='eager';if(i===0)img.fetchPriority='high';});
qa('a[href]').forEach(a=>{const raw=a.getAttribute('href');if(/^[a-z-]+\.html(?:#.*)?$/.test(raw)){const [file,hash]=raw.split('#');a.href=file+'?v='+variant+(hash?'#'+hash:'');}});
const nav=q('#mobile-nav'),toggle=q('.nav-toggle');
function closeNav(){if(nav.open)nav.close();document.body.classList.remove('locked');toggle.setAttribute('aria-expanded','false');toggle.focus();}
toggle.addEventListener('click',()=>{nav.showModal();document.body.classList.add('locked');toggle.setAttribute('aria-expanded','true');q('.nav-close').focus();});
q('.nav-close').addEventListener('click',closeNav);nav.addEventListener('cancel',()=>{document.body.classList.remove('locked');toggle.setAttribute('aria-expanded','false');});
qa('nav a',nav).forEach(a=>a.addEventListener('click',closeNav));
const lightbox=q('#lightbox');let origin=null;
qa('.photo-open').forEach(b=>b.addEventListener('click',()=>{origin=b;q('img',lightbox).src=b.dataset.image;q('img',lightbox).alt=b.dataset.caption;q('p',lightbox).textContent=b.dataset.caption;lightbox.showModal();document.body.classList.add('locked');q('.lightbox-close').focus();}));
function closePhoto(){lightbox.close();document.body.classList.remove('locked');origin?.focus();}
q('.lightbox-close').addEventListener('click',closePhoto);lightbox.addEventListener('cancel',()=>{document.body.classList.remove('locked');origin?.focus();});
lightbox.addEventListener('click',e=>{if(e.target===lightbox)closePhoto();});
// הסרטונים אינם מקבלים src ואין בקשת MP4 עד לחיצה מפורשת.
qa('.film-play').forEach(b=>b.addEventListener('click',()=>{const v=q('video',b.parentElement);qa('source',v).forEach(s=>{s.src=s.dataset.src;});const poster=q('.film-poster',b.parentElement);if(poster)poster.hidden=true;v.hidden=false;v.controls=true;v.load();v.play().then(()=>{b.hidden=true;}).catch(()=>{b.hidden=true;v.controls=true;});}));
qa('video').forEach(v=>v.addEventListener('play',()=>qa('video').filter(x=>x!==v).forEach(x=>x.pause())));
const search=q('#dish-search'),select=q('#category');
if(search){const normalize=s=>s.replace(/[׳״'"\u0591-\u05c7]/g,'').toLocaleLowerCase('he');
const dishes=qa('.dish'),groups=qa('.menu-group'),count=q('#menu-count'),empty=q('.no-results');
function filter(){let shown=0;const term=normalize(search.value.trim());groups.forEach(group=>{let local=0;qa('.dish',group).forEach(d=>{const ok=(!term||normalize(d.textContent).includes(term))&&(select.value==='all'||select.value===group.id);d.hidden=!ok;if(ok){shown++;local++;}});group.hidden=local===0;});count.textContent=shown===1?'מנה אחת':shown+' מנות';empty.hidden=shown>0;q('.search-clear').hidden=!term;}
search.addEventListener('input',filter);select.addEventListener('change',filter);function reset(){search.value='';select.value='all';filter();search.focus();}q('.search-clear').addEventListener('click',reset);q('#reset-menu').addEventListener('click',reset);filter();
qa('.menu-categories a').forEach(a=>a.addEventListener('click',()=>{search.value='';select.value='all';filter();}));}
const planner=q('#event-planner');if(planner){q('input[type=date]',planner).min=new Date().toLocaleDateString('en-CA');planner.addEventListener('submit',e=>{e.preventDefault();if(!planner.reportValidity())return;const values=new FormData(planner);const text=['שלום, אשמח לתאם אירוע בכרמלה עם משה.','שם: '+values.get('name'),'מספר אורחים: '+values.get('guests'),values.get('date')?'תאריך משוער: '+values.get('date'):'',values.get('details')||''].filter(Boolean).join('\n');const a=q('#planner-link');a.href='https://wa.me/972505473128?text='+encodeURIComponent(text);q('#planner-result').hidden=false;a.focus();});}
})();
