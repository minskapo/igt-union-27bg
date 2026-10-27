/* 공유본 화면 동작: 탭과 목차, 조문 참조 미리보기, 실무교섭 기록, 인쇄, 입장 암호 */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var store={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
var K={gate:'imdan27share_gate',sec:'imdan27share_sec',round:'imdan27share_round'};
var SB=null;

function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove('on');},2400);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function when(iso){var d=new Date(iso);return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function hex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return ('0'+b.toString(16)).slice(-2);}).join('');}
function sha256(s){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(hex);}

/* ---------- 탭 ---------- */
function showTab(id,noScroll){
 $$('nav.tabs button').forEach(function(b){b.setAttribute('aria-selected',b.dataset.p===id?'true':'false');});
 $$('.pane').forEach(function(p){p.classList.toggle('on',p.id===id);});
 $$('aside .tg').forEach(function(g){g.classList.toggle('on',g.dataset.p===id);});
 $('#wrap').classList.toggle('solo',id==='p-in');
 $('#sfilt').classList.toggle('hide',!(id==='p-d'||id==='p-w'));
 if(id==='p-d'||id==='p-w')applyFilter();
 if(!noScroll)window.scrollTo(0,0);
}
$$('nav.tabs button').forEach(function(b){b.addEventListener('click',function(){showTab(b.dataset.p);history.replaceState(null,'',location.pathname+location.search);});});
$$('[data-tab]').forEach(function(b){b.addEventListener('click',function(){showTab(b.dataset.tab);});});

function go(id,push){
 var el=document.getElementById(id);if(!el)return;
 var pane=el.closest('.pane');if(pane&&!pane.classList.contains('on'))showTab(pane.id,true);
 var rd=el.closest('.rdoc');if(rd&&!rd.classList.contains('on'))showRule(rd.id);
 var tcb=$('.tc-a[data-go="'+id+'"]');if(tcb){var box=tcb.closest('.tc');if(box)box.classList.add('open');}
 requestAnimationFrame(function(){el.scrollIntoView({block:'start'});});
 if(push!==false)history.replaceState(null,'','#'+id);
}
document.addEventListener('click',function(e){
 var a=e.target.closest('a[href^="#"]');if(!a)return;
 var id=decodeURIComponent(a.getAttribute('href').slice(1));if(!id||!document.getElementById(id))return;
 e.preventDefault();hideTip();go(id);
});
$$('.tc-h').forEach(function(h){if(h.tagName==='BUTTON')h.addEventListener('click',function(){h.parentElement.classList.toggle('open');});});

/* 현행 규정 문서 전환 */
function showRule(id){
 $$('.rbtn').forEach(function(x){x.classList.toggle('on',x.dataset.r===id);});
 $$('.rdoc').forEach(function(d){d.classList.toggle('on',d.id===id);});
}
$$('.rbtn').forEach(function(b){b.addEventListener('click',function(){showRule(b.dataset.r);window.scrollTo(0,0);});});

/* 지금 읽는 조문을 목차에 표시 */
var io=new IntersectionObserver(function(es){es.forEach(function(en){
 if(!en.isIntersecting)return;
 var id=en.target.id;$$('.tc-a.here').forEach(function(a){a.classList.remove('here');});
 var a=$('.tc-a[data-go="'+id+'"]');if(!a)return;a.classList.add('here');
 var b=a.closest('.tc');if(b)b.classList.add('open');
 if(window.matchMedia('(min-width:901px)').matches)a.scrollIntoView({block:'nearest'});
});},{rootMargin:'-90px 0px -70% 0px'});
$$('.art,.ap').forEach(function(s){io.observe(s);});

/* 찾기 */
var qT;
$('#q').addEventListener('input',function(){clearTimeout(qT);qT=setTimeout(function(){applyFilter();},120);});

/* ---------- 조문 참조 미리보기 ---------- */
var tip=$('#tip');
function showTip(a){
 var r=REF[a.dataset.r];if(!r)return;
 var k=a.dataset.r,more=k.indexOf('L|')===0?'누르면 국가법령정보센터에서 엽니다':(k.indexOf('R|charter')===0?'':'누르면 해당 조문으로 이동합니다');
 /* 화면에 들어갈 만큼만 보여 주고, 넘치면 이하 생략을 표시합니다 */
 var budget=Math.max(500,Math.floor(innerHeight*innerWidth/1500)),used=0,shown=[],cut=false;
 for(var i=0;i<r.b.length;i++){var x=r.b[i];if(used+x.length>budget&&shown.length){cut=true;break;}shown.push(x);used+=x.length;}
 tip.innerHTML='<b>'+esc(r.t)+'</b>'+shown.map(function(x){return '<p>'+esc(x)+'</p>';}).join('')+(cut?'<p class="more">… 이하 생략</p>':'')+
  ((r.src||more)?'<small>'+esc([r.src,more].filter(Boolean).join(' · '))+'</small>':'');
 tip.classList.add('on');
 var b=a.getBoundingClientRect(),t=tip.getBoundingClientRect();
 var x=Math.min(Math.max(10,b.left),innerWidth-t.width-10),y=b.bottom+8;
 if(y+t.height>innerHeight-10)y=Math.max(10,b.top-t.height-8);
 tip.style.left=x+'px';tip.style.top=y+'px';
}
function hideTip(){tip.classList.remove('on');}
document.addEventListener('mouseover',function(e){var a=e.target.closest('.ref');if(a)showTip(a);});
document.addEventListener('mouseout',function(e){if(e.target.closest('.ref'))hideTip();});
document.addEventListener('focusin',function(e){var a=e.target.closest('.ref');if(a)showTip(a);});
document.addEventListener('focusout',hideTip);
document.addEventListener('keydown',function(e){if(e.key==='Escape'){hideTip();closeDlg();}});
window.addEventListener('scroll',hideTip,{passive:true});

/* ---------- 대화상자 ---------- */
function openDlg(id){$('#'+id).classList.add('on');var f=$('#'+id+' input');if(f)f.focus();}
function closeDlg(){$$('.dlg.on').forEach(function(d){d.classList.remove('on');});}
$$('.dlg [data-close]').forEach(function(b){b.addEventListener('click',closeDlg);});
$$('.dlg').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d)closeDlg();});});

/* ---------- 실무교섭 기록 ----------
   회차(rounds)마다 조문별 기록과 기타 안건을 minutes 테이블에 둡니다.
   쓰기는 간사 암호를 서버 함수에서 확인한 뒤에만 이루어지며, 칸마다 따로 저장해 두 간사가 동시에 적어도 서로 덮어쓰지 않습니다. */
var STATUS=[
 {v:'합의',c:'ok'},{v:'수정 합의',c:'ok'},{v:'계속 논의',c:'wait'},{v:'검토 후 회신',c:'wait'},
 {v:'쟁점',c:'hot'},{v:'참여형 회부',c:'up'},{v:'본교섭 회부',c:'up'},{v:'철회',c:'off'}];
