/* PROJECT ATLAS - Character admin (admin, legacy).
   Edit and delete characters in the sheet via the Apps Script.
   Note: this tab is not reachable from the current admin panel.
   Classic script, loaded before core.js. */

function renderCharsTab(c){
  if(!c) c=document.getElementById('admin-content');
  const CHARS_CSV='https://docs.google.com/spreadsheets/d/e/2PACX-1vRRllRkwaCacdM0WZZT0cVQflhxJ9Fw5mgId-v615_kE2GdKdbwHMUYCG03HC8gUXfg7lucTs1Mqhg1/pub?output=csv&gid=474514580&single=true';
  const SCRIPT='https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec';
  c.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3)">⏳ Lade Charaktere...</div>';

  function parseCSV(csv){
    const rows=csv.split('\n');
    const headers=rows[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
    const idx=k=>headers.indexOf(k);
    return rows.slice(1).filter(r=>r.trim()).map(r=>{
      const cols=r.split(',');
      const get=k=>(cols[idx(k)]||'').replace(/"/g,'').trim();
      return{name:get('name'),player:get('player'),type:get('type'),age:get('age'),job:get('job'),home:get('home'),portraitUrl:get('portraiturl'),threadUrl:get('threadurl'),okkult:get('okkult'),gender:get('gender')};
    }).filter(ch=>ch.name);
  }

  fetch(CHARS_CSV).then(r=>r.text()).then(csv=>{
    const allChars=parseCSV(csv);
    let filtered=allChars;
    let searchTerm='';
    let activeType='all';

    function render(){
      const q=searchTerm.toLowerCase();
      filtered=allChars.filter(ch=>{
        const matchType=activeType==='all'||ch.type.toLowerCase().includes(activeType);
        const matchSearch=!q||ch.name.toLowerCase().includes(q)||ch.player.toLowerCase().includes(q);
        return matchType&&matchSearch;
      });

      c.innerHTML=`
        <div style="margin-bottom:8px">
          <input id="ca-search" class="a-input" placeholder="Name oder Spieler suchen..." value="${searchTerm}" oninput="window._caSearch(this.value)">
        </div>
        <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">
          ${['all','haupt','neben','randfigur','passant'].map(t=>`
            <button class="a-btn${activeType===t?' a-btn-primary':''}" style="font-size:10px;padding:3px 8px" onclick="window._caType('${t}')">${t==='all'?'Alle':t.charAt(0).toUpperCase()+t.slice(1)}</button>
          `).join('')}
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:8px">${filtered.length} Charaktere</div>
        <div id="ca-list">
          ${filtered.map((ch,i)=>`
            <div style="background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 10px;margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:8px">
                ${ch.portraitUrl?`<img src="${ch.portraitUrl}" loading="lazy" decoding="async" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`:
                  '<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);flex-shrink:0"></div>'}
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:500;color:#ddeedd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ch.name}</div>
                  <div style="font-size:10px;color:rgba(255,255,255,0.35)">${ch.player} · ${ch.type}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                  <button class="a-btn" style="font-size:10px;padding:3px 7px;color:rgba(100,180,255,0.7);border-color:rgba(100,180,255,0.2)" onclick="window._caEdit(${i})">✎</button>
                  <button class="a-btn a-btn-danger" style="font-size:10px;padding:3px 7px" onclick="window._caDelete('${ch.name.replace(/'/g,"\\'")}')">✕</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`;

      // Re-attach listeners
      window._caSearch=function(v){searchTerm=v;render();};
      window._caType=function(t){activeType=t;render();};

      window._caEdit=function(idx){
        const ch=filtered[idx];
        if(!ch) return;
        const panel=document.createElement('div');
        panel.style.cssText='position:fixed;top:0;right:min(340px,100vw);width:min(320px,100vw);bottom:0;background:#060e1a;border-left:0.5px solid rgba(74,170,106,0.3);z-index:600;overflow-y:auto;padding:16px;box-shadow:-4px 0 20px rgba(0,0,0,0.7)';
        panel.innerHTML=`
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600;color:#ddeedd">Charakter bearbeiten</div>
            <button onclick="this.closest('[style]').remove()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer">✕</button>
          </div>
          ${['name','player','age','job','home','portraitUrl','threadUrl'].map(f=>`
            <div style="margin-bottom:10px">
              <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;text-transform:uppercase">${f}</div>
              <input class="a-input" id="cae-${f}" value="${(ch[f]||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box">
            </div>
          `).join('')}
          <div style="margin-bottom:10px">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;text-transform:uppercase">Okkult-Typ</div>
            <select id="cae-okkult" class="a-select" style="width:100%">
              ${['Sim','Vampir','Werwolf','Magier','Geist','Fee','Meersim'].map(o=>`<option value="${o}"${ch.okkult===o?' selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom:14px">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;text-transform:uppercase">Geschlecht</div>
            <select id="cae-gender" class="a-select" style="width:100%">
              <option value="">—</option>
              ${['männlich','weiblich','divers'].map(g=>`<option value="${g}"${ch.gender===g?' selected':''}>${g}</option>`).join('')}
            </select>
          </div>
          <button id="cae-save" class="a-btn a-btn-primary" style="width:100%" onclick="window._caSave('${ch.name.replace(/'/g,"\\'")}')">Speichern</button>
          <div id="cae-msg" style="font-size:11px;text-align:center;margin-top:8px;min-height:16px"></div>`;
        document.body.appendChild(panel);
      };

      window._caSave=function(origName){
        const msg=document.getElementById('cae-msg');
        msg.style.color='rgba(255,255,255,0.4)';msg.textContent='Speichern...';
        const get=id=>(document.getElementById('cae-'+id)||{value:''}).value.trim();
        const params=new URLSearchParams({
          action:'updateChar',originalName:origName,
          name:get('name'),player:get('player'),age:get('age'),job:get('job'),
          home:get('home'),portraitUrl:get('portraitUrl'),threadUrl:get('threadUrl'),
          okkult:get('okkult'),gender:get('gender')
        });
        fetch(SCRIPT+'?'+params.toString(),{mode:'no-cors'})
          .then(()=>{msg.style.color='#4aaa6a';msg.textContent='✓ Gespeichert';setTimeout(()=>{document.querySelectorAll('[style*="right:min(340px"]').forEach(e=>e.remove());renderCharsTab(c);},1200);})
          .catch(()=>{msg.style.color='#ff6b6b';msg.textContent='Fehler.';});
      };

      window._caDelete=function(name){
        if(!confirm(`"${name}" wirklich löschen?\n\nWenn der Charakterbogen-Thread noch existiert wird der Charakter beim nächsten Apps-Script-Lauf evtl. neu eingetragen.`))return;
        const params=new URLSearchParams({action:'deleteChar',name});
        fetch(SCRIPT+'?'+params.toString(),{mode:'no-cors'})
          .then(()=>{alert(`"${name}" gelöscht.`);renderCharsTab(c);})
          .catch(()=>alert('Fehler beim Löschen.'));
      };
    }

    render();
  }).catch(()=>{
    c.innerHTML='<div style="color:#ff6b6b;padding:20px;font-size:11px">Fehler beim Laden der Charaktere.</div>';
  });
}
