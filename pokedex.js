const MAX_DEX = 1025;
const POKEAPI = 'https://pokeapi.co/api/v2';
const TCGDEX = 'https://api.tcgdex.net/v2/en';
const POKEMONTCG = 'https://api.pokemontcg.io/v2';
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
const gridDebutCache = new Map();
const detailCache = new Map();
const cardDetailCache = new Map();
const marketCache = new Map();
let allPokemon=[]; let filtered=[]; let visibleCount=window.matchMedia('(max-width:800px)').matches?20:40; let typeIds=null;
const IS_MOBILE=window.matchMedia('(max-width:800px)').matches;
const hydrationQueue=[];
let activeHydrations=0;
const MAX_HYDRATIONS=IS_MOBILE?3:8;

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
function cardImage(base, quality='high'){
  if(!base) return '';
  if(base.includes('images.pokemontcg.io')){
    if(quality==='high' && /\.png(?:\?.*)?$/.test(base) && !/_hires\.png(?:\?.*)?$/.test(base)){
      return base.replace(/\.png(\?.*)?$/, '_hires.png$1');
    }
    return base;
  }
  if(/\.(?:png|jpe?g|webp)(?:\?.*)?$/i.test(base)) return base;
  return `${base}/${quality}.webp`;
}
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function withTimeout(promise,ms,fallback=null){return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))])}
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
  visibleCount=IS_MOBILE?20:40;
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
  if(IS_MOBILE) requestAnimationFrame(hydrateMoreMobileCards);
}

function maybeLoadMore(){if(visibleCount>=filtered.length)return;visibleCount=Math.min(visibleCount+(IS_MOBILE?20:40),filtered.length);render();if(IS_MOBILE)setTimeout(hydrateMoreMobileCards,0)}
const sentinelObserver=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)maybeLoadMore()},{rootMargin:'900px'});
sentinelObserver.observe(document.querySelector('#loadSentinel'));

function queueHydration(card){
  if(!card || card.dataset.hydrationQueued==='1') return;
  card.dataset.hydrationQueued='1';
  hydrationQueue.push(card);
  pumpHydrationQueue();
}
function pumpHydrationQueue(){
  while(activeHydrations<MAX_HYDRATIONS && hydrationQueue.length){
    const card=hydrationQueue.shift();
    if(!card?.isConnected) continue;
    activeHydrations++;
    hydrateCard(card).finally(()=>{
      activeHydrations--;
      pumpHydrationQueue();
    });
  }
}
const cardObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      cardObserver.unobserve(entry.target);
      queueHydration(entry.target);
    }
  });
},{rootMargin:IS_MOBILE?'160px':'700px'});
function observeCards(){
  const cards=[...document.querySelectorAll('.pokemonCard')];
  if(IS_MOBILE){
    cards.slice(0,12).forEach(queueHydration);
    return;
  }
  cards.forEach(card=>cardObserver.observe(card));
}

function hydrateMoreMobileCards(){
  if(!IS_MOBILE) return;
  const cards=[...document.querySelectorAll('.pokemonCard')];
  const viewportBottom=window.scrollY+window.innerHeight+500;
  cards.forEach(card=>{
    if(card.dataset.hydrationQueued==='1') return;
    if(card.querySelector('.debutImage')?.classList.contains('loaded')) return;
    const top=card.getBoundingClientRect().top+window.scrollY;
    if(top<viewportBottom) queueHydration(card);
  });
}

if(IS_MOBILE){
  let mobileHydrationTick=false;
  window.addEventListener('scroll',()=>{
    if(mobileHydrationTick) return;
    mobileHydrationTick=true;
    requestAnimationFrame(()=>{
      mobileHydrationTick=false;
      hydrateMoreMobileCards();
    });
  },{passive:true});
}

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

