const workouts={A:{name:'Treino A',desc:'Peito e tríceps',ex:[['Supino reto',3,'8–10'],['Supino inclinado com halteres',3,'8–12'],['Crucifixo máquina / crossover',2,'10–15'],['Tríceps corda',3,'10–12'],['Tríceps francês',2,'10–12']]},B:{name:'Treino B',desc:'Costas e bíceps',ex:[['Puxada frente',3,'8–12'],['Remada baixa',3,'8–12'],['Remada unilateral',2,'10–12'],['Rosca direta',3,'8–12'],['Rosca martelo',2,'10–12']]},C:{name:'Treino C',desc:'Pernas',ex:[['Agachamento ou Hack',3,'8–10'],['Leg press',3,'10–12'],['Mesa flexora',3,'10–12'],['Cadeira extensora',2,'10–15'],['Panturrilha em pé ou sentado',4,'10–15']]},D:{name:'Treino D',desc:'Ombros e braços',ex:[['Desenvolvimento',3,'8–10'],['Elevação lateral',3,'10–15'],['Crucifixo inverso',3,'10–15'],['Rosca Scott',2,'10–12'],['Tríceps polia',2,'10–12'],['Abdominal máquina / cabo',3,'10–15']]}};
let current=localStorage.currentWorkout||'A',timerId=null,timeLeft=0;const $=s=>document.querySelector(s);const data=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));if(id==='history')renderHistory()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function renderHome(){const w=workouts[current];$('#nextWorkout').textContent=w.name;$('#nextDesc').textContent=w.desc;$('#workoutCards').innerHTML=Object.entries(workouts).map(([k,v])=>`<div class='card workout-card' onclick="startWorkout('${k}')"><small>${k}</small><b>${v.name}</b><p>${v.desc}</p></div>`).join('');const weights=data('weights',[{date:new Date().toISOString(),value:66}]);$('#latestWeight').textContent=weights.at(-1).value.toFixed(1).replace('.',',')+' kg';drawChart(weights)}
function getExerciseSessions(exerciseName,limit=3){
  const h=data('history',[]),out=[];
  for(const session of h){
    const d=(session.details||[]).find(x=>x.exercise===exerciseName);
    if(!d)continue;
    const sets=(d.sets||[]).filter(x=>x&&x.done&&x.kg&&x.reps).map(x=>({
      kg:parseFloat(String(x.kg).replace(',','.')),
      reps:parseInt(x.reps,10)
    })).filter(x=>Number.isFinite(x.kg)&&Number.isFinite(x.reps));
    if(sets.length)out.push({date:session.date,sets});
    if(out.length>=limit)break;
  }
  return out;
}
function fmtKg(v){return String(Math.round(v*2)/2).replace('.',',')}
function progressionTip(sets,range,expectedSets,exerciseName){
  const valid=(sets||[]).slice(0,expectedSets).filter(p=>p&&p.kg&&p.reps);
  if(!valid.length)return '';
  const nums=String(range).match(/\d+/g)||[];
  const min=parseInt(nums[0]||'0',10),max=parseInt(nums[1]||nums[0]||'0',10);
  const parsed=valid.map(p=>({kg:parseFloat(String(p.kg).replace(',','.')),reps:parseInt(p.reps,10)})).filter(p=>p.kg&&p.reps);
  if(!parsed.length)return '';

  const firstKg=parsed[0].kg,allSets=parsed.length===expectedSets;
  const sameLoad=parsed.every(p=>Math.abs(p.kg-firstKg)<0.01);
  const allAtTop=allSets&&sameLoad&&parsed.every(p=>p.reps>=max);
  const allInRange=allSets&&parsed.every(p=>p.reps>=min&&p.reps<=max);
  const belowCount=parsed.filter(p=>p.reps<min).length;
  const sessions=getExerciseSessions(exerciseName,3);
  const priorFail=sessions.slice(0,2).some(sess=>{
    const ss=sess.sets.slice(0,expectedSets);
    return ss.length===expectedSets&&ss.filter(p=>p.reps<min).length>=Math.ceil(expectedSets/2);
  });
  let label='MANter',text='';

  if(allAtTop){
    const inc=firstKg<20?1:firstKg<50?2:firstKg<100?2.5:5;
    const target=Math.round((firstKg+inc)*2)/2;
    label='AUMENTAR CARGA';
    text=`Tente ${fmtKg(target)} kg. Você atingiu ${max}+ reps nas ${expectedSets} séries anteriores.`;
  }else if(allSets&&belowCount>=Math.ceil(expectedSets/2)&&priorFail){
    const reduction=firstKg<=20?1:firstKg<=50?2:firstKg<=100?2.5:5;
    const target=Math.max(.5,Math.round((firstKg-reduction)*2)/2);
    label='REDUZIR CARGA';
    text=`Tente ${fmtKg(target)} kg e recupere pelo menos ${min} reps por série. O desempenho ficou abaixo da faixa em treinos consecutivos.`;
  }else if(belowCount){
    label='MANTER CARGA';
    text=`Mantenha ${fmtKg(firstKg)} kg e busque pelo menos ${min} reps em todas as séries antes de pensar em aumentar.`;
  }else if(!allSets){
    label='COMPLETAR SÉRIES';
    text=`Complete as ${expectedSets} séries dentro de ${min}–${max} reps. Ainda faltam dados para recomendar aumento.`;
  }else if(allInRange){
    label='BUSCAR MAIS REPS';
    const avg=(parsed.reduce((a,p)=>a+p.reps,0)/parsed.length).toFixed(1).replace('.',',');
    text=`Mantenha ${fmtKg(firstKg)} kg e tente aproximar todas as séries de ${max} reps. Média anterior: ${avg} reps.`;
  }else{
    label='MANTER CARGA';
    text=`Mantenha a carga atual e priorize séries consistentes dentro de ${min}–${max} reps.`;
  }

  let trend='';
  if(sessions.length>=2){
    const score=s=>s.sets.reduce((a,p)=>a+p.kg*p.reps,0);
    const a=score(sessions[0]),b=score(sessions[1]);
    if(a>b*1.03)trend=' • Tendência: evolução';
    else if(a<b*.97)trend=' • Tendência: queda';
    else trend=' • Tendência: estável';
  }
  return `<div class='exercise-progression'><span>${label}</span><strong>Meta hoje: ${text}</strong><small>Baseada no último desempenho${trend}</small></div>`;
}
function startWorkout(k=current){current=k;localStorage.currentWorkout=k;const w=workouts[k];$('#workoutTitle').textContent=w.name;$('#workoutDesc').textContent=w.desc;const previous=data('lastSets',{});$('#exerciseList').innerHTML=w.ex.map((e,i)=>`<div class='exercise'><small>EXERCÍCIO ${i+1}</small><h3>${e[0]}</h3><p>${e[1]} séries • ${e[2]} repetições</p>${progressionTip(previous[e[0]],e[2],e[1],e[0])}${Array.from({length:e[1]},(_,s)=>{const p=previous[e[0]]?.[s]||{};const ref=(p.kg||p.reps)?`<span class='previous-set'>Anterior: ${p.kg||'—'} kg × ${p.reps||'—'}</span>`:'';return `<div class='set-row'><b>${s+1}</b><input inputmode='decimal' class='kg' data-ex='${i}' data-set='${s}' placeholder='kg'><input inputmode='numeric' class='reps' data-ex='${i}' data-set='${s}' placeholder='reps'><button class='check' onclick='completeSet(this,${i},${s})'>✓</button>${ref}</div>`}).join('')}</div>`).join('');showPage('workout')}
function completeSet(btn,i,s){btn.classList.toggle('done');const w=workouts[current],ex=w.ex[i][0],kg=document.querySelector(`.kg[data-ex='${i}'][data-set='${s}']`).value,reps=document.querySelector(`.reps[data-ex='${i}'][data-set='${s}']`).value;if(btn.classList.contains('done')){if(!kg&&!reps){btn.classList.remove('done');return alert('Informe a carga ou as repetições antes de concluir a série.')}const previous=data('lastSets',{});if(!previous[ex])previous[ex]=[];previous[ex][s]={kg,reps,date:new Date().toISOString()};save('lastSets',previous);startTimer(90)}}
function finishWorkout(){const w=workouts[current],details=[],previous=data('lastSets',{});let completed=0;w.ex.forEach((e,i)=>{const sets=Array.from({length:e[1]},(_,s)=>{const kg=document.querySelector(`.kg[data-ex='${i}'][data-set='${s}']`).value;const reps=document.querySelector(`.reps[data-ex='${i}'][data-set='${s}']`).value;const done=document.querySelector(`.check[onclick*=",${i},${s})"]`)?.classList.contains('done');if(done){completed++;if(!previous[e[0]])previous[e[0]]=[];previous[e[0]][s]={kg,reps,date:new Date().toISOString()}}return{kg,reps,done:!!done}});details.push({exercise:e[0],sets})});if(!completed)return alert('Conclua pelo menos uma série antes de salvar o treino.');save('lastSets',previous);const h=data('history',[]);h.unshift({date:new Date().toISOString(),workout:w.name,desc:w.desc,details});save('history',h);current=String.fromCharCode(65+(current.charCodeAt(0)-64)%4);localStorage.currentWorkout=current;stopTimer();renderHome();showPage('home');alert('Treino salvo! Próximo: '+workouts[current].name)}
function startTimer(sec){stopTimer();timeLeft=sec;$('#timer').classList.remove('hidden');tick();timerId=setInterval(()=>{timeLeft--;tick();if(timeLeft<=0)stopTimer()},1000)}function tick(){const m=String(Math.floor(timeLeft/60)).padStart(2,'0'),s=String(timeLeft%60).padStart(2,'0');$('#timerText').textContent=m+':'+s}function stopTimer(){if(timerId)clearInterval(timerId);timerId=null;$('#timer').classList.add('hidden')}
function addWeight(){const v=parseFloat($('#weightInput').value);if(!v||v<30||v>250)return alert('Digite um peso válido.');const a=data('weights',[]);a.push({date:new Date().toISOString(),value:v});save('weights',a);$('#weightInput').value='';renderHome()}
function drawChart(a){const c=$('#weightChart'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(a.length<2){ctx.fillStyle='#9ca3af';ctx.font='22px sans-serif';ctx.fillText('Registre mais pesos para ver o gráfico.',20,100);return}const vals=a.slice(-12).map(x=>x.value),min=Math.min(...vals)-.5,max=Math.max(...vals)+.5;ctx.strokeStyle='#84cc16';ctx.lineWidth=5;ctx.beginPath();vals.forEach((v,i)=>{const x=25+i*(c.width-50)/(vals.length-1),y=20+(max-v)*(c.height-45)/(max-min);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
function renderHistory(){const h=data('history',[]);$('#historyList').innerHTML=h.length?h.map(x=>`<div class='card history-item'><h3>${x.workout} — ${x.desc}</h3><small>${new Date(x.date).toLocaleString('pt-BR')}</small><p>${x.details.map(d=>d.exercise).join(' • ')}</p></div>`).join(''):`<div class='card'><p>Nenhum treino concluído ainda.</p></div>`}
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}};if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');renderHome();
