const MAX_DEX = 1025;
const POKEAPI = 'https://pokeapi.co/api/v2';
const TCGDEX = 'https://api.tcgdex.net/v2/en';
const GENERATIONS = [
  {name:'Generation I',min:1,max:151},{name:'Generation II',min:152,max:251},{name:'Generation III',min:252,max:386},
  {name:'Generation IV',min:387,max:493},{name:'Generation V',min:494,max:649},{name:'Generation VI',min:650,max:721},
  {name:'Generation VII',min:722,max:809},{name:'Generation VIII',min:810,max:905},{name:'Generation IX',min:906,max:1025}
];
const TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const NAME_FIXES={
  'nidoran-f':'Nidoran♀','nidoran-m':'Nidoran♂','farfetchd':"Farfetch'd",'mr-mime':'Mr. Mime','mime-jr':'Mime Jr.',
  'ho-oh':'Ho-Oh','porygon-z':'Porygon-Z','flabebe':'Flabébé','type-null':'Type: Null','jangmo-o':'Jangmo-o',
  'hakamo-o':'Hakamo-o','kommo-o':'Kommo-o','tapu-koko':'Tapu Koko','tapu-lele':'Tapu Lele','tapu-bulu':'Tapu Bulu',
  'tapu-fini':'Tapu Fini','sirfetchd':"Sirfetch'd",'mr-rime':'Mr. Rime','wo-chien':'Wo-Chien','chien-pao':'Chien-Pao',
  'ting-lu':'Ting-Lu','chi-yu':'Chi-Yu'
};
const setCache = new Map();
const debutCache = new Map();
const detailCache = new Map();
let allPokemon=[]; let filtered=[]; let visibleCount=40; let typeIds=null;

const grid=document.querySelector('#pokemonGrid');
const status=document.querySelector('#status');
const resultCount=document.querySelector('#resultCount');
const searchInput=document.querySelector('#searchInput');
const generationFilter=document.querySelector('#generationFilter');
const typeFilter=document.querySelector('#typeFilter');
const sortFilter=document.querySelector('#sortFilter');
const modal=document.querySelector('#pokemonModal');
const modalContent=document.querySelector('#modalContent');

function displayName(slug){
  if(NAME_FIXES[slug]) return NAME_FIXES[slug];
  return slug.split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
}
function dex(id){return `#${String(id).padStart(4,'0')}`}
function generationFor(id){return GENERATIONS.findIndex(g=>id>=g.min&&id<=g.max)+1}
function cardImage(base, quality='high'){return base ? `${base}/${quality}.webp` : ''}
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function setupFilters(){GENERATIONS.forEach((g,i)=>generationFilter.insertAdjacentHTML('beforeend',`<option value="${i+1}">${g.name}</option>`));TYPES.forEach(t=>typeFilter.insertAdjacentHTML('beforeend',`<option value="${t}">${displayName(t)}</option>`))}

async function init(){
  setupFilters();
  status.textContent='Opening the National Dex…';
  try{
    const r=await fetch(`${POKEAPI}/pokemon-species?limit=${MAX_DEX}&offset=0`);
    if(!r.ok) throw new Error('PokéAPI unavailable');
    const data=await r.json();
    allPokemon=data.results.slice(0,MAX_DEX).map((p,i)=>({name:p.name,id:i+1}));
    status.hidden=true;
    applyFilters();
  }catch(err){
    status.textContent='The Pokédex database is temporarily offline. Try refreshing in a moment.';
  }
}