async function resolveDebutBriefPTCG(p){
  const q='nationalPokedexNumbers:'+p.id;
  const url=POKEMONTCG+'/cards?q='+encodeURIComponent(q)+'&orderBy='+encodeURIComponent('set.releaseDate,number')+'&pageSize=1';
  const response=await fetch(url);
  if(!response.ok) return null;
  const payload=await response.json();
  const card=payload?.data?.[0];
  if(!card?.images?.small) return null;
  return {
    id:card.id,
    name:card.name,
    image:card.images.small,
    localId:card.number,
    set:card.set?.name||'Unknown set',
    date:card.set?.releaseDate?card.set.releaseDate.replaceAll('/','-'):null,
    illustrator:card.artist||null,
    rarity:card.rarity||null,
    source:'ptcg'
  };
}

async function resolveDebutBrief(p){
  if(gridDebutCache.has(p.id)) return gridDebutCache.get(p.id);

  const key='pokedae-debut-v2-'+p.id;
  try{
    const stored=localStorage.getItem(key);
    if(stored){
      const parsed=JSON.parse(stored);
      if(parsed?.image){
        gridDebutCache.set(p.id,parsed);
        return parsed;
      }
    }
  }catch{}

  const pokemonName=displayName(p.name);

  const promise=(async()=>{
    // Mobile gets an independent source first so TCGdex cannot stall the card wall.
    if(IS_MOBILE){
      const ptcg=await withTimeout(resolveDebutBriefPTCG(p),6000,null);
      if(ptcg) return ptcg;
    }

    try{
      let cards=[];
      const exact=await fetch(TCGDEX+'/cards?name='+encodeURIComponent('eq:'+pokemonName));
      if(exact.ok) cards=await exact.json();

      if(!cards.length){
        const loose=await fetch(TCGDEX+'/cards?name='+encodeURIComponent(pokemonName));
        if(loose.ok){
          const all=await loose.json();
          cards=all.filter(c=>c.image&&cardNameMatches(c.name,pokemonName));
        }
      }

      const first=cards.find(c=>c.image)||null;
      if(first){
        return {
          id:first.id,
          name:first.name,
          image:first.image,
          localId:first.localId,
          set:'',
          date:null,
          illustrator:null,
          rarity:null,
          source:'tcgdex'
        };
      }
    }catch{}

    // Desktop also gets the same fallback if TCGdex fails.
    return await withTimeout(resolveDebutBriefPTCG(p),6000,null);
  })();

  gridDebutCache.set(p.id,promise);
  return promise;
}

async function resolveDebut(p){
  if(debutCache.has(p.id)) return debutCache.get(p.id);

  const key='pokedae-debut-v2-'+p.id;
  try{
    const stored=localStorage.getItem(key);
    if(stored){
      const parsed=JSON.parse(stored);
      if(parsed?.image && parsed?.set){
        debutCache.set(p.id,parsed);
        return parsed;
      }
    }
  }catch{}

  const promise=(async()=>{
    const first=await resolveDebutBrief(p);
    if(!first) return null;

    if(first.source==='ptcg'){
      const result={
        id:first.id,
        name:first.name,
        image:first.image,
        localId:first.localId,
        set:first.set||'Unknown set',
        date:first.date||null,
        illustrator:first.illustrator||null,
        rarity:first.rarity||null,
        source:'ptcg'
      };
      try{localStorage.setItem(key,JSON.stringify(result))}catch{}
      gridDebutCache.set(p.id,result);
      return result;
    }

    const full=await fetch(TCGDEX+'/cards/'+encodeURIComponent(first.id))
      .then(x=>x.ok?x.json():null)
      .catch(()=>null);

    let setName=full?.set?.name||'Unknown set';
    let releaseDate=full?.set?.releaseDate||null;

    if(!releaseDate){
      const set=await getSet(setIdFromCardId(first.id));
      setName=set?.name||setName;
      releaseDate=set?.releaseDate||null;
    }

    const result={
      id:first.id,
      name:first.name,
      image:first.image,
      localId:first.localId,
      set:setName,
      date:releaseDate,
      illustrator:full?.illustrator||null,
      rarity:full?.rarity||null,
      source:'tcgdex'
    };

    try{localStorage.setItem(key,JSON.stringify(result))}catch{}
    gridDebutCache.set(p.id,result);
    return result;
  })();

  debutCache.set(p.id,promise);
  return promise;
}