var SCLS={};STATUS.forEach(function(s){SCLS[s.v]=s.c;});
var FILTERS=[['all','전체'],['cur','이번 회차'],['none','기록 없음'],['ok','합의'],['wait','논의 중'],['hot','쟁점·회부']];
var FLT='all';
var ROUNDS=[], MIN=[], CUR=store.get(K.round)||'';
var SEC=null;try{SEC=JSON.parse(store.get(K.sec)||'null');}catch(e){SEC=null;}
var OPEN={};          /* 이번 회차 기록란을 펼친 조문 */
var PEERS={};         /* 다른 간사가 지금 입력 중인 칸: fid -> [{side,name}] */
var CH=null, MY_FID='', LIVE=false;
var SIDE={u:'노측',i:'사측'};

function rLabel(r){return r?('제'+r.no+'차 '+(r.kind==='본'?'본교섭':'실무교섭')):'';}
function rTitle(r){return '2027 임금·단체교섭 '+rLabel(r);}
function rOrder(a,b){
 var da=a.held_on||'9999',db=b.held_on||'9999';if(da!==db)return da<db?-1:1;
 if(a.kind!==b.kind)return a.kind==='본'?-1:1;return a.no-b.no;}
function curRound(){return ROUNDS.filter(function(r){return r.id===CUR;})[0]||null;}
function dateKo(d){if(!d)return '';var x=new Date(d+'T00:00:00');return x.getFullYear()+'. '+(x.getMonth()+1)+'. '+x.getDate()+'.('+'일월화수목금토'[x.getDay()]+')';}
function whoTag(t){if(!t)return '';var i=t.indexOf(':');var s=t.slice(0,i),n=t.slice(i+1);return '<span class="who-'+s+'">'+esc(SIDE[s]||'')+' '+esc(n)+'</span>';}
function clock(iso){var d=new Date(iso);return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function artRow(rid,k){for(var i=0;i<MIN.length;i++){var m=MIN[i];if(m.kind==='art'&&m.round_id===rid&&m.article_key===k)return m;}return null;}
function agendaOf(rid){return MIN.filter(function(m){return m.kind==='agenda'&&m.round_id===rid;}).sort(function(a,b){return a.ord-b.ord;});}
function artsOf(rid){return MIN.filter(function(m){return m.kind==='art'&&m.round_id===rid;});}
function roundById(id){return ROUNDS.filter(function(r){return r.id===id;})[0];}
function latest(k){ /* 가장 최근 회차에서 상태가 정해진 기록 */
 var best=null;ROUNDS.forEach(function(r){var m=artRow(r.id,k);if(m&&m.status)best=m;});return best;}
function hasAny(k){return MIN.some(function(m){return m.kind==='art'&&m.article_key===k;});}
function artTitle(k){return REF[k]?REF[k].t.replace(/^(단체협약|임금협약) /,''):k;}
function artGroup(k){return k.indexOf('w-')===0?'임금협약':'단체협약';}
function keyOrder(){if(!keyOrder.c)keyOrder.c=$$('.art').map(function(a){return a.id;});return keyOrder.c;}
function lines(t){return String(t||'').split('\n').filter(function(x){return x.trim();});}
function chip(st){return st?'<span class="sc '+(SCLS[st]||'')+'">'+esc(st)+'</span>':'';}

/* ---- 불러오기 ---- */
function load(){
 if(!SB)return Promise.resolve();
 if(Object.keys(PEND).length)return Promise.resolve();
 return Promise.all([
  SB.from('rounds').select('*').order('created_at',{ascending:true}),
  SB.from('minutes').select('*').order('created_at',{ascending:true}).range(0,9999)
 ]).then(function(rs){
  if(rs[0].error||rs[1].error){toast('기록을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.');return;}
  ROUNDS=(rs[0].data||[]).sort(rOrder);MIN=rs[1].data||[];
  if(!curRound()&&ROUNDS.length){CUR=ROUNDS[ROUNDS.length-1].id;store.set(K.round,CUR);}
  paintAllRec();paintRounds();
 });
}

/* ---- 조문 기록란 ---- */
function fieldBox(fid,label,val,cls,ph){
 return '<label class="fd '+(cls||'')+'"><span class="fl">'+label+'<i class="busy" data-busy="'+fid+'"></i><i class="sv" data-sv="'+fid+'"></i></span>'+
  '<textarea data-fid="'+fid+'" rows="2" placeholder="'+esc(ph||'')+'">'+esc(val||'')+'</textarea></label>';
}
function speakerBar(rid,fid){
 var r=roundById(rid);var names=[];
 if(r){['u','i'].forEach(function(s){lines((r['att_'+s]||'').replace(/,/g,'\n')).forEach(function(n){
  n=n.replace(/\([^)]*\)/g,'').trim();if(n)names.push({s:s,n:n});});});}
 if(!names.length)names=[{s:'u',n:'노측'},{s:'i',n:'사측'}];
 return '<div class="spk" data-for="'+fid+'">'+names.map(function(x){
  return '<button type="button" class="sp-'+x.s+'" data-spk="'+esc(x.n)+'">'+esc(x.n)+'</button>';}).join('')+
  '<button type="button" class="sp-sub" data-spk="" title="앞 발언에 딸린 응답으로 들여 씁니다">↳ 응답</button></div>';
}
function statusBar(fid,cur){
 return '<div class="stbar" data-sfid="'+fid+'">'+STATUS.map(function(s){
  return '<button type="button" class="sc '+s.c+(cur===s.v?' on':'')+'" data-stv="'+esc(s.v)+'" aria-pressed="'+(cur===s.v)+'">'+esc(s.v)+'</button>';}).join('')+'</div>';
}
function viewRec(m,r,withRound){
 var o=['<div class="rv">'];
 if(withRound)o.push('<div class="rv-h"><b>'+esc(rLabel(r))+'</b>'+(r&&r.held_on?'<span>'+esc(dateKo(r.held_on))+'</span>':'')+chip(m.status)+'</div>');
 else if(m.status)o.push('<div class="rv-h">'+chip(m.status)+'</div>');
 if(m.union_pos||m.inst_pos)o.push('<div class="rv-pos">'+(m.union_pos?'<div class="pu"><span>노측</span><p>'+esc(m.union_pos)+'</p></div>':'')+(m.inst_pos?'<div class="pi"><span>사측</span><p>'+esc(m.inst_pos)+'</p></div>':'')+'</div>');
 if(m.progress)o.push('<div class="rv-pg"><span>논의경과</span><p>'+esc(m.progress)+'</p></div>');
 if(m.result)o.push('<div class="rv-rs"><span>회의결과</span><p>'+esc(m.result)+'</p></div>');
 o.push('</div>');return o.join('');
}
function paintRec(k){
 var box=$('[data-rec="'+k+'"]');if(!box)return;
 var r=curRound(),m=r?artRow(r.id,k):null;
 var past=ROUNDS.filter(function(x){return (!r||x.id!==r.id)&&artRow(x.id,k);}).reverse();
 /* 입력 중인 칸이 있으면 통째로 다시 그리지 않고 다른 칸만 맞춥니다 */
 if(box.contains(document.activeElement)&&document.activeElement.dataset.fid){syncFields(box,m);paintHead(k);return;}
 var o=[];
 o.push('<div class="rec-h"><b>실무교섭 기록</b>');
 if(r)o.push('<span class="rn">'+esc(rLabel(r))+'</span>');
 if(m)o.push('<span class="meta">'+whoTag(m.updated_by)+' · '+clock(m.updated_at)+'</span>');
 o.push('</div>');
 if(!r){o.push('<p class="rec-empty">아직 만든 회차가 없습니다. 머리의 회차 선택에서 회차를 만들어 주세요.</p>');}
 else if(SEC&&(m||OPEN[k])){
  var p='a|'+r.id+'|'+k+'|';
  o.push('<div class="rec-ed">');
  o.push('<div class="pos2">'+fieldBox(p+'union_pos','노측 입장',m&&m.union_pos,'fu','노측 의견, 수정 제안')+fieldBox(p+'inst_pos','사측 입장',m&&m.inst_pos,'fi','사측 검토 의견, 수정 제안')+'</div>');
  o.push(fieldBox(p+'progress','논의경과',m&&m.progress,'fp','발언자 단추를 누르면 줄머리에 이름이 들어갑니다')+speakerBar(r.id,p+'progress'));
  o.push(fieldBox(p+'result','회의결과',m&&m.result,'fr','결론을 문장으로 적어 주세요. 예: 현행 관행을 문서화한 조항으로 보아 원안대로 합의했다.'));
  o.push('<div class="fd"><span class="fl">처리 상태<i class="sv" data-sv="'+p+'status"></i></span>'+statusBar(p+'status',m&&m.status)+'</div>');
  o.push('</div>');
 }else if(m){o.push(viewRec(m,r,false));}
 else if(SEC){o.push('<button type="button" class="rec-open" data-open="'+k+'">'+esc(rLabel(r))+' 기록 쓰기</button>');}
 else{o.push('<p class="rec-empty">'+esc(rLabel(r))+'에서 아직 기록하지 않았습니다.</p>');}
 if(past.length){
  o.push('<details class="past"><summary>이전 회차 기록 '+past.length+'건</summary>'+past.map(function(x){return viewRec(artRow(x.id,k),x,true);}).join('')+'</details>');
 }
 /* 인쇄용: 모든 회차 기록 */
 var all=ROUNDS.filter(function(x){return artRow(x.id,k);});
 o.push('<div class="rec-all">'+all.map(function(x){return viewRec(artRow(x.id,k),x,true);}).join('')+'</div>');
 box.innerHTML=o.join('');
 box.classList.toggle('has',all.length>0);
 $$('textarea',box).forEach(grow);
 paintBusy(box);paintHead(k);
}
function syncFields(box,m){
 $$('textarea[data-fid]',box).forEach(function(t){
  var f=t.dataset.fid.split('|').pop(),v=(m&&m[f])||'';
  if(t===document.activeElement){if(v!==t.value&&!PEND[t.dataset.fid]&&m&&m.updated_by&&m.updated_by.charAt(0)!==SEC.side)warnStale(t,v);return;}
  if(t.value!==v){t.value=v;grow(t);}
 });
 $$('.stbar',box).forEach(function(b){var cur=(m&&m.status)||'';$$('button',b).forEach(function(x){var on=x.dataset.stv===cur;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});});
}
function warnStale(t,v){
 var lab=t.closest('.fd');if(!lab||lab.querySelector('.stale'))return;
 var d=document.createElement('div');d.className='stale';
 d.innerHTML='상대 간사가 이 칸을 고쳤습니다. <button type="button">상대 내용 보기</button>';
 d.querySelector('button').addEventListener('click',function(){
  if(confirm('지금 칸에 적은 내용 대신 상대 간사가 저장한 내용을 불러올까요?\n\n'+v)){t.value=v;grow(t);}d.remove();});
 lab.appendChild(d);
}
function paintHead(k){
 var L=latest(k),st=$('[data-st="'+k+'"]');
 if(st)st.innerHTML=L?chip(L.status):'';
 var d=$('[data-tst="'+k+'"]');if(d){d.className='sd'+(L?' on '+(SCLS[L.status]||''):(hasAny(k)?' on rec':''));d.title=L?L.status:(hasAny(k)?'기록 있음':'');}
}
function paintAllRec(){$$('[data-rec]').forEach(function(b){paintRec(b.dataset.rec);});applyFilter();paintRoundBtn();}
function grow(t){t.style.height='auto';t.style.height=Math.min(t.scrollHeight+2,520)+'px';}

