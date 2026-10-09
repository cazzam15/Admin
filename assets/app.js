'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayStr=()=>new Date().toDateString();
const LEVEL_NAMES={1:'Easy',2:'Medium',3:'Hard'};

// Short "glyphs" shown on topic tiles
const GLYPH={t_role:'👤',t_time:'⏱',t_teams:'👥',t_hs:'⛑',t_law:'§',t_security:'🔒',t_digital:'💻',t_customer:'★',t_meetings:'📋',t_comms:'✉',
  s_ss_funcs:'Σ',s_ss_logic:'IF',s_ss_data:'▦',s_db:'🔑',s_db_query:'?',s_wp:'¶',s_pres_comms:'▶'};
const GROUPS=[['theory','Theory — question paper','Theory'],['it','IT skills — assignment','IT skills']];
const groupName=g=>(GROUPS.find(x=>x[0]===g)||[0,0,''])[2];
const EXAM_DATE=new Date(2027,3,27); // 27 April 2027
function daysToExam(){const t=new Date();t.setHours(0,0,0,0);return Math.round((EXAM_DATE-t)/864e5);}
const shuffled=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const kindOf=q=>q.o?'mc':q.points?'w':'t';
const ansText=q=>q.o?esc(q.o[0]):showAns(q.a);
// Multiple-choice buttons (options are shuffled; the first option in the data is the correct one)
function renderOpts(box,q,onPick){
  box.innerHTML='';box.hidden=false;
  shuffled(q.o).forEach((t,i)=>{
    const b=document.createElement('button');b.type='button';b.className='opt';b.dataset.v=t;
    b.innerHTML=`<span class="opt-key">${'ABCDEF'[i]}</span><span class="opt-text">${esc(t)}</span>`;
    b.addEventListener('click',()=>{if(!b.disabled)onPick(t);});
    box.append(b);
  });
}
function markOpts(box,q,picked){
  box.querySelectorAll('.opt').forEach(b=>{b.disabled=true;
    if(b.dataset.v===q.o[0])b.classList.add('opt-ok');else if(b.dataset.v===picked)b.classList.add('opt-no');});
}
// Keys 1–4 or A–D pick an option in the visible option box
function optKey(e,box){
  if(!box||box.hidden||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select'))return false;
  let n='1234'.indexOf(e.key);if(n<0)n='abcd'.indexOf(e.key.toLowerCase());
  const b=box.querySelectorAll('.opt')[n];
  if(n<0||!b||b.disabled)return false;
  e.preventDefault();b.click();return true;
}

// ---------------- State ----------------
const STORE='hadmin_v1';
const S={
  panel:'practice',currentQ:null,currentTopic:'random',currentDiff:'mixed',answered:false,
  questionNum:1,notepadContent:'',recent:[],
  stats:{answered:0,correct:0,streak:0,bestStreak:0,dailyCount:0,dailyDate:'',dayStreak:0,lastStudyDate:''},
  topicStats:{},settings:{name:'',goal:10,accent:'saltire',mode:'system'},
  timerScores:[],mockScores:[],fcIdx:0,fcCards:[]
};
try{
  const p=JSON.parse(localStorage.getItem(STORE)||'null');
  if(p){
    if(p.stats){const {xp,level,...rest}=p.stats;Object.assign(S.stats,rest);}
    if(p.topicStats)S.topicStats=p.topicStats;
    if(p.notepadContent)S.notepadContent=p.notepadContent;
    if(p.questionNum)S.questionNum=p.questionNum;
    if(p.settings){
      Object.assign(S.settings,p.settings);
      // migrate old theme names
      delete S.settings.theme;
    }
    if(p.timerScores)S.timerScores=p.timerScores;
    if(p.mockScores)S.mockScores=p.mockScores;
  }
}catch(e){}

function save(){
  try{localStorage.setItem(STORE,JSON.stringify({stats:S.stats,topicStats:S.topicStats,notepadContent:S.notepadContent,questionNum:S.questionNum,settings:S.settings,timerScores:S.timerScores,mockScores:S.mockScores}));}catch(e){}
}
function rollDay(){
  const t=todayStr();
  if(S.stats.dailyDate!==t){S.stats.dailyCount=0;S.stats.dailyDate=t;}
  // day streak lapses if the last study day was before yesterday
  if(S.stats.lastStudyDate){
    const y=new Date();y.setDate(y.getDate()-1);
    if(S.stats.lastStudyDate!==t&&S.stats.lastStudyDate!==y.toDateString())S.stats.dayStreak=0;
  }
}
function recordStudy(){
  rollDay();
  const t=todayStr();
  if(S.stats.lastStudyDate!==t){S.stats.dayStreak=(S.stats.dayStreak||0)+1;S.stats.lastStudyDate=t;}
}

let toastTimer;
function toast(msg){
  const el=$('toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

// ---------------- Navigation ----------------
const PANELS=['practice','topics','worksheets','flashcards','mock','timer','formulas','calculator','notepad','progress','resources','shop','settings'];
function showPanel(id,{focus=false}={}){
  if(!PANELS.includes(id))id='practice';
  document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='panel-'+id);
  document.querySelectorAll('[data-nav]').forEach(a=>{
    if(a.dataset.nav===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
  const panel=$('panel-'+id);
  $('page-title').textContent=panel.dataset.title;
  document.title=id==='practice'?'Free Higher Administration & IT Revision — Scotland':panel.dataset.title+' — Higher Administration & IT Revision';
  S.panel=id;
  closeSheet();
  if(id==='progress')renderProg();
  if(id==='topics')renderTopics();
  if(id==='worksheets')closeWS();
  if(id==='notepad')$('notepad-text').value=S.notepadContent;
  if(id==='mock'&&!mock.active)renderMockHome();
  if(id==='practice'&&!S.answered)setTimeout(()=>$('q-input').focus({preventScroll:true}),0);
  if(focus)window.scrollTo(0,0);
}
function route(){showPanel((location.hash||'#practice').slice(1),{focus:true});}
window.addEventListener('hashchange',route);
function go(id){if(location.hash==='#'+id)route();else location.hash=id;}

function openSheet(){$('more-sheet').hidden=false;$('sheet-backdrop').hidden=false;$('more-btn').setAttribute('aria-expanded','true');}
function closeSheet(){$('more-sheet').hidden=true;$('sheet-backdrop').hidden=true;$('more-btn').setAttribute('aria-expanded','false');}
$('more-btn').addEventListener('click',()=>$('more-sheet').hidden?openSheet():closeSheet());
$('sheet-backdrop').addEventListener('click',closeSheet);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});

// ---------------- Topic pickers ----------------
const topicKeys=g=>Object.keys(TOPICS).filter(k=>!g||TOPICS[k].group===g);
function fillTopicSelect(sel,{smart=true,all=true}={}){
  const top=document.createElement('optgroup');top.label='Whole course';
  if(all)top.append(new Option('Random mix — whole course','random'));
  if(smart)top.append(new Option('Smart Mix — focuses on your weakest topics','smart'));
  if(top.children.length)sel.append(top);
  GROUPS.forEach(([g,label,short])=>{
    const o=document.createElement('optgroup');o.label=label;
    if(all)o.append(new Option('Random mix ('+short+')','random_'+g));
    if(smart)o.append(new Option('Smart Mix ('+short+')','smart_'+g));
    topicKeys(g).forEach(k=>o.append(new Option(TOPICS[k].name,k)));
    sel.append(o);
  });
}

// ---------------- Question selection ----------------
function weightedPick(keys){
  const w=keys.map(k=>{const ts=S.topicStats[k];if(!ts||ts.total<3)return 2;return 0.5+3*(1-ts.correct/ts.total);});
  let r=Math.random()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<keys.length;i++){r-=w[i];if(r<=0)return keys[i];}
  return keys[keys.length-1];
}
function pickTopic(t){
  const m=/^(random|smart)(?:_(\w+))?$/.exec(t);
  if(m){const k=topicKeys(m[2]);return m[1]==='smart'?weightedPick(k):k[Math.floor(Math.random()*k.length)];}
  return TOPICS[t]?t:Object.keys(TOPICS)[0];
}
function pickQuestion(topic,filter){
  const all=TOPICS[topic].questions;
  let pool=all.filter(filter);if(!pool.length)pool=all;
  // avoid repeating any of the last few questions
  const fresh=pool.filter(q=>!S.recent.includes(q.q));
  if(fresh.length)pool=fresh;
  const q=pool[Math.floor(Math.random()*pool.length)];
  S.recent.push(q.q);if(S.recent.length>12)S.recent.shift();
  return q;
}

// ---------------- Answer marking ----------------
// '|' separates accepted alternatives; top-level ',' separates parts that must all be given (any order).
const SUP='⁰¹²³⁴⁵⁶⁷⁸⁹';
function norm(s){
  return String(s).toLowerCase()
    .replace(/sqrt/g,'√').replace(/(^|[^a-z])pi(?![a-z])/g,'$1π').replace(/theta/g,'θ')
    .replace(/[−–—‐]/g,'-').replace(/\s+/g,'')
    .replace(/[×x]/g,'*').replace(/\^/g,'').replace(/°|degrees?$/g,'')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,d=>SUP.indexOf(d))
    .replace(/√\(([\d.]+)\)/g,'√$1')
    .replace(/\.$/,'').replace(/^=/,'').replace(/[‘’'“”]/g,m=>m==='“'||m==='”'?'"':'');
}
function splitTop(s){const out=[];let d=0,cur='';for(const ch of s){if(ch==='(')d++;else if(ch===')')d--;if(ch===','&&d===0){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
const isNum=s=>/^-?(\d+\.?\d*|\.\d+)$/.test(s);
const VAR=/^[a-zθ*]=/;
const stripVar=s=>s.replace(VAR,'');
// "£138", "13cm", "40%" → number, but only if what's left is a plain number
function unitless(s){const t=s.replace(/^£/,'').replace(/(cm2|cm3|cm|mm2|mm3|mm|km|m2|m3|m|ml|l|kg|g|p|%|units?|litres?|pence)$/,'');return isNum(t)?t:s;}
// products of brackets in any order: (x+2)(x+3) == (x+3)(x+2)
function canon(s){const m=s.match(/^([^()]*)((?:\([^()]+\))+)$/);if(!m)return s;return m[1]+m[2].match(/\([^()]+\)/g).sort().join('');}
function fracVal(s){const m=s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);return m&&+m[2]?(+m[1])/(+m[2]):null;}
function partEq(u,c){
  if(u===c||canon(u)===canon(c))return true;
  if(VAR.test(u)&&VAR.test(c)&&u[0]!==c[0])return false; // named the wrong variable
  const un=unitless(stripVar(u)),cn=stripVar(c);
  if(un===cn||canon(un)===canon(cn))return true;
  if(!isNum(cn))return false;
  const uv=isNum(un)?parseFloat(un):fracVal(un);
  if(uv===null)return false;
  // integers must be exact; decimals allow the rounding band of the stated answer
  const dp=(cn.split('.')[1]||'').length;
  const tol=dp>0?0.5*Math.pow(10,-dp)+1e-9:1e-9;
  return Math.abs(parseFloat(cn)-uv)<=tol;
}
function match(user,correct){
  const raw=String(user).trim().replace(/\s+(and|or|&)\s+/gi,',').replace(/;/g,',');
  if(!raw)return false;
  return String(correct).split('|').some(alt=>{
    const cParts=splitTop(alt).map(norm).filter(Boolean);
    const u=alt.includes(',')?raw:raw.replace(/(\d),(?=\d{3}(?!\d))/g,'$1'); // allow 153,000
    const uParts=splitTop(u).map(norm).filter(Boolean);
    if(uParts.length!==cParts.length)return false;
    const used=cParts.map(()=>false);
    const tryM=i=>{
      if(i===uParts.length)return true;
      for(let j=0;j<cParts.length;j++){
        if(!used[j]&&partEq(uParts[i],cParts[j])){used[j]=true;if(tryM(i+1))return true;used[j]=false;}
      }
      return false;
    };
    return tryM(0);
  });
}
const showAns=a=>esc(String(a).split('|')[0].split(',').join(', '));

// ---------------- Symbol buttons ----------------
const SYMBOLS=['=','$',':','(',')',',','"','<','>','*','£','%'];
document.querySelectorAll('.symbols').forEach(box=>{
  const input=$(box.dataset.for);
  SYMBOLS.forEach(sym=>{
    const b=document.createElement('button');b.type='button';b.textContent=sym;b.tabIndex=-1;
    b.setAttribute('aria-label','Insert '+sym);
    b.addEventListener('mousedown',e=>e.preventDefault()); // keep focus in input
    b.addEventListener('click',()=>{
      if(input.disabled)return;
      const s=input.selectionStart??input.value.length,e=input.selectionEnd??s;
      input.value=input.value.slice(0,s)+sym+input.value.slice(e);
      input.setSelectionRange(s+sym.length,s+sym.length);input.focus();
    });
    box.append(b);
  });
});

// ---------------- Practice ----------------
function areaTag(el,topic){
  const it=TOPICS[topic].group==='it';
  el.textContent=it?'Assignment skill':'Question paper';
  el.className='tag '+(it?'tag-calc':'tag-qp');
}
function newQuestion(){
  const topic=pickTopic(S.currentTopic);
  const d=S.currentDiff;
  const q=pickQuestion(topic,d==='mixed'?()=>true:x=>x.level===+d);
  S.currentQ={...q,topic};S.answered=false;
  $('q-text').textContent=q.q;
  const mc=!!q.o,inp=$('q-input');
  inp.value='';inp.disabled=false;inp.hidden=mc;
  document.querySelector('.symbols[data-for="q-input"]').hidden=mc;
  if(mc)renderOpts($('q-opts'),q,pick=>checkAnswer(pick));else{$('q-opts').hidden=true;$('q-opts').innerHTML='';}
  $('q-topic-label').textContent=TOPICS[topic].name;
  $('q-num').textContent=S.questionNum;
  const lv=$('q-level');lv.textContent=LEVEL_NAMES[q.level];lv.className='tag tag-lvl-'+q.level;
  areaTag($('calc-badge'),topic);
  $('feedback-area').innerHTML='';
  $('check-btn').hidden=mc;$('hint-btn').hidden=false;$('skip-btn').hidden=false;
  if(S.panel==='practice'&&!mc)inp.focus({preventScroll:true});
}
function checkAnswer(picked){
  if(!S.currentQ||S.answered)return;
  const q=S.currentQ,mc=!!q.o;
  const raw=mc?picked:$('q-input').value.trim();
  if(!raw){$('q-input').focus();return;}
  S.answered=true;
  const ok=mc?raw===q.o[0]:match(raw,q.a);
  if(mc)markOpts($('q-opts'),q,raw);
  recordStudy();
  S.stats.answered++;S.stats.dailyCount++;
  const ts=S.topicStats[q.topic]||(S.topicStats[q.topic]={correct:0,total:0});
  ts.total++;
  $('q-input').disabled=true;
  $('check-btn').hidden=true;$('hint-btn').hidden=true;$('skip-btn').hidden=true;
  let html;
  if(ok){
    S.stats.correct++;ts.correct++;S.stats.streak++;
    if(S.stats.streak>S.stats.bestStreak)S.stats.bestStreak=S.stats.streak;
    const run=S.stats.streak>=3?` <span class="muted">· ${S.stats.streak} in a row</span>`:'';
    html=`<div class="fb fb-ok"><div class="fb-head"><svg class="ico"><use href="#i-check"/></svg>Correct${run}</div>
      <div class="fb-exp"><b>Why:</b> ${esc(q.explain)}</div>
      <button class="btn btn-primary" id="next-btn">Next question<svg class="ico"><use href="#i-arrow"/></svg></button></div>`;
  }else{
    S.stats.streak=0;
    html=`<div class="fb fb-no"><div class="fb-head"><svg class="ico"><use href="#i-x"/></svg>Not quite</div>
      You answered <span class="ans">${esc(raw)}</span>. The answer is <span class="ans">${ansText(q)}</span>.
      <div class="fb-exp"><b>Explanation:</b> ${esc(q.explain)}</div>
      <button class="btn btn-primary" id="next-btn">Next question<svg class="ico"><use href="#i-arrow"/></svg></button></div>`;
  }
  $('feedback-area').innerHTML=html;
  $('next-btn').addEventListener('click',nextQuestion);
  $('next-btn').focus({preventScroll:true});
  S.questionNum++;save();updateHeader();
  if(ok&&S.stats.dailyCount===(S.settings.goal||10))toast('Daily goal reached — nice work');
  else if(ok&&S.stats.streak>0&&S.stats.streak%5===0)toast(S.stats.streak+' correct in a row');
}
function nextQuestion(){newQuestion();}
function skipQuestion(){if(S.answered)return;S.stats.streak=0;updateHeader();save();newQuestion();}
function getHint(){
  if(!S.currentQ||S.answered)return;
  $('feedback-area').innerHTML=`<div class="fb fb-hint"><div class="fb-head"><svg class="ico"><use href="#i-bulb"/></svg>Hint</div>${esc(S.currentQ.hint)}</div>`;
  $('q-input').focus({preventScroll:true});
}
function updateHeader(){
  rollDay();
  const g=S.settings.goal||10,dc=S.stats.dailyCount||0,pct=Math.min(100,dc/g*100);
  $('hdr-days').textContent=S.stats.dayStreak||0;
  $('hdr-daily').textContent=dc;$('hdr-goal').textContent=g;
  $('goal-ring').setAttribute('stroke-dasharray',pct+' 100');
  document.querySelector('.chip-goal').classList.toggle('done',dc>=g);
  $('daily-count').textContent=dc;$('daily-goal-lbl').textContent=g;
  $('goal-fill').style.width=pct+'%';
  $('run-streak').textContent=S.stats.streak;$('best-streak').textContent=S.stats.bestStreak;
}
function setTopic(k){S.currentTopic=k;$('topic-select').value=k;newQuestion();}

$('answer-form').addEventListener('submit',e=>{e.preventDefault();checkAnswer();});
document.addEventListener('keydown',e=>{if(S.panel==='practice'&&!S.answered)optKey(e,$('q-opts'));});
$('hint-btn').addEventListener('click',getHint);
$('skip-btn').addEventListener('click',skipQuestion);
$('topic-select').addEventListener('change',e=>setTopic(e.target.value));
$('diff-seg').addEventListener('click',e=>{
  const b=e.target.closest('[data-diff]');if(!b)return;
  S.currentDiff=b.dataset.diff;
  $('diff-seg').querySelectorAll('[data-diff]').forEach(x=>x.setAttribute('aria-checked',x===b));
  newQuestion();
});
// Enter moves on after an answer has been marked
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&S.panel==='practice'&&S.answered&&document.activeElement?.id!=='next-btn'&&!e.target.closest('select,textarea')){e.preventDefault();nextQuestion();}
});

// ---------------- Topics ----------------
function accClass(pct,total){return !total?'':pct<50?'acc-low':pct<75?'acc-mid':'acc-high';}
function renderTopics(){
  const g=$('topic-grid');g.innerHTML='';
  GROUPS.forEach(([grp,label])=>{
    const sec=document.createElement('div');sec.className='topic-section';
    sec.innerHTML=`<h2 class="section-title">${label}</h2><div class="topic-grid"></div>`;
    const grid=sec.lastElementChild;
    topicKeys(grp).forEach(k=>{
      const t=TOPICS[k],ts=S.topicStats[k]||{correct:0,total:0};
      const pct=ts.total?Math.round(ts.correct/ts.total*100):0;
      const b=document.createElement('button');b.className='tile '+accClass(pct,ts.total);
      b.innerHTML=`<div class="tile-top"><span class="glyph">${esc(GLYPH[k]||'•')}</span><span class="tag ${grp==='it'?'tag-calc':'tag-qp'}">${grp==='it'?'Assignment':'Exam'}</span></div>
        <h3>${esc(t.name)}</h3>
        <div class="tile-meta">${ts.total?`${pct}% correct · ${ts.total} answered`:`${t.questions.length} questions · not started`}</div>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>`;
      b.addEventListener('click',()=>{setTopic(k);go('practice');});
      grid.append(b);
    });
    g.append(sec);
  });
}

// ---------------- Worksheets ----------------
const DIFF_TAG={Easy:'tag-lvl-1',Medium:'tag-lvl-2',Hard:'tag-lvl-3',Mixed:'tag-topic'};
function renderWS(){
  const el=$('sheet-list');el.innerHTML='';
  GROUPS.forEach(([grp,label])=>{
    const h=document.createElement('h2');h.className='section-title ws-group';h.textContent=label;h.style.gridColumn='1/-1';el.append(h);
    WORKSHEETS.forEach((ws,i)=>{
      const t=TOPICS[ws.topic];if(t.group!==grp)return;
      const b=document.createElement('button');b.className='tile';
      b.innerHTML=`<div class="tile-top"><span class="glyph">${esc(GLYPH[ws.topic]||'•')}</span><span class="tag ${DIFF_TAG[ws.diff]||'tag-topic'}">${ws.diff}</span></div>
        <h3>${esc(ws.title)}</h3><div class="tile-meta">${ws.qs.length} questions · ${groupName(t.group)}</div>`;
      b.addEventListener('click',()=>openWS(i));el.append(b);
    });
  });
}
function openWS(idx){
  const ws=WORKSHEETS[idx],t=TOPICS[ws.topic];
  const qs=ws.qs.map(i=>t.questions[i]).filter(Boolean);
  $('ws-list').hidden=true;
  const av=$('ws-active');av.hidden=false;
  const it=t.group==='it';
  av.innerHTML=`<div class="card">
    <div class="ws-head">
      <div><h2 class="card-title" style="margin-bottom:6px">${esc(ws.title)}</h2>
        <span class="tag ${it?'tag-calc':'tag-qp'}">${it?'Assignment skill':'Question paper'}</span> <span class="tag ${DIFF_TAG[ws.diff]}">${ws.diff}</span></div>
      <button class="btn btn-ghost btn-sm" data-ws-back><svg class="ico"><use href="#i-back"/></svg>All worksheets</button>
    </div>
    <form id="ws-form" autocomplete="off">
    ${qs.map((q,i)=>`<div class="ws-q"><p class="ws-qtext"><span class="num">${i+1}</span>${esc(q.q)}</p>
      ${q.o?`<div class="ws-opts" role="radiogroup" aria-label="Options for question ${i+1}">${shuffled(q.o).map(o=>`<label class="ws-opt"><input type="radio" name="wsq${i}" value="${esc(o)}"> <span>${esc(o)}</span></label>`).join('')}</div>`
        :`<label class="sr-only" for="wsq${i}">Answer to question ${i+1}</label>
      <input class="input" type="text" id="wsq${i}" data-i="${i}" placeholder="Your answer" spellcheck="false" autocapitalize="off">`}
      <div class="ws-fb" id="wsfb${i}"></div></div>`).join('')}
    <div class="btn-row" style="margin-top:16px">
      <button type="submit" class="btn btn-primary">Check all answers</button>
      <button type="button" class="btn btn-ghost" data-ws-reset>Clear</button>
      <span class="ws-score" id="ws-score"></span>
    </div></form></div>`;
  const form=$('ws-form');
  const userAns=i=>{const q=qs[i];if(q.o){const r=form.querySelector(`input[name="wsq${i}"]:checked`);return r?r.value:'';}return $('wsq'+i).value.trim();};
  const checkOne=i=>{
    const q=qs[i],user=userAns(i),fb=$('wsfb'+i);
    if(!user){fb.innerHTML='<span class="muted">Not answered.</span> Answer: <b>'+ansText(q)+'</b>';return false;}
    const ok=q.o?user===q.o[0]:match(user,q.a);
    fb.innerHTML=ok?`<span class="ok">Correct.</span> <span class="muted">${esc(q.explain)}</span>`
      :`<span class="no">Answer: ${ansText(q)}</span> <span class="muted">— ${esc(q.explain)}</span>`;
    return ok;
  };
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const n=qs.reduce((a,_,i)=>a+(checkOne(i)?1:0),0);
    $('ws-score').textContent=`${n} / ${qs.length} correct`;
  });
  form.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!e.target.dataset.i)return;
    e.preventDefault();const i=+e.target.dataset.i;
    if(e.target.value.trim())checkOne(i);
    const next=$('wsq'+(i+1));if(next)next.focus();
  });
  av.querySelector('[data-ws-back]').addEventListener('click',closeWS);
  av.querySelector('[data-ws-reset]').addEventListener('click',()=>openWS(idx));
  window.scrollTo(0,0);
}
function closeWS(){$('ws-list').hidden=false;$('ws-active').hidden=true;$('ws-active').innerHTML='';}