async function loadTypeIds(type){
  if(type==='all'){typeIds=null;return}
  status.hidden=false;status.textContent=`Loading ${displayName(type)} Pokémon…`;
  try{
    const r=await fetch(`${POKEAPI}/type/${type}`); const d=await r.json();
    typeIds=new Set(d.pokemon.map(x=>Number(x.pokemon.url.match(/\/pokemon\/(\d+)\//)?.[1])).filter(id=>id&&id<=MAX_DEX));
  }catch{typeIds=new Set()}
  status.hidden=true;
}

function applyFilters(){
  const q=searchInput.value.trim().toLowerCase().replace(/^#/,'');
  const gen=generationFilter.value;
  filtered=allPokemon.filter(p=>{
    const label=displayName(p.name).toLowerCase();
    const searchOk=!q||label.includes(q)||p.name.includes(q)||String(p.id)===q||String(p.id).padStart(4,'0').includes(q);
    const genOk=gen==='all'||generationFor(p.id)===Number(gen);
    const typeOk=!typeIds||typeIds.has(p.id);
    return searchOk&&genOk&&typeOk;
  });
  const sort=sortFilter.value;
  filtered.sort((a,b)=>sort==='number-desc'?b.id-a.id:sort==='name-asc'?displayName(a.name).localeCompare(displayName(b.name)):sort==='name-desc'?displayName(b.name).localeCompare(displayName(a.name)):a.id-b.id);
  visibleCount=40;
  resultCount.textContent=filtered.length.toLocaleString();
  render();
}

function render(){
  const slice=filtered.slice(0,visibleCount);
  if(!slice.length){grid.innerHTML='<div class="empty"><b>No Pokémon found.</b><span>Try another name, number, type, or generation.</span></div>';return}
  grid.innerHTML=slice.map(p=>`<article class="pokemonCard" tabindex="0" data-id="${p.id}" data-name="${escapeHTML(p.name)}" aria-label="Open ${escapeHTML(displayName(p.name))} TCG debut card">
    <div class="cardVisual">
      <span class="dexNumber">${dex(p.id)}</span>
      <div class="cardSkeleton"><i></i><span>Finding TCG debut…</span></div>
      <img class="debutImage" alt="${escapeHTML(displayName(p.name))} TCG debut card" loading="lazy">
    </div>
    <div class="cardCopy"><h3>${escapeHTML(displayName(p.name))}</h3><p class="debutMeta">TCG DEBUT · LOADING</p></div>
  </article>`).join('');
  observeCards();
}

function maybeLoadMore(){if(visibleCount>=filtered.length)return;visibleCount=Math.min(visibleCount+40,filtered.length);render()}
const sentinelObserver=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)maybeLoadMore()},{rootMargin:'900px'});
sentinelObserver.observe(document.querySelector('#loadSentinel'));

const cardObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting){cardObserver.unobserve(entry.target); hydrateCard(entry.target)}})
},{rootMargin:'700px'});
function observeCards(){document.querySelectorAll('.pokemonCard').forEach(card=>cardObserver.observe(card))}

function setIdFromCardId(id){const ix=id.lastIndexOf('-');return ix>0?id.slice(0,ix):id}
async function getSet(setId){
  if(setCache.has(setId)) return setCache.get(setId);
  const p=fetch(`${TCGDEX}/sets/${encodeURIComponent(setId)}`).then(r=>r.ok?r.json():null).catch(()=>null);
  setCache.set(setId,p); return p;
}

