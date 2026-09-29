type Concert={id:string;title:string;date:string;time:string;city:string;venue:string;description:string;url:string;source:string};

const plain = (v: unknown) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;|&#038;/g, '&').replace(/&#8211;|&ndash;/g, '–').replace(/&#8217;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
const summary = (v: unknown) => { const s = plain(v); return s.length > 190 ? s.slice(0,187).replace(/\s+\S*$/, '') + '…' : s; };
async function get(url: string) { const r = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error('Unavailable'); return r.json(); }
async function getTicketmaster(key: string, today: string, end: string) {
 const events: Record<string, any>[] = [];
 for (let page=0; page<5; page++) {
  const params = new URLSearchParams({apikey:key,countryCode:'SE',segmentName:'Music',startDateTime:`${today}T00:00:00Z`,endDateTime:`${end}T23:59:59Z`,sort:'date,asc',size:'200',page:String(page)});
  const result = await get(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  events.push(...(result?._embedded?.events ?? []));
  if (page+1 >= Math.min(result?.page?.totalPages ?? 1,5)) break;
 }
 return events;
}
async function getLiveNation() {
 const r = await fetch('https://www.livenation.se/api/search/events?PageSize=500', {
  headers: {'X-Site':'www.livenation.se','X-Culture':'sv-SE','Accept':'application/json','User-Agent':'Mozilla/5.0'},
  next: {revalidate:3600}, signal:AbortSignal.timeout(12000)
 });
 if (!r.ok) throw new Error('Live Nation unavailable');
 const data = await r.json();
 if (!Array.isArray(data.documents) || data.hasError) throw new Error('Invalid Live Nation response');
 return data.documents;
}
async function getWordPressEvents(host: string, pages: number) {
 const requests=Array.from({length:pages},async(_,i)=>{
  const r=await fetch(`${host}/wp-json/wp/v2/events?per_page=100&page=${i+1}`,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'},next:{revalidate:3600},signal:AbortSignal.timeout(16000)});
  if(!r.ok)throw new Error('Venue unavailable');
  return r.json();
 });
 const results=await Promise.allSettled(requests);
 if (results[0].status==='rejected') throw new Error('Venue unavailable');
 return results.flatMap(r=>r.status==='fulfilled'&&Array.isArray(r.value)?r.value:[]);
}
async function getGavle(today: string, end: string) {
 const [from,to]=[today,end].map(d=>d.split('-').map(Number));
 const form=new URLSearchParams({sortOrder:'datum',skipNumber:'0',loadNumber:'300',category:'',dateFromYear:String(from[0]),dateFromMonth:String(from[1]),dateFromDate:String(from[2]),dateToYear:String(to[0]),dateToMonth:String(to[1]),dateToDate:String(to[2])});
 const r=await fetch('https://www.gavlekonserthus.se/Static/ConsertListListing.aspx',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0','Referer':'https://www.gavlekonserthus.se/konserter/'},body:form,signal:AbortSignal.timeout(12000)});
 if(!r.ok) throw new Error('Gävle unavailable');
 const html=await r.text();
 if(!html.includes('post-box') && html.trim()) throw new Error('Invalid Gävle response');
 const months:Record<string,number>={januari:1,februari:2,mars:3,april:4,maj:5,juni:6,juli:7,augusti:8,september:9,oktober:10,november:11,december:12};
 return html.split('<div class="post-box col-sm-4">').slice(1).flatMap((block,i)=>{
  const path=block.match(/<a href="(\/konserter\/[^\"]+)"/i)?.[1];
  const title=plain(block.match(/<h3>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
  const info=plain(block.match(/<p class="info">([\s\S]*?)<\/p>/i)?.[1]);
  const parts=info.match(/(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{1,2})[.](\d{2})/i);
  if(!path||!title||!parts||/skolkonsert|repetition|trollkarl/i.test(path+' '+title)) return [];
  const month=months[parts[2].toLowerCase()], year=month<from[1]?from[0]+1:from[0];
  const date=`${year}-${String(month).padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  if(date<today||date>end)return [];
  return [{id:`g-${i}-${path}`,title,date,time:`${parts[3]}:${parts[4]}`,city:'Gävle',venue:/gasklockorna/i.test(title)?'Gasklockorna':'Gävle Konserthus',description:summary(block.match(/<div class="concertintrot">([\s\S]*?)<\/div>/i)?.[1]),url:`https://www.gavlekonserthus.se${path}`,source:'Gävle Konserthus'}];
 });
}
function mapVenueEvents(items: any[], source: 'Kaliber Room'|'Katalin', today:string, end:string):Concert[] {
 const excluded=/stand.?up|quiz|comedy|föreläsning|forelasning|underhallning|show|party|lounge/i;
 return items.flatMap(x=>{
  const raw=String(x.acf?.date_of_event||'');
  if(!/^\d{8}$/.test(raw))return [];
  const date=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
  const genres=(source==='Kaliber Room'?x.genre_names:x.genre_slugs)||[];
  if(date<today||date>end||!Array.isArray(genres)||!genres.length||genres.every((g:string)=>excluded.test(g)))return [];
  const title=plain(x.title?.rendered);
  if(!title||/quiz|stand.?up|comedy/i.test(title))return [];
  const url=source==='Kaliber Room'?`https://kaliberroom.com/events/${x.slug}`:x.link;
  if(!url)return [];
  return [{id:`${source==='Kaliber Room'?'k':'a'}-${x.id}`,title,date,time:String(x.acf?.time||'').slice(0,5),city:'Uppsala',venue:source,description:summary(x.acf?.description||x.acf?.text||''),url,source}];
 });
}
async function getPages(urls:string[]) {
 const results=await Promise.allSettled(urls.map(async url=>{
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},next:{revalidate:3600},signal:AbortSignal.timeout(16000)});
  if(!r.ok)throw new Error('Calendar unavailable');
  return r.text();
 }));
 if(results[0].status==='rejected')throw new Error('Calendar unavailable');
 return results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
}
async function getMusikhuset(today:string,end:string):Promise<Concert[]> {
 const pages=await getPages(['https://musikhuset.nu/event/',...[2,3,4,5].map(p=>`https://musikhuset.nu/event/page/${p}/`)]);
 const months:Record<string,number>={jan:1,feb:2,mar:3,apr:4,maj:5,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dec:12};
 const fromMonth=Number(today.slice(5,7)),fromYear=Number(today.slice(0,4));
 const seen=new Set<string>();
 return pages.flatMap(html=>html.split(/<div data-elementor-type="loop-item"/).slice(1).flatMap(block=>{
  const match=block.match(/<h2 class="elementor-heading-title[^\"]*"><a href="(https:\/\/musikhuset\.nu\/event\/[^\"]+)">([\s\S]*?)<\/a><\/h2>/i);
  const datePart=block.match(/<h3 class="elementor-heading-title[^\"]*">(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)<\/h3>/i);
  if(!match||!datePart)return [];
  const title=plain(match[2]),month=months[datePart[2].toLowerCase()];
  const year=month<fromMonth?fromYear+1:fromYear;
  const date=`${year}-${String(month).padStart(2,'0')}-${datePart[1].padStart(2,'0')}`;
  if(date<today||date>end||seen.has(match[1])||/quiz|stickcaf|föreläsning|after work dance|barn för världens barn/i.test(title))return [];
  seen.add(match[1]);
  return [{id:`m-${match[1]}`,title,date,time:block.match(/KL\.\s*(\d{1,2}:\d{2})/i)?.[1]||'',city:'Gävle',venue:'Musikhuset',description:'',url:match[1],source:'Musikhuset'}];
 }));
}
async function getKollektivet(today:string,end:string):Promise<Concert[]> {
 const pages=await getPages(Array.from({length:10},(_,i)=>`https://kollektivetlivet.se/evenemang-biljetter/${i?`?offset=${i*12}`:''}`));
 const seen=new Set<string>();
 return pages.flatMap(html=>html.split('<div class="time-location">').slice(1).flatMap(block=>{
  const time=block.match(/<time datetime="(\d{4}-\d{2}-\d{2})[ T]?(\d{2}:\d{2})?/i);
  const venue=plain(block.match(/<div class="location">([\s\S]*?)<\/div>/i)?.[1]);
  const link=block.match(/<h3><a[^>]*href="(https:\/\/kollektivetlivet\.se\/event\/[^\"]+)"[^>]*>([\s\S]*?)<\/a><\/h3>/i);
  if(!time||!link||time[1]<today||time[1]>end||seen.has(link[1]))return [];
  const title=plain(link[2]);
  if(/quiz|stand.?up|karaoke|dart|workshop|klubb i slottet/i.test(title))return [];
  seen.add(link[1]);
  return [{id:`kl-${link[1]}`,title,date:time[1],time:time[2]||'',city:'Stockholm',venue:venue?`Kollektivet Livet · ${venue}`:'Kollektivet Livet',description:'',url:link[1],source:'Kollektivet Livet'}];
 }));
}
async function getAXSViaStockholmLive(today:string,end:string):Promise<Concert[]> {
 const r=await fetch('https://stockholmlive.com/evenemang/',{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},next:{revalidate:3600},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Stockholm Live unavailable');
 const html=await r.text();
 if(!html.includes('card-event'))throw new Error('Invalid Stockholm Live response');
 const months:Record<string,number>={januari:1,februari:2,mars:3,april:4,maj:5,juni:6,juli:7,augusti:8,september:9,oktober:10,november:11,december:12};
 return html.split('<div class="card-event">').slice(1).flatMap(block=>{
  const axs=block.match(/href="(https:\/\/www\.axs\.com\/se\/events\/[^\"]+)"/i)?.[1];
  const category=plain(block.match(/<div class="card-button-text-content">\s*<div>\s*([^<]+)<\/div>/i)?.[1]);
  const title=plain(block.match(/<h3>\s*([^<]+)<\/h3>/i)?.[1]);
  const dateText=plain(block.match(/<div class="dates">\s*([\s\S]*?)<\/div>/i)?.[1]);
  const dayMonth=dateText.match(/(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/i);
  const year=dateText.match(/20\d{2}/)?.[0];
  if(!axs||category!=='Musik/Show'||!title||!dayMonth||!year||/burlesque|musikal|show on ice|stunt show/i.test(title))return [];
  const date=`${year}-${String(months[dayMonth[2].toLowerCase()]).padStart(2,'0')}-${dayMonth[1].padStart(2,'0')}`;
  if(date<today||date>end)return [];
  const venue=plain(block.match(/<div class="card-button-text-content">\s*<div>[\s\S]*?<\/div>\s*<div>\s*([\s\S]*?)<\/div>/i)?.[1])||'Stockholm Live';
  const tagline=plain(block.match(/<div class="tagline">\s*([\s\S]*?)<\/div>/i)?.[1]);
  return [{id:`axs-${axs}`,title,date,time:'',city:'Stockholm',venue,description:summary(tagline),url:axs.replace(/&amp;/g,'&'),source:'AXS via Stockholm Live'}];
 });
}
async function getEncore(today:string,end:string):Promise<Concert[]> {
 const data=await get('https://www.encoresundbyberg.se/wp-json/encore/v1/events');
 if(!Array.isArray(data.events))throw new Error('Invalid Encore response');
 return data.events.flatMap((x:any)=>{
  const date=String(x.date||''),title=plain(x.title),url=String(x.event_url||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||date>end||!title||!url||/quiz|stand.?up|karaoke/i.test(title))return [];
  return [{id:`encore-${url}`,title,date,time:String(x.show_time||x.doors_time||'').slice(0,5),city:'Sundbyberg',venue:'Encore Sundbyberg',description:summary(x.description),url,source:'Encore Sundbyberg'}];
 });
}
async function getNalen(today:string,end:string):Promise<Concert[]> {
 const pages=await getPages(['https://nalen.com/sv']);
 const raw=pages[0].match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 if(!raw)throw new Error('Invalid Nalen response');
 const data=JSON.parse(raw);
 const cards=data.props?.pageProps?.blocks?.find((b:any)=>b.component==='artistCarousel')?.artists;
 if(!Array.isArray(cards))throw new Error('Invalid Nalen concerts');
 const richText=(v:any):string=>typeof v==='string'?v:Array.isArray(v)?v.map(richText).join(' '):v&&typeof v==='object'?(v.text||richText(v.content||[])):'';
 return cards.flatMap((x:any)=>{
  const date=String(x.startDate||'').slice(0,10),title=plain(richText(x.artistName));
  const path=String(x.artistPageUrl?.cached_url||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||date>end||!title||!path.startsWith('konsert/')||/efter jobbet|burlesque|vernissage|jazzbrunch|quiz|stand.?up|föreläsning|workshop|inställt/i.test(title))return [];
  return [{id:`nalen-${path}-${date}`,title,date,time:String(x.startDate||'').slice(11,16),city:'Stockholm',venue:'Nalen',description:summary(x.info||''),url:`https://nalen.com/sv/${path}`,source:'Nalen'}];
 });
}
export async function collectConcerts() {
 const now = new Date();
 const today = new Intl.DateTimeFormat('sv-SE', { timeZone:'Europe/Stockholm', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
 const end = new Date(now.getTime()+180*86400000).toISOString().slice(0,10);
 const ticketmasterKey = process.env.TICKETMASTER_API_KEY;
 const results = await Promise.allSettled([get(`https://debaser.se/external/events?start=${today}&end=${end}&category=CONCERT`), get('https://www.berwaldhallen.se/api/feeds/calendar'), ticketmasterKey ? getTicketmaster(ticketmasterKey,today,end) : Promise.resolve(null), getLiveNation(),getWordPressEvents('https://kaliberlive.com',2),getWordPressEvents('https://www.katalin.com',4),getGavle(today,end),getMusikhuset(today,end),getKollektivet(today,end),getAXSViaStockholmLive(today,end),getEncore(today,end),getNalen(today,end)]);
 const concerts: Concert[] = [];
 if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) for (const x of results[0].value) if (x.date && x.title) concerts.push({id:`d-${x.date}-${x.title}`,title:plain(x.title),date:x.date,time:x.open_time||'',city:'Stockholm',venue:plain(x.room)||'Debaser',description:summary(x.description),url:x.ticket_url||'https://debaser.se/kalender',source:'Debaser'});
 if (results[1].status === 'fulfilled' && Array.isArray(results[1].value?.data)) for (const x of results[1].value.data) { const date=String(x.startDate||'').slice(0,10); if (!date || date < today || !x.name) continue; concerts.push({id:`b-${x['@id']||x.startDate}`,title:plain(x.name),date,time:String(x.startDate||'').slice(11,16),city:plain(x.location?.address?.addressLocality)||'Stockholm',venue:plain(x.location?.name)||'Berwaldhallen',description:summary(x.description),url:x['@id']||'https://www.berwaldhallen.se/',source:'Berwaldhallen'}); }
 if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) for (const x of results[2].value) {
  const date=String(x.dates?.start?.localDate||'');
  const venue=x._embedded?.venues?.[0];
  if (!date || date<today || !x.name || !venue?.city?.name || !x.url || x.test) continue;
  concerts.push({id:`t-${x.id}`,title:plain(x.name),date,time:String(x.dates?.start?.localTime||'').slice(0,5),city:plain(venue.city.name),venue:plain(venue.name)||'Spelställe ej angivet',description:summary(x.description||x.info||x.pleaseNote||''),url:x.url,source:'Ticketmaster'});
 }
 if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) for (const x of results[3].value) {
  const date=String(x.eventDate||'').slice(0,10);
  const genres=(x.genres||[]).map((g:{name:string})=>g.name);
  const music=['Pop','Rock','Alternative and Indie','Hard rock / Metal','RnB / Soul','Country','Electronic','Hip Hop / Rap','Jazz and Blues','Afrobeats'];
  const festival=/festival|way out west/i.test(x.name||'');
  if (!date || date<today || date>end || !x.name || !x.venue?.city || (!genres.some((g:string)=>music.includes(g)) && !festival)) continue;
  const path=x.localizations?.find((l:{cultureName:string})=>l.cultureName==='sv-SE')?.url || x.url;
  const url=typeof path==='string' && path.startsWith('/event/') ? `https://www.livenation.se${path}` : '';
  if (!url) continue;
  concerts.push({id:`l-${x.id}`,title:plain(x.name),date,time:plain(x.showTime||'').slice(0,5),city:plain(x.venue.city),venue:plain(x.venue.name)||'Spelställe ej angivet',description:summary(x.description||x.eventListingText||x.mainEventInformation||''),url,source:'Live Nation'});
 }
 if(results[4].status==='fulfilled')concerts.push(...mapVenueEvents(results[4].value,'Kaliber Room',today,end));
 if(results[5].status==='fulfilled')concerts.push(...mapVenueEvents(results[5].value,'Katalin',today,end));
 if(results[6].status==='fulfilled')concerts.push(...results[6].value);
 if(results[7].status==='fulfilled')concerts.push(...results[7].value);
 if(results[8].status==='fulfilled')concerts.push(...results[8].value);
 if(results[9].status==='fulfilled')concerts.push(...results[9].value);
 if(results[10].status==='fulfilled')concerts.push(...results[10].value);
 if(results[11].status==='fulfilled')concerts.push(...results[11].value);
 const normalized=(v:string)=>v.toLocaleLowerCase('sv-SE').normalize('NFKD').replace(/[^a-z0-9]+/g,'');
 const unique: Concert[]=[];
 for (const concert of concerts) {
  const match=unique.find(c=>c.source!==concert.source && c.date===concert.date && normalized(c.title)===normalized(concert.title) && normalized(c.city)===normalized(concert.city));
  if (match) { match.source += ` · ${concert.source}`; if (concert.source==='Live Nation') match.url=concert.url; if (!match.description && concert.description) match.description=concert.description; }
  else unique.push(concert);
 }
 unique.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
 return unique;
}