// ---------------- Flashcards ----------------
function loadFC(){S.fcCards=[...(FLASHCARDS[$('fc-topic').value]||FLASHCARDS.all)];S.fcIdx=0;showFC();}
function showFC(){
  const c=S.fcCards[S.fcIdx];if(!c)return;
  $('flashcard').classList.remove('flipped');
  $('fc-term').textContent=c.term;$('fc-term-back').textContent=c.term;$('fc-def').textContent=c.def;
  $('fc-idx').textContent=S.fcIdx+1;$('fc-tot').textContent=S.fcCards.length;
}
function flipCard(){$('flashcard').classList.toggle('flipped');}
function stepFC(d){S.fcIdx=(S.fcIdx+d+S.fcCards.length)%S.fcCards.length;showFC();}
function shuffleFC(){for(let i=S.fcCards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[S.fcCards[i],S.fcCards[j]]=[S.fcCards[j],S.fcCards[i]];}S.fcIdx=0;showFC();toast('Deck shuffled');}
$('fc-topic').addEventListener('change',loadFC);
$('flashcard').addEventListener('click',flipCard);
$('fc-prev').addEventListener('click',()=>stepFC(-1));
$('fc-next').addEventListener('click',()=>stepFC(1));
$('fc-shuffle').addEventListener('click',shuffleFC);
document.addEventListener('keydown',e=>{
  if(S.panel!=='flashcards'||e.target.closest('input,select,textarea'))return;
  if(e.key==='ArrowRight')stepFC(1);else if(e.key==='ArrowLeft')stepFC(-1);
  else if(e.key===' '&&e.target.id!=='flashcard'){e.preventDefault();flipCard();}
});