async function hydrateCard(card){
  const id=Number(card.dataset.id); const p=allPokemon.find(x=>x.id===id)||{id,name:card.dataset.name};
  const skeleton=card.querySelector('.cardSkeleton'); const img=card.querySelector('.debutImage'); const meta=card.querySelector('.debutMeta');
  if(!skeleton||!img||!meta) return;
  try{
    const debut=await withTimeout(resolveDebutBrief(p),IS_MOBILE?8000:7000,null);
    if(!debut){
      skeleton.querySelector('span').textContent='Tap to load card';
      meta.textContent=`GENERATION ${generationFor(id)}`;
      card.dataset.hydrationQueued='0';
      return;
    }
    const reveal=()=>{img.classList.add('loaded');skeleton.hidden=true};
    const fail=()=>{skeleton.querySelector('span').textContent='Tap to retry';card.dataset.hydrationQueued='0'};
    img.onload=reveal;
    img.onerror=fail;
    img.loading=IS_MOBILE?'eager':'lazy';
    img.decoding='async';
    img.src=cardImage(debut.image,'low');
    if(img.complete && img.naturalWidth>0) reveal();
    meta.textContent=debut.date&&debut.set?`TCG DEBUT · ${debut.date.slice(0,4)} · ${debut.set}`:'TCG DEBUT · FIRST ENGLISH CARD';
  }catch{
    skeleton.querySelector('span').textContent='Tap to retry';
    meta.textContent=`GENERATION ${generationFor(id)}`;
    card.dataset.hydrationQueued='0';
  }
}

searchInput.addEventListener('input',applyFilters);
generationFilter.addEventListener('change',applyFilters);
sortFilter.addEventListener('change',applyFilters);
typeFilter.addEventListener('change',async e=>{await loadTypeIds(e.target.value);applyFilters()});
document.querySelector('#clearFilters').addEventListener('click',()=>{searchInput.value='';generationFilter.value='all';typeFilter.value='all';sortFilter.value='number-asc';typeIds=null;applyFilters()});
document.querySelector('#randomBtn').addEventListener('click',()=>{const pool=filtered.length?filtered:allPokemon;if(!pool.length)return;const pick=pool[Math.floor(Math.random()*pool.length)];openPokemon(pick.id)});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();searchInput.focus()}if(e.key==='Escape'&&modal.open)modal.close()});
grid.addEventListener('click',e=>{
  const card=e.target.closest('.pokemonCard');
  if(!card) return;
  if(!card.querySelector('.debutImage')?.classList.contains('loaded') && card.dataset.hydrationQueued!=='1'){
    queueHydration(card);
  }
  openPokemon(Number(card.dataset.id));
});
grid.addEventListener('keydown',e=>{const card=e.target.closest('.pokemonCard');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openPokemon(Number(card.dataset.id))}});
document.querySelector('#modalClose').addEventListener('click',()=>modal.close());modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});

