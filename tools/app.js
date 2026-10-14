/* 연구소 공유본 화면 동작: 탭과 목차, 조문 참조 미리보기, 의견(댓글·답글), 인쇄, 입장 암호 */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var store={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
var K={me:'imdan27share_me',org:'imdan27share_org',tok:'imdan27share_tok',mine:'imdan27share_mine',gate:'imdan27share_gate'};
var ME=store.get(K.me)||'', ORG=store.get(K.org)||'';
var SB=null, ALL=[], MINE={};
try{MINE=JSON.parse(store.get(K.mine)||'{}')||{};}catch(e){MINE={};}

function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove('on');},2400);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function when(iso){var d=new Date(iso);return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function hex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return ('0'+b.toString(16)).slice(-2);}).join('');}
function sha256(s){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(hex);}
function token(){
 var t=store.get(K.tok);
 if(!t){var a=new Uint8Array(24);crypto.getRandomValues(a);t=hex(a.buffer);store.set(K.tok,t);}
 return t;
}

/* ---------- 탭 ---------- */
function showTab(id,noScroll){
 $$('nav.tabs button').forEach(function(b){b.setAttribute('aria-selected',b.dataset.p===id?'true':'false');});
 $$('.pane').forEach(function(p){p.classList.toggle('on',p.id===id);});
 $$('aside .tg').forEach(function(g){g.classList.toggle('on',g.dataset.p===id);});
 $('#wrap').classList.toggle('solo',id==='p-in');
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
$('#q').addEventListener('input',function(){var v=this.value.trim();clearTimeout(qT);qT=setTimeout(function(){
 var pane=$('.pane.on');if(!pane)return;
 $$('.art,.ap',pane).forEach(function(s){
  var hit=!v||s.textContent.indexOf(v)>=0;s.classList.toggle('dim',!hit);
 });
 $$('.chap,.sect',pane).forEach(function(c){c.classList.toggle('dim',!!v);});
},120);});

/* ---------- 조문 참조 미리보기 ---------- */
var tip=$('#tip');
function showTip(a){
 var r=REF[a.dataset.r];if(!r)return;
 tip.innerHTML='<b>'+esc(r.t)+'</b>'+r.b.slice(0,14).map(function(x){return '<p>'+esc(x)+'</p>';}).join('')+(r.b.length>14?'<p>…</p>':'');
 tip.classList.add('on');
 var b=a.getBoundingClientRect(),t=tip.getBoundingClientRect();
 var x=Math.min(Math.max(10,b.left),innerWidth-t.width-10),y=b.bottom+8;
 if(y+t.height>innerHeight-10)y=Math.max(10,b.top-t.height-8);
 tip.style.left=x+'px';tip.style.top=y+'px';
}
function hideTip(){tip.classList.remove('on');}
document.addEventListener('mouseover',function(e){var a=e.target.closest('a.ref');if(a)showTip(a);});
document.addEventListener('mouseout',function(e){if(e.target.closest('a.ref'))hideTip();});
document.addEventListener('focusin',function(e){var a=e.target.closest('a.ref');if(a)showTip(a);});
document.addEventListener('focusout',hideTip);
document.addEventListener('keydown',function(e){if(e.key==='Escape'){hideTip();closeDlg();}});
window.addEventListener('scroll',hideTip,{passive:true});

/* ---------- 대화상자 ---------- */
function openDlg(id){$('#'+id).classList.add('on');var f=$('#'+id+' input');if(f)f.focus();}
function closeDlg(){$$('.dlg.on').forEach(function(d){d.classList.remove('on');});}
$$('.dlg [data-close]').forEach(function(b){b.addEventListener('click',closeDlg);});
$$('.dlg').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d)closeDlg();});});

