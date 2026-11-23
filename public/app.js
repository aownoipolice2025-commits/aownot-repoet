'use strict';
const $ = id => document.getElementById(id);
const canvas = $('reportCanvas'), ctx = canvas.getContext('2d');
const form = $('reportForm');
const reportFields = ['station','province','category','resultStatus','title','date','time','place','details','result','reporter','commander','phone'];
const officialFields = ['leaderName','leaderRole','supervisor1Name','supervisor1Role','supervisor2Name','supervisor2Role'];
const portraitKeys = ['leader','supervisor1','supervisor2'];
const portraits = { leader: null, supervisor1: null, supervisor2: null };
const photos = [];
let drawToken = 0, draftTimer;
const background = new Image();
background.src = 'assets/region7-background.jpg';
const backgroundReady = new Promise(resolve => { background.onload=resolve; background.onerror=resolve; });

function bangkokNow(){
  const pieces=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(t=>[t.type,t.value]));
  return {date:`${pieces.year}-${pieces.month}-${pieces.day}`,time:`${pieces.hour}:${pieces.minute}`};
}
function collect(ids){return Object.fromEntries(ids.map(id=>[id,$(id).value.trim()]));}
function read(){return {...collect(reportFields),...collect(officialFields)};}
function saveDraft(){try{sessionStorage.setItem('aonoi-report-draft-v2',JSON.stringify(collect(reportFields)));}catch{}}
function restoreDraft(){
  const now=bangkokNow();$('date').value=now.date;$('time').value=now.time;
  try{const v=JSON.parse(sessionStorage.getItem('aonoi-report-draft-v2')||'null');if(v)for(const id of reportFields)if(typeof v[id]==='string')$(id).value=v[id];}catch{}
}
function thaiDate(d){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return 'ยังไม่ระบุวันที่';
  return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${d}T12:00:00+07:00`));
}
function rounded(x,y,w,h,r=14,fill='#fff',stroke=null,line=2){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.lineWidth=line;ctx.strokeStyle=stroke;ctx.stroke();}
}
function setFont(size=24,bold=false){ctx.font=`${bold?'700':'400'} ${size}px 'Thonburi','Noto Sans Thai','Garuda',Tahoma,system-ui,sans-serif`;}
function label(s,x,y,size=24,color='#172e51',bold=false,align='left'){
  ctx.font=`${bold?'700':'400'} ${size}px 'Thonburi','Noto Sans Thai','Garuda',Tahoma,system-ui,sans-serif`;
  ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(String(s??''),x,y);
}
function fit(s,x,y,w,size=26,color='#172e51',bold=false,min=14){
  s=String(s||'—');ctx.textAlign='left';setFont(size,bold);
  while(size>min&&ctx.measureText(s).width>w){size--;setFont(size,bold);}
  ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.fillText(s,x,y,w);
}
function splitLines(raw,maxWidth,maxLines,size,bold=false){
  const s=String(raw||'—');setFont(size,bold);
  const segments=typeof Intl.Segmenter==='function'
    ? [...new Intl.Segmenter('th',{granularity:'word'}).segment(s)].map(v=>v.segment)
    : Array.from(s);
  const lines=[];let line='';
  for(const token of segments){
    const bits=token.split('\n');
    for(let k=0;k<bits.length;k++){
      if(k>0){lines.push(line.trim());line='';if(lines.length>=maxLines)break;}
      const piece=bits[k];
      if(!piece)continue;
      if(ctx.measureText(line+piece).width>maxWidth&&line){lines.push(line.trim());line=piece.trimStart();}
      else line+=piece;
      if(lines.length>=maxLines)break;
    }
    if(lines.length>=maxLines)break;
  }
  if(lines.length<maxLines&&line.trim())lines.push(line.trim());
  if(lines.length>=maxLines&&s.length>lines.join('').length){
    let end=lines[maxLines-1];
    while(end&&ctx.measureText(end+'…').width>maxWidth)end=end.slice(0,-1);
    lines[maxLines-1]=end+'…';
  }
  return lines.slice(0,maxLines);
}
function paragraph(s,x,y,w,n=3,size=23,lh=35,color='#203553',bold=false){
  const lines=splitLines(s,w,n,size,bold);
  for(const line of lines){label(line,x,y,size,color,bold);y+=lh;}return y;
}
function getImage(obj){return obj&&obj.img&&obj.img.naturalWidth?obj.img:null;}
function coverImage(img,x,y,w,h){
  const ratio=Math.max(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function photoSlot(obj,x,y,w,h,circle=false,kind='photo'){
  ctx.save();ctx.beginPath();
  if(circle)ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2-3,0,2*Math.PI);
  else ctx.roundRect(x,y,w,h,13);
  ctx.clip();
  const img=getImage(obj);
  if(img)coverImage(img,x,y,w,h);
  else{
    const gr=ctx.createLinearGradient(x,y,x+w,y+h);gr.addColorStop(0,'#e9eff7');gr.addColorStop(1,'#b8c8df');
    ctx.fillStyle=gr;ctx.fillRect(x,y,w,h);
    label('＋',x+w/2,y+h/2+19,60,'#7592b4',true,'center');
    label(kind==='leader'?'รูป ผกก.':kind==='official'?'รูปผู้บังคับบัญชา':'ภาพประกอบ',x+w/2,y+h-22,w<150?13:17,'#547293',true,'center');
  }
  ctx.restore();ctx.beginPath();
  if(circle)ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2-3,0,2*Math.PI);
  else ctx.roundRect(x,y,w,h,13);
  ctx.strokeStyle='#dbb764';ctx.lineWidth=5;ctx.stroke();
}
function drawReport(){
  const d=read(), W=1024,H=1920;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b1b46';ctx.fillRect(0,0,W,H);
  if(background.naturalWidth){
    ctx.drawImage(background,0,0,1024,1536);
    ctx.drawImage(background,0,1080,1024,320,0,1536,1024,384);
  }
  // Background dimming preserves the Region 7 header, temple, bridge and dark-blue visual theme.
  ctx.fillStyle='rgba(8,20,53,.15)';ctx.fillRect(0,290,1024,1630);
  // Chief officer, visible above the report body.
  const chiefGrad=ctx.createLinearGradient(26,298,980,475);chiefGrad.addColorStop(0,'#7b141e');chiefGrad.addColorStop(.65,'#581018');chiefGrad.addColorStop(1,'#360d24');
  rounded(27,302,970,173,18,chiefGrad,'#d8aa53',4);
  photoSlot(portraits.leader,43,316,143,143,true,'leader');
  rounded(209,324,5,126,2,'#d2aa62');
  fit(d.station||'สภ.อ่าวน้อย',235,346,547,27,'#f9d67e',true);
  fit(d.leaderName||'กรอกชื่อผู้กำกับการ',235,394,719,39,'#ffffff',true,23);
  fit(d.leaderRole||'ผู้กำกับการสถานีตำรวจภูธรอ่าวน้อย',235,431,680,24,'#e7dbe1');
  // Two supervisor cards under the main commander.
  rounded(27,489,970,195,18,'#f9f7f1','#d8b663',4);
  rounded(511,510,2,150,1,'#d4c18e');
  drawSupervisor(0,45,502,453,d.supervisor1Name,d.supervisor1Role,'ผู้บังคับบัญชา 1');
  drawSupervisor(1,528,502,453,d.supervisor2Name,d.supervisor2Role,'ผู้บังคับบัญชา 2');
  // Report category band.
  rounded(27,700,970,66,13,'#10285c','#dabb67',3);
  rounded(47,711,7,45,3,'#f1c56d');
  fit('รายงานผลการปฏิบัติ',70,746,470,36,'#ffffff',true);
  fit(d.category||'ป้องกันเหตุทั่วไป',625,746,334,24,'#f9d37d',true);
  // Primary event images and three extras.
  rounded(27,780,970,550,16,'#f8fbff','#d9b566',4);
  photoSlot(photos[0],40,792,657,521,false);
  for(let i=1;i<4;i++)photoSlot(photos[i],710,792+(i-1)*174,273,166,false);
  rounded(52,1176,634,126,12,'rgba(8,25,57,.91)');
  fit(`วันที่ ${thaiDate(d.date)}   •   เวลา ${d.time||'--:--'} น.`,70,1220,598,23,'#fff0bd',true);
  paragraph(`สถานที่: ${d.place||'รอกรอกสถานที่ปฏิบัติ'}`,70,1257,586,2,20,29,'#ffffff');
  // Report description.
  rounded(27,1343,970,101,14,'rgba(250,251,255,.98)','#d7b361',3);
  rounded(47,1360,7,67,3,'#a31524');
  label('หัวข้อรายงาน',71,1376,19,'#a06920',true);
  paragraph(d.title||'กรุณากรอกหัวข้อรายงาน',71,1410,892,2,25,29,'#152447',true);
  rounded(27,1456,970,194,14,'rgba(251,252,255,.98)','#d7b361',3);
  rounded(46,1475,175,39,9,'#8a1a28');
  label('รายละเอียดการปฏิบัติ',62,1503,20,'#ffffff',true);
  paragraph(d.details||'กรอกรายละเอียดผลการปฏิบัติที่แบบฟอร์ม',54,1544,921,3,22,34,'#23344f');
  rounded(27,1662,970,107,13,'rgba(246,248,252,.98)','#d7b361',3);
  rounded(45,1678,181,34,8,'#19386d');
  label('สรุปผลการปฏิบัติ',59,1702,18,'#ffffff',true);
  paragraph(d.result||d.resultStatus||'ดำเนินการเรียบร้อย',53,1734,919,2,19,26,'#1e3656',true);
  // Footer - don't replace underlying official Region 7 artwork with unrelated station imagery.
  rounded(27,1782,970,114,14,'rgba(8,24,61,.96)','#d9b663',3);
  fit(`ผู้รายงาน: ${d.reporter||'—'}`,51,1821,825,24,'#ffffff',true);
  fit(`ผู้ควบคุมภารกิจ: ${d.commander||'—'}`,51,1854,745,20,'#e4eaf4');
  fit(`${d.province||'ภ.จว.ประจวบคีรีขันธ์'}${d.phone?'  •  โทร. '+d.phone:''}`,51,1880,899,19,'#f2ca7d',true);
}
function drawSupervisor(i,x,y,w,name,role,slotTitle){
  const key=i===0?'supervisor1':'supervisor2';
  photoSlot(portraits[key],x,y+12,134,151,false,'official');
  rounded(x+148,y+15,173,30,13,'#f6e7c0','#d7b363',1);
  fit(slotTitle,x+162,y+36,150,17,'#862c21',true);
  fit(name||'กรอกชื่อผู้บังคับบัญชา',x+149,y+86,w-160,27,'#1e2839',true,17);
  paragraph(role||'กรอกตำแหน่ง',x+149,y+120,w-161,2,19,29,'#465a74');
}
async function render(){
  const token=++drawToken;
  await backgroundReady;
  await Promise.all([...photos.map(o=>o.ready), ...portraitKeys.map(k=>portraits[k]?.ready).filter(Boolean)]);
  if(drawToken===token)drawReport();
}
async function buildImages(){
  await render();
  let full=canvas.toDataURL('image/jpeg',.80);
  if(full.length>3_100_000)full=canvas.toDataURL('image/jpeg',.70);
  const mini=document.createElement('canvas');mini.width=240;mini.height=450;
  mini.getContext('2d').drawImage(canvas,0,0,240,450);
  return {full,thumb:mini.toDataURL('image/jpeg',.67)};
}
function setStatus(message,type=''){const elem=$('actionStatus');elem.textContent=message;elem.className='status-msg '+type;}
function createPreviewImage(){return `รายงาน_สภอ่าวน้อย_${$('date').value||bangkokNow().date}.jpg`;}
async function downloadImage(){
  $('downloadBtn').disabled=true;
  try{const {full}=await buildImages();const a=document.createElement('a');a.download=createPreviewImage();a.href=full;document.body.append(a);a.click();a.remove();setStatus('สร้างภาพ JPG สำเร็จ หากเปิดบน iPhone เป็นภาพ ให้กดค้างและเลือกบันทึกรูป','good');}
  catch(error){setStatus('เกิดข้อผิดพลาดในการสร้างภาพ: '+error.message,'error');}
  finally{$('downloadBtn').disabled=false;}
}
async function api(url,payload){
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  let content;try{content=await res.json();}catch{throw new Error(`เซิร์ฟเวอร์ไม่ตอบกลับ JSON (${res.status})`);}
  if(!res.ok)throw new Error(content.error||`HTTP ${res.status}`);return content;
}
async function submitReport(){
  if(!form.reportValidity())return setStatus('กรุณากรอกช่องที่มี * ให้ครบ','error');
  const pin=$('sendPin').value.trim();if(!pin)return setStatus('กรุณาใส่ REPORT_PIN ก่อนส่ง','error');
  $('sendBtn').disabled=true;setStatus('กำลังสร้างภาพและส่งข้อความกับภาพเข้า LINE...');
  try{
    const {full,thumb}=await buildImages();const report=read();delete report.resultStatus;
    const result=await api('/.netlify/functions/submit',{pin,report,imageFull:full,imagePreview:thumb});
    $('sendPin').value='';setStatus('✅ '+result.message,'good');
  }catch(error){setStatus('❌ '+error.message,'error');}
  finally{$('sendBtn').disabled=false;refreshConnection();}
}
async function testLine(){
  const pin=$('sendPin').value.trim();if(!pin)return setStatus('กรุณาใส่ REPORT_PIN ก่อนทดสอบ','error');
  $('testBtn').disabled=true;setStatus('กำลังทดสอบข้อความ LINE...');
  try{const result=await api('/.netlify/functions/test-line',{pin});setStatus('✅ '+result.message,'good');}
  catch(error){setStatus('❌ '+error.message,'error');}
  finally{$('testBtn').disabled=false;refreshConnection();}
}
async function refreshConnection(){
  const box=$('connection');
  try{
    const res=await fetch('/.netlify/functions/status',{cache:'no-store'});if(!res.ok)throw new Error();
    const data=await res.json();box.className='connection '+(data.ready?'connected':'partial');
    $('connectionTitle').textContent=data.ready?'เชื่อมต่อ LINE พร้อมส่งรายงาน':'สร้างภาพได้ · LINE ยังเชื่อมไม่ครบ';
    const s=data.setup;$('connectionDetail').textContent=`รหัส ${s.reportPassword?'✓':'○'} · LINE API ${s.messagingApi?'✓':'○'} · รหัสจับคู่ ${s.pairingCode?'✓':'○'} · กลุ่ม ${s.groupConnected?'✓':'○'}`;
  }catch{box.className='connection partial';$('connectionTitle').textContent='โหมดสร้างภาพบนเครื่อง';$('connectionDetail').textContent='ต้อง Deploy Netlify Functions ก่อนใช้ส่ง LINE';}
}
function makeLocalImage(file){
  const url=URL.createObjectURL(file), img=new Image();const obj={url,img,ready:null};
  obj.ready=new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;img.src=url;});return obj;
}
function renderPortraitInput(key){
  const el=$(`${key}PhotoView`);el.replaceChildren();const portrait=portraits[key];
  if(getImage(portrait)){const image=document.createElement('img');image.src=portrait.url;image.alt='รูปผู้บังคับบัญชา';el.append(image);}
  else{const span=document.createElement('span');span.textContent='📷';const small=document.createElement('small');small.textContent='เพิ่มรูปจริง';el.append(span,small);}
}
function updatePortrait(key,file){
  if(portraits[key]?.url?.startsWith('blob:'))URL.revokeObjectURL(portraits[key].url);
  portraits[key]=file?makeLocalImage(file):null;renderPortraitInput(key);render();
}
async function saveOfficials(){
  const payload={...collect(officialFields),photos:{}};
  for(const key of portraitKeys){
    const obj=portraits[key];if(!obj)continue;await obj.ready;
    if(!getImage(obj))continue;
    const c=document.createElement('canvas');c.width=260;c.height=320;coverToCanvas(c,obj.img);
    payload.photos[key]=c.toDataURL('image/jpeg',.70);
  }
  try{localStorage.setItem('aonoi-officials-v2',JSON.stringify(payload));$('officialsStatus').textContent='✅ บันทึกชื่อ ตำแหน่ง และรูปลงในเบราว์เซอร์เครื่องนี้แล้ว';}
  catch{$('officialsStatus').textContent='❌ บันทึกไม่ได้ (พื้นที่เครื่อง/โหมดส่วนตัวอาจจำกัด) กรุณาเปิดผ่านเบราว์เซอร์ปกติ';}
}
function coverToCanvas(c,img){const cctx=c.getContext('2d');const w=c.width,h=c.height;const ratio=Math.max(w/img.naturalWidth,h/img.naturalHeight);const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;cctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);}
function restoreOfficials(){
  try{
    const stored=JSON.parse(localStorage.getItem('aonoi-officials-v2')||'null');if(!stored)return;
    for(const id of officialFields)if(typeof stored[id]==='string')$(id).value=stored[id];
    for(const key of portraitKeys){const src=stored.photos?.[key];if(typeof src!=='string'||!src.startsWith('data:image/jpeg;base64,'))continue;const img=new Image();const obj={img,url:src,ready:null};obj.ready=new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;img.src=src;});portraits[key]=obj;renderPortraitInput(key);}
  }catch{}
}
function clearEventPhotos(){for(const p of photos){if(p.url?.startsWith('blob:'))URL.revokeObjectURL(p.url);}photos.length=0;}
function photoThumbs(){
  const node=$('photoThumbs');node.replaceChildren();photos.forEach((p,i)=>{
    const div=document.createElement('div');div.className='thumb';const img=document.createElement('img');img.src=p.url;img.alt=`ภาพเหตุการณ์ ${i+1}`;
    const btn=document.createElement('button');btn.type='button';btn.title='ลบภาพ';btn.textContent='×';btn.addEventListener('click',()=>{if(p.url.startsWith('blob:'))URL.revokeObjectURL(p.url);photos.splice(i,1);photoThumbs();render();});
    div.append(img,btn);node.append(div);
  });$('photoCount').textContent=`${photos.length}/4`;
}
function addPhotos(files){
  for(const file of Array.from(files).slice(0,4-photos.length)){
    if(!file.type.startsWith('image/'))continue;
    if(file.size>16_000_000){setStatus(`ไฟล์ ${file.name} ใหญ่เกิน 16 MB`,'error');continue;}
    photos.push(makeLocalImage(file));
  }
  $('photos').value='';photoThumbs();render();
}
restoreDraft();restoreOfficials();backgroundReady.then(render);
form.addEventListener('input',()=>{saveDraft();clearTimeout(draftTimer);draftTimer=setTimeout(render,140);});
form.addEventListener('change',()=>{saveDraft();render();});
for(const key of portraitKeys){
  $(`${key}Photo`).addEventListener('change',event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')||file.size>16_000_000){$('officialsStatus').textContent='รูปต้องเป็นไฟล์ภาพ และขนาดไม่เกิน 16MB';return;}
    updatePortrait(key,file);event.target.value='';$('officialsStatus').textContent='เปลี่ยนรูปแล้ว กดบันทึกข้อมูลผู้บังคับบัญชาเพื่อใช้ในครั้งต่อไป';
  });
}
document.querySelectorAll('[data-portrait]').forEach(btn=>btn.addEventListener('click',()=>{updatePortrait(btn.dataset.portrait,null);$('officialsStatus').textContent='ลบรูปแล้ว กดบันทึกข้อมูลผู้บังคับบัญชาอีกครั้งเพื่อบันทึกการเปลี่ยนแปลง';}));
$('saveOfficialsBtn').addEventListener('click',saveOfficials);
$('photos').addEventListener('change',event=>addPhotos(event.target.files));
$('previewBtn').addEventListener('click',render);
$('downloadBtn').addEventListener('click',downloadImage);
$('sendBtn').addEventListener('click',submitReport);
$('testBtn').addEventListener('click',testLine);
$('resetBtn').addEventListener('click',()=>{
  if(!confirm('ล้างข้อมูลภารกิจและภาพเหตุการณ์หรือไม่? ข้อมูลผู้บังคับบัญชาที่บันทึกไว้จะยังอยู่'))return;
  for(const id of reportFields){const el=$(id);if(el.type==='select-one')el.selectedIndex=0;else if(id==='station')el.value='สภ.อ่าวน้อย';else if(id==='province')el.value='ภ.จว.ประจวบคีรีขันธ์';else el.value='';}
  const now=bangkokNow();$('date').value=now.date;$('time').value=now.time;
  clearEventPhotos();photoThumbs();try{sessionStorage.removeItem('aonoi-report-draft-v2');}catch{}render();
});
refreshConnection();
