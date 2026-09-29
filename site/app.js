if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
const eventsEl=document.querySelector('#events');
if(eventsEl){
 const citiesEl=document.querySelector('#cities'),summary=document.querySelector('#city-summary'),status=document.querySelector('#status');
 const from=document.querySelector('#from'),to=document.querySelector('#to');
 let concerts=[],updated='',visibleCount=80;const selected=new Set();const more=document.querySelector('#more');
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=s=>new Date(s+'T12:00:00Z');
 const dateLabel=s=>new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'long',weekday:'short',timeZone:'Europe/Stockholm'}).format(date(s));
 function render(){
  const shown=concerts.filter(c=>(!selected.size||selected.has(c.city))&&(!from.value||c.date>=from.value)&&(!to.value||c.date<=to.value));
  summary.textContent=selected.size?`${selected.size} ${selected.size===1?'ort vald':'orter valda'}`:'Alla orter';
  document.querySelector('#all-cities').hidden=!selected.size;
  status.textContent=`${shown.length} träffar · Uppdaterat ${updated}`;
  more.hidden=shown.length<=visibleCount;
  eventsEl.innerHTML=shown.length?shown.slice(0,visibleCount).map(c=>`<article class="event"><div class="datebox"><strong>${date(c.date).getUTCDate()}</strong><span>${new Intl.DateTimeFormat('sv-SE',{month:'short'}).format(date(c.date))}</span></div><div class="event-body"><div class="meta">${safe(dateLabel(c.date))}${c.time?' · '+safe(c.time):''} <span class="meta-sep">/</span> ${safe(c.city)}</div><h3>${safe(c.title)}</h3><p class="venue">${safe(c.venue)}</p>${c.description?`<p class="description">${safe(c.description)}</p>`:''}<div class="event-footer"><span>Data från ${safe(c.source)}</span><a href="${safe(c.url)}" target="_blank" rel="noopener noreferrer">Visa hos arrangören ↗</a></div></div></article>`).join(''):'<div class="empty"><h3>Inga konserter i det här urvalet</h3><p>Pröva ett annat datum eller välj alla orter.</p></div>';
 }
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
