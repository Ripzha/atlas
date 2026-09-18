/* PROJECT ATLAS - Admin panel.
   Opens after clicking the logo five times and entering ADMIN_PASS.
   Tabs: "assign" (lot assignment) and "routen" (route editor).
   Called from inline handlers: closeAdmin(), setAdminTab(), renderAdminContent().
   Classic script, loaded before core.js. */

document.getElementById('logo-icon').addEventListener('click',()=>{
  logoClicks++;clearTimeout(logoTimer);logoTimer=setTimeout(()=>logoClicks=0,5000);
  if(logoClicks>=5){
    logoClicks=0;
    if(adminMode){adminMode=false;closeAdmin();return;}
    // Own modal instead of prompt() — some mobile browsers (Samsung Internet,
    // iOS Safari with popup blocker) do not show prompt() reliably.
    showAdminLogin();
  }
});
function showAdminLogin(){
  const ov=document.createElement('div');
  ov.id='admin-login-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML='<div style="background:#0d1f2d;border:1px solid rgba(74,170,106,0.4);border-radius:10px;padding:20px;width:100%;max-width:300px"><div style="font-size:13px;font-weight:600;margin-bottom:12px;color:#fff">Admin-Passwort</div><input type="password" id="admin-login-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="width:100%;padding:10px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:12px"><div style="display:flex;gap:8px"><button id="admin-login-ok" style="flex:1;padding:10px;border-radius:6px;border:none;background:#4aaa6a;color:#fff;font-size:13px;font-weight:600;cursor:pointer">OK</button><button id="admin-login-cancel" style="padding:10px 14px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.2);background:transparent;color:#fff;font-size:13px;cursor:pointer">Abbrechen</button></div></div>';
  document.body.appendChild(ov);
  const input=document.getElementById('admin-login-input');
  setTimeout(()=>input.focus(),50);
  const submit=()=>{
    // Robust: trim + lowercase so autocorrect/capitalization of mobile keyboards
    // does not break the password.
    const pw=(input.value||'').trim().toLowerCase();
    if(pw===ADMIN_PASS){
      ov.remove();
      adminMode=true;
      openAdmin();
    } else {
      input.style.borderColor='#e05555';
      input.value='';
      input.placeholder='Falsches Passwort';
      input.focus();
    }
  };
  document.getElementById('admin-login-ok').onclick=submit;
  document.getElementById('admin-login-cancel').onclick=()=>ov.remove();
  input.addEventListener('keydown',e=>{if(e.key==='Enter')submit();else if(e.key==='Escape')ov.remove();});
}
function openAdmin(){document.body.classList.add('admin-mode');document.getElementById('admin-panel').classList.add('open');document.getElementById('logo-icon').classList.add('admin-active');adminTab='assign';setAdminTab('assign');}
function closeAdmin(){document.body.classList.remove('admin-mode');document.getElementById('admin-panel').classList.remove('open');document.getElementById('logo-icon').classList.remove('admin-active');adminMode=false;}
function setAdminTab(t){adminTab=t;['assign','routen'].forEach(id=>document.getElementById('atab-'+id).classList.toggle('active',id===t));renderAdminContent();}
function renderAdminContent(){const c=document.getElementById('admin-content');if(adminTab==='assign')renderAssignTab(c);else if(adminTab==='routen')renderRoutenTab(c);}