function normalizedCardName(name){return name.toLowerCase().replace(/[♀♂]/g,'').replace(/[é]/g,'e').replace(/[.'’:\-]/g,' ').replace(/\s+/g,' ').trim()}
function cardNameMatches(cardName, pokemonName){
  const a=normalizedCardName(cardName), b=normalizedCardName(pokemonName);
  return a===b || a===`dark ${b}` || a===`light ${b}` || a.endsWith(`'s ${b}`) || a.endsWith(`s ${b}`);
}

async function resolveDebut(p){
  if(debutCache.has(p.id)) return debutCache.get(p.id);
  const stored=localStorage.getItem(`pokedae-debut-v3-${p.id}`);
  if(stored){try{const parsed=JSON.parse(stored);debutCache.set(p.id,parsed);return parsed}catch{}}
  const pokemonName=displayName(p.name);
  const promise=(async()=>{
    const r=await fetch(`${TCGDEX}/cards?name=${encodeURIComponent(pokemonName)}`);
    if(!r.ok) throw new Error('TCGdex search failed');
    let cards=await r.json();
    cards=cards.filter(c=>c.image && cardNameMatches(c.name,pokemonName));
    if(!cards.length){
      cards=(await (await fetch(`${TCGDEX}/cards?name=${encodeURIComponent(pokemonName.split(' ')[0])}`)).json()).filter(c=>c.image && normalizedCardName(c.name).includes(normalizedCardName(pokemonName)));
    }
    const uniqueSetIds=[...new Set(cards.map(c=>setIdFromCardId(c.id)))];
    const sets=await Promise.all(uniqueSetIds.map(getSet));
    const dates=new Map(sets.filter(Boolean).map(s=>[s.id,s.releaseDate||'9999-12-31']));
    cards.sort((a,b)=>{
      const da=dates.get(setIdFromCardId(a.id))||'9999-12-31'; const db=dates.get(setIdFromCardId(b.id))||'9999-12-31';
      if(da!==db) return da.localeCompare(db);
      return String(a.localId).localeCompare(String(b.localId),undefined,{numeric:true});
    });
    const first=cards[0];
    if(!first) return null;
    const set=await getSet(setIdFromCardId(first.id));
    const full=await fetch(`${TCGDEX}/cards/${encodeURIComponent(first.id)}`).then(x=>x.ok?x.json():null).catch(()=>null);
    const result={id:first.id,name:first.name,image:first.image,localId:first.localId,set:set?.name||full?.set?.name||'Unknown set',date:set?.releaseDate||null,illustrator:full?.illustrator||null,rarity:full?.rarity||null,abilities:Array.isArray(full?.abilities)?full.abilities:[],attacks:Array.isArray(full?.attacks)?full.attacks:[]};
    try{localStorage.setItem(`pokedae-debut-v3-${p.id}`,JSON.stringify(result))}catch{}
    return result;
  })();
  debutCache.set(p.id,promise);
  return promise;
}

async function hydrateCard(card){
  const id=Number(card.dataset.id); const p=allPokemon.find(x=>x.id===id)||{id,name:card.dataset.name};
  const skeleton=card.querySelector('.cardSkeleton'); const img=card.querySelector('.debutImage'); const meta=card.querySelector('.debutMeta');
  try{
    const debut=await resolveDebut(p);
    if(!debut){skeleton.querySelector('span').textContent='Card debut unavailable';meta.textContent=`GENERATION ${generationFor(id)}`;return}
    img.src=cardImage(debut.image,'low'); img.onload=()=>{img.classList.add('loaded');skeleton.hidden=true};
    const year=debut.date?debut.date.slice(0,4):'—'; meta.textContent=`TCG DEBUT · ${year} · ${debut.set}`;
  }catch{ skeleton.querySelector('span').textContent='Tap to retry'; meta.textContent=`GENERATION ${generationFor(id)}`; }
}

searchInput.addEventListener('input',applyFilters);
generationFilter.addEventListener('change',applyFilters);
sortFilter.addEventListener('change',applyFilters);
typeFilter.addEventListener('change',async e=>{await loadTypeIds(e.target.value);applyFilters()});
document.querySelector('#clearFilters').addEventListener('click',()=>{searchInput.value='';generationFilter.value='all';typeFilter.value='all';sortFilter.value='number-asc';typeIds=null;applyFilters()});
document.querySelector('#randomBtn').addEventListener('click',()=>openPokemon(Math.floor(Math.random()*MAX_DEX)+1));
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();searchInput.focus()}if(e.key==='Escape'&&modal.open)modal.close()});
grid.addEventListener('click',e=>{const card=e.target.closest('.pokemonCard');if(card)openPokemon(Number(card.dataset.id))});
grid.addEventListener('keydown',e=>{const card=e.target.closest('.pokemonCard');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openPokemon(Number(card.dataset.id))}});
document.querySelector('#modalClose').addEventListener('click',()=>modal.close());modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});

