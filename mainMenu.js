(function(){
  const root=document.getElementById('mainMenu'); if(!root)return;
  const $=id=>document.getElementById(id);
  const views={home:$('menuHome'),world:$('menuWorld'),invite:$('menuInviteView'),host:$('menuHostView'),skin:$('menuSkinView'),settings:$('menuSettingsView')};
  const MODE_LABEL={survival:'Sinh tồn',free:'Tự do',explore:'Khám phá',observer:'Quan sát'};
  const MODE_DESC={survival:'Đầy đủ sinh tồn: chịu sát thương, khai thác và đặt khối theo quyền.',free:'Chế độ tự do: bay, không mất máu và xây dựng thoải mái.',explore:'Chế độ khám phá: di chuyển và tương tác theo quyền được cấp, phù hợp bản đồ thử thách.',observer:'Chế độ quan sát: không chiến đấu, không phá/đặt khối và di chuyển tự do.'};
  const defaultPerms={break:true,place:true,combat:true,pickup:true,use:true,chat:true};
  let worldMode='single',inviteCode='',isHost=false;
  window.AV_SINGLE_PLAYER_ONLY=true;
  const get=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}};
  const set=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const safeName=v=>String(v||'Player').replace(/[^A-Za-z0-9_-]/g,'').slice(0,16)||'Player';
  function makeInviteCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;}
  function normalizeMode(v){const x=String(v||'survival').toLowerCase();return MODE_LABEL[x]?x:'survival';}
  function modeOptions(select,value){if(!select)return;select.value=normalizeMode(value);}
  function show(name){Object.values(views).forEach(v=>v&&v.classList.remove('active'));if(views[name])views[name].classList.add('active');}
  function refreshProfile(){const el=$('menuProfile');if(el)el.textContent='Người chơi: '+get('advanced_voxel_player_name','Player')+' • '+(get('advanced_voxel_world_name','')||'Chưa tạo thế giới');}
  function currentPerms(prefix='perm'){const ids=['break','place','combat','pickup','use','chat'];const out={};for(const k of ids){const el=$(prefix+k[0].toUpperCase()+k.slice(1));out[k]=el?!!el.checked:true;}return out;}
  function setPerms(prefix,perms){const p=Object.assign({},defaultPerms,perms||{});for(const k of Object.keys(defaultPerms)){const el=$(prefix+k[0].toUpperCase()+k.slice(1));if(el)el.checked=p[k]!==false;}}
  function renderMembers(){
    const box=$('memberList');if(!box)return;let list=[];try{list=JSON.parse(get('advanced_voxel_invited_members','[]'))}catch(e){}
    if(!list.length){box.innerHTML='<div class="menuHint">Chưa có người chơi tham gia.</div>';return;}
    box.innerHTML=list.map((m,i)=>`<div class="memberCard"><div class="memberHead"><span>${String(m.name||'Player').replace(/[<>]/g,'')}</span><span class="memberRole">${String(m.role||'Người chơi')}</span></div><div class="memberActions"><select class="menuSelect memberMode" data-i="${i}"><option value="survival" ${normalizeMode(m.mode)==='survival'?'selected':''}>Sinh tồn</option><option value="free" ${normalizeMode(m.mode)==='free'?'selected':''}>Tự do</option><option value="explore" ${normalizeMode(m.mode)==='explore'?'selected':''}>Khám phá</option><option value="observer" ${normalizeMode(m.mode)==='observer'?'selected':''}>Quan sát</option></select><button class="copyBtn removeMember" data-i="${i}">XÓA</button></div></div>`).join('');
    box.querySelectorAll('.removeMember').forEach(b=>b.onclick=()=>{list.splice(+b.dataset.i,1);set('advanced_voxel_invited_members',JSON.stringify(list));renderMembers();});
    box.querySelectorAll('.memberMode').forEach(s=>s.onchange=()=>{const m=list[+s.dataset.i];m.mode=normalizeMode(s.value);set('advanced_voxel_invited_members',JSON.stringify(list));if(window.NETWORK?.client?.connected&&m.id)NETWORK.send('permissionUpdate',{playerId:m.id,mode:m.mode,permissions:m.permissions||currentPerms('perm')});});
  }
  function openWorld(mode){
    worldMode='single';const multi=false;
    $('worldModeTitle').textContent=multi?'TẠO THẾ GIỚI NHIỀU NGƯỜI':'TẠO THẾ GIỚI CHƠI ĐƠN';
    $('multiServerRow').style.display=multi?'flex':'none';
    $('multiInviteRow').style.display=multi?'flex':'none';
    $('serverUrlInput').value=get('advanced_voxel_server_url','');
    inviteCode=makeInviteCode();
    if($('worldInviteCode'))$('worldInviteCode').textContent=multi?inviteCode:'------';
    show('world');
  }
  function openHost(){
    isHost=true;inviteCode=get('advanced_voxel_invite_code','')||makeInviteCode();set('advanced_voxel_invite_code',inviteCode);
    if($('inviteCodeDisplay'))$('inviteCodeDisplay').textContent=inviteCode;
    modeOptions($('hostModeSetting'),get('advanced_voxel_host_mode','survival'));
    if($('hostPvpSetting'))$('hostPvpSetting').value=get('advanced_voxel_host_pvp','on');
    let p;try{p=JSON.parse(get('advanced_voxel_host_perms',JSON.stringify(defaultPerms)))}catch(e){p=defaultPerms}setPerms('perm',p);renderMembers();show('host');
  }
  $('menuSingle').onclick=()=>openWorld('single');
  $('menuMulti').onclick=()=>openWorld('multi');
  $('menuJoinInvite').onclick=()=>{$('inviteJoinCode').value='';$('inviteJoinStatus').textContent='Chưa kết nối phòng.';show('invite');};
  $('menuSkin').onclick=()=>{$('playerNameInput').value=get('advanced_voxel_player_name','Player');show('skin');};
  $('menuSettings').onclick=()=>show('settings');
  root.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{show('home');refreshProfile();});
  root.querySelectorAll('.skinCard').forEach(c=>c.onclick=()=>{root.querySelectorAll('.skinCard').forEach(x=>x.classList.remove('active'));c.classList.add('active');set('advanced_voxel_skin',c.dataset.skin);});
  const savedSkin=get('advanced_voxel_skin','war');root.querySelectorAll('.skinCard').forEach(c=>c.classList.toggle('active',c.dataset.skin===savedSkin));
  $('saveSkinBtn').onclick=()=>{set('advanced_voxel_player_name',safeName($('playerNameInput').value));refreshProfile();show('home');};

  $('createWorldBtn').onclick=()=>{
    const name=$('worldNameInput').value.trim().slice(0,24)||'Thế giới mới';
    const seed=$('worldSeedInput').value.trim().slice(0,24)||'ADVANCED';
    const mode=normalizeMode($('worldGameMode').value);
    const server=$('serverUrlInput').value.trim();
    inviteCode=worldMode==='multi'?makeInviteCode():'';
    set('advanced_voxel_world_name',name);set('advanced_voxel_world_seed',seed);set('advanced_voxel_game_mode',mode);set('advanced_voxel_world_type','single');if(server)set('advanced_voxel_server_url',server);set('advanced_voxel_invite_code',inviteCode);
    set('advanced_voxel_player_mode',mode);
    window.AV_WORLD_CONFIG={name,seed,gameMode:mode,type:'single',serverUrl:'',inviteCode:''};
    window.GAME_MODE=mode;
    window.dispatchEvent(new CustomEvent('advancedvoxel:worldcreated',{detail:window.AV_WORLD_CONFIG}));
    const load=$('loadingScreen');if(load)load.classList.remove('hidden');if($('loadingTitle'))$('loadingTitle').textContent=name;refreshProfile();root.classList.add('hidden');

    if(typeof window.__AV_START_GAME==='function'){const resume=window.__AV_START_GAME;window.__AV_START_GAME=null;resume();}
  };

  $('joinInviteBtn').onclick=()=>{
    const code=$('inviteJoinCode').value.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,6);const st=$('inviteJoinStatus');
    if(code.length!==6){st.textContent='Mã mời phải có 6 ký tự.';return;}
    set('advanced_voxel_join_invite_code',code);
    if(window.NETWORK?.client?.connected){NETWORK.send('inviteJoin',{code,name:get('advanced_voxel_player_name','Player'),skin:get('advanced_voxel_skin','war'),playerKey:get('advanced_voxel_player_key','')});st.textContent='Đang kiểm tra mã '+code+'...';}
    else st.textContent='Chưa kết nối máy chủ. Hãy nhập địa chỉ máy chủ trong Cài đặt trước.';
  };
  $('copyInviteBtn').onclick=()=>copyText($('inviteCodeDisplay')?.textContent||'');
  $('copyWorldInviteBtn').onclick=()=>copyText($('worldInviteCode')?.textContent||'');
  async function copyText(text){try{if(navigator.clipboard)await navigator.clipboard.writeText(text);showToast('ĐÃ SAO CHÉP MÃ');}catch(e){showToast('Hãy giữ để sao chép mã');}}
  function showToast(t){const st=$('inGameSettingsStatus');if(st){st.textContent=t;setTimeout(()=>{if(st.textContent===t)st.textContent='';},1200);}}

  $('applyHostRulesBtn').onclick=()=>{const rules={mode:normalizeMode($('hostModeSetting').value),pvp:$('hostPvpSetting').value,permissions:currentPerms('perm')};set('advanced_voxel_host_mode',rules.mode);set('advanced_voxel_host_pvp',rules.pvp);set('advanced_voxel_host_perms',JSON.stringify(rules.permissions));if(window.NETWORK?.client?.connected)NETWORK.send('roomSettings',{mode:rules.mode,pvp:rules.pvp,permissions:rules.permissions});window.dispatchEvent(new CustomEvent('advancedvoxel:hostpermissions',{detail:rules}));show('home');};

  function openInGameSettings(){
    const overlay=$('inGameSettings');if(!overlay)return;const multi=(window.AV_WORLD_CONFIG?.type==='multi'||get('advanced_voxel_world_type','single')==='multi');
    const mode=normalizeMode(window.GAME_MODE||window.GAME?.playerMode||get('advanced_voxel_player_mode',get('advanced_voxel_game_mode','survival')));
    modeOptions($('inGameModeSetting'),mode);$('modeExplain').textContent=MODE_DESC[mode];
    $('multiplayerSettingsSection').classList.toggle('hidden',!multi);
    if(multi){$('inGameInviteCode').textContent=get('advanced_voxel_invite_code','------');const host=!!window.GAME?.isHost; $('hostPermissionsBox').classList.toggle('hidden',!host);$('inGameDefaultMode').value=normalizeMode(get('advanced_voxel_host_mode',mode));let p;try{p=JSON.parse(get('advanced_voxel_host_perms',JSON.stringify(defaultPerms)))}catch(e){p=defaultPerms}setPerms('inPerm',p);renderInGameMembers();}
    $('inQualitySetting').value=get('advanced_voxel_quality','medium');$('inShadowSetting').value=get('advanced_voxel_shadows','on');$('inSensitivitySetting').value=get('advanced_voxel_sensitivity','7');$('inVolumeSetting').value=get('advanced_voxel_volume','70');overlay.classList.remove('hidden');
  }
  function renderInGameMembers(){const box=$('inGameMemberList');if(!box)return;let list=[];try{list=JSON.parse(get('advanced_voxel_invited_members','[]'))}catch(e){};box.innerHTML=list.length?list.map((m,i)=>`<div class="memberCard"><div class="memberHead"><span>${String(m.name||'Player').replace(/[<>]/g,'')}</span><span class="memberRole">${m.role||'Người chơi'}</span></div><div class="memberActions"><select class="menuSelect inMemberMode" data-i="${i}"><option value="survival" ${normalizeMode(m.mode)==='survival'?'selected':''}>Sinh tồn</option><option value="free" ${normalizeMode(m.mode)==='free'?'selected':''}>Tự do</option><option value="explore" ${normalizeMode(m.mode)==='explore'?'selected':''}>Khám phá</option><option value="observer" ${normalizeMode(m.mode)==='observer'?'selected':''}>Quan sát</option></select></div></div>`).join(''):'<div class="menuHint">Chưa có người chơi khác.</div>';box.querySelectorAll('.inMemberMode').forEach(s=>s.onchange=()=>{const m=list[+s.dataset.i];if(!m)return;m.mode=normalizeMode(s.value);set('advanced_voxel_invited_members',JSON.stringify(list));if(window.NETWORK?.client?.connected&&m.id)NETWORK.send('permissionUpdate',{playerId:m.id,mode:m.mode,permissions:m.permissions||currentPerms('inPerm')});});}
  $('gameSettingsButton').onclick=openInGameSettings;$('closeInGameSettings').onclick=()=>$('inGameSettings').classList.add('hidden');
  $('inGameModeSetting').onchange=()=>{$('modeExplain').textContent=MODE_DESC[normalizeMode($('inGameModeSetting').value)];};
  $('copyInGameInviteBtn').onclick=()=>copyText($('inGameInviteCode')?.textContent||'');
  $('saveInGameSettings').onclick=()=>{
    const mode=normalizeMode($('inGameModeSetting').value);window.GAME_MODE=mode;set('advanced_voxel_player_mode',mode);if(window.GAME)GAME.playerMode=mode;window.dispatchEvent(new CustomEvent('advancedvoxel:modechanged',{detail:{mode}}));
    set('advanced_voxel_quality',$('inQualitySetting').value);set('advanced_voxel_shadows',$('inShadowSetting').value);set('advanced_voxel_sensitivity',$('inSensitivitySetting').value);set('advanced_voxel_volume',$('inVolumeSetting').value);
    if(window.AV_WORLD_CONFIG?.type==='multi'&&window.NETWORK?.client?.connected)NETWORK.send('playerSettings',{mode});
    if(window.GAME?.isHost&&window.AV_WORLD_CONFIG?.type==='multi'){const rules={mode:normalizeMode($('inGameDefaultMode').value),permissions:currentPerms('inPerm')};set('advanced_voxel_host_mode',rules.mode);set('advanced_voxel_host_perms',JSON.stringify(rules.permissions));NETWORK.send('roomSettings',rules);}
    $('inGameSettingsStatus').textContent='ĐÃ LƯU';setTimeout(()=>$('inGameSettings').classList.add('hidden'),250);
  };

  if(window.NETWORK&&typeof NETWORK.on==='function'){
    NETWORK.on('inviteCreated',m=>{const p=m?.payload||{};if(p.code){inviteCode=p.code;set('advanced_voxel_invite_code',p.code);if($('inviteCodeDisplay'))$('inviteCodeDisplay').textContent=p.code;if($('worldInviteCode'))$('worldInviteCode').textContent=p.code;if($('inGameInviteCode'))$('inGameInviteCode').textContent=p.code;}});
    NETWORK.on('inviteAccepted',m=>{const p=m?.payload||{};set('advanced_voxel_join_invite_code',p.code||'');set('advanced_voxel_world_name',p.worldName||p.room||'Thế giới mời');set('advanced_voxel_world_type','multi');set('advanced_voxel_game_mode',normalizeMode(p.mode||'survival'));set('advanced_voxel_player_mode',normalizeMode(p.playerMode||p.mode||'survival'));set('advanced_voxel_invite_code',p.code||'');window.AV_WORLD_CONFIG={name:p.worldName||p.room||'Thế giới mời',seed:p.seed||'INVITE',gameMode:normalizeMode(p.playerMode||p.mode||'survival'),type:'multi',serverUrl:get('advanced_voxel_server_url',''),inviteCode:p.code||''};window.GAME_MODE=normalizeMode(p.playerMode||p.mode||'survival');$('inviteJoinStatus').textContent='Đã vào thế giới: '+(p.worldName||p.room||'');root.classList.add('hidden');const load=$('loadingScreen');if(load)load.classList.remove('hidden');if(typeof window.__AV_START_GAME==='function'){const resume=window.__AV_START_GAME;window.__AV_START_GAME=null;resume();}});
    NETWORK.on('inviteReject',m=>{$('inviteJoinStatus').textContent='Không thể vào: '+String(m?.payload?.reason||'MÃ KHÔNG HỢP LỆ');});
    NETWORK.on('inviteState',m=>{const p=m?.payload||{};if(p.code){inviteCode=p.code;set('advanced_voxel_invite_code',p.code);if($('inviteCodeDisplay'))$('inviteCodeDisplay').textContent=p.code;if($('worldInviteCode'))$('worldInviteCode').textContent=p.code;if($('inGameInviteCode'))$('inGameInviteCode').textContent=p.code;}if(Array.isArray(p.members)){set('advanced_voxel_invited_members',JSON.stringify(p.members));renderMembers();}});
    NETWORK.on('permissionChanged',m=>{const p=m?.payload||{};if(p.mode){window.GAME_MODE=normalizeMode(p.mode);if(window.GAME)GAME.playerMode=window.GAME_MODE;set('advanced_voxel_player_mode',window.GAME_MODE);window.dispatchEvent(new CustomEvent('advancedvoxel:modechanged',{detail:p}));}});
    NETWORK.on('roomSettings',m=>{const p=m?.payload||{};if(p.mode){set('advanced_voxel_host_mode',normalizeMode(p.mode));}if(p.permissions)set('advanced_voxel_host_perms',JSON.stringify(p.permissions));});
  }

  root.querySelectorAll('.skinCard').forEach(c=>c.addEventListener('click',()=>{}));
  const quality=$('qualitySetting'),shadow=$('shadowSetting'),view=$('viewSetting'),sens=$('sensitivitySetting'),vib=$('vibrationSetting'),vol=$('volumeSetting');
  quality.value=get('advanced_voxel_quality','medium');shadow.value=get('advanced_voxel_shadows','on');view.value=get('advanced_voxel_view','3');sens.value=get('advanced_voxel_sensitivity','7');vib.value=get('advanced_voxel_vibration','on');vol.value=get('advanced_voxel_volume','70');
  $('saveSettingsBtn').onclick=()=>{set('advanced_voxel_quality',quality.value);set('advanced_voxel_shadows',shadow.value);set('advanced_voxel_view',view.value);set('advanced_voxel_sensitivity',sens.value);set('advanced_voxel_vibration',vib.value);set('advanced_voxel_volume',vol.value);show('home');};
  $('worldNameInput').value=get('advanced_voxel_world_name','Thế giới mới');$('worldSeedInput').value=get('advanced_voxel_world_seed','ADVANCED');modeOptions($('worldGameMode'),get('advanced_voxel_game_mode','survival'));
  refreshProfile();
})();