/* ---- 거르기(낱말 + 논의 상태) ---- */
$('#sfilt').innerHTML=FILTERS.map(function(f){return '<button type="button" data-flt="'+f[0]+'"'+(f[0]==='all'?' class="on"':'')+'>'+f[1]+'</button>';}).join('');
$('#sfilt').addEventListener('click',function(e){var b=e.target.closest('[data-flt]');if(!b)return;FLT=b.dataset.flt;
 $$('#sfilt button').forEach(function(x){x.classList.toggle('on',x===b);});applyFilter();});
function fltHit(k){
 if(FLT==='all')return true;
 var r=curRound();
 if(FLT==='cur')return !!(r&&artRow(r.id,k));
 if(FLT==='none')return !hasAny(k);
 var L=latest(k);if(!L)return false;var c=SCLS[L.status];
 if(FLT==='hot')return c==='hot'||c==='up';
 return c===FLT;
}
function applyFilter(){
 var pane=$('.pane.on');if(!pane)return;var v=$('#q').value.trim();
 var isArt=pane.id==='p-d'||pane.id==='p-w';
 $$('.art,.ap',pane).forEach(function(s){
  var hit=(!v||s.textContent.indexOf(v)>=0)&&(!isArt||!s.classList.contains('art')||fltHit(s.id));
  s.classList.toggle('dim',!hit);});
 var on=!!v||(isArt&&FLT!=='all');
 $$('.chap,.sect',pane).forEach(function(c){c.classList.toggle('dim',on);});
 $$('aside .tg.on .tc-a').forEach(function(a){var k=a.dataset.go;a.classList.toggle('fade',isArt&&FLT!=='all'&&!fltHit(k));});
}