async function getPokemonDetails(id){
  if(detailCache.has(id)) return detailCache.get(id);
  const p=Promise.all([fetch(`${POKEAPI}/pokemon/${id}`).then(r=>r.json()),fetch(`${POKEAPI}/pokemon-species/${id}`).then(r=>r.json())]);
  detailCache.set(id,p);return p;
}
async function getDebutCardInfo(debut){
  if(!debut?.id) return null;
  if(debut.source==='ptcg'){
    return fetch(POKEMONTCG+'/cards/'+encodeURIComponent(debut.id)).then(r=>r.ok?r.json():null).then(payload=>{const full=payload?.data;if(!full)return null;return {moves:[...new Set([...(full.abilities||[]).map(x=>x?.name).filter(Boolean),...(full.attacks||[]).map(x=>x?.name).filter(Boolean)])],hp:full.hp||null,weaknesses:Array.isArray(full.weaknesses)?full.weaknesses:[],retreat:typeof full.convertedRetreatCost==='number'?full.convertedRetreatCost:null};}).catch(()=>null);
  }
  if(cardDetailCache.has(debut.id)) return cardDetailCache.get(debut.id);
  const promise=fetch(TCGDEX+'/cards/'+encodeURIComponent(debut.id))
    .then(r=>r.ok?r.json():null)
    .then(full=>{
      if(!full) return null;
      const abilityNames=Array.isArray(full.abilities)?full.abilities.map(x=>x?.name).filter(Boolean):[];
      const attackNames=Array.isArray(full.attacks)?full.attacks.map(x=>x?.name).filter(Boolean):[];
      return {
        moves:[...new Set([...abilityNames,...attackNames])],
        hp:full.hp||null,
        weaknesses:Array.isArray(full.weaknesses)?full.weaknesses:[],
        retreat:typeof full.retreat==='number'?full.retreat:null
      };
    })
    .catch(()=>null);
  cardDetailCache.set(debut.id,promise);
  return promise;
}

async function getTCGPlayerMarket(debut){
  if(!debut?.id) return null;
  if(marketCache.has(debut.id)) return marketCache.get(debut.id);
  const promise=fetch(POKEMONTCG+'/cards/'+encodeURIComponent(debut.id))
    .then(r=>r.ok?r.json():null)
    .then(payload=>{
      const card=payload?.data;
      const prices=card?.tcgplayer?.prices;
      if(!prices) return null;
      const preferred=['normal','holofoil','reverseHolofoil','1stEditionHolofoil','1stEditionNormal','unlimitedHolofoil'];
      let picked=null;
      for(const key of preferred){
        if(prices[key]?.market!=null){picked={variant:key,market:prices[key].market};break}
      }
      if(!picked){
        const entry=Object.entries(prices).find(([,v])=>v?.market!=null);
        if(entry) picked={variant:entry[0],market:entry[1].market};
      }
      if(!picked) return null;
      return {
        market:Number(picked.market),
        variant:picked.variant,
        url:card?.tcgplayer?.url||null,
        updatedAt:card?.tcgplayer?.updatedAt||null
      };
    })
    .catch(()=>null);
  marketCache.set(debut.id,promise);
  return promise;
}

