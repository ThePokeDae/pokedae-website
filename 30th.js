(function(){
  const dayEl=document.getElementById('countdownDays'), detailEl=document.getElementById('countdownDetail');
  if(!dayEl||!detailEl)return;
  const waves=[{date:[2026,9,2],name:'Booster Bundles + Mini Tins'},{date:[2026,9,30],name:'Espeon ex + Umbreon ex Battle Decks'},{date:[2026,10,6],name:'Premium collections'},{date:[2026,11,4],name:'Binder Collection'}];
  function updateCountdown(){
    const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const next=waves.find(w=>new Date(...w.date)>=today);
    const label=document.getElementById('countdownLabel'),unit=document.getElementById('countdownUnit');
    if(!next){dayEl.textContent='LIVE';unit.textContent='ALL WAVES RELEASED';detailEl.textContent='The celebration continues';return;}
    const date=new Date(...next.date),days=Math.round((Date.UTC(...next.date)-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/86400000);
    label.textContent='NEXT PRODUCT WAVE';dayEl.textContent=days===0?'TODAY':days;unit.textContent=days===0?'RELEASE DAY':'DAYS TO GO';detailEl.textContent=next.name+' · '+date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }
  updateCountdown();window.setInterval(updateCountdown,60000);
})();
