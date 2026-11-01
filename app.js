const DB_NAME = "JIN_CASHBOOK_MOBILE";
const DB_VERSION = 1;
const STORE = "entries";
const LS_KEY = "JIN_CASHBOOK_MOBILE_ENTRIES_V1";

let entries = [];
let kind = "income";
let editingId = null;
let currentMode = "day";

const $ = id => document.getElementById(id);
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const money = n => Number(n || 0).toLocaleString("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const thaiDate = s => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return `${d}/${m}/${y + 543}`;
};
const uid = () => `cash_${Date.now()}_${Math.random().toString(36).slice(2)}`;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function loadEntries() {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(result));
    } catch (_) {}
    return result;
  } catch (_) {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }
}

async function saveEntries(list) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.clear();
      list.forEach(e => store.put(e));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
    });
  } catch (_) {
    // Fallback keeps the app usable in restricted WebViews.
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch (_) {}
}

function setKind(type) {
  kind = type;
  $("incomeBtn").className = `type income${type === "income" ? " active" : ""}`;
  $("expenseBtn").className = `type expense${type === "expense" ? " active" : ""}`;
}

function openModal(type = kind) {
  $("modal").classList.remove("hidden");
  if (!editingId) {
    $("date").value = today();
    $("amount").value = "";
    $("description").value = "";
    $("note").value = "";
    $("formTitle").textContent = "เพิ่มรายการ";
    $("saveBtn").textContent = "บันทึกรายการ";
  }
  setKind(type);
  setTimeout(() => $("amount").focus(), 120);
}

function closeModal() {
  editingId = null;
  $("modal").classList.add("hidden");
  setKind("income");
}

function getPeriodLabel() {
  if (currentMode === "day") return `วันนี้ ${thaiDate(today())}`;
  if (currentMode === "month") return `เดือนนี้ ${today().slice(0, 7)}`;
  if (currentMode === "year") return `ปีนี้ ${Number(today().slice(0, 4)) + 543}`;
  return "ทั้งหมด";
}

function periodEntries(list = entries) {
  const t = today();
  if (currentMode === "day") return list.filter(e => e.date === t);
  if (currentMode === "month") return list.filter(e => e.date.startsWith(t.slice(0, 7)));
  if (currentMode === "year") return list.filter(e => e.date.startsWith(t.slice(0, 4)));
  return list.slice();
}

function historyEntries() {
  const q = ($( "search")?.value || "").trim().toLowerCase();
  return entries
    .filter(e => !q || `${e.description} ${e.note || ""}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function selectedEntries() {
  return periodEntries(entries).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function render() {
  const list = selectedEntries();
  const inc = list.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0);
  const out = list.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0);
  const net = inc - out;

  $("incomeTotal").textContent = `฿${money(inc)}`;
  $("expenseTotal").textContent = `฿${money(out)}`;
  $("netTotal").textContent = `${net < 0 ? "−" : ""}฿${money(Math.abs(net))}`;
  $("reportIncome").textContent = `฿${money(inc)}`;
  $("reportExpense").textContent = `฿${money(out)}`;
  $("reportNet").textContent = `${net < 0 ? "−" : ""}฿${money(Math.abs(net))}`;
  $("reportCount").textContent = list.length;
  $("reportText").innerHTML = `${getPeriodLabel()} · <b>${list.length}</b> รายการ · รายรับ <b>฿${money(inc)}</b> · รายจ่าย <b>฿${money(out)}</b> · คงเหลือ <b>${net < 0 ? "−" : ""}฿${money(Math.abs(net))}</b>`;

  renderMonthlyChart();
  renderList($("list"), historyEntries());
  renderList($("recentList"), list.slice(0, 5));
}

function renderMonthlyChart() {
  const box = $("monthlyChart");
  if (!box) return;
  const now = new Date();
  const names = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const months = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rows = entries.filter(e => e.date.startsWith(key));
    months.push({
      name: names[d.getMonth()],
      inc: rows.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0),
      out: rows.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0)
    });
  }
  const max = Math.max(1, ...months.flatMap(m => [m.inc, m.out]));
  box.innerHTML = months.map(m => `
    <div class="month-col">
      <div class="bar-pair">
        <span class="month-bar in" style="height:${Math.max(5, m.inc / max * 100)}%"></span>
        <span class="month-bar out" style="height:${Math.max(5, m.out / max * 100)}%"></span>
      </div>
      <div class="month-name">${m.name}</div>
    </div>`).join("");
}

function renderList(box, list) {
  if (!box) return;
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = '<div class="empty">ยังไม่มีรายการ</div>';
    return;
  }
  list.forEach(x => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item-top">
        <div class="item-left">
          <div class="item-bullet ${x.type === "income" ? "in" : "out"}">${x.type === "income" ? "↓" : "↑"}</div>
          <div>
            <div class="item-desc"></div>
            <div class="item-note"></div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="item-date">${thaiDate(x.date)}</div>
          <div class="amount ${x.type === "income" ? "in" : "out"}">${x.type === "income" ? "+" : "−"} ฿${money(x.amount)}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="edit" type="button">แก้ไข</button>
        <button class="del" type="button">ลบ</button>
      </div>`;
    el.querySelector(".item-desc").textContent = x.description;
    el.querySelector(".item-note").textContent = x.note || "";
    el.querySelector(".edit").onclick = () => edit(x.id);
    el.querySelector(".del").onclick = () => remove(x.id);
    box.appendChild(el);
  });
}

