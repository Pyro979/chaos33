(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let editor, current, timer, connected=false, busy=false;
  const number=x=>x==null?'—':x.toFixed(2);
  const percent=x=>x==null?'—':`${(100*x).toFixed(1)}%`;
  const duration=s=>s==null?'estimating...':`${Math.floor(s/60)}m ${Math.round(s%60)}s`;
  function fairDiff(r){
    const diff=r.win_share.mean==null?null:r.win_share.mean-1/r.players;
    const span=document.createElement('span');span.className=`fair-diff ${diff==null||Math.abs(diff)<=0.03?'even':diff>0?'above':'below'}`;
    span.textContent=diff==null?'—':`${diff>0?'+':diff<0?'−':''}${(100*Math.abs(diff)).toFixed(1)} pp`;return span;
  }
  const points=x=>x==null?'—':`${(100*x).toFixed(1)} pp`;
  function render(data) {
    current=data;busy=['running','stopping'].includes(data.status);
    $('batch-run').disabled=busy||!connected;
    $('batch-stop').hidden=!busy;$('batch-stop').disabled=data.status==='stopping';
    $('batch-save').hidden=data.completed===0;
    $('batch-progress').textContent=`${data.layout.name}: ${data.status} · ${data.completed}/${data.scheduled} games · 2P ${data.counts[2]}, 3P ${data.counts[3]}, 4P ${data.counts[4]} · ${Math.round(data.elapsed_seconds)} seconds${data.stalled?` · ${data.stalled} stalled (excluded)`:''}${data.error?` · ${data.error}`:''}`;
    $('batch-runtime').textContent=`Actual elapsed: ${duration(data.elapsed_seconds)}${busy?` · Remaining: ${duration(data.estimated_remaining_seconds)}`:''}. Estimated on this computer: ${Object.entries(data.estimated_preset_seconds||{}).map(([n,s])=>`${Number(n).toLocaleString()} per count: ${duration(s)}`).join(' · ')||'collecting timing samples...'}. Estimates include all three player counts and can vary by map.`;
    const cards=[];
    for(const r of data.rows.filter(r=>r.position===1)){
      const card=document.createElement('div');card.className='batch-card';
      card.dataset.playerCount=r.players;
      const title=document.createElement('strong');title.textContent=`${r.players}P · ${r.games} completed games`;card.append(title);
      const share=document.createElement('p');share.textContent=`First-player wins: ${percent(r.win_share.mean)} (fair: ${percent(1/r.players)}) `;share.append(fairDiff(r));card.append(share);
      [`95% interval: ${percent(r.win_share.low)}–${percent(r.win_share.high)}`,
       `Final VP gap: ${number(r.vp_margin)} · Opening VP: ${number(r.opening.vp)}`,
       `Suns contested: ${number(r.contested_suns)} · Largest network: ${percent(r.largest_component_fraction)}`].forEach(text=>{const p=document.createElement('p');p.textContent=text;card.append(p);});cards.push(card);
    }
    $('batch-overview').replaceChildren(...cards);
    const table=document.createElement('table');const head=table.createTHead().insertRow();
    ['Players','Turn position','Games','Win share (95% CI)','vs fair','Final VP','VP vs others','Opening VP','Suns contested','Largest network','Paired change'].forEach(text=>{const th=document.createElement('th');th.textContent=text;head.append(th);});
    const body=table.createTBody();
    for(const r of data.rows){
      const row=body.insertRow();
      row.dataset.playerCount=r.players;
      if(r.position===1)row.classList.add('player-count-start');
      [r.players,r.position,r.games,`${percent(r.win_share.mean)} (${percent(r.win_share.low)}–${percent(r.win_share.high)})`,number(r.final.vp),number(r.vp_margin),number(r.opening.vp),number(r.contested_suns),percent(r.largest_component_fraction),r.paired_change.games?`${points(r.paired_change.mean)} [${points(r.paired_change.low)}, ${points(r.paired_change.high)}], n=${r.paired_change.games}`:'First run'].forEach(v=>{row.insertCell().textContent=v;});
      row.insertCell(4).append(fairDiff(r));
      row.title=`Final adjacency / majority / Asteroid VP: ${number(r.final.adjacency_vp)} / ${number(r.final.majority_vp)} / ${number(r.final.asteroid_vp)}. Opening: ${number(r.opening.adjacency_vp)} / ${number(r.opening.majority_vp)} / ${number(r.opening.asteroid_vp)}.`;
    }
    $('batch-results').replaceChildren(table);
    $('batch-note').textContent=`${data.note} ${data.comparison?`Paired change compares matching cases with batch ${data.comparison}.`:''} Score-category breakdowns are in row tooltips and downloaded JSON.`;
    $('batch-path').textContent=`Saved locally: ${data.output_path}\\summary.json`;
  }
  async function poll(){
    clearTimeout(timer);
    try{
      const r=await fetch(`/api/xenophyte/batch/${current.id}`);const data=await r.json();
      if(!r.ok)throw Error(data.error);render(data);
      if(busy)timer=setTimeout(poll,1000);
    }catch(e){$('batch-progress').textContent=`${e.message} Reload to reconnect.`;}
  }
  async function start(){
    if(busy)return;
    $('batch-run').disabled=true;
    try{
      const r=await fetch('/api/xenophyte/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({layout:editor.getLayout(),games_per_count:Number($('batch-size').value),seed:Number($('batch-seed').value),workers:Number($('batch-workers').value)})});
      const data=await r.json();if(!r.ok)throw Error(data.error);
      render(data);localStorage.setItem('xenophyte-last-batch',data.id);timer=setTimeout(poll,1000);
    }catch(e){$('batch-progress').textContent=e.message;$('batch-run').disabled=!connected;}
  }
  window.XenophyteBatches={attach(api){
    editor=api;$('batch-run').addEventListener('click',start);
    $('batch-stop').addEventListener('click',async()=>{
      try{const r=await fetch(`/api/xenophyte/batch/${current.id}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await r.json();if(!r.ok)throw Error(data.error);render(data);}catch(e){$('batch-progress').textContent=e.message;}
    });
    $('batch-save').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`xenophyte-batch-${current.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    fetch('/api/xenophyte/health').then(r=>r.json()).then(data=>{
      connected=Boolean(data.ready);$('batch-run').disabled=!connected;
      const saved=localStorage.getItem('xenophyte-last-batch');if(saved){current={id:saved};poll();}
    }).catch(()=>{$('batch-progress').textContent='Use the local Python editor server to run batches.';});
  }};
})();