/* ---- 저장 ---- */
var PEND={},TIMERS={};
function rpc(fn,args){
 if(!SEC)return Promise.reject(new Error('login'));
 args.p_key=SEC.key;args.p_name=SEC.name;
 return SB.rpc(fn,args).then(function(r){
  if(r.error){if(r.error.code==='42501'){toast('간사 암호가 바뀌었거나 맞지 않습니다. 다시 로그인해 주세요.');logout();}throw r.error;}
  return r.data;});
}
function setSv(fid,t){$$('[data-sv="'+fid+'"]').forEach(function(x){x.textContent=t;x.className='sv'+(t==='저장 실패'?' bad':'');});}
function localApply(fid,v){
 var p=fid.split('|'),f=p[p.length-1],tag=SEC.side+':'+SEC.name,now=new Date().toISOString();
 if(p[0]==='a'){var m=artRow(p[1],p[2]);
  if(!m){m={id:'tmp-'+p[1]+p[2],kind:'art',round_id:p[1],article_key:p[2],union_pos:'',inst_pos:'',progress:'',result:'',status:''};MIN.push(m);}
  m[f]=v;m.updated_by=tag;m.updated_at=now;
  if(!m.union_pos&&!m.inst_pos&&!m.progress&&!m.result&&!m.status)MIN=MIN.filter(function(x){return x!==m;});
 }else if(p[0]==='g'){MIN.forEach(function(m){if(m.id===p[1]){m[f]=v;m.updated_by=tag;m.updated_at=now;}});}
 else if(p[0]==='r'){ROUNDS.forEach(function(r){if(r.id===p[1]){r[f]=(f==='no'?parseInt(v,10):v);r.updated_by=tag;r.updated_at=now;}});}
}
function save(fid,v){
 var p=fid.split('|'),f=p[p.length-1],q;
 PEND[fid]=v;setSv(fid,'저장 중…');localApply(fid,v);
 if(p[0]==='a')q=rpc('art_set',{p_round:p[1],p_article:p[2],p_field:f,p_value:v});
 else if(p[0]==='g')q=rpc('agenda_set',{p_id:p[1],p_field:f,p_value:v});
 else q=rpc('round_set',{p_id:p[1],p_field:f,p_value:v});
 return q.then(function(){if(PEND[fid]===v)delete PEND[fid];setSv(fid,'저장됨');
  setTimeout(function(){if(!PEND[fid])setSv(fid,'');},1800);
  if(p[0]==='a'){paintHead(p[2]);if(document.activeElement.dataset.fid!==fid)paintRec(p[2]);}
  if(p[0]!=='a'||$('#p-m').classList.contains('on'))paintRoundsSoft();
 }).catch(function(){setSv(fid,'저장 실패');toast('저장하지 못했습니다. 연결을 확인해 주세요.');});
}
function queue(fid,v,now){
 clearTimeout(TIMERS[fid]);
 if(now){save(fid,v);return;}
 setSv(fid,'입력 중');TIMERS[fid]=setTimeout(function(){save(fid,v);},700);
}
document.addEventListener('input',function(e){
 var t=e.target;if(!t.dataset||!t.dataset.fid||!SEC)return;
 if(t.tagName==='TEXTAREA')grow(t);
 queue(t.dataset.fid,t.value);
});
document.addEventListener('change',function(e){
 var t=e.target;if(!t.dataset||!t.dataset.fid||!SEC)return;
 if(t.tagName!=='TEXTAREA')queue(t.dataset.fid,t.value,true);
});
document.addEventListener('focusin',function(e){var t=e.target;if(t.dataset&&t.dataset.fid)setFocus(t.dataset.fid);});
document.addEventListener('focusout',function(e){
 var t=e.target;if(!t.dataset||!t.dataset.fid)return;
 if(TIMERS[t.dataset.fid]&&SEC){clearTimeout(TIMERS[t.dataset.fid]);delete TIMERS[t.dataset.fid];save(t.dataset.fid,t.value);}
 var st=t.closest('.fd')&&t.closest('.fd').querySelector('.stale');if(st)st.remove();
 setTimeout(function(){if(!document.activeElement||!document.activeElement.dataset||!document.activeElement.dataset.fid)setFocus('');},50);
});
document.addEventListener('click',function(e){
 var op=e.target.closest('[data-open]');
 if(op){var k=op.dataset.open;OPEN[k]=1;paintRec(k);var t=$('[data-rec="'+k+'"] textarea');if(t)t.focus();return;}
 var sb=e.target.closest('[data-stv]');
 if(sb&&SEC){var bar=sb.closest('[data-sfid]'),fid=bar.dataset.sfid,v=sb.classList.contains('on')?'':sb.dataset.stv;
  $$('button',bar).forEach(function(x){var on=x===sb&&v!=='';x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});
  queue(fid,v,true);return;}
 var sp=e.target.closest('[data-spk]');
 if(sp){var fid2=sp.closest('.spk').dataset.for,ta=$('textarea[data-fid="'+fid2+'"]');if(!ta)return;
  var pre=sp.dataset.spk?'('+sp.dataset.spk+') ':'  ↳ ';
  var s=ta.selectionStart,before=ta.value.slice(0,s),after=ta.value.slice(ta.selectionEnd);
  var lead=(before&&!/\n$/.test(before))?'\n':'';
  ta.value=before+lead+pre+after;var pos=(before+lead+pre).length;ta.focus();ta.setSelectionRange(pos,pos);grow(ta);
  queue(fid2,ta.value);return;}
});

/* ---- 함께 접속한 간사 표시 ---- */
function setFocus(fid){if(fid===MY_FID)return;MY_FID=fid;if(CH&&SEC)CH.track({side:SEC.side,name:SEC.name,f:fid});}
function paintBusy(root){
 $$('[data-busy]',root||document).forEach(function(x){var ps=PEERS[x.dataset.busy];
  x.textContent=ps?ps.map(function(p){return SIDE[p.side]+' '+p.name+' 입력 중';}).join(', '):'';});
}
function paintPeers(state){
 PEERS={};var online=[];
 Object.keys(state).forEach(function(key){state[key].forEach(function(p){
  if(SEC&&p.side===SEC.side&&p.name===SEC.name&&key===CH._me)return;
  online.push(p);if(p.f)(PEERS[p.f]=PEERS[p.f]||[]).push(p);});});
 var el=$('#peers');
 if(el)el.innerHTML=online.length?online.map(function(p){return '<span class="pp '+p.side+'">'+esc(SIDE[p.side]+' '+p.name)+'</span>';}).join(''):'';
 paintBusy();
}
function subscribe(){
 if(!SB||CH)return;
 var me=Math.random().toString(36).slice(2);
 CH=SB.channel('minutes-live',{config:{presence:{key:me}}});CH._me=me;
 CH.on('postgres_changes',{event:'*',schema:'public',table:'minutes'},function(ev){
  var n=ev.new,o=ev.old;
  if(ev.eventType==='DELETE'){MIN=MIN.filter(function(m){return m.id!==o.id;});if(o.kind==='art')paintRec(o.article_key);}
  else{MIN=MIN.filter(function(m){return m.id!==n.id&&!(m.kind==='art'&&n.kind==='art'&&m.round_id===n.round_id&&m.article_key===n.article_key);});MIN.push(n);
   if(n.kind==='art')paintRec(n.article_key);}
  paintRoundsSoft();applyFilter();
 }).on('postgres_changes',{event:'*',schema:'public',table:'rounds'},function(ev){
  if(ev.eventType==='DELETE'){ROUNDS=ROUNDS.filter(function(r){return r.id!==ev.old.id;});MIN=MIN.filter(function(m){return m.round_id!==ev.old.id;});
   if(CUR===ev.old.id){CUR=ROUNDS.length?ROUNDS[ROUNDS.length-1].id:'';store.set(K.round,CUR);}paintAllRec();paintRounds();return;}
  ROUNDS=ROUNDS.filter(function(r){return r.id!==ev.new.id;});ROUNDS.push(ev.new);ROUNDS.sort(rOrder);
  if(!CUR){CUR=ev.new.id;store.set(K.round,CUR);}
  paintRoundBtn();paintRoundsSoft();
 }).on('presence',{event:'sync'},function(){paintPeers(CH.presenceState());})
 .subscribe(function(st){
  LIVE=st==='SUBSCRIBED';paintLive();
  if(st==='SUBSCRIBED'&&SEC)CH.track({side:SEC.side,name:SEC.name,f:MY_FID});
 });
}