async function saveEntry() {
  const date = $("date").value;
  const amount = Number($("amount").value);
  const description = $("description").value.trim();

  if (!date) return alert("กรุณาเลือกวันที่");
  if (!description) return alert("กรุณากรอกรายละเอียดรายการ");
  if (!Number.isFinite(amount) || amount <= 0) return alert("กรุณากรอกจำนวนเงินมากกว่า 0");

  const item = {
    id: editingId || uid(),
    date,
    type: kind,
    description,
    amount: Math.round(amount * 100) / 100,
    note: $("note").value.trim()
  };

  if (editingId) {
    const i = entries.findIndex(x => x.id === editingId);
    if (i >= 0) entries[i] = item;
  } else {
    entries.push(item);
  }

  await saveEntries(entries);
  closeModal();
  render();
  alert(editingId ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "บันทึกรายการเรียบร้อยแล้ว");
}

function edit(id) {
  const x = entries.find(e => e.id === id);
  if (!x) return;
  editingId = id;
  $("formTitle").textContent = "แก้ไขรายการ";
  $("saveBtn").textContent = "บันทึกการแก้ไข";
  $("date").value = x.date;
  $("amount").value = x.amount;
  $("description").value = x.description;
  $("note").value = x.note || "";
  openModal(x.type);
}

async function remove(id) {
  const x = entries.find(e => e.id === id);
  if (!x) return;
  if (!confirm(`ยืนยันลบ “${x.description}” จำนวน ${money(x.amount)} บาท?`)) return;
  entries = entries.filter(e => e.id !== id);
  await saveEntries(entries);
  render();
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".period-pills button").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  render();
}

function go(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === page));
  document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n.dataset.page === page));
  if (page === "history") renderList($("list"), historyEntries());
  if (page === "summary") render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function download(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}

async function backup() {
  const blob = new Blob([JSON.stringify({ app: "JIN_CASHBOOK", version: 1, entries }, null, 2)], { type: "application/json" });
  const name = `JIN_Cashbook_Backup_${today()}.json`;
  if (navigator.share && window.File) {
    try {
      const file = new File([blob], name, { type: "application/json" });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "JIN Cashbook Backup", files: [file] });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  download(blob, name);
}

function csv() {
  const rows = [["วันที่", "รายการรายละเอียด", "รายรับ", "รายจ่าย", "หมายเหตุ"], ...historyEntries().map(x => [
    thaiDate(x.date), x.description,
    x.type === "income" ? x.amount : "",
    x.type === "expense" ? x.amount : "",
    x.note || ""
  ])];
  const out = "\ufeff" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  download(new Blob([out], { type: "text/csv;charset=utf-8" }), `JIN_Cashbook_${today()}.csv`);
}

