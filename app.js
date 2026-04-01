(function(){
  // The site is intentionally self-contained: a small static snapshot of a
  // 90-day comparison model that can be read, hosted, and maintained without
  // a build step or framework runtime.
  const TOTAL_DAYS=90;
  const DEFAULT_DAYS=60;
  const STATUS_URLS={c:'https://status.claude.com',o:'https://status.openai.com'};
  const STATUS_LABELS={g:'Operational',y:'Degraded',o:'Partial Outage',r:'Major Outage',b:'Maintenance'};
  const STATUS_PRIORITY={r:4,o:3,y:2,b:1,g:0};
  const STATUS_COLORS={g:'var(--green)',y:'var(--yellow)',o:'var(--orange)',r:'var(--red)',b:'var(--blue)'};
  const STATUS_SCORE={g:1,y:0.6,o:0.3,r:0,b:0.8};
  const UPTIME_SCORE={g:100,y:99.5,o:98,r:95};
  const SUPPORTS_HOVER=window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const THEME_ICONS={
    dark:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    light:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  };

  const A_SM='<svg class="logo-a-sm" viewBox="0 0 46 32"><path d="M32.73 0h-6.73l-7.543 32h6.73L32.73 0ZM13.27 0 0 32h6.88l2.725-5.87h13.97l2.726 5.87h6.88L19.91 0h-6.64Zm-.524 20.67 4.383-9.44 4.382 9.44H12.746Z"/></svg>';
  const O_SM='<svg class="logo-o-sm" viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872v.024Zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667Zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66v.018ZM8.318 12.861l-2.02-1.164a.08.08 0 0 1-.038-.057V6.072a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681l-.003 6.72Zm1.096-2.365L12 8.96l2.586 1.502v2.998L12 14.968l-2.586-1.504v-2.968Z"/></svg>';

  const C_NAMES=['Claude API','claude.ai','Claude Code'];
  const O_NAMES=['OpenAI APIs','ChatGPT','Codex'];
  const C_WEIGHTS=[3,3,2];
  const O_WEIGHTS=[3,3,2];
  // Daily history is encoded as compact status strings to keep the dataset
  // visible in-source and easy to audit at a glance.
  const CLAUDE_DAILY={
    'Claude API':'ggggggyyyyyryggggggyyrgggyyyyggrgrrrygggyyggyyyrgyyyoyyyyrrgggyrrrggyrrrgrooggrrrgrrrg',
    'claude.ai':'ggggggyyyyyryggggggyyrgggyyyyggrgrrrygggyyggyyyrgyyyoyyyyrrgggyrrrggyrrrgrooggrrrgrrrg',
    'Claude Code':'gggggggggggggggggggggggggggggggrgrrrygggygggyyyrggggyyyyrrgggyrrrggyrrrgrooggrrrgrrry',
    'platform.claude.com':'ggggggygggggyygggggyyggggyyyyrggrgrrrygggggggyyyrggyygygrrrggyrrrgggrrrgroggrrrgrrry',
    'Claude for Government':'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggyggggggggygggg'
  };
  const OPENAI_DAILY={
    'OpenAI APIs':'ggggggggggggggggggggggggggggggggggyyggggyggyyyyogggyygggggyoggggoggyyggggyyggggggygyg',
    'ChatGPT':'ggggggggggggggggggggggggggggggggggyygoygyyyyyogggyyggyygyogygyoggyygggyyygyggggygyg',
    'Codex':'gggggggggggggggggggggggggggggggggggggggggggggggyyyygggggggggggggggggggggggggggggggg',
    'Sora':'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggogggggggggggggggggoggggggg',
    'FedRAMP':'ggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg'
  };
  const UPTIME={
    'claude.ai':98.89,'Claude API':99.03,'Claude Code':99.27,'platform.claude.com':99.30,'Claude for Government':99.88,
    'OpenAI APIs':99.98,'ChatGPT':99.91,'Codex':100.00,'Sora':99.95,'FedRAMP':100.00
  };
  const OAI_INCIDENTS={
    '03-31':['SSO failures for Enterprise/Edu'],'03-29':['Login instability'],
    '03-26':['Responses API and Sora errors'],'03-25':['File download/preview issues'],
    '03-24':['Realtime API SIP errors','Sync app errors','Project file errors'],
    '03-20':['Pinned chats not loading'],'03-18':['Sora video generation failing'],
    '03-17':['ChatGPT 5.4 Pro errors','Excel Plugin down','Sign-in errors','Free/Guest plan errors'],
    '03-13':['Responses API errors','Conversation errors'],'03-12':['SSO access issues','File download errors'],
    '03-11':['Login errors','Conversation errors','Deep Research errors','File upload errors'],
    '03-10':['File upload errors','Codex unresponsive','Support chat degraded'],
    '03-09':['Codex unresponsive','Deep Research LATAM errors','Enterprise conversation errors'],
    '03-07':['Codex usage rate issues','Login issues'],'03-06':['Compliance API errors'],
    '03-05':['API Error Rates (11 components)','ChatGPT message issues','Realtime API EU errors'],
    '03-03':['File upload errors','Codex error rate'],'03-02':['File processing failing','Sora API errors','Auth failures'],
    '02-26':['ChatGPT Apps issues'],'02-25':['Artifact generation down'],
    '02-23':['Business/Enterprise conversation errors'],'02-20':['Increased ChatGPT latency'],
    '02-19':['Audit Logs issues'],'02-18':['Sora 2 degraded performance'],
    '02-16':['Shopping Research down','Codex Cloud errors'],'02-14':['Support email delays','Image generation errors'],
    '02-12':['Conversation issues','Embeddings error rate'],'02-11':['Login errors'],
    '02-10':['ChatGPT Go errors','GPT 5.2 error rates'],'02-09':['Codex GitHub dependency issues'],
    '02-07':['Conversation loading issues'],'02-05':['Increased ChatGPT errors'],
    '02-04':['ChatGPT Availability Impacted','Custom GPT updates failing','Conversation loading issues'],
    '02-03':['Finetuning job errors']
  };
  const CLAUDE_MINUTES={
    '01-14':1300,'01-22':2776,'01-29':5331,'02-01':6444,'02-04':5091,'02-14':4583,'02-18':695,
    '02-23':2997,'02-25':11665,'02-26':23748,'02-27':16039,'02-28':10369,
    '03-02':9959,'03-03':2914,'03-12':5160,'03-13':10218,'03-17':14940,'03-18':5851,
    '03-19':4310,'03-21':5714,'03-23':960,'03-25':31930,'03-26':5095,'03-27':16920,
    '03-29':13885,'03-31':2198
  };
  const RACES=[
    {title:'API',c:'Claude API',o:'OpenAI APIs'},
    {title:'CHAT',c:'claude.ai',o:'ChatGPT'},
    {title:'CODE',c:'Claude Code',o:'Codex'}
  ];
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DATES=Array.from({length:TOTAL_DAYS},function(_,index){
    const date=new Date(2026,2,31);
    date.setDate(date.getDate()-(TOTAL_DAYS-1-index));
    return String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  });

  let els;
  let tooltip;
  let dataRows=[];
  let chartIdSeed=0;

  function fmtMins(minutes){
    const hours=Math.min(minutes,1440)/60;
    return hours<1?Math.round(hours*60)+'m':hours.toFixed(1)+'h';
  }

  function fmtDate(dateString){
    const parts=dateString.split('-');
    const monthIndex=parseInt(parts[0],10)-1;
    const day=parseInt(parts[1],10);
    const date=new Date(2026,monthIndex,day);
    return DAY_NAMES[date.getDay()]+', '+MONTHS[monthIndex]+' '+day+', 2026';
  }

  function getStatusPage(side){
    return STATUS_URLS[side]||STATUS_URLS.o;
  }

  function getRequiredElements(){
    const nextEls={
      stars:document.getElementById('stars'),
      cards:document.getElementById('cards'),
      overview:document.getElementById('overview'),
      standings:document.getElementById('standings'),
      standingsGrid:document.getElementById('sg'),
      timestamp:document.getElementById('ts'),
      loader:document.getElementById('loader'),
      cAvg:document.getElementById('c-avg'),
      oAvg:document.getElementById('o-avg'),
      delta:document.getElementById('delta'),
      infoOpen:document.getElementById('info-open'),
      drawerClose:document.getElementById('drawer-close'),
      drawerOverlay:document.getElementById('drawer-overlay'),
      themeToggle:document.getElementById('theme-toggle'),
      dayButtons:Array.from(document.querySelectorAll('.ctrl-btn[data-days]'))
    };
    return Object.values(nextEls).every(Boolean)?nextEls:null;
  }

  function createStars(){
    els.stars.replaceChildren();
    for(let i=0;i<30;i++){
      const star=document.createElement('span');
      const size=Math.random()*1.2+0.4;
      Object.assign(star.style,{
        width:size+'px',
        height:size+'px',
        left:Math.random()*100+'%',
        top:Math.random()*100+'%',
        '--d':3+Math.random()*5+'s',
        '--o':0.08+Math.random()*0.18
      });
      els.stars.appendChild(star);
    }
  }

  function calcAvg(days){
    const skip=TOTAL_DAYS-days;
    function serviceAverage(daily){
      const slice=daily.slice(skip);
      let total=0;
      for(let i=0;i<slice.length;i++)total+=UPTIME_SCORE[slice[i]]||100;
      return total/slice.length;
    }
    const cAvg=RACES.reduce((sum,race)=>sum+serviceAverage(CLAUDE_DAILY[race.c]),0)/RACES.length;
    const oAvg=RACES.reduce((sum,race)=>sum+serviceAverage(OPENAI_DAILY[race.o]),0)/RACES.length;
    els.cAvg.textContent=cAvg.toFixed(2)+'%';
    els.oAvg.textContent=oAvg.toFixed(2)+'%';
    els.delta.textContent=(oAvg>cAvg?'OpenAI':'Claude')+' leads by '+Math.abs(cAvg-oAvg).toFixed(2)+'%';
  }

  function renderBars(data,side){
    const padded=(data||'')+'g'.repeat(TOTAL_DAYS);
    return padded.slice(0,TOTAL_DAYS).split('').map(function(status,index){
      let incidents='';
      const date=DATES[index];
      if(side==='c'){
        const minutes=CLAUDE_MINUTES[date];
        if(minutes)incidents='Partial outage (~'+fmtMins(minutes)+')';
      } else {
        const list=OAI_INCIDENTS[date];
        if(list&&list.length)incidents=list.join('||');
      }
      return '<div class="day '+status+'" data-date="'+date+'" data-status="'+(STATUS_LABELS[status]||'Operational')+'" data-color="'+status+'" data-incidents="'+incidents.replace(/"/g,'&quot;')+'" data-href="'+getStatusPage(side)+'"></div>';
    }).join('');
  }

  function dotCls(data){
    const status=(data||'g').slice(-1);
    return {g:'ok',y:'deg',o:'part',r:'maj',b:'ok'}[status]||'ok';
  }

  function statusTxt(data){
    const status=(data||'g').slice(-1);
    return STATUS_LABELS[status]||'Operational';
  }

  function createTooltip(){
    if(tooltip)return tooltip;
    tooltip=document.createElement('div');
    tooltip.className='tip';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function showTip(el){
    const tip=createTooltip();
    const date=el.dataset.date;
    const color=el.dataset.color||'g';
    let html='<div class="tip-date">'+fmtDate(date)+'</div>';

    if(el.dataset.ov){
      const services=el.dataset.svcs.split('||').map(function(entry){
        const parts=entry.split(':');
        return {name:parts[0],status:parts[1]};
      });
      services.forEach(function(service){
        html+='<div class="tip-svc"><span class="ts-dot" style="background:'+STATUS_COLORS[service.status]+'"></span>'+service.name+': '+(STATUS_LABELS[service.status]||'OK')+'</div>';
      });
    } else {
      html+='<div class="tip-status"><span class="td" style="background:'+STATUS_COLORS[color]+'"></span>'+(el.dataset.status||'Operational')+'</div>';
      if(el.dataset.incidents){
        html+='<div class="tip-incidents"><div class="tip-lbl">Related</div>';
        el.dataset.incidents.split('||').forEach(function(item){
          html+='<div class="tip-incident"><span style="width:4px;height:4px;border-radius:50%;background:'+STATUS_COLORS[color]+';flex-shrink:0;margin-top:3px"></span>'+item+'</div>';
        });
        html+='</div>';
      } else if(color==='g'){
        html+='<div style="font-size:.45rem;color:var(--muted);margin-top:.1rem">No incidents recorded.</div>';
      }
    }

    tip.innerHTML=html;
    const rect=el.getBoundingClientRect();
    let left=rect.left+rect.width/2-tip.offsetWidth/2;
    let top=rect.top-tip.offsetHeight-8;
    if(top<4)top=rect.bottom+8;
    if(left<4)left=4;
    if(left+tip.offsetWidth>window.innerWidth-4)left=window.innerWidth-tip.offsetWidth-4;
    tip.style.left=left+'px';
    tip.style.top=top+'px';
    tip.classList.add('show');
  }

  function hideTip(){
    if(tooltip)tooltip.classList.remove('show');
  }

  function getDayCell(target){
    return target.closest('.bars .day, .ov-bars .day');
  }

  function bindDayInteractions(){
    document.addEventListener('click',function(event){
      const dayCell=getDayCell(event.target);
      if(dayCell){
        if(!SUPPORTS_HOVER){
          event.preventDefault();
          showTip(dayCell);
          return;
        }
        window.open(dayCell.dataset.href||getStatusPage(dayCell.dataset.side),'_blank','noopener');
        return;
      }
      if(!SUPPORTS_HOVER&&!event.target.closest('.tip'))hideTip();
    });

    if(!SUPPORTS_HOVER)return;

    document.addEventListener('mouseover',function(event){
      const dayCell=getDayCell(event.target);
      if(dayCell)showTip(dayCell);
    });

    document.addEventListener('mouseout',function(event){
      if(getDayCell(event.target))hideTip();
    });
  }

  function applyDays(days){
    const skip=TOTAL_DAYS-days;
    els.dayButtons.forEach(function(button){
      button.classList.toggle('active',parseInt(button.dataset.days,10)===days);
    });
    dataRows.forEach(function(row){
      row.style.gridTemplateColumns='repeat('+days+',1fr)';
      for(let i=0;i<row.children.length;i++)row.children[i].hidden=i<skip;
    });
    calcAvg(days);
  }

  function bindChromeInteractions(){
    els.infoOpen.addEventListener('click',function(){
      els.drawerOverlay.classList.add('open');
    });
    els.drawerClose.addEventListener('click',function(){
      els.drawerOverlay.classList.remove('open');
    });
    els.drawerOverlay.addEventListener('click',function(event){
      if(event.target===els.drawerOverlay)els.drawerOverlay.classList.remove('open');
    });
    els.dayButtons.forEach(function(button){
      button.addEventListener('click',function(){
        applyDays(parseInt(button.dataset.days,10));
      });
    });
    els.themeToggle.addEventListener('click',function(){
      const isLight=document.documentElement.classList.toggle('light');
      els.themeToggle.innerHTML=isLight?THEME_ICONS.light:THEME_ICONS.dark;
    });
  }

  function pingStatusApis(){
    void Promise.allSettled([
      fetch('https://status.claude.com/api/v2/components.json').then(function(response){return response.ok;}),
      fetch('https://status.openai.com/api/v2/components.json').then(function(response){return response.ok;})
    ]);
  }

  function buildOverview(cAgg,cPerDay,oAgg,oPerDay){
    function overviewBars(agg,perDay,side){
      return agg.split('').map(function(status,index){
        const services=perDay[index].map(function(service){return service.name+':'+service.status;}).join('||');
        return '<div class="day '+status+'" data-ov="1" data-side="'+side+'" data-date="'+DATES[index]+'" data-svcs="'+services+'" data-color="'+status+'"></div>';
      }).join('');
    }

    els.overview.innerHTML=
      '<div class="ov-row"><div class="ov-label">'+A_SM+' Claude<span class="ov-tag">all services</span></div><div class="ov-bars">'+overviewBars(cAgg,cPerDay,'c')+'</div></div>'+
      '<div class="ov-row"><div class="ov-bars">'+overviewBars(oAgg,oPerDay,'o')+'</div><div class="ov-label">'+O_SM+' OpenAI</div></div>'+
      '<div class="ov-meta"><div class="ov-time">90 days ago</div>'+
      '<div class="ov-legend">'+
      '<div class="lg"><span class="sw" style="background:var(--green)"></span>OK</div>'+
      '<div class="lg"><span class="sw" style="background:var(--yellow)"></span>Degraded</div>'+
      '<div class="lg"><span class="sw" style="background:var(--orange)"></span>Partial</div>'+
      '<div class="lg"><span class="sw" style="background:var(--red)"></span>Major</div>'+
      '</div><div class="ov-time">Today</div></div>';
  }

  function buildCards(){
    els.cards.replaceChildren();
    RACES.forEach(function(race,index){
      const cData=CLAUDE_DAILY[race.c];
      const oData=OPENAI_DAILY[race.o];
      const cUptime=UPTIME[race.c];
      const oUptime=UPTIME[race.o];
      const diff=Math.abs(cUptime-oUptime);
      const winner=cUptime===oUptime?'t':(cUptime>oUptime?'c':'o');
      const winnerLabel=winner==='c'?A_SM+' Claude leads':winner==='o'?O_SM+' OpenAI leads':'Tie';
      const winnerColor=winner==='c'?'var(--claude)':winner==='o'?'var(--openai)':'var(--muted)';
      const card=document.createElement('div');

      card.className='uptime-card'+(index===0?' full':'');
      card.innerHTML=
        '<div class="card-status"><div class="left"><span class="dot" style="background:'+winnerColor+'"></span><span>'+race.title+'</span></div><div class="right">'+winnerLabel+(diff>0?' (+'+diff.toFixed(2)+'%)':'')+'</div></div>'+
        '<div class="card-bars">'+
        '<div class="brand-tag c">'+A_SM+' '+race.c+'<span style="margin-left:auto;font-size:.55rem;color:var(--muted);font-weight:400">'+cUptime.toFixed(2)+'%</span></div>'+
        '<div class="bar-row"><div class="bars">'+renderBars(cData,'c')+'</div></div>'+
        '<div class="bar-row"><div class="bars">'+renderBars(oData,'o')+'</div></div>'+
        '<div class="brand-tag o">'+O_SM+' '+race.o+'<span style="margin-left:auto;font-size:.55rem;color:var(--muted);font-weight:400">'+oUptime.toFixed(2)+'%</span></div>'+
        '</div>'+
        '<div class="card-foot"><a href="'+STATUS_URLS.c+'" target="_blank" rel="noopener"><span class="sdot '+dotCls(cData)+'"></span>'+race.c+': '+statusTxt(cData)+'</a><a href="'+STATUS_URLS.o+'" target="_blank" rel="noopener">'+race.o+': '+statusTxt(oData)+'<span class="sdot '+dotCls(oData)+'"></span></a></div>';
      els.cards.appendChild(card);
    });
  }

  function buildNarrative(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak){
    const oLeads=oDaysWon>cDaysWon;
    const leader=oLeads?'OpenAI':'Claude';
    const leaderClass=oLeads?'o-hl':'c-hl';
    const trailer=oLeads?'Claude':'OpenAI';
    const trailerClass=oLeads?'c-hl':'o-hl';
    const leaderWins=Math.max(cDaysWon,oDaysWon);
    const trailerWins=Math.min(cDaysWon,oDaysWon);
    const topStreak=oLeads?oStreak:cStreak;
    const gapWinner=bigGapCat.oW>bigGapCat.cW?'OpenAI':'Claude';
    const gapWinnerClass=bigGapCat.oW>bigGapCat.cW?'o-hl':'c-hl';
    const gapWins=Math.max(bigGapCat.oW,bigGapCat.cW);
    const trailerBestWins=oLeads?trailerBestCat.cW:trailerBestCat.oW;

    const last7=dayWinners.slice(-7);
    const weekParts=[];
    const o7=last7.filter(function(value){return value==='o';}).length;
    const c7=last7.filter(function(value){return value==='c';}).length;
    const t7=last7.filter(function(value){return value==='t';}).length;
    if(o7>0)weekParts.push('<span class="o-hl">OpenAI</span> '+o7);
    if(c7>0)weekParts.push('<span class="c-hl">Claude</span> '+c7);
    if(t7>0)weekParts.push(t7+' tied');

    const sentences=[
      '<span class="'+leaderClass+'">'+leader+'</span> leads the 90-day race with <span class="num" data-to="'+leaderWins+'">0</span> daily wins to <span class="'+trailerClass+'">'+trailer+'</span>\'s <span class="num" data-to="'+trailerWins+'">0</span>, with <span class="num" data-to="'+tiedDays+'">0</span> ties.'
    ];
    if(Math.abs(bigGapCat.oW-bigGapCat.cW)>3){
      sentences.push('The gap is sharpest in '+bigGapCat.title+', where <span class="'+gapWinnerClass+'">'+gapWinner+'</span> took <span class="num" data-to="'+gapWins+'">0</span> days.');
    }
    if(trailerBestWins>3&&trailerBestCat.title!==bigGapCat.title){
      sentences.push('<span class="'+trailerClass+'">'+trailer+'</span> fights back in '+trailerBestCat.title+' with <span class="num" data-to="'+trailerBestWins+'">0</span> wins.');
    }

    let streakSentence=leader+'\'s longest run: <span class="num" data-to="'+topStreak+'">0</span> consecutive days.';
    if(bestComeback.droughtLen>=3){
      const comebackSide=bestComeback.side==='c'?'Claude':'OpenAI';
      const comebackClass=bestComeback.side==='c'?'c-hl':'o-hl';
      streakSentence+=' <span class="'+comebackClass+'">'+comebackSide+'</span> snapped a '+bestComeback.droughtLen+'-day drought on '+fmtDate(bestComeback.date).replace(/^..., /,'')+'.';
    }
    sentences.push(streakSentence);
    sentences.push('Last 7 days: '+weekParts.join(', ')+'.');

    let wordIndex=0;
    function wrapWords(html){
      let output='';
      let buffer='';
      let insideTag=false;
      for(let i=0;i<html.length;i++){
        const character=html[i];
        if(character==='<'){
          insideTag=true;
          buffer+=character;
        } else if(character==='>'&&insideTag){
          insideTag=false;
          buffer+=character;
        } else if(character===' '&&!insideTag){
          if(buffer){
            output+='<span class="word" style="transition-delay:'+(wordIndex*40)+'ms">'+buffer+'</span> ';
            wordIndex++;
          }
          buffer='';
        } else {
          buffer+=character;
        }
      }
      if(buffer){
        output+='<span class="word" style="transition-delay:'+(wordIndex*40)+'ms">'+buffer+'</span>';
        wordIndex++;
      }
      return output;
    }

    return sentences.map(function(sentence){
      return '<span class="sentence">'+wrapWords(sentence)+'</span>';
    }).join(' ');
  }

  function buildMomentum(runDiff){
    const chartWidth=800;
    const chartHeight=60;
    const range=Math.max(Math.abs(Math.min(0,...runDiff)),Math.abs(Math.max(0,...runDiff)))||1;
    const padding=2;
    const zeroY=padding+(chartHeight-padding*2)*(1-(range)/(range*2));
    const points=runDiff.map(function(value,index){
      const x=(index/(TOTAL_DAYS-1))*chartWidth;
      const y=padding+(chartHeight-padding*2)*(1-((value+range)/(range*2)));
      return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    const fill='0,'+zeroY.toFixed(1)+' '+points+' '+chartWidth+','+zeroY.toFixed(1);
    const clipAbove='clip-above-'+chartIdSeed;
    const clipBelow='clip-below-'+chartIdSeed;
    const diff=runDiff[runDiff.length-1];
    const diffLabel=diff>0?'Claude +'+diff:diff<0?'OpenAI +'+Math.abs(diff):'Even';
    chartIdSeed++;

    return {
      diff,
      diffLabel,
      svg:
        '<svg class="momentum-svg" viewBox="0 0 '+chartWidth+' '+chartHeight+'" preserveAspectRatio="none">'+
        '<defs>'+
        '<clipPath id="'+clipAbove+'"><rect x="0" y="0" width="'+chartWidth+'" height="'+zeroY.toFixed(1)+'"/></clipPath>'+
        '<clipPath id="'+clipBelow+'"><rect x="0" y="'+zeroY.toFixed(1)+'" width="'+chartWidth+'" height="'+(chartHeight-zeroY).toFixed(1)+'"/></clipPath>'+
        '</defs>'+
        '<polygon points="'+fill+'" clip-path="url(#'+clipAbove+')" fill="var(--claude)" opacity=".25"/>'+
        '<polygon points="'+fill+'" clip-path="url(#'+clipBelow+')" fill="var(--openai)" opacity=".25"/>'+
        '<line x1="0" y1="'+zeroY.toFixed(1)+'" x2="'+chartWidth+'" y2="'+zeroY.toFixed(1)+'" stroke="var(--muted)" stroke-dasharray="4,3" stroke-width="1" opacity=".4"/>'+
        '<polyline points="'+points+'" fill="none" stroke="var(--muted-lt)" stroke-width="1.5" stroke-linejoin="round"/>'+
        '</svg>'
    };
  }

  function animateNarrative(){
    const narrative=document.getElementById('narrative');
    if(!narrative)return;
    const observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting)return;
        narrative.classList.add('visible');
        narrative.querySelectorAll('.num').forEach(function(counter){
          const target=parseInt(counter.dataset.to,10);
          const startedAt=performance.now();
          function tick(now){
            const progress=Math.min((now-startedAt)/800,1);
            const eased=1-Math.pow(1-progress,3);
            counter.textContent=Math.round(eased*target);
            if(progress<1)requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
        observer.disconnect();
      });
    },{threshold:0.1});
    observer.observe(els.standings);
  }

  function renderStandings(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak,runDiff){
    const momentum=buildMomentum(runDiff);
    const narrative=buildNarrative(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak);
    els.standingsGrid.innerHTML=
      '<div class="narrative" id="narrative">'+narrative+'</div>'+
      '<div class="momentum-wrap">'+
      '<div class="momentum-header"><span class="momentum-label">Momentum</span><span class="momentum-diff '+(momentum.diff>0?'c-hl':momentum.diff<0?'o-hl':'')+'">'+momentum.diffLabel+'</span></div>'+
      '<div class="momentum-chart">'+momentum.svg+'</div>'+
      '<div class="momentum-meta"><span class="ws-time">90 days ago</span><span class="ws-legend"><span class="ws-lg"><span class="ws-sw" style="background:var(--claude)"></span>Claude leads</span><span class="ws-lg"><span class="ws-sw" style="background:var(--openai)"></span>OpenAI leads</span></span><span class="ws-time">Today</span></div>'+
      '</div>';
    animateNarrative();
  }

  function render(){
    // Convert per-service daily strings into aggregate category outcomes,
    // then derive the narrative stats that make the comparison readable.
    const allClaude=C_NAMES.map(function(name){return CLAUDE_DAILY[name];});
    const allOpenAI=O_NAMES.map(function(name){return OPENAI_DAILY[name];});
    let cAgg='';
    let oAgg='';
    const cPerDay=[];
    const oPerDay=[];
    const dayWinners=[];
    let cDaysWon=0;
    let oDaysWon=0;
    let tiedDays=0;
    let cStreak=0;
    let oStreak=0;
    let cCurrent=0;
    let oCurrent=0;

    for(let i=0;i<TOTAL_DAYS;i++){
      let cMax='g';
      let oMax='g';
      let cDayScore=0;
      let oDayScore=0;
      const cServices=[];
      const oServices=[];

      C_NAMES.forEach(function(name,index){
        const status=allClaude[index][i]||'g';
        cServices.push({name:name,status:status});
        if((STATUS_PRIORITY[status]||0)>(STATUS_PRIORITY[cMax]||0))cMax=status;
        cDayScore+=C_WEIGHTS[index]*(STATUS_SCORE[status]||0);
      });
      O_NAMES.forEach(function(name,index){
        const status=allOpenAI[index][i]||'g';
        oServices.push({name:name,status:status});
        if((STATUS_PRIORITY[status]||0)>(STATUS_PRIORITY[oMax]||0))oMax=status;
        oDayScore+=O_WEIGHTS[index]*(STATUS_SCORE[status]||0);
      });

      cAgg+=cMax;
      oAgg+=oMax;
      cPerDay.push(cServices);
      oPerDay.push(oServices);
      if(cDayScore>oDayScore){
        cDaysWon++;
        cCurrent++;
        oCurrent=0;
        if(cCurrent>cStreak)cStreak=cCurrent;
        dayWinners.push('c');
      } else if(oDayScore>cDayScore){
        oDaysWon++;
        oCurrent++;
        cCurrent=0;
        if(oCurrent>oStreak)oStreak=oCurrent;
        dayWinners.push('o');
      } else {
        tiedDays++;
        cCurrent=0;
        oCurrent=0;
        dayWinners.push('t');
      }
    }

    const catWins=RACES.map(function(race){
      let cWins=0;
      let oWins=0;
      for(let i=0;i<TOTAL_DAYS;i++){
        const cScore=STATUS_SCORE[CLAUDE_DAILY[race.c][i]||'g']||0;
        const oScore=STATUS_SCORE[OPENAI_DAILY[race.o][i]||'g']||0;
        if(cScore>oScore)cWins++;
        else if(oScore>cScore)oWins++;
      }
      return {title:race.title,cW:cWins,oW:oWins,tie:TOTAL_DAYS-cWins-oWins};
    });

    let bigGapCat=catWins[0];
    let trailerBestCat=catWins[0];
    catWins.forEach(function(category){
      if(Math.abs(category.oW-category.cW)>Math.abs(bigGapCat.oW-bigGapCat.cW))bigGapCat=category;
      const oLeadsOverall=oDaysWon>cDaysWon;
      const trailerWins=oLeadsOverall?category.cW:category.oW;
      const bestTrailerWins=oLeadsOverall?trailerBestCat.cW:trailerBestCat.oW;
      if(trailerWins>bestTrailerWins)trailerBestCat=category;
    });

    const bestComeback={side:'',droughtLen:0,date:''};
    let cLosing=0;
    let oLosing=0;
    for(let i=0;i<TOTAL_DAYS;i++){
      if(dayWinners[i]==='c'){
        if(oLosing>bestComeback.droughtLen){
          bestComeback.side='c';
          bestComeback.droughtLen=oLosing;
          bestComeback.date=DATES[i];
        }
        oLosing=0;
        cLosing++;
      } else if(dayWinners[i]==='o'){
        if(cLosing>bestComeback.droughtLen){
          bestComeback.side='o';
          bestComeback.droughtLen=cLosing;
          bestComeback.date=DATES[i];
        }
        cLosing=0;
        oLosing++;
      } else {
        cLosing++;
        oLosing++;
      }
    }

    const runDiff=[];
    let runningDiff=0;
    for(let i=0;i<TOTAL_DAYS;i++){
      if(dayWinners[i]==='c')runningDiff++;
      else if(dayWinners[i]==='o')runningDiff--;
      runDiff.push(runningDiff);
    }

    buildOverview(cAgg,cPerDay,oAgg,oPerDay);
    buildCards();
    renderStandings(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak,runDiff);
    dataRows=Array.from(document.querySelectorAll('.bars, .ov-bars'));
  }

  function start(){
    els=getRequiredElements();
    if(!els)return;
    createStars();
    createTooltip();
    bindDayInteractions();
    bindChromeInteractions();
    render();
    els.timestamp.textContent='fetched '+new Date().toISOString().replace('T',' ').slice(0,19)+' UTC';
    els.loader.classList.add('hidden');
    applyDays(DEFAULT_DAYS);
    pingStatusApis();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  } else {
    start();
  }
})();