/* ---- 간사 로그인 ---- */
function paintSec(){
 var b=$('#secBtn');
 b.innerHTML=SEC?'<span class="org '+SEC.side+'">'+SIDE[SEC.side]+' 간사</span>'+esc(SEC.name):'간사 로그인';
 document.body.classList.toggle('sec',!!SEC);
 $('#secOut').classList.toggle('hide',!SEC);
}
function logout(){SEC=null;store.set(K.sec,'');OPEN={};paintSec();paintAllRec();paintRounds();if(CH)CH.untrack();}
$('#secBtn').addEventListener('click',function(){$('#secName').value=SEC?SEC.name:'';$('#secKey').value='';$('#secErr').textContent='';openDlg('secDlg');});
$('#secOut').addEventListener('click',function(){logout();closeDlg();toast('로그아웃했습니다');});
$('#secForm').addEventListener('submit',function(e){
 e.preventDefault();
 var n=$('#secName').value.trim(),k=$('#secKey').value;
 if(!n){$('#secErr').textContent='이름과 직함을 적어 주세요.';return;}
 if(!SB){$('#secErr').textContent='저장소에 연결하지 못했습니다.';return;}
 SB.rpc('sec_whoami',{p_key:k}).then(function(r){
  if(r.error||!r.data){$('#secErr').textContent='간사 암호가 맞지 않습니다.';return;}
  SEC={key:k,side:r.data,name:n};store.set(K.sec,JSON.stringify(SEC));closeDlg();paintSec();paintAllRec();paintRounds();
  if(CH)CH.track({side:SEC.side,name:SEC.name,f:''});
  toast(SIDE[SEC.side]+' 간사로 로그인했습니다');
 });
});

/* ---- 회차 선택 ---- */
function paintRoundBtn(){
 var r=curRound(),b=$('#roundBtn');
 b.innerHTML='<i class="live off" id="live"></i>'+(r?esc(rLabel(r))+(r.held_on?' <small>'+esc(dateKo(r.held_on))+'</small>':''):'회차 없음');
 paintLive();
}
function paintLive(){var d=$('#live');if(!d)return;d.className='live '+(LIVE?'on':'off');d.title=LIVE?'실시간 연결됨':'실시간 연결 끊김. 30초마다 다시 불러옵니다.';}
function pickRound(id){CUR=id;store.set(K.round,id);OPEN={};paintAllRec();paintRounds();}
function paintRndList(){
 $('#rndList').innerHTML=ROUNDS.length?ROUNDS.slice().reverse().map(function(r){
  var n=artsOf(r.id).length,g=agendaOf(r.id).length;
  return '<button type="button" class="'+(r.id===CUR?'on':'')+'" data-pick="'+r.id+'"><b>'+esc(rLabel(r))+'</b><span>'+esc(dateKo(r.held_on)||'일자 미정')+' · 조문 '+n+' · 안건 '+g+'</span></button>';}).join('')
  :'<p class="rec-empty">아직 회차가 없습니다.</p>';
 $('#rndNew').classList.toggle('hide',!SEC);
}
$('#roundBtn').addEventListener('click',function(){
 paintRndList();var f=$('#rndNew');
 var mx=0;ROUNDS.forEach(function(r){if(r.kind===f.kind.value&&r.no>mx)mx=r.no;});f.no.value=mx+1;
 var d=new Date();f.held_on.value=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
 $('#rndErr').textContent='';openDlg('rndDlg');
});
$('#rndNew').kind.addEventListener('change',function(){var f=$('#rndNew'),mx=0;ROUNDS.forEach(function(r){if(r.kind===f.kind.value&&r.no>mx)mx=r.no;});f.no.value=mx+1;});
$('#rndList').addEventListener('click',function(e){var b=e.target.closest('[data-pick]');if(!b)return;pickRound(b.dataset.pick);closeDlg();toast(rLabel(curRound())+' 기록으로 바꿨습니다');});
$('#rndNew').addEventListener('submit',function(e){
 e.preventDefault();var f=e.target;
 rpc('round_create',{p_kind:f.kind.value,p_no:parseInt(f.no.value,10),p_held_on:f.held_on.value||null}).then(function(id){
  return load().then(function(){pickRound(id);closeDlg();toast(rLabel(curRound())+'를 만들었습니다');});
 }).catch(function(err){$('#rndErr').textContent=(err&&err.code==='23505')?'같은 회차가 이미 있습니다.':'만들지 못했습니다.';});
});

