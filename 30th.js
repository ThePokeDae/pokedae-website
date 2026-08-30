(function(){
  const dayEl=document.getElementById('countdownDays');
  const detailEl=document.getElementById('countdownDetail');
  if(!dayEl||!detailEl)return;

  function updateCountdown(){
    const now=new Date();
    const launch=new Date(2026,8,16,0,0,0);
    const difference=launch-now;

    if(difference<=0){
      dayEl.textContent='LIVE';
      detailEl.textContent='The worldwide celebration has begun';
      return;
    }

    const totalHours=Math.max(0,Math.ceil(difference/3600000));
    const totalDays=Math.max(0,Math.ceil(difference/86400000));

    dayEl.textContent=totalDays;
    detailEl.textContent=totalHours+' HOURS UNTIL LAUNCH';
  }

  updateCountdown();
  window.setInterval(updateCountdown,60000);
})();
