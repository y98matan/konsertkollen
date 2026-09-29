if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
const eventsEl=document.querySelector('#events');
if(eventsEl){
 const citiesEl=document.querySelector('#cities'),summary=document.querySelector('#city-summary'),status=document.querySelector('#status');
 const from=document.querySelector('#from'),to=document.querySelector('#to');
 let concerts=[],updated='',visibleCount=80;const selected=new Set();const more=document.querySelector('#more');
 const saved=new Map(),storageKey='konsertkollen-saved-v1',savedEl=document.querySelector('#saved-events'),feedback=document.querySelector('#saved-feedback');
 const key=c=>`${c.source}|${c.date}|${c.title}|${c.url}`;
 try{for(const c of JSON.parse(localStorage.getItem(storageKey)||'[]'))if(c?.title&&c?.date&&c?.url)saved.set(key(c),c)}catch{}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify([...saved.values()]))}catch{feedback.textContent='Kunde inte spara valen.'}}
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=s=>new Date(s+'T12:00:00Z');
 const dateLabel=s=>new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'long',weekday:'short',timeZone:'Europe/Stockholm'}).format(date(s));
 function renderSaved(){
  const items=[...saved.values()].sort((a,b)=>a.date.localeCompare(b.date));
  document.querySelector('#saved-count').textContent=items.length;
  document.querySelector('#calendar').disabled=document.querySelector('#share').disabled=!items.length;
  savedEl.innerHTML=items.map(c=>`<div class="saved-item"><span><strong>${safe(c.title)}</strong><small>${safe(c.date)}${c.time?' · '+safe(c.time):''} · ${safe(c.city)} · ${safe(c.venue)}</small></span><button type="button" data-remove="${safe(key(c))}">Ta bort</button></div>`).join('');
 }
 function render(){
  const shown=concerts.filter(c=>(!selected.size||selected.has(c.city))&&(!from.value||c.date>=from.value)&&(!to.value||c.date<=to.value));
  summary.textContent=selected.size?`${selected.size} ${selected.size===1?'ort vald':'orter valda'}`:'Alla orter';
  document.querySelector('#all-cities').hidden=!selected.size;
  status.textContent=`${shown.length} träffar · Uppdaterat ${updated}`;
  more.hidden=shown.length<=visibleCount;
  eventsEl.innerHTML=shown.length?shown.slice(0,visibleCount).map(c=>`<article class="event"><div class="datebox"><strong>${date(c.date).getUTCDate()}</strong><span>${new Intl.DateTimeFormat('sv-SE',{month:'short'}).format(date(c.date))}</span></div><div class="event-body"><div class="meta">${safe(dateLabel(c.date))}${c.time?' · '+safe(c.time):''} <span class="meta-sep">/</span> ${safe(c.city)}</div><h3>${safe(c.title)}</h3><p class="venue">${safe(c.venue)}</p>${c.description?`<p class="description">${safe(c.description)}</p>`:''}<div class="event-footer"><label class="interest"><input type="checkbox" data-interest="${safe(key(c))}" ${saved.has(key(c))?'checked':''}> Intresserad</label><span>Data från ${safe(c.source)}</span><a href="${safe(c.url)}" target="_blank" rel="noopener noreferrer">Visa hos arrangören ↗</a></div></div></article>`).join(''):'<div class="empty"><h3>Inga konserter i det här urvalet</h3><p>Pröva ett annat datum eller välj alla orter.</p></div>';
  renderSaved();
 }
 eventsEl.addEventListener('change',e=>{
  const input=e.target.closest('input[data-interest]');if(!input)return;
  const c=concerts.find(x=>key(x)===input.dataset.interest);if(!c)return;
  if(input.checked)saved.set(key(c),c);else saved.delete(key(c));
  feedback.textContent='';persist();renderSaved();
 });
 savedEl.addEventListener('click',e=>{
  const button=e.target.closest('button[data-remove]');if(!button)return;
  saved.delete(button.dataset.remove);persist();feedback.textContent='';render();
 });
 const ics=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 document.querySelector('#calendar').addEventListener('click',()=>{
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Konsertkollen//Intresselista//SV','CALSCALE:GREGORIAN'];
  for(const c of [...saved.values()].sort((a,b)=>a.date.localeCompare(b.date))){
   const start=c.date.replace(/-/g,''),hasTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time||'');
   lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(key(c))}@konsertkollen`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`SUMMARY:${ics(c.title)}`);
   if(hasTime){
    const [hour,minute]=c.time.split(':').map(Number),end=new Date(`${c.date}T00:00:00Z`);end.setUTCMinutes(hour*60+minute+120);
    lines.push(`DTSTART:${start}T${c.time.replace(':','')}00`,`DTEND:${end.toISOString().slice(0,10).replace(/-/g,'')}T${String(end.getUTCHours()).padStart(2,'0')}${String(end.getUTCMinutes()).padStart(2,'0')}00`);
   }else{
    const next=new Date(`${c.date}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
    lines.push(`DTSTART;VALUE=DATE:${start}`,`DTEND;VALUE=DATE:${next.toISOString().slice(0,10).replace(/-/g,'')}`);
   }
   lines.push(`LOCATION:${ics([c.venue,c.city].filter(Boolean).join(', '))}`,`DESCRIPTION:${ics(`Kontrollera tider och biljetter hos arrangören: ${c.url}`)}`,'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='konsertkollen.ics';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  feedback.textContent='Kalenderfil nedladdad. Öppna eller importera den i din kalender. Sluttiden är uppskattad till två timmar efter start.';
 });
 document.querySelector('#share').addEventListener('click',async()=>{
  const text='Konserter jag är intresserad av:\n\n'+[...saved.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(c=>`${c.date}${c.time?' '+c.time:''} – ${c.title}\n${c.venue}, ${c.city}\n${c.url}`).join('\n\n');
  if(navigator.share){try{await navigator.share({title:'Min intresselista – Konsertkollen',text});feedback.textContent='Lista delad.';return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(text);feedback.textContent='Listan kopierad. Klistra in den i Google Keep.'}catch{feedback.textContent='Delning stöds inte i den här webbläsaren.'}
 });
 renderSaved();
 for(const input of [from,to])input.addEventListener('change',()=>{visibleCount=80;render()});
 more.addEventListener('click',()=>{visibleCount+=80;render()});
 document.querySelector('#clear').addEventListener('click',()=>{selected.clear();from.value='';to.value='';citiesEl.querySelectorAll('input').forEach(x=>x.checked=false);visibleCount=80;render()});
 document.querySelector('#all-cities').addEventListener('click',()=>{selected.clear();citiesEl.querySelectorAll('input').forEach(x=>x.checked=false);visibleCount=80;render()});
 try{
  const response=await fetch('./data/concerts.json');if(!response.ok)throw new Error('data');
  const data=await response.json();concerts=data.concerts.filter(c=>c.date>=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'}));
  updated=new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeZone:'Europe/Stockholm'}).format(new Date(data.updated));
  document.querySelector('#total').textContent=concerts.length;
  const cities=[...new Set(concerts.map(c=>c.city))].sort((a,b)=>a.localeCompare(b,'sv'));
  for(const [i,city] of cities.entries()){
   const row=document.createElement('label');row.className='city-option';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=city;checkbox.id=`city-${i}`;
   checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(city):selected.delete(city);visibleCount=80;render()});row.append(checkbox,document.createTextNode(city));citiesEl.append(row)
  }
  render();
 }catch{status.textContent='Kunde inte läsa konsertlistan';eventsEl.innerHTML='<div class="empty"><h3>Konserterna kunde inte visas</h3><p>Försök igen när du har uppkoppling.</p></div>'}
}