async function getPokemonDetails(id){
  if(detailCache.has(id)) return detailCache.get(id);
  const p=Promise.all([fetch(`${POKEAPI}/pokemon/${id}`).then(r=>r.json()),fetch(`${POKEAPI}/pokemon-species/${id}`).then(r=>r.json())]);
  detailCache.set(id,p);return p;
}
async function openPokemon(id){
  const p=allPokemon.find(x=>x.id===id)||{id,name:'pokemon'};
  modalContent.innerHTML=`<div class="detailLoading"><b>${dex(id)} · ${escapeHTML(displayName(p.name))}</b><span>Pulling the first English TCG card and Pokédex data…</span></div>`;
  modal.showModal();
  try{
    const [debut,[pokemon,species]]=await Promise.all([resolveDebut(p),getPokemonDetails(id)]);
    const flavor=(species.flavor_text_entries.find(x=>x.language.name==='en')?.flavor_text||'No Pokédex description available.').replace(/[\n\f]/g,' ');
    const genus=species.genera.find(x=>x.language.name==='en')?.genus||'Pokémon';
    const tcgAbilityNames=debut?.abilities?.map(x=>x?.name).filter(Boolean)||[];
    const tcgAttackNames=debut?.attacks?.map(x=>x?.name).filter(Boolean)||[];
    const cardAbilities=[...new Set([...tcgAbilityNames,...tcgAttackNames])].join(', ')||'None listed';
    const types=pokemon.types.map(x=>x.type.name);
    modalContent.innerHTML=`<div class="detailHero">
      <div class="detailVisual tcg"><span class="firstCardStamp">FIRST ENGLISH TCG CARD</span>${debut?`<img src="${cardImage(debut.image,'high')}" alt="${escapeHTML(debut.name)} from ${escapeHTML(debut.set)}">`:'<div class="noCard">TCG debut card unavailable</div>'}</div>
      <div class="detailCopy"><span class="detailNumber">${dex(id)} · GENERATION ${generationFor(id)}</span><h2>${escapeHTML(displayName(p.name))}</h2>
        <div class="types">${types.map(t=>`<span class="typeBadge type-${t}">${t}</span>`).join('')}</div>
        ${debut?`<div class="debutPanel"><small>TCG DEBUT</small><strong>${escapeHTML(debut.set)} · ${debut.date?debut.date.slice(0,4):'DATE UNKNOWN'}</strong><span>Card ${escapeHTML(debut.localId)}${debut.illustrator?` · Illustrated by ${escapeHTML(debut.illustrator)}`:''}</span></div>`:''}
        <p class="flavor">${escapeHTML(flavor)}</p>
        <div class="detailFacts"><div class="fact"><span>Category</span><b>${escapeHTML(genus.replace(' Pokémon',''))}</b></div><div class="fact"><span>Height</span><b>${(pokemon.height/10).toFixed(1)} m</b></div><div class="fact"><span>Weight</span><b>${(pokemon.weight/10).toFixed(1)} kg</b></div><div class="fact"><span>Card Abilities</span><b>${escapeHTML(cardAbilities)}</b></div></div>
      </div></div>
      <div class="stats"><h3>Base Stats</h3>${pokemon.stats.map(st=>`<div class="statRow"><span>${escapeHTML(displayName(st.stat.name))}</span><b>${st.base_stat}</b><div class="statTrack"><i style="width:${Math.min(100,st.base_stat/2)}%"></i></div></div>`).join('')}</div>`;
  }catch{
    modalContent.innerHTML=`<div class="detailLoading"><b>${dex(id)} · ${escapeHTML(displayName(p.name))}</b><span>That entry could not be loaded right now. Try again in a moment.</span></div>`;
  }
}

init();