/* ---------- 이름과 소속 ---------- */
var afterMe=null;
function paintMe(){
 var b=$('#meBtn');
 b.innerHTML=ME?esc(ME)+' <span class="org '+(ORG==='조합'?'u':'i')+'">'+esc(ORG)+'</span>':'이름 설정';
}
function askMe(cb){
 afterMe=cb||null;
 $('#meName').value=ME;
 $$('#meForm input[name=org]').forEach(function(r){r.checked=(r.value===ORG);});
 $('#meErr').textContent='';
 openDlg('meDlg');
}
$('#meBtn').addEventListener('click',function(){askMe(null);});
$('#meForm').addEventListener('submit',function(e){
 e.preventDefault();
 var n=$('#meName').value.trim(),o=($('#meForm input[name=org]:checked')||{}).value;
 if(!n){$('#meErr').textContent='이름을 적어 주세요.';return;}
 if(!o){$('#meErr').textContent='소속을 골라 주세요.';return;}
 ME=n;ORG=o;store.set(K.me,ME);store.set(K.org,ORG);paintMe();closeDlg();
 var cb=afterMe;afterMe=null;if(cb)cb();
});
function needMe(cb){if(ME&&ORG)cb();else askMe(cb);}

/* ---------- 의견 ---------- */
var COLS='id,article_key,parent_id,name,org,body,created_at';
function load(){
 if(!SB)return Promise.resolve();
 return SB.from('comments').select(COLS).order('created_at',{ascending:true}).range(0,9999).then(function(r){
  if(r.error){toast('의견을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.');return;}
  ALL=r.data||[];paintAll();
 });
}
function byKey(){var m={};ALL.forEach(function(c){(m[c.article_key]=m[c.article_key]||[]).push(c);});return m;}
function one(c,isReply){
 var mine=!!MINE[c.id];
 var acts=[];
 if(!isReply)acts.push('<button type="button" data-reply="'+c.id+'">답글</button>');
 if(mine)acts.push('<button type="button" class="del" data-del="'+c.id+'">삭제</button>');
 return '<div class="c from-'+(c.org==='조합'?'u':'i')+'" data-id="'+c.id+'"><div class="who"><b>'+esc(c.name)+'</b><span class="org '+(c.org==='조합'?'u':'i')+'">'+esc(c.org)+'</span><time datetime="'+esc(c.created_at)+'">'+when(c.created_at)+'</time></div>'+
  '<div class="bd">'+esc(c.body)+'</div>'+(acts.length?'<div class="acts">'+acts.join('')+'</div>':'');
}
function paintKey(k,list){
 var box=$('[data-list="'+k+'"]');if(!box)return;
 list=list||[];
 var tops=list.filter(function(c){return !c.parent_id;});
 box.innerHTML=tops.map(function(c){
  var reps=list.filter(function(r){return r.parent_id===c.id;});
  return one(c,false)+(reps.length?'<div class="replies">'+reps.map(function(r){return one(r,true)+'</div>';}).join('')+'</div>':'')+'</div>';
 }).join('');
 var n=list.length;
 var cnt=$('[data-cnt="'+k+'"]');if(cnt)cnt.textContent=n?n+'건':'아직 없습니다';
 var cc=$('[data-cc="'+k+'"]');if(cc){cc.textContent='의견 '+n;cc.classList.toggle('on',n>0);}
 var tc=$('[data-tcc="'+k+'"]');if(tc){tc.textContent=n;tc.classList.toggle('on',n>0);}
 var tk=$('[data-talk="'+k+'"]');if(tk)tk.classList.toggle('has',n>0);
}
function paintAll(){
 var m=byKey();
 $$('[data-list]').forEach(function(b){paintKey(b.dataset.list,m[b.dataset.list]);});
}
function post(k,body,parent){
 return sha256(token()).then(function(h){
  return SB.from('comments').insert({article_key:k,parent_id:parent||null,name:ME,org:ORG,body:body,token_hash:h}).select(COLS);
 }).then(function(r){
  if(r.error||!r.data||!r.data[0])throw r.error||new Error('insert');
  var row=r.data[0];MINE[row.id]=1;store.set(K.mine,JSON.stringify(MINE));
  ALL.push(row);var m=byKey();paintKey(k,m[k]);
 });
}
document.addEventListener('submit',function(e){
 var f=e.target.closest('form.cf');if(!f)return;
 e.preventDefault();
 var ta=f.querySelector('textarea'),v=ta.value.trim(),btn=f.querySelector('button[type=submit]');
 if(!v){ta.focus();return;}
 if(!SB){toast('의견 저장소에 연결하지 못했습니다.');return;}
 needMe(function(){
  btn.disabled=true;
  post(f.dataset.form,v,f.dataset.parent).then(function(){
   ta.value='';toast(f.dataset.parent?'답글을 등록했습니다':'의견을 등록했습니다');
   if(f.classList.contains('reply'))f.remove();
  }).catch(function(){toast('등록하지 못했습니다. 다시 시도해 주세요.');}).then(function(){btn.disabled=false;});
 });
});
document.addEventListener('keydown',function(e){
 if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&e.target.closest&&e.target.closest('form.cf')){
  e.preventDefault();e.target.closest('form.cf').requestSubmit();}
});
document.addEventListener('click',function(e){
 var rb=e.target.closest('[data-reply]');
 if(rb){
  var c=rb.closest('.c'),k=rb.closest('[data-list]').dataset.list,id=rb.dataset.reply;
  var ex=c.querySelector(':scope > form.cf.reply');if(ex){ex.querySelector('textarea').focus();return;}
  var f=document.createElement('form');f.className='cf reply';f.dataset.form=k;f.dataset.parent=id;
  f.innerHTML='<textarea rows="1" placeholder="답글을 남겨 주세요." aria-label="답글 입력"></textarea><button type="button" class="cancel">취소</button><button type="submit">답글 등록</button>';
  c.appendChild(f);
  f.querySelector('.cancel').addEventListener('click',function(){f.remove();});
  f.querySelector('textarea').focus();
  return;
 }
 var db=e.target.closest('[data-del]');
 if(db){
  if(!confirm('이 의견을 지울까요? 달린 답글도 함께 지워집니다.'))return;
  var did=db.dataset.del;
  SB.rpc('delete_comment',{p_id:did,p_token:token()}).then(function(r){
   if(r.error||r.data!==true){toast('지우지 못했습니다.');return;}
   delete MINE[did];store.set(K.mine,JSON.stringify(MINE));
   ALL=ALL.filter(function(x){return x.id!==did&&x.parent_id!==did;});paintAll();toast('지웠습니다');
  });
 }
});