/* ---- 실무교섭 기록 탭 ---- */
function inp(fid,val,ph,type){return '<input data-fid="'+fid+'" type="'+(type||'text')+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'">';}
function paintRounds(){
 var root=$('#mroot');if(!root)return;
 if(root.contains(document.activeElement)&&document.activeElement.dataset&&document.activeElement.dataset.fid){paintRoundsSoft();return;}
 var r=curRound(),ed=!!SEC,o=[];
 $('#mtoc').innerHTML='<div class="tc-s">회차</div>'+ROUNDS.slice().reverse().map(function(x){
  return '<button type="button" class="rbtn'+(x.id===CUR?' on':'')+'" data-pick="'+x.id+'">'+esc(rLabel(x))+'<small>'+esc(dateKo(x.held_on))+'</small></button>';}).join('')+
  (r?'<div class="tc-s">이 회차</div><a class="tc-a" href="#m-meta"><span>개요</span></a><a class="tc-a" href="#m-sum"><span>요약</span></a><a class="tc-a" href="#m-ag"><span>회의결과 · 기타 안건</span></a><a class="tc-a" href="#m-art"><span>회의결과 · 조문 검토</span></a><a class="tc-a" href="#m-next"><span>향후일정 · 붙임</span></a><a class="tc-a" href="#m-out"><span>회의록 초안</span></a><a class="tc-a" href="#m-all"><span>전체 조문 진행 현황</span></a>':'');
 if(!r){
  root.innerHTML='<div class="guide"><h2>실무교섭 기록</h2><p>노사 간사가 회의 중에 각자 노트북에서 이 화면을 열고 회의결과와 논의경과를 함께 적는 공간입니다. 적은 내용은 바로 저장되고 상대 화면에도 곧바로 나타납니다.</p>'+
   '<p>'+(ed?'머리의 회차 선택에서 첫 회차를 만들어 주세요.':'간사 로그인을 하면 회차를 만들고 기록할 수 있습니다.')+'</p></div>';return;}
 var P='r|'+r.id+'|';
 o.push('<div class="mhead"><div><p class="kicker">교섭회의록 작성 화면</p><h2>'+esc(rTitle(r))+'</h2></div><div class="peers" id="peers"></div></div>');
 /* 개요 */
 o.push('<section class="mcard" id="m-meta"><h3>개요</h3>');
 if(ed){
  o.push('<div class="mgrid"><label class="fd"><span class="fl">구분</span><select data-fid="'+P+'kind"><option value="실무"'+(r.kind==='실무'?' selected':'')+'>실무교섭</option><option value="본"'+(r.kind==='본'?' selected':'')+'>본교섭</option></select></label>'+
   '<label class="fd"><span class="fl">차수<i class="sv" data-sv="'+P+'no"></i></span>'+inp(P+'no',r.no,'','number')+'</label>'+
   '<label class="fd"><span class="fl">일자<i class="sv" data-sv="'+P+'held_on"></i></span>'+inp(P+'held_on',r.held_on,'','date')+'</label>'+
   '<label class="fd"><span class="fl">시각<i class="sv" data-sv="'+P+'held_time"></i></span>'+inp(P+'held_time',r.held_time,'예: 오전 10시')+'</label>'+
   '<label class="fd wide"><span class="fl">장소<i class="sv" data-sv="'+P+'place"></i></span>'+inp(P+'place',r.place,'')+'</label></div>');
  o.push('<div class="pos2">'+fieldBox(P+'att_u','노측 참석',r.att_u,'fu','한 줄에 한 사람씩. 예: 김민석 사무처장(간사)')+fieldBox(P+'att_i','사측 참석',r.att_i,'fi','예: 장주영 운영기획팀장(간사)')+'</div>');
 }else{
  o.push('<dl class="mdl"><dt>일시</dt><dd>'+esc(dateKo(r.held_on)+' '+(r.held_time||''))+'</dd><dt>장소</dt><dd>'+esc(r.place||'')+'</dd><dt>노측</dt><dd>'+esc(lines(r.att_u).join(', '))+'</dd><dt>사측</dt><dd>'+esc(lines(r.att_i).join(', '))+'</dd></dl>');
 }
 o.push('</section>');
 /* 요약 */
 o.push('<section class="mcard" id="m-sum"><h3>요약</h3>'+(ed?fieldBox(P+'summary','요약 (한 줄에 한 항목)',r.summary,'fr','회의 결과를 한 줄씩 정리합니다. 회의가 끝난 뒤 함께 다듬어도 됩니다.'):'<div class="rv"><p>'+esc(r.summary||'')+'</p></div>')+'</section>');
 /* 기타 안건 */
 o.push('<section class="mcard" id="m-ag"><h3>회의결과 · 기타 안건<span class="sub">조문 축조심의 밖의 논의 (회의록 작성 방식, 교섭 운영, 쟁점 처리 절차 등)</span></h3><div id="agList">'+agendaHtml(r,ed)+'</div>'+
  (ed?'<form class="agadd" id="agAdd"><input name="t" placeholder="새 안건 제목 (예: 실무교섭 운영)" aria-label="새 안건 제목"><button type="submit">안건 추가</button></form>':'')+'</section>');
 /* 조문 검토 */
 o.push('<section class="mcard" id="m-art"><h3>회의결과 · 조문 검토<span class="sub">이 회차에 기록한 조문입니다. 내용은 각 조문 카드의 기록란에서 적습니다.</span></h3><div id="artList">'+artListHtml(r)+'</div></section>');
 /* 향후일정·붙임 */
 o.push('<section class="mcard" id="m-next"><h3>향후일정 및 후속조치 · 붙임</h3>'+(ed?fieldBox(P+'next_steps','향후일정 및 후속조치 (한 줄에 한 항목)',r.next_steps,'fr','예: 사측: 10. 29.(목) 요구안에 대한 사측 입장 정리')+fieldBox(P+'attach','붙임 (한 줄에 한 항목, 링크 가능)',r.attach,'','파일 이름 또는 주소'):
  '<div class="rv"><div class="rv-pg"><span>향후일정</span><p>'+esc(r.next_steps||'')+'</p></div><div class="rv-pg"><span>붙임</span><p>'+esc(r.attach||'')+'</p></div></div>')+'</section>');
 /* 회의록 초안 */
 o.push('<section class="mcard" id="m-out"><h3>회의록 초안<span class="sub">구글 문서 회의록 양식(개요·요약·회의결과·향후일정·붙임)에 맞춘 초안입니다.</span></h3>'+
  '<div class="outbar"><button type="button" class="pbtn" id="cpDoc">구글 문서용으로 복사</button><button type="button" id="dlMd">Markdown 내려받기</button><span class="hint">복사한 뒤 구글 문서의 해당 회차 탭에 붙여 넣으면 제목과 글머리표가 유지됩니다.</span></div>'+
  '<div class="draft" id="draft">'+draftHtml(r)+'</div></section>');
 /* 전체 현황 */
 o.push('<section class="mcard" id="m-all"><h3>전체 조문 진행 현황<span class="sub">조문마다 가장 최근 회차의 처리 상태를 셉니다.</span></h3><div id="allStat">'+statHtml()+'</div></section>');
 if(ed)o.push('<div class="danger"><button type="button" id="rndDel">이 회차 지우기</button></div>');
 root.innerHTML=o.join('');
 $$('textarea',root).forEach(grow);paintBusy(root);
 var ag=$('#agAdd');if(ag)ag.addEventListener('submit',function(e){e.preventDefault();var t=ag.t.value.trim();
  rpc('agenda_add',{p_round:r.id,p_title:t}).then(function(id){ag.t.value='';return load().then(function(){var x=$('[data-fid="g|'+id+'|progress"]');if(x)x.focus();});}).catch(function(){toast('안건을 더하지 못했습니다.');});});
 var del=$('#rndDel');if(del)del.addEventListener('click',function(){
  if(!confirm(rLabel(r)+'를 지울까요? 이 회차의 조문 기록과 안건이 모두 지워지며 되돌릴 수 없습니다.'))return;
  rpc('round_delete',{p_id:r.id}).then(function(){toast('지웠습니다');CUR='';return load();});});
 $('#cpDoc').addEventListener('click',copyDraft);$('#dlMd').addEventListener('click',downloadMd);
}
function paintRoundsSoft(){ /* 입력 중에는 읽기 전용 영역만 새로 그립니다 */
 var r=curRound();if(!r||!$('#mroot'))return;
 if(!$('#draft')){paintRounds();return;}
 var al=$('#artList');if(al)al.innerHTML=artListHtml(r);
 var dr=$('#draft');if(dr)dr.innerHTML=draftHtml(r);
 var st=$('#allStat');if(st)st.innerHTML=statHtml();
 var root=$('#mroot');
 /* 다른 쪽에서 추가·삭제한 안건이 있으면 안건 목록만 다시 그립니다 */
 var ids=agendaOf(r.id).map(function(m){return m.id;}).join(),shown=$$('#agList [data-ag]').map(function(x){return x.dataset.ag;}).join();
 if(ids!==shown&&!($('#agList').contains(document.activeElement))){$('#agList').innerHTML=agendaHtml(r,!!SEC);$$('#agList textarea').forEach(grow);}
 else{agendaOf(r.id).forEach(function(m){var b=$('[data-ag="'+m.id+'"]');if(b)syncFields(b,m);});}
 var rm={};['kind','no','held_on','held_time','place','att_u','att_i','summary','next_steps','attach'].forEach(function(f){rm[f]=r[f]==null?'':String(r[f]);});
 $$('[data-fid^="r|'+r.id+'|"]',root).forEach(function(t){var f=t.dataset.fid.split('|').pop();
  if(t!==document.activeElement&&t.value!==rm[f]){t.value=rm[f];if(t.tagName==='TEXTAREA')grow(t);}});
 var h=$('.mhead h2');if(h)h.textContent=rTitle(r);
 paintBusy(root);
}
function agendaHtml(r,ed){
 var ag=agendaOf(r.id);
 if(!ag.length)return '<p class="rec-empty">아직 안건이 없습니다.</p>';
 return ag.map(function(m,i){
  var P='g|'+m.id+'|';
  if(!ed)return '<div class="agi" data-ag="'+m.id+'"><h4>안건 '+(i+1)+'. '+esc(m.title||'')+'</h4>'+viewRec(m,r,false)+'</div>';
  return '<div class="agi" data-ag="'+m.id+'"><div class="agh"><span class="agn">안건 '+(i+1)+'</span>'+inp(P+'title',m.title,'안건 제목')+
   '<span class="agm"><button type="button" data-agmv="-1" data-id="'+m.id+'" title="위로">↑</button><button type="button" data-agmv="1" data-id="'+m.id+'" title="아래로">↓</button><button type="button" class="del" data-agdel="'+m.id+'">지우기</button></span>'+
   '<span class="meta">'+whoTag(m.updated_by)+'</span></div>'+
   fieldBox(P+'progress','논의경과',m.progress,'fp','발언자 단추를 누르면 줄머리에 이름이 들어갑니다')+speakerBar(r.id,P+'progress')+
   fieldBox(P+'result','회의결과',m.result,'fr','결론 문장')+'</div>';
 }).join('');
}
document.addEventListener('click',function(e){
 var mv=e.target.closest('[data-agmv]');
 if(mv){rpc('agenda_move',{p_id:mv.dataset.id,p_dir:parseInt(mv.dataset.agmv,10)}).then(function(){return load();});return;}
 var dl=e.target.closest('[data-agdel]');
 if(dl){if(!confirm('이 안건을 지울까요?'))return;rpc('agenda_delete',{p_id:dl.dataset.agdel}).then(function(){MIN=MIN.filter(function(m){return m.id!==dl.dataset.agdel;});paintRounds();});return;}
 var pk=e.target.closest('#mtoc [data-pick]');if(pk){pickRound(pk.dataset.pick);window.scrollTo(0,0);}
});
function sortedArts(rid){var ord=keyOrder();return artsOf(rid).sort(function(a,b){return ord.indexOf(a.article_key)-ord.indexOf(b.article_key);});}
function artListHtml(r){
 var arts=sortedArts(r.id);
 if(!arts.length)return '<p class="rec-empty">아직 이 회차에 기록한 조문이 없습니다. 단체협약(안)·임금협약(안) 탭의 조문 카드에서 기록을 시작해 주세요.</p>';
 var cnt={};arts.forEach(function(m){var s=m.status||'상태 미정';cnt[s]=(cnt[s]||0)+1;});
 return '<div class="cnts">'+Object.keys(cnt).map(function(s){return (s==='상태 미정'?'<span class="sc">상태 미정</span>':chip(s))+'<b>'+cnt[s]+'</b>';}).join('')+'</div>'+
  '<table class="t alist"><thead><tr><th>조문</th><th>상태</th><th>회의결과</th></tr></thead><tbody>'+arts.map(function(m){
   return '<tr><td><a href="#'+m.article_key+'">'+esc(artGroup(m.article_key)+' '+artTitle(m.article_key))+'</a></td><td>'+chip(m.status)+'</td><td>'+esc(m.result||'')+'</td></tr>';}).join('')+'</tbody></table>';
}
function statHtml(){
 var keys=keyOrder(),c={none:0},bySt={};
 keys.forEach(function(k){var L=latest(k);if(L){bySt[L.status]=(bySt[L.status]||0)+1;}else if(hasAny(k))c.rec=(c.rec||0)+1;else c.none++;});
 var tot=keys.length,seg=[];
 STATUS.forEach(function(s){if(bySt[s.v])seg.push({n:bySt[s.v],c:s.c,t:s.v});});
 if(c.rec)seg.push({n:c.rec,c:'rec',t:'기록만 있음'});seg.push({n:c.none,c:'none',t:'기록 없음'});
 return '<div class="bar">'+seg.map(function(x){return '<i class="'+x.c+'" style="flex:'+x.n+'" title="'+esc(x.t)+' '+x.n+'"></i>';}).join('')+'</div>'+
  '<div class="cnts">'+seg.map(function(x){return '<span class="sc '+x.c+'">'+esc(x.t)+'</span><b>'+x.n+'</b>';}).join('')+'<span class="tot">전체 '+tot+'개 조문</span></div>';
}