function restoreFile(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const x = JSON.parse(r.result);
      if (x.app !== "JIN_CASHBOOK" || !Array.isArray(x.entries)) throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
      if (!confirm(`กู้คืน ${x.entries.length} รายการ และแทนที่ข้อมูลในเครื่องใช่หรือไม่?`)) return;
      entries = x.entries.map(e => ({ ...e, amount: Number(e.amount) })).filter(e => e.id && e.date && e.type && Number.isFinite(e.amount));
      await saveEntries(entries);
      render();
      alert("กู้คืนข้อมูลเรียบร้อยแล้ว");
    } catch (err) {
      alert("กู้คืนไม่สำเร็จ: " + err.message);
    } finally {
      ev.target.value = "";
    }
  };
  r.readAsText(f);
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function reportData(){const list=selectedEntries(),inc=list.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount||0),0),out=list.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount||0),0);return{list,inc,out,net:inc-out};}
function buildReportHtml(){const {list,inc,out,net}=reportData();const rows=list.length?list.map(x=>`<tr><td>${thaiDate(x.date)}</td><td>${x.type==="income"?"รายรับ":"รายจ่าย"}</td><td>${escapeHtml(x.description)}</td><td>${escapeHtml(x.note||"")}</td><td class="report-right ${x.type==="income"?"report-in":"report-out"}">${x.type==="income"?"+":"−"}฿${money(x.amount)}</td></tr>`).join(""):"<tr><td colspan=5 class=report-empty>ไม่มีรายการในช่วงที่เลือก</td></tr>";return `<div class="report-sheet"><div class="report-heading"><h1>JIN Cashbook</h1><h2>รายงานรายรับ-รายจ่าย</h2><div class="report-period">${getPeriodLabel()}</div><div class="report-generated">พิมพ์รายงานวันที่ ${thaiDate(today())}</div></div><div class="report-summary"><div class="rs income"><small>รายรับ</small><b>฿${money(inc)}</b></div><div class="rs expense"><small>รายจ่าย</small><b>฿${money(out)}</b></div><div class="rs balance"><small>คงเหลือ</small><b>${net<0?"−":""}฿${money(Math.abs(net))}</b></div><div class="rs count"><small>จำนวนรายการ</small><b>${list.length}</b></div></div><div class="report-table-wrap"><table class="report-table"><thead><tr><th>วันที่</th><th>ประเภท</th><th>รายการรายละเอียด</th><th>หมายเหตุ</th><th>จำนวนเงิน</th></tr></thead><tbody>${rows}</tbody></table></div><div class="report-footer">JIN Cashbook Mobile · รายงานจากข้อมูลที่เก็บในเครื่อง</div></div>`;}
function showReport(){$("reportContent").innerHTML=buildReportHtml();$("reportView").classList.remove("hidden");document.body.classList.add("report-open");window.scrollTo(0,0);}
function closeReport(){$("reportView").classList.add("hidden");document.body.classList.remove("report-open");go("home");}
async function wrapCanvasText(ctx, text, maxWidth){
  const out=[]; let line="";
  for(const ch of String(text??"")){
    const test=line+ch;
    if(ctx.measureText(test).width>maxWidth && line){out.push(line);line=ch;}else line=test;
  }
  if(line||!out.length) out.push(line);
  return out;
}
function pdfEscapeBytes(bytes){return bytes;}
function b64ToBytes(b64){const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
async function canvasPagesToPdf(pages){
  const W=595,H=842; const objs=[]; const add=o=>{objs.push(o);return objs.length;};
  const catalog=add(null), pagesObj=add(null), pageIds=[];
  const fontObj=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for(const canvas of pages){
    const data=canvas.toDataURL('image/jpeg',0.92).split(',')[1]; const img=b64ToBytes(data);
    const imgObj=add({jpeg:img,w:canvas.width,h:canvas.height});
    const content=`q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentObj=add(content);
    const pageObj=add({page:true,contentObj,imgObj}); pageIds.push(pageObj);
  }
  objs[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  const chunks=[]; const enc=new TextEncoder(); let offset=0; const offsets=[0];
  const pushBytes=b=>{chunks.push(b);offset+=b.length;};
  pushBytes(enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'));
  for(let i=0;i<objs.length;i++){
    offsets.push(offset); const n=i+1; const o=objs[i]; let head=`${n} 0 obj\n`;
    if(typeof o==='string'){
      const body=o; pushBytes(enc.encode(head+body+'\nendobj\n'));
    }else if(o && o.jpeg){
      pushBytes(enc.encode(head+`<< /Type /XObject /Subtype /Image /Width ${o.w} /Height ${o.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.jpeg.length} >>\nstream\n`));
      pushBytes(o.jpeg); pushBytes(enc.encode('\nendstream\nendobj\n'));
    }else if(o && o.page){
      pushBytes(enc.encode(head+`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${o.imgObj} 0 R >> >> /Contents ${o.contentObj} 0 R >>\nendobj\n`));
    }
  }
  const xref=offset; pushBytes(enc.encode(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`));
  for(let i=1;i<=objs.length;i++)pushBytes(enc.encode(String(offsets[i]).padStart(10,'0')+' 00000 n \n'));
  pushBytes(enc.encode(`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  const blob=new Blob(chunks,{type:'application/pdf'}); return blob;
}
function drawReportPage(canvas, list, pageIndex, pageCount, inc, out, net){
  const ctx=canvas.getContext('2d'); const S=2, W=1240,H=1754, M=70; canvas.width=W;canvas.height=H;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0758dc';ctx.fillRect(0,0,W,150);
  ctx.fillStyle='#fff';ctx.font='bold 46px Arial,"Noto Sans Thai",sans-serif';ctx.textAlign='center';ctx.fillText('JIN Cashbook',W/2,62);
  ctx.font='bold 27px Arial,"Noto Sans Thai",sans-serif';ctx.fillText('รายงานรายรับ-รายจ่าย',W/2,105);
  ctx.font='bold 22px Arial,"Noto Sans Thai",sans-serif';ctx.fillText(getPeriodLabel(),W/2,137);
  ctx.textAlign='left';ctx.fillStyle='#182536';ctx.font='bold 25px Arial,"Noto Sans Thai",sans-serif';ctx.fillText(`รายงานวันที่ ${thaiDate(today())}`,M,205);
  const cards=[['รายรับ',`฿${money(inc)}`,'#12b95b'],['รายจ่าย',`฿${money(out)}`,'#ef3b5d'],['คงเหลือ',`${net<0?'−':''}฿${money(Math.abs(net))}`,'#1769e0'],['จำนวนรายการ',String(list.length),'#7657db']];
  cards.forEach((c,i)=>{const x=M+i*275;ctx.fillStyle=c[2];ctx.roundRect(x,235,250,105,18);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 20px Arial,"Noto Sans Thai",sans-serif';ctx.fillText(c[0],x+18,267);ctx.font='bold 28px Arial,"Noto Sans Thai",sans-serif';ctx.fillText(c[1],x+18,310);});
  let y=390; const cols=[M,180,340,760,1010]; const heads=['วันที่','ประเภท','รายการรายละเอียด','หมายเหตุ','จำนวนเงิน'];
  ctx.fillStyle='#eaf1f8';ctx.fillRect(M,y,W-2*M,52);ctx.fillStyle='#29425d';ctx.font='bold 18px Arial,"Noto Sans Thai",sans-serif';heads.forEach((h,i)=>ctx.fillText(h,cols[i]+8,y+33));y+=52;
  const rowH=66; const usableBottom=H-90;
  const rows=list.slice(pageIndex*20,(pageIndex+1)*20);
  rows.forEach((x,ri)=>{ctx.strokeStyle='#cbd7e5';ctx.strokeRect(M,y,W-2*M,rowH);ctx.fillStyle=ri%2?'#fff':'#f8fbfe';ctx.fillRect(M,y,W-2*M,rowH);ctx.strokeStyle='#cbd7e5';[cols[1],cols[2],cols[3],cols[4]].forEach(col=>{ctx.beginPath();ctx.moveTo(col,y);ctx.lineTo(col,y+rowH);ctx.stroke();});ctx.fillStyle='#182536';ctx.font='16px Arial,"Noto Sans Thai",sans-serif';ctx.fillText(thaiDate(x.date),cols[0]+8,y+25);ctx.fillText(x.type==='income'?'รายรับ':'รายจ่าย',cols[1]+8,y+25);ctx.fillText(String(x.description||'').slice(0,32),cols[2]+8,y+25);ctx.fillText(String(x.note||'').slice(0,20),cols[3]+8,y+25);ctx.textAlign='right';ctx.fillStyle=x.type==='income'?'#0a9f36':'#e91d43';ctx.font='bold 17px Arial,"Noto Sans Thai",sans-serif';ctx.fillText(`${x.type==='income'?'+':'−'}฿${money(x.amount)}`,W-M-10,y+25);ctx.textAlign='left';y+=rowH;});
  if(!rows.length){ctx.fillStyle='#7b8998';ctx.font='20px Arial,"Noto Sans Thai",sans-serif';ctx.textAlign='center';ctx.fillText('ไม่มีรายการในช่วงที่เลือก',W/2,y+45);ctx.textAlign='left';}
  ctx.fillStyle='#8996a5';ctx.font='15px Arial,"Noto Sans Thai",sans-serif';ctx.textAlign='center';ctx.fillText(`JIN Cashbook Mobile · หน้า ${pageIndex+1}/${pageCount}`,W/2,H-35);ctx.textAlign='left';
}
async function makeReportPdf(){
  const {list,inc,out,net}=reportData(); const pageSize=20; const pageCount=Math.max(1,Math.ceil(list.length/pageSize)); const pages=[];
  for(let i=0;i<pageCount;i++){const c=document.createElement('canvas');drawReportPage(c,list,i,pageCount,inc,out,net);pages.push(c);}
  return await canvasPagesToPdf(pages);
}
function isStandalonePWA(){
  return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function openPdfInBrowser(file){
  const url = URL.createObjectURL(file);
  // In iOS Home Screen/PWA mode, opening the Blob in a new browser context
  // is much more reliable than navigator.share({files}) or <a download>.
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

async function shareReport(){
  try{
    const file=new File([await makeReportPdf()],`JIN_Cashbook_${today()}.pdf`,{type:'application/pdf'});
    // Safari browser: use the native file share when supported.
    if(!isStandalonePWA() && navigator.share){
      try{
        if(!navigator.canShare || navigator.canShare({files:[file]})){
          await navigator.share({title:'JIN Cashbook - รายงาน PDF',files:[file]});
          return;
        }
      }catch(e){
        if(e?.name==='AbortError') return;
      }
    }
    // Home Screen/PWA or unsupported file-share: open the PDF in the browser.
    // The iOS PDF viewer then provides its own Share button for LINE/Files/etc.
    openPdfInBrowser(file);
  }catch(e){
    if(e?.name==='AbortError')return;
    console.error('shareReport',e);
    alert('สร้าง/แชร์ PDF ไม่สำเร็จ: '+(e?.message||e));
  }
}

async function saveReportPdf(){
  try{
    const file = new File([await makeReportPdf()], `JIN_Cashbook_${today()}.pdf`, {type:'application/pdf'});

    // Browser mode: native file share is the cleanest route.
    if(!isStandalonePWA() && navigator.share){
      try{
        if(!navigator.canShare || navigator.canShare({files:[file]})){
          await navigator.share({
            title:'JIN Cashbook - PDF รายงาน',
            files:[file]
          });
          return;
        }
      }catch(e){
        if(e?.name==='AbortError') return;
      }
    }

    // iOS Home Screen/PWA cannot reliably download/share Blob files directly.
    // Open the generated PDF in the browser/PDF viewer instead. From there the
    // user can tap Share and choose LINE, Files, Drive, etc.
    openPdfInBrowser(file);
  }catch(e){
    if(e?.name==='AbortError') return;
    console.error('saveReportPdf',e);
    alert('สร้าง/เปิด PDF ไม่สำเร็จ\n'+(e?.message||e));
  }
}

function init() {
  // All event handlers are wired only to elements that really exist in index.html.
  $("incomeBtn").onclick = () => setKind("income");
  $("expenseBtn").onclick = () => setKind("expense");
  $("saveBtn").onclick = saveEntry;
  $("cancelBtn").onclick = closeModal;
  $("closeModal").onclick = closeModal;
  $("fab").onclick = () => openModal("income");
  $("quickIncome").onclick = () => openModal("income");
  $("quickExpense").onclick = () => go("summary");
  $("quickBackup").onclick = () => go("summary");
  $("backupQuick").onclick = backup;
  $("restoreQuick").onclick = () => $("restoreFile").click();
  $("csvQuick").onclick = csv;
  $("printQuick").onclick = showReport;
  $("seeAllChart").onclick = () => go("summary");
  $("seeAll").onclick = () => go("history");
  $("seeAllQuick").onclick = () => go("history");
  $("headerSettings").onclick = () => go("settings");
  document.querySelectorAll(".nav").forEach(n => n.onclick = () => go(n.dataset.page));
  document.querySelectorAll(".period-pills button").forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $("search").oninput = () => renderList($("list"), historyEntries());
  $("backupBtn").onclick = backup;
  $("restoreBtn").onclick = () => $("restoreFile").click();
  $("restoreFile").onchange = restoreFile;
  $("csvBtn").onclick = csv;
  $("reportBack").onclick = closeReport;
  $("reportShare").onclick = shareReport;
  $("reportPdf").onclick = saveReportPdf;
  $("printBtn").onclick = showReport;

  const t = today();
  $("date").value = t;
  entries = [];
  render();

  loadEntries().then(list => {
    entries = Array.isArray(list) ? list : [];
    render();
  }).catch(() => render());

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js?v=fix7").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