/* ---------- 의견 내려받기 ---------- */
$('#expBtn').addEventListener('click',function(){
 if(!SB){toast('의견 저장소에 연결하지 못했습니다.');return;}
 load().then(function(){
  var m=byKey(),L=[],now=new Date();
  L.push('# 2027 임금·단체교섭 요구안 해설 · 연구소 공유본 의견 모음','');
  L.push('- 내려받은 시각: '+now.toLocaleString('ko-KR'));
  L.push('- 출처: '+location.href.split('#')[0]);
  L.push('- 의견 '+ALL.filter(function(c){return !c.parent_id;}).length+'건, 답글 '+ALL.filter(function(c){return c.parent_id;}).length+'건','');
  $$('[data-list]').forEach(function(b){
   var k=b.dataset.list,list=m[k];if(!list||!list.length)return;
   var head=document.getElementById(k);var title=k==='intro'?'교섭을 시작하며':(REF[k]?REF[k].t:(head?(head.querySelector('h3')||{}).textContent:k));
   L.push('## '+title+' `'+k+'`','');
   list.filter(function(c){return !c.parent_id;}).forEach(function(c){
    L.push('- **'+c.name+'**('+c.org+') · '+new Date(c.created_at).toLocaleString('ko-KR'));
    L.push('  '+c.body.replace(/\n/g,'\n  '));
    list.filter(function(r){return r.parent_id===c.id;}).forEach(function(r){
     L.push('  - ↳ **'+r.name+'**('+r.org+') · '+new Date(r.created_at).toLocaleString('ko-KR'));
     L.push('    '+r.body.replace(/\n/g,'\n    '));
    });
   });
   L.push('');
  });
  var blob=new Blob([L.join('\n')],{type:'text/markdown;charset=utf-8'}),a=document.createElement('a');
  var p=function(n){return (n<10?'0':'')+n;};
  a.href=URL.createObjectURL(blob);a.download='27_임단협_연구소공유본_의견_'+String(now.getFullYear()).slice(2)+p(now.getMonth()+1)+p(now.getDate())+'.md';
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
  toast('의견을 내려받았습니다');
 });
});

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
 load();
 /* 다른 사람이 남긴 의견을 주기적으로 가져옵니다(화면을 보고 있을 때만) */
 setInterval(function(){if(document.visibilityState==='visible')load();},30000);
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')load();});
 if(location.hash)go(decodeURIComponent(location.hash.slice(1)),false);
}
paintMe();
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