async function openPokemon(id){
  const p=allPokemon.find(x=>x.id===id)||{id,name:'pokemon'};
  modalContent.innerHTML=`<div class="detailLoading"><b>${dex(id)} · ${escapeHTML(displayName(p.name))}</b><span>Loading Pokémon details…</span></div>`;
  if(!modal.open) modal.showModal();

  try{
    const details=await withTimeout(getPokemonDetails(id),8000,null);
    if(!details) throw new Error('Pokédex details timed out');
    const [pokemon,species]=details;
    const flavor=(species.flavor_text_entries.find(x=>x.language.name==='en')?.flavor_text||'No Pokédex description available.').replace(/[\n\f]/g,' ');
    const genus=species.genera.find(x=>x.language.name==='en')?.genus||'Pokémon';
    const types=pokemon.types.map(x=>x.type.name);

    modalContent.innerHTML=`<div class="detailHero">
      <div class="detailVisual tcg" id="modalCardVisual"><span class="firstCardStamp">FIRST ENGLISH TCG CARD</span><div class="noCard">Loading debut card…</div></div>
      <div class="detailCopy"><img class="detailMascot detailMascotShip" src="./pokedae-spaceship.png" alt="" aria-hidden="true"><span class="detailNumber">${dex(id)} · GENERATION ${generationFor(id)}</span><h2>${escapeHTML(displayName(p.name))}</h2>
        <div class="types">${types.map(t=>`<span class="typeBadge type-${t}">${t}</span>`).join('')}</div>
        <div class="debutPanel" id="modalDebutPanel"><small>TCG DEBUT</small><strong>Loading card data…</strong><span>Pokédex details are ready.</span></div>
        <p class="flavor">${escapeHTML(flavor)}</p>
        <div class="detailFacts"><div class="fact"><span>Category</span><b>${escapeHTML(genus.replace(' Pokémon',''))}</b></div><div class="fact"><span>Height</span><b>${(pokemon.height/10).toFixed(1)} m</b></div><div class="fact"><span>Weight</span><b>${(pokemon.weight/10).toFixed(1)} kg</b></div></div>
        <div class="cardExtras" id="modalCardExtras" hidden></div>
      </div></div>
      <div class="stats"><h3>Base Stats</h3>${pokemon.stats.map(st=>`<div class="statRow"><span>${escapeHTML(displayName(st.stat.name))}</span><b>${st.base_stat}</b><div class="statTrack"><i style="width:${Math.min(100,st.base_stat/2)}%"></i></div></div>`).join('')}</div>`;

    const debut=await withTimeout(resolveDebut(p),7000,null);
    if(!modal.open) return;

    const visual=document.querySelector('#modalCardVisual');
    const panel=document.querySelector('#modalDebutPanel');
    const extrasEl=document.querySelector('#modalCardExtras');

    if(debut){
      if(visual) visual.innerHTML=`<span class="firstCardStamp">FIRST ENGLISH TCG CARD</span><img src="${cardImage(debut.image,'high')}" alt="${escapeHTML(debut.name)} from ${escapeHTML(debut.set)}">`;
      if(panel) panel.innerHTML=`<small>TCG DEBUT</small><strong>${escapeHTML(debut.set)} · ${debut.date?debut.date.slice(0,4):'DATE UNKNOWN'}</strong><span>Card ${escapeHTML(debut.localId)}${debut.illustrator?` · Illustrated by ${escapeHTML(debut.illustrator)}`:''}</span>`;

      const [cardInfo,marketInfo]=await Promise.all([
        withTimeout(getDebutCardInfo(debut),4500,null),
        withTimeout(getTCGPlayerMarket(debut),4500,null)
      ]);

      if(extrasEl){
        const extras=[];
        if(cardInfo?.moves?.length) extras.push({label:'Card Moves',value:cardInfo.moves.join(' · ')});
        if(cardInfo?.hp) extras.push({label:'Card HP',value:String(cardInfo.hp)});
        if(cardInfo?.weaknesses?.length) extras.push({label:'Weakness',value:cardInfo.weaknesses.map(w=>w.type+(w.value?' '+w.value:'')).join(', ')});
        if(cardInfo?.retreat!=null) extras.push({label:'Retreat',value:String(cardInfo.retreat)});
        if(marketInfo?.market!=null){
          extras.push({
            label:'TCGplayer Market',
            value:'$'+marketInfo.market.toFixed(2),
            href:marketInfo.url,
            meta:marketInfo.updatedAt?'Updated '+marketInfo.updatedAt:''
          });
        }
        if(extras.length){
          extrasEl.hidden=false;
          extrasEl.innerHTML=extras.map(item=>`<div class="${item.label==='TCGplayer Market'?'marketFact':''}"><span>${escapeHTML(item.label)}</span>${item.href?`<a href="${escapeHTML(item.href)}" target="_blank" rel="noreferrer"><b>${escapeHTML(item.value)}</b></a>`:`<b>${escapeHTML(item.value)}</b>`}${item.meta?`<small>${escapeHTML(item.meta)}</small>`:''}</div>`).join('');
        }
      }
    }else{
      if(visual) visual.innerHTML='<span class="firstCardStamp">FIRST ENGLISH TCG CARD</span><div class="noCard">TCG debut card unavailable</div>';
      if(panel) panel.innerHTML='<small>TCG DEBUT</small><strong>Card data unavailable</strong><span>Try this entry again later.</span>';
    }
  }catch{
    modalContent.innerHTML=`<div class="detailLoading"><b>${dex(id)} · ${escapeHTML(displayName(p.name))}</b><span>That entry could not be loaded right now. Try again in a moment.</span></div>`;
  }
}

init();
