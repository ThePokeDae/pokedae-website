(function(){
  const dayEl=document.getElementById('countdownDays');
  const detailEl=document.getElementById('countdownDetail');
  if(!dayEl||!detailEl)return;
  function updateCountdown(){
    const now=new Date();
    const launch=new Date(2026,8,16,0,0,0);
    const difference=launch-now;
    if(difference<=0){dayEl.textContent='LIVE';detailEl.textContent='The worldwide celebration has begun';return;}
    const days=Math.ceil(difference/86400000);
    const hours=Math.max(0,Math.floor((difference%86400000)/3600000));
    dayEl.textContent=days;
    detailEl.textContent=hours+' hours beyond the full days';
  }
  updateCountdown();
  window.setInterval(updateCountdown,60000);
})();