// ---------------- Timed challenge ----------------
const timer={interval:null,left:0,secs:0,score:0,topic:'random',q:null,token:0,locked:false};
function startTimer(secs){
  timer.topic=$('timer-topic').value;timer.secs=secs;timer.left=secs;timer.score=0;
  $('timer-setup').hidden=true;$('timer-result').hidden=true;$('timer-game').hidden=false;
  $('timer-score-lbl').textContent='0';
  const d=$('timer-display');d.textContent=secs;d.classList.remove('urgent');
  newTimerQ();
  clearInterval(timer.interval);
  timer.interval=setInterval(()=>{
    timer.left--;d.textContent=timer.left;
    if(timer.left<=10)d.classList.add('urgent');
    if(timer.left<=0)endTimer();
  },1000);
}
function newTimerQ(){
  timer.token++;timer.locked=false;
  const t=pickTopic(timer.topic);
  timer.q=pickQuestion(t,q=>q.level<=2);
  $('timer-q').textContent=timer.q.q;
  const mc=!!timer.q.o,inp=$('timer-input');
  inp.value='';inp.disabled=false;inp.hidden=mc;
  document.querySelector('.symbols[data-for="timer-input"]').hidden=mc;
  $('timer-submit').hidden=mc;
  if(mc)renderOpts($('timer-opts'),timer.q,pick=>checkTimerAnswer(pick));else{$('timer-opts').hidden=true;$('timer-opts').innerHTML='';inp.focus({preventScroll:true});}
}
function checkTimerAnswer(picked){
  const q=timer.q;if(!q||timer.locked)return;
  const raw=q.o?picked:$('timer-input').value.trim();
  if(!raw)return;
  const fb=$('timer-fb');
  const ok=q.o?raw===q.o[0]:match(raw,q.a);
  if(ok){
    timer.score++;$('timer-score-lbl').textContent=timer.score;
    fb.innerHTML='<span class="ok">Correct</span>';newTimerQ();
  }else{
    timer.locked=true;$('timer-input').disabled=true;
    if(q.o)markOpts($('timer-opts'),q,raw);
    fb.innerHTML=`<span class="no">Answer: ${ansText(q)}</span>`;
    const tk=timer.token;setTimeout(()=>{if(tk===timer.token&&timer.interval)newTimerQ();},1600);
  }
}
function endTimer(){
  clearInterval(timer.interval);timer.interval=null;timer.token++;
  $('timer-game').hidden=true;$('timer-result').hidden=false;$('timer-fb').textContent='';
  $('timer-final').textContent=timer.score+' correct';
  const best=S.timerScores.filter(s=>s.secs===timer.secs).reduce((m,s)=>Math.max(m,s.score),0);
  const mins=timer.secs/60;
  $('timer-msg').textContent=timer.score>best?`New personal best for the ${mins}-minute challenge.`:
    `Your best for ${mins} minute${mins>1?'s':''} is ${best}. `+(timer.score>=best*0.8?'Close!':'Keep practising.');
  S.timerScores.push({score:timer.score,secs:timer.secs,date:new Date().toLocaleDateString('en-GB')});
  if(S.timerScores.length>30)S.timerScores=S.timerScores.slice(-30);
  save();
}
function resetTimer(){clearInterval(timer.interval);timer.interval=null;timer.token++;$('timer-setup').hidden=false;$('timer-game').hidden=true;$('timer-result').hidden=true;}
document.querySelectorAll('#timer-setup [data-secs]').forEach(b=>b.addEventListener('click',()=>startTimer(+b.dataset.secs)));
$('timer-form').addEventListener('submit',e=>{e.preventDefault();checkTimerAnswer();});
document.addEventListener('keydown',e=>{if(S.panel==='timer'&&timer.interval&&!timer.locked)optKey(e,$('timer-opts'));});
$('timer-skip').addEventListener('click',()=>{if(!timer.locked){$('timer-fb').textContent='';newTimerQ();}});
$('timer-stop').addEventListener('click',endTimer);
$('timer-again').addEventListener('click',resetTimer);