/* ---- 회의록 초안 ---- */
function bullets(txt){ /* 줄 단위로 글머리표를 만들고, 들여 쓰거나 ↳로 시작한 줄은 앞 줄에 딸린 항목으로 둡니다 */
 var L=lines(txt);if(!L.length)return '';
 var o=['<ul>'],open=false;
 L.forEach(function(x){
  var sub=/^\s+|^↳/.test(x);x=x.replace(/^\s*(↳\s*)?([-*•]\s*)?/,'');
  if(sub){if(!open){o.push('<ul>');open=true;}o.push('<li>'+esc(x)+'</li>');}
  else{if(open){o.push('</ul>');open=false;}o.push('<li>'+esc(x)+'</li>');}
 });
 if(open)o.push('</ul>');o.push('</ul>');return o.join('');
}
function draftHtml(r){
 var me=SEC?SEC.name:'';
 var o=['<h1>교섭회의록</h1><h2>개요</h2>'];
 o.push('<table border="1" style="border-collapse:collapse"><tr><th>회의명</th><td colspan="2">'+esc(rTitle(r))+'</td><th>작성자</th><td colspan="2">'+esc(me)+'</td></tr>'+
  '<tr><th>일시</th><td colspan="2">'+esc((dateKo(r.held_on)+' '+(r.held_time||'')).trim())+'</td><th colspan="3">간사 확인란</th></tr>'+
  '<tr><th>장소</th><td colspan="2">'+esc(r.place||'')+'</td><th>노</th><th colspan="2">사</th></tr>'+
  '<tr><th rowspan="2">참석</th><th>노</th><td>'+esc(lines(r.att_u).join(', '))+'</td><td rowspan="2">(서명)</td><td rowspan="2" colspan="2">(서명)</td></tr>'+
  '<tr><th>사</th><td>'+esc(lines(r.att_i).join(', '))+'</td></tr></table>');
 o.push('<h2>요약</h2>'+(bullets(r.summary)||'<ul><li></li></ul>'));
 o.push('<h2>회의결과</h2>');
 var n=0;
 agendaOf(r.id).forEach(function(m){n++;o.push('<h3>안건 '+n+'. '+esc(m.title||'')+'</h3>'+bullets(m.progress)+(m.result?'<ul>'+lines(m.result).map(function(x){return '<li><b>'+esc(x)+'</b></li>';}).join('')+'</ul>':''));});
 var arts=sortedArts(r.id);
 if(arts.length){
  n++;o.push('<h3>안건 '+n+'. 조문 검토</h3>');
  arts.forEach(function(m){
   o.push('<h4>'+esc(artGroup(m.article_key)+' '+artTitle(m.article_key))+(m.status?' · '+esc(m.status):'')+'</h4>');
   var pos=[];if(m.union_pos)pos.push('(노측 입장) '+m.union_pos.replace(/\n+/g,' '));if(m.inst_pos)pos.push('(사측 입장) '+m.inst_pos.replace(/\n+/g,' '));
   o.push(bullets(pos.join('\n'))+bullets(m.progress)+(m.result?'<ul>'+lines(m.result).map(function(x){return '<li><b>'+esc(x)+'</b></li>';}).join('')+'</ul>':''));
  });
 }
 if(!n)o.push('<p>(기록한 안건이 없습니다)</p>');
 o.push('<h2>향후일정 및 후속조치</h2>'+(bullets(r.next_steps)||'<ul><li></li></ul>'));
 o.push('<h2>붙임</h2>'+(bullets(r.attach)||'<ul><li></li></ul>'));
 return o.join('');
}
function copyDraft(){
 var r=curRound();if(!r)return;var h=draftHtml(r),box=$('#draft');
 var txt=box?box.innerText:'';
 if(navigator.clipboard&&window.ClipboardItem){
  navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([h],{type:'text/html'}),'text/plain':new Blob([txt],{type:'text/plain'})})])
   .then(function(){toast('회의록 초안을 복사했습니다. 구글 문서에 붙여 넣어 주세요.');}).catch(fallback);
 }else fallback();
 function fallback(){var rg=document.createRange();rg.selectNodeContents(box);var s=getSelection();s.removeAllRanges();s.addRange(rg);
  try{document.execCommand('copy');toast('회의록 초안을 복사했습니다');}catch(e){toast('복사하지 못했습니다. 초안을 직접 선택해 복사해 주세요.');}s.removeAllRanges();}
}
function mdList(txt,pre){return lines(txt).map(function(x){var sub=/^\s+|^↳/.test(x);x=x.replace(/^\s*(↳\s*)?([-*•]\s*)?/,'');return (sub?'  ':'')+'- '+(pre||'')+x+(pre?pre:'');}).join('\n');}
function downloadMd(){
 var r=curRound();if(!r)return;var L=[];
 L.push('# 교섭회의록','','## 개요','','- 회의명: '+rTitle(r),'- 일시: '+(dateKo(r.held_on)+' '+(r.held_time||'')).trim(),'- 장소: '+(r.place||''),
  '- 참석(노): '+lines(r.att_u).join(', '),'- 참석(사): '+lines(r.att_i).join(', '),'- 작성자: '+(SEC?SEC.name:''),'','## 요약','',mdList(r.summary),'','## 회의결과','');
 var n=0;
 agendaOf(r.id).forEach(function(m){n++;L.push('### 안건 '+n+'. '+(m.title||''),'',mdList(m.progress),mdList(m.result,'**'),'');});
 var arts=sortedArts(r.id);
 if(arts.length){n++;L.push('### 안건 '+n+'. 조문 검토','');
  arts.forEach(function(m){L.push('#### '+artGroup(m.article_key)+' '+artTitle(m.article_key)+(m.status?' · '+m.status:''),'');
   if(m.union_pos)L.push('- (노측 입장) '+m.union_pos.replace(/\n+/g,' '));if(m.inst_pos)L.push('- (사측 입장) '+m.inst_pos.replace(/\n+/g,' '));
   L.push(mdList(m.progress),mdList(m.result,'**'),'');});}
 L.push('## 향후일정 및 후속조치','',mdList(r.next_steps),'','## 붙임','',mdList(r.attach),'');
 var blob=new Blob([L.join('\n').replace(/\n{3,}/g,'\n\n')],{type:'text/markdown;charset=utf-8'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='27_임단협_'+rLabel(r).replace(/\s/g,'_')+'_회의록초안.md';
 document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ---------- 인쇄 ---------- */
var openedForPrint=[];
$('#printBtn').addEventListener('click',function(){openDlg('prDlg');});
$('#prForm').addEventListener('submit',function(e){
 e.preventDefault();
 var all=$('#prForm input[name=scope]:checked').value==='all',cmt=$('#prForm input[name=cmt]').checked;
 document.body.classList.toggle('p-all',all);document.body.classList.toggle('p-cur',!all);
 document.body.classList.toggle('p-cmt',cmt);
 closeDlg();setTimeout(function(){window.print();},80);
});
window.addEventListener('beforeprint',function(){
 openedForPrint=$$('details:not([open])');openedForPrint.forEach(function(d){d.open=true;});
});
window.addEventListener('afterprint',function(){
 openedForPrint.forEach(function(d){d.open=false;});openedForPrint=[];
 document.body.classList.remove('p-all','p-cmt');document.body.classList.add('p-cur');
});

/* ---------- 시작 ---------- */
function start(){
 if(window.supabase&&CFG.sbUrl&&CFG.sbKey){SB=supabase.createClient(CFG.sbUrl,CFG.sbKey,{auth:{persistSession:false}});}
 load().then(subscribe);
 /* 실시간 연결이 끊겨도 놓치지 않도록 주기적으로 다시 불러옵니다(화면을 보고 있을 때만) */
 setInterval(function(){if(document.visibilityState==='visible')load();},30000);
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')load();});
 if(location.hash)go(decodeURIComponent(location.hash.slice(1)),false);
}
paintSec();paintRoundBtn();
/* 입장 암호: 화면을 가리는 가벼운 장치입니다. 페이지 소스를 열면 우회할 수 있습니다. */
if(!CFG.gate||store.get(K.gate)===CFG.gate){start();}
else{
 $('#gate').classList.add('on');$('#gateIn').focus();
 $('#gateForm').addEventListener('submit',function(e){
  e.preventDefault();
  sha256($('#gateIn').value).then(function(h){
   if(h===CFG.gate){store.set(K.gate,h);$('#gate').classList.remove('on');start();}
   else{$('#gateErr').textContent='암호가 맞지 않습니다. 전달받은 암호를 다시 확인해 주세요.';}
  });
 });
}
})();
