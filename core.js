/* VBC Service – Datenmodell und nachvollziehbare Berechnung, ohne Abhängigkeiten. */
(function(root){
 'use strict';
 const clone = x => JSON.parse(JSON.stringify(x));
 const uid = () => 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
 const phase = (a,b) => a<=19 && b<=19 ? '0–19' : a>=25 && b>=25 ? '25+' : 'Übrige';
 function newMatch(roster=[]){const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');return {version:1,id:uid(),team:'VBC Interlaken',opponent:'Gegner',date:today,roster:clone(roster),sets:[],current:0,completed:false};}
 function replay(set,roster){
  const ids=new Set(roster.map(p=>p.id));
  if(set.start.length!==6 || new Set(set.start).size!==6 || set.start.some(id=>!ids.has(id))) throw Error('Wähle genau sechs verschiedene Spielerinnen für die Startaufstellung.');
  let active=[...set.start],score=[0,0]; const events=[];
  for(const e of set.events){
   const pre=[...score]; let before=[...active];
   if(e.kind==='serve'){
    if(!active.includes(e.player))throw Error('Eine Service-Spielerin ist zu diesem Zeitpunkt nicht auf dem Feld. Korrigiere zuerst die Aufstellung oder den Wechsel.');
    if(!['ace','error','regular'].includes(e.result))throw Error('Ungültiger Servicetyp.');
    if(e.at){validScore(e.at); score=[...e.at];}
    const at=[...score];
    if(e.result==='ace')score[0]++;
    if(e.result==='error')score[1]++;
    events.push({...e,pre,at,phase:phase(...at),post:[...score],active:before});
   }else if(e.kind==='point'){
    if(![0,1].includes(e.team))throw Error('Ungültige Punkteingabe.'); score[e.team]++;
    events.push({...e,pre,at:pre,post:[...score]});
   }else if(e.kind==='score'){
    validScore(e.score);score=[...e.score];events.push({...e,pre,at:pre,post:[...score]});
   }else if(e.kind==='sub'){
    if(!active.includes(e.out)||active.includes(e.into)||!ids.has(e.into))throw Error('Dieser Wechsel passt nicht zur Aufstellung. Prüfe auch spätere Wechsel und Services.');
    active[active.indexOf(e.out)]=e.into;events.push({...e,pre,at:pre,post:[...score],active:before});
   }else throw Error('Unbekanntes Ereignis.');
  }
  return {active,score,events};
 }
 function validScore(s){if(!Array.isArray(s)||s.length!==2||s.some(n=>!Number.isInteger(n)||n<0||n>999))throw Error('Punkte müssen ganze Zahlen zwischen 0 und 999 sein.');}
 function validate(m){
  if(!m||m.version!==1||!Array.isArray(m.roster)||!Array.isArray(m.sets)||m.roster.length>14||m.sets.length>5)throw Error('Diese Datei ist keine gültige VBC-Service-Sicherung (maximal 14 Spielerinnen).');
  if(typeof m.team!=='string'||typeof m.opponent!=='string'||typeof m.date!=='string'||!m.team.trim()||!m.opponent.trim()||m.team.length>80||m.opponent.length>80||!/^\d{4}-\d{2}-\d{2}$/.test(m.date))throw Error('Ungültige Matchangaben.');
  if(m.roster.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||!p.name.trim()||p.name.length>60||!Number.isInteger(p.number)||p.number<0||p.number>99)||new Set(m.roster.map(p=>p.id)).size!==m.roster.length||new Set(m.roster.map(p=>p.number)).size!==m.roster.length)throw Error('Prüfe Namen und eindeutige Nummern (0–99).');
  if(!Number.isInteger(m.current)||m.current<0||(m.sets.length?m.current>=m.sets.length:m.current!==0))throw Error('Ungültiger aktueller Satz.');
  for(const s of m.sets){if(!s||!Array.isArray(s.start)||!Array.isArray(s.events)||s.events.length>10000||typeof s.closed!=='boolean')throw Error('Ungültiger Satz.');if(s.events.some(e=>!e||typeof e.id!=='string'||!e.id||typeof e.time!=='string'||!Number.isFinite(Date.parse(e.time)))||new Set(s.events.map(e=>e.id)).size!==s.events.length)throw Error('Ungültige oder doppelte Ereignisse.');for(const e of s.events){if(e.awaitPoint!==undefined&&typeof e.awaitPoint!=='boolean')throw Error('Ungültiger Ballwechselstatus.');if(e.service!==undefined&&typeof e.service!=='string')throw Error('Ungültige Servicezuordnung.');}replay(s,m.roster);}
  return m;
 }
 function stats(m,index=null,filter='Alle'){
  const rows=m.roster.map(p=>({...p,total:0,ace:0,error:0,regular:0}));
  const byId=Object.fromEntries(rows.map(p=>[p.id,p]));
  m.sets.forEach((s,i)=>{if(index!==null&&i!==index)return;replay(s,m.roster).events.filter(e=>e.kind==='serve'&&(filter==='Alle'||e.phase===filter)).forEach(e=>{const p=byId[e.player];p.total++;p[e.result]++;});});
  return rows;
 }
 function summarize(rows){return rows.reduce((a,p)=>({total:a.total+p.total,ace:a.ace+p.ace,error:a.error+p.error,regular:a.regular+p.regular}),{total:0,ace:0,error:0,regular:0});}
 function pct(n,d){return d ? Math.round(n/d*1000)/10 : 0;}
 function setWinner(score,index){return Math.max(...score)>=25&&Math.abs(score[0]-score[1])>=2?(score[0]>score[1]?0:1):null;}
 function matchResult(m,includeOpen=false){const wins=[0,0];for(let i=0;i<m.sets.length;i++){const s=m.sets[i];if(!s.closed&&!includeOpen)continue;const winner=setWinner(replay(s,m.roster).score,i);if(winner!==null)wins[winner]++;if(wins.some(n=>n===3))return {wins,winner:wins[0]===3?0:1,decidingSet:i};}return {wins,winner:null,decidingSet:null};}
 function pendingRally(m){
  for(let index=0;index<m.sets.length;index++){
   const events=m.sets[index].events;
   for(let i=0;i<events.length;i++){const e=events[i];if(e.kind==='serve'&&e.result==='regular'&&e.awaitPoint===true&&!events.slice(i+1).some(p=>p.kind==='point'&&p.service===e.id))return {index,event:e};}
  }
  return null;
 }
 function undoPlayerService(m,index,player){const events=m.sets[index].events;let at=-1;for(let i=events.length-1;i>=0;i--)if(events[i].kind==='serve'&&events[i].player===player){at=i;break;}if(at<0)throw Error('Für diese Spielerin gibt es in diesem Satz keinen Service zum Zurücknehmen.');events.splice(at,1);}
 const api={clone,uid,phase,newMatch,replay,validate,stats,summarize,pct,validScore,setWinner,matchResult,pendingRally,undoPlayerService};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VBC=api;
})(typeof window!=='undefined'?window:globalThis);