// ---------------- Mock exams ----------------
const mock={active:false,paper:null,questions:[],idx:0,answers:[],correct:[],awarded:[],score:0,total:0,left:0,interval:null,locked:false};
const fmtTime=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
function markTag(el,self){el.textContent=self?'Self-marked':'Auto-marked';el.className='tag '+(self?'tag-qp':'tag-calc');}
function buildRandomPaper({group,n}){
  const pool=[];
  topicKeys(group).forEach(k=>TOPICS[k].questions.forEach(q=>{if(!q.points)pool.push({...q,topic:TOPICS[k].name,marks:1});}));
  return shuffled(pool).slice(0,n);
}
function renderMockHome(){
  const el=$('mock-papers');el.innerHTML='';
  Object.entries(MOCK_PAPERS).forEach(([n,p])=>{
    const d=document.createElement('div');d.className='tile paper';
    const nq=p.random?p.random.n:p.questions.length;
    d.innerHTML=`<div class="tile-top"><span class="glyph">${esc(p.glyph||'P'+n)}</span></div>
      <h3>${esc(p.title)}</h3>
      <div class="paper-facts"><span class="tag">${nq} questions</span><span class="tag">${p.totalMarks} marks</span><span class="tag">${p.duration/60} min</span>
      <span class="tag ${p.selfMark?'tag-qp':'tag-calc'}">${p.selfMark?'Self-marked':'Auto-marked'}</span></div>
      <button class="btn btn-primary">Start paper</button>`;
    d.querySelector('button').addEventListener('click',()=>startMock(+n));
    el.append(d);
  });
  const prev=$('mock-prev-scores');
  if(S.mockScores.length){prev.hidden=false;prev.innerHTML='<h2 class="card-title">Recent attempts</h2>'+mockHistoryHTML(5);}
  else prev.hidden=true;
}
function mockHistoryHTML(n){
  if(!S.mockScores.length)return '<p class="empty">No mock exams yet. Try one from the Mock exams page.</p>';
  return [...S.mockScores].slice(-n).reverse().map(s=>`<div class="list-row">
    <span class="rank">${esc(s.grade==='No Award'?'–':s.grade)}</span>
    <span class="grow">${esc((MOCK_PAPERS[s.paper]&&MOCK_PAPERS[s.paper].short)||'Paper '+s.paper)} · ${s.score}/${s.total} (${s.pct}%)</span>
    <span class="muted small">${esc(s.date)}</span></div>`).join('');
}
function startMock(n){
  const p=MOCK_PAPERS[n];
  const qs=p.random?buildRandomPaper(p.random):[...p.questions];
  Object.assign(mock,{active:true,paper:n,questions:qs,idx:0,answers:new Array(qs.length).fill(''),correct:new Array(qs.length).fill(false),awarded:new Array(qs.length).fill(0),score:0,total:qs.reduce((a,q)=>a+q.marks,0),left:p.duration,locked:false});
  $('mock-home').hidden=true;$('mock-results').hidden=true;$('mock-exam').hidden=false;
  $('mock-paper-title').textContent=p.title;
  markTag($('mock-calc-status'),!!p.selfMark);
  $('mock-marks-so-far').textContent='0';
  const clock=$('mock-timer-display');clock.textContent=fmtTime(mock.left);clock.classList.remove('low');
  clearInterval(mock.interval);mock.interval=setInterval(mockTick,1000);
  showMockQ();window.scrollTo(0,0);
}
function mockTick(){
  mock.left--;
  const clock=$('mock-timer-display');clock.textContent=fmtTime(Math.max(0,mock.left));
  if(mock.left<=300)clock.classList.add('low');
  if(mock.left<=0)endMock();
}
function showMockQ(){
  const q=mock.questions[mock.idx],total=mock.questions.length,k=kindOf(q);
  mock.locked=false;
  $('mock-q-counter').textContent=`Question ${mock.idx+1} of ${total}`;
  $('mock-topic-label').textContent=q.topic;
  $('mock-marks-label').textContent=q.marks+(q.marks===1?' mark':' marks');
  const st=$('mock-stim');
  if(q.stim){st.hidden=false;st.textContent=q.stim;}else st.hidden=true;
  $('mock-q-text').textContent=q.q;
  const inp=$('mock-answer'),ta=$('mock-text');
  inp.value='';inp.disabled=false;inp.hidden=k!=='t';
  ta.value='';ta.disabled=false;ta.hidden=k!=='w';
  document.querySelector('.symbols[data-for="mock-answer"]').hidden=k!=='t';
  if(k==='mc')renderOpts($('mock-opts'),q,pick=>submitMockAnswer(pick));else{$('mock-opts').hidden=true;$('mock-opts').innerHTML='';}
  const sb=$('mock-submit');sb.hidden=k==='mc';sb.disabled=false;sb.textContent=k==='w'?'Mark my answer':'Submit answer';
  $('mock-skip').disabled=false;
  $('mock-fb').innerHTML='';
  if(k==='t')inp.focus({preventScroll:true});else if(k==='w')ta.focus({preventScroll:true});
  $('mock-prog-bar').style.width=(mock.idx/total*100)+'%';
}
function advanceMock(){mock.idx++;if(mock.idx>=mock.questions.length)endMock();else{showMockQ();window.scrollTo(0,0);}}
function submitMockAnswer(picked){
  if(!mock.active||mock.locked)return;
  const q=mock.questions[mock.idx],k=kindOf(q);
  if(k==='w')return selfMark(q);
  const raw=k==='mc'?picked:$('mock-answer').value.trim();
  if(!raw){$('mock-answer').focus();return;}
  mock.locked=true;
  const ok=k==='mc'?raw===q.o[0]:match(raw,q.a);
  mock.answers[mock.idx]=raw;mock.correct[mock.idx]=ok;mock.awarded[mock.idx]=ok?q.marks:0;
  if(ok)mock.score+=q.marks;
  if(k==='mc')markOpts($('mock-opts'),q,raw);
  $('mock-marks-so-far').textContent=mock.score;
  $('mock-answer').disabled=true;$('mock-submit').disabled=true;$('mock-skip').disabled=true;
  $('mock-fb').innerHTML=ok
    ?`<div class="fb fb-ok"><div class="fb-head"><svg class="ico"><use href="#i-check"/></svg>Correct — ${q.marks} mark${q.marks>1?'s':''}</div></div>`
    :`<div class="fb fb-no"><div class="fb-head"><svg class="ico"><use href="#i-x"/></svg>Answer: ${ansText(q)}</div>${esc(q.explain)}</div>`;
  const at=mock.idx;
  setTimeout(()=>{if(mock.active&&mock.idx===at)advanceMock();},ok?1200:3200);
}
// Written answers: reveal the marking points, the candidate ticks the ones they made
function selfMark(q){
  const ta=$('mock-text'),text=ta.value.trim();
  if(!text){ta.focus();toast('Write your answer first — or choose Leave blank');return;}
  mock.locked=true;ta.disabled=true;$('mock-submit').disabled=true;$('mock-skip').disabled=true;
  const at=mock.idx;
  $('mock-fb').innerHTML=`<div class="fb fb-hint"><div class="fb-head"><svg class="ico"><use href="#i-check"/></svg>Mark your answer</div>
    <p class="small">Tick each marking point your answer makes clearly. 1 mark per point, maximum <b>${q.marks}</b>.</p>
    <div class="mark-points">${q.points.map((p,i)=>`<label class="mp"><input type="checkbox" data-mp="${i}"> <span>${esc(p)}</span></label>`).join('')}</div>
    ${q.explain?`<p class="small muted mp-tip"><b>Examiner tip:</b> ${esc(q.explain)}</p>`:''}
    <button type="button" class="btn btn-primary" id="mock-confirm">Confirm 0 / ${q.marks} marks</button></div>`;
  const fb=$('mock-fb'),btn=$('mock-confirm');
  const count=()=>Math.min(q.marks,fb.querySelectorAll('[data-mp]:checked').length);
  fb.firstElementChild.addEventListener('change',()=>{btn.textContent=`Confirm ${count()} / ${q.marks} marks`;});
  btn.addEventListener('click',()=>{
    if(!mock.active||mock.idx!==at)return;
    const m=count();
    mock.answers[at]=text;mock.awarded[at]=m;mock.correct[at]=m>=q.marks/2;mock.score+=m;
    $('mock-marks-so-far').textContent=mock.score;
    advanceMock();
  });
  btn.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function skipMockQ(){if(!mock.active||mock.locked)return;mock.answers[mock.idx]='';advanceMock();}
function endMock(){
  if(!mock.active)return;
  clearInterval(mock.interval);mock.interval=null;mock.active=false;
  $('mock-exam').hidden=true;$('mock-results').hidden=false;$('mock-review-section').hidden=true;
  const p=MOCK_PAPERS[mock.paper],total=mock.total,score=mock.score,pct=Math.round(score/total*100);
  let grade,msg;
  if(pct>=70){grade='A';msg="That's A-grade standard. Excellent work.";}
  else if(pct>=60){grade='B';msg='A solid B. Review the questions you dropped to push for an A.';}
  else if(pct>=50){grade='C';msg='A pass at C. Target your weakest topics to move up a grade.';}
  else if(pct>=40){grade='D';msg='Close to a pass. Use Smart Mix to work on the topics you found hardest.';}
  else{grade='No Award';msg='Not there yet — that is what practice is for. Review your answers, then try again.';}
  $('mock-grade-icon').textContent=grade==='No Award'?'–':grade;
  $('mock-grade-title').textContent=grade==='No Award'?'Keep practising':'Grade '+grade;
  $('mock-score-display').textContent=`${score} / ${total}`;
  $('mock-grade-band').textContent=`${pct}% · ${p.title}`;
  $('mock-grade-msg').textContent=msg;
  S.mockScores.push({paper:mock.paper,score,total,pct,grade,date:new Date().toLocaleDateString('en-GB')});
  if(S.mockScores.length>50)S.mockScores=S.mockScores.slice(-50);
  save();window.scrollTo(0,0);
}
function showMockReview(){
  const sec=$('mock-review-section');sec.hidden=false;
  $('mock-review-list').innerHTML=mock.questions.map((q,i)=>{
    const given=mock.answers[i],ok=mock.correct[i],k=kindOf(q);
    if(k==='w')return `<div class="review-item ${ok?'ok':'no'}">
      <div class="meta">${i+1}. ${esc(q.topic)} · ${mock.awarded[i]} / ${q.marks} marks</div>
      <div class="q">${esc(q.q)}</div>
      <div class="review-answer">${given?esc(given):'<span class="muted">blank</span>'}</div>
      <div class="exp"><b>Marking points:</b><ul>${q.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div></div>`;
    return `<div class="review-item ${ok?'ok':'no'}">
      <div class="meta">${i+1}. ${esc(q.topic)} · ${q.marks} mark${q.marks>1?'s':''}</div>
      <div class="q">${esc(q.q)}</div>
      <div>Your answer: <b>${given?esc(given):'<span class="muted">blank</span>'}</b>${ok?'':` · Correct: <b>${ansText(q)}</b>`}</div>
      ${ok?'':`<div class="exp">${esc(q.explain)}</div>`}</div>`;
  }).join('');
  sec.scrollIntoView({behavior:'smooth'});
}
function resetMock(){
  clearInterval(mock.interval);mock.interval=null;mock.active=false;
  $('mock-home').hidden=false;$('mock-exam').hidden=true;$('mock-results').hidden=true;
  renderMockHome();window.scrollTo(0,0);
}
document.addEventListener('keydown',e=>{if(S.panel==='mock'&&mock.active&&!mock.locked)optKey(e,$('mock-opts'));});
$('mock-form').addEventListener('submit',e=>{e.preventDefault();submitMockAnswer();});
$('mock-skip').addEventListener('click',skipMockQ);
$('mock-end').addEventListener('click',()=>{if(confirm('End the exam now? Unanswered questions score zero.'))endMock();});
$('mock-review-btn').addEventListener('click',showMockReview);
$('mock-back').addEventListener('click',resetMock);
window.addEventListener('beforeunload',e=>{if(mock.active){e.preventDefault();e.returnValue='';}});

// ---------------- Progress ----------------
function renderProg(){
  rollDay();
  const st=S.stats,acc=st.answered?Math.round(st.correct/st.answered*100)+'%':'–';
  $('stats-grid').innerHTML=[
    [st.answered,'Questions answered'],[acc,'Accuracy'],[st.dayStreak||0,'Day streak'],
    [st.bestStreak,'Best run in a row'],[st.dailyCount+' / '+(S.settings.goal||10),'Today'],[S.mockScores.length,'Mock exams taken']
  ].map(([n,l])=>`<div class="stat"><div class="stat-num">${n}</div><div class="stat-lbl">${l}</div></div>`).join('');
  const rows=Object.entries(TOPICS).map(([k,t])=>{const ts=S.topicStats[k]||{correct:0,total:0};return {k,t,ts,pct:ts.total?Math.round(ts.correct/ts.total*100):null};});
  rows.sort((a,b)=>(a.pct===null)-(b.pct===null)||(a.pct??0)-(b.pct??0));
  const list=$('topic-prog');list.innerHTML='';
  rows.forEach(({k,t,ts,pct})=>{
    const r=document.createElement('div');r.className='prog-row '+accClass(pct??0,ts.total);
    r.innerHTML=`<div class="name">${esc(t.name)}<small>${groupName(t.group)} · ${ts.total?`${ts.correct}/${ts.total} correct · ${pct}%`:'Not started'}</small></div>
      <div class="bar"><div class="bar-fill" style="width:${pct??0}%"></div></div>
      <button class="btn btn-ghost">Practise</button>`;
    r.querySelector('button').addEventListener('click',()=>{setTopic(k);go('practice');});
    list.append(r);
  });
  const lb=$('leaderboard');
  if(S.timerScores.length){
    lb.innerHTML=[...S.timerScores].sort((a,b)=>b.score-a.score).slice(0,5).map((s,i)=>`<div class="list-row">
      <span class="rank ${i===0?'r1':''}">${i+1}</span><span class="grow">${s.secs/60}-minute challenge</span>
      <b>${s.score}</b><span class="muted small">${esc(s.date)}</span></div>`).join('');
  }else lb.innerHTML='<p class="empty">No scores yet — try the Timed challenge.</p>';
  $('mock-history').innerHTML=mockHistoryHTML(8);
}
function resetProg(){
  if(!confirm('Reset all progress? This cannot be undone.'))return;
  S.stats={answered:0,correct:0,streak:0,bestStreak:0,dailyCount:0,dailyDate:todayStr(),dayStreak:0,lastStudyDate:''};
  S.topicStats={};S.questionNum=1;S.timerScores=[];S.mockScores=[];
  save();renderProg();updateHeader();toast('Progress reset');
}
$('reset-prog').addEventListener('click',resetProg);

// ---------------- Calculator ----------------
// Small recursive-descent parser — no eval. Angles in degrees.
const RAD=Math.PI/180;
const CALC_FNS=[['sin⁻¹(',x=>Math.asin(x)/RAD],['cos⁻¹(',x=>Math.acos(x)/RAD],['tan⁻¹(',x=>Math.atan(x)/RAD],
  ['sin(',x=>Math.sin(x*RAD)],['cos(',x=>Math.cos(x*RAD)],['tan(',x=>Math.tan(x*RAD)],
  ['√(',Math.sqrt],['log(',Math.log10],['ln(',Math.log]];
function calcEval(src){
  const s=src.replace(/\s+/g,'').replace(/\*/g,'×').replace(/\//g,'÷').replace(/−/g,'-');
  let i=0;
  const startsPrimary=()=>i<s.length&&(/[\d.(πe√]/.test(s[i])||CALC_FNS.some(([n])=>s.startsWith(n,i))||s.startsWith('Ans',i));
  function primary(){
    for(const [n,fn] of CALC_FNS)if(s.startsWith(n,i)){i+=n.length;const v=expr();if(s[i]===')')i++;return fn(v);}
    if(s[i]==='('){i++;const v=expr();if(s[i]===')')i++;return v;}
    if(s[i]==='π'){i++;return Math.PI;}
    if(s.startsWith('Ans',i)){i+=3;return calc.ans;}
    if(s[i]==='e'){i++;return Math.E;}
    const m=s.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
    if(m){i+=m[0].length;return parseFloat(m[0]);}
    throw new Error('syntax');
  }
  function postfix(){
    let v=primary();
    for(;;){
      if(s[i]==='²'){i++;v=v*v;}else if(s[i]==='³'){i++;v=v*v*v;}
      else if(s[i]==='%'){i++;v=v/100;}else break;
    }
    return v;
  }
  function power(){const b=postfix();if(s[i]==='^'){i++;return Math.pow(b,unary());}return b;}
  function unary(){if(s[i]==='-'){i++;return -unary();}if(s[i]==='+'){i++;return unary();}return power();}
  function term(){
    let v=unary();
    for(;;){
      if(s[i]==='×'){i++;v*=unary();}
      else if(s[i]==='÷'){i++;v/=unary();}
      else if(startsPrimary())v*=unary(); // implicit multiplication: 2π, 3(4), 2sin(30)
      else return v;
    }
  }
  function expr(){let v=term();for(;;){if(s[i]==='+'){i++;v+=term();}else if(s[i]==='-'){i++;v-=term();}else return v;}}
  const v=expr();
  if(i<s.length)throw new Error('syntax');
  if(!isFinite(v))throw new Error('math');
  return v;
}
const calc={expr:'',ans:0,done:false};
const CALC_KEYS=[
  ['sin(','cfn','sin'],['cos(','cfn','cos'],['tan(','cfn','tan'],['(','cfn'],[')','cfn'],
  ['sin⁻¹(','cfn','sin⁻¹'],['cos⁻¹(','cfn','cos⁻¹'],['tan⁻¹(','cfn','tan⁻¹'],['π','cfn'],['√(','cfn','√'],
  ['²','cfn','x²'],['^','cfn','xʸ'],['log(','cfn','log'],['ln(','cfn','ln'],['Ans','cfn'],
  ['7','cnum'],['8','cnum'],['9','cnum'],['÷','cop'],['DEL','cclr','⌫'],
  ['4','cnum'],['5','cnum'],['6','cnum'],['×','cop'],['AC','cclr'],
  ['1','cnum'],['2','cnum'],['3','cnum'],['-','cop','−'],['%','cfn'],
  ['0','cnum'],['.','cnum'],['e','cfn'],['+','cop'],['=','ceq'],
];
function buildCalc(){
  const g=$('calc-btns');
  CALC_KEYS.forEach(([v,cls,label])=>{
    const b=document.createElement('button');b.className='cbtn '+cls;b.textContent=label||v;b.type='button';
    b.addEventListener('click',()=>calcPress(v));g.append(b);
  });
}
function calcRender(){$('calc-main').textContent=calc.expr||'0';}
function calcPress(v){
  if(v==='AC'){calc.expr='';calc.done=false;$('calc-prev').textContent='';return calcRender();}
  if(v==='DEL'){
    if(calc.done){calc.expr='';calc.done=false;return calcRender();}
    const fn=CALC_FNS.find(([n])=>calc.expr.endsWith(n));
    calc.expr=calc.expr.slice(0,fn?-fn[0].length:(calc.expr.endsWith('Ans')?-3:-1));return calcRender();
  }
  if(v==='='){
    if(!calc.expr)return;
    try{
      const r=calcEval(calc.expr);
      $('calc-prev').textContent=calc.expr+' =';
      calc.ans=r;calc.expr=String(parseFloat(r.toPrecision(12)));calc.done=true;
    }catch(e){$('calc-prev').textContent=calc.expr;calc.expr='';calc.done=false;$('calc-main').textContent='Error';return;}
    return calcRender();
  }
  // after a result, typing a number starts fresh; an operator carries on from the answer
  if(calc.done){calc.done=false;if(!/^[+\-×÷^²%]/.test(v))calc.expr='';}
  calc.expr+=v;calcRender();
}
document.addEventListener('keydown',e=>{
  if(S.panel!=='calculator'||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea'))return;
  const map={'*':'×','/':'÷',Enter:'=','=':'=',Backspace:'DEL',Escape:'AC',Delete:'AC','^':'^','p':'π','s':'sin(','c':'cos(','t':'tan(','r':'√(','l':'log(','n':'ln('};
  let v=map[e.key]??(/^[\d.+\-()%e]$/.test(e.key)?e.key:null);
  if(v===null)return;
  e.preventDefault();
  if(e.target.closest?.('.cbtn')&&e.key==='Enter')v='=';
  calcPress(v);
});

// ---------------- Notepad ----------------
let noteTimer;
$('notepad-text').addEventListener('input',e=>{
  S.notepadContent=e.target.value;$('note-status').textContent='Saving…';
  clearTimeout(noteTimer);noteTimer=setTimeout(()=>{save();$('note-status').textContent='Saved on this device';},400);
});
$('note-clear').addEventListener('click',()=>{if(confirm('Clear all notes?')){$('notepad-text').value='';S.notepadContent='';save();}});
$('note-copy').addEventListener('click',()=>{
  const txt=$('notepad-text').value;
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Notes copied'),()=>{$('notepad-text').select();toast('Press Ctrl+C to copy');});
});
$('note-download').addEventListener('click',()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([$('notepad-text').value],{type:'text/plain'}));
  a.download='higher-admin-notes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

// ---------------- Shop ----------------
const TAG='cazza09-21';
const SHOP=[
  ['Revision books',[
    ['Higher Administration & IT revision guide','Course notes and exam technique for the SQA course','higher+administration+and+it+revision+guide+sqa'],
    ['Higher Administration & IT practice papers','Exam-style papers with marking guidance','higher+administration+and+it+practice+papers+sqa'],
    ['How to Pass Higher Administration & IT','Hodder Gibson guide covering theory and IT skills','how+to+pass+higher+administration+and+it'],
    ['Microsoft Excel formulas guide','VLOOKUP, IF, SUMIF and more, explained step by step','excel+formulas+and+functions+guide'],
  ]],
  ['Study kit',[
    ['USB memory stick','Back up your practice files (and practise good file management)','usb+flash+drive+64gb'],
    ['Over-ear headphones','Block out noise while revising','over+ear+headphones+wired+study'],
  ]],
  ['Stationery',[
    ['Revision flashcards','Make your own legislation and function cards','revision+flashcards+blank+cards'],
    ['Highlighters and pens','Colour-code notes and marking points','highlighter+pens+set+revision'],
    ['A4 lined notebook','For practising exam answers by hand','a4+lined+notebook+revision'],
    ['Sticky index tabs','Mark key pages in your revision guide','sticky+index+tabs+page+markers'],
  ]],
];
function renderShop(){
  $('shop-sections').innerHTML=SHOP.map(([title,items])=>`<div class="shop-section"><h2 class="section-title">${title}</h2><div class="grid-cards">
    ${items.map(([n,d,q])=>`<a class="tile shop-card" href="https://www.amazon.co.uk/s?k=${q}&tag=${TAG}" target="_blank" rel="noopener sponsored"><h3>${esc(n)}</h3><small>${esc(d)}</small><span class="cta">View on Amazon<svg class="ico"><use href="#i-external"/></svg></span></a>`).join('')}
  </div></div>`).join('');
}

// ---------------- Settings ----------------
function setSeg(id,attr,val){$(id).querySelectorAll(`[data-${attr}]`).forEach(b=>b.setAttribute('aria-checked',b.dataset[attr]===String(val)));}
function applySettings(){
  const st=S.settings,root=document.documentElement;
  if(st.mode==='light'||st.mode==='dark')root.dataset.theme=st.mode;else delete root.dataset.theme;
  if(st.accent&&st.accent!=='saltire')root.dataset.accent=st.accent;else delete root.dataset.accent;
  setSeg('goal-seg','goal',st.goal||10);setSeg('mode-seg','mode',st.mode||'system');setSeg('accent-seg','accent',st.accent||'saltire');
  $('student-name').value=st.name||'';
  $('greeting').textContent=greetText();
  const meta=document.querySelector('meta[name="theme-color"]');
  meta.content=getComputedStyle(root).getPropertyValue('--bg').trim()||'#0065bd';
  updateHeader();
}
function greetText(){const d=daysToExam(),c=d>1?`${d} days until the exam (27 April 2027).`:d===1?'The exam is tomorrow — good luck!':d===0?'Exam day — good luck!':'';const n=S.settings.name;return n?`Hi ${n} — ${c||"let's get some practice in."}`:c;}
$('student-name').addEventListener('input',e=>{S.settings.name=e.target.value.trim();save();$('greeting').textContent=greetText();});
$('goal-seg').addEventListener('click',e=>{const b=e.target.closest('[data-goal]');if(!b)return;S.settings.goal=+b.dataset.goal;save();applySettings();});
$('mode-seg').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;S.settings.mode=b.dataset.mode;save();applySettings();});
$('accent-seg').addEventListener('click',e=>{const b=e.target.closest('[data-accent]');if(!b)return;S.settings.accent=b.dataset.accent;save();applySettings();});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applySettings);

// ---------------- PWA ----------------
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;
  let dismissed=false;try{dismissed=localStorage.getItem('hadmin_install_dismissed')==='1';}catch(_){}
  if(!dismissed)setTimeout(()=>{$('install-banner').hidden=false;},30000);
});
$('install-btn').addEventListener('click',()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();deferredPrompt.userChoice.finally(()=>{deferredPrompt=null;$('install-banner').hidden=true;});
});
$('dismiss-install').addEventListener('click',()=>{$('install-banner').hidden=true;try{localStorage.setItem('hadmin_install_dismissed','1');}catch(_){}});
// iPhone/iPad Safari has no install prompt, so show how to do it by hand (once, until dismissed)
(function(){
  const ua=navigator.userAgent;
  const iOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
  let dismissed=false;try{dismissed=localStorage.getItem('hadmin_install_dismissed')==='1';}catch(_){}
  if(!iOS||standalone||dismissed)return;
  $('install-text').hidden=true;$('ios-text').hidden=false;
  $('install-btn').hidden=true;$('dismiss-install').textContent='Got it';
  setTimeout(()=>{$('install-banner').hidden=false;},20000);
})();

// ---------------- Init ----------------
fillTopicSelect($('topic-select'));
fillTopicSelect($('timer-topic'),{smart:false});
buildCalc();renderWS();renderShop();loadFC();
rollDay();applySettings();save();
newQuestion();
route();
