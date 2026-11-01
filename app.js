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
async function shareReport(){const {list,inc,out,net}=reportData();const text=["JIN Cashbook","รายงานรายรับ-รายจ่าย",getPeriodLabel(),"",`รายรับ: ฿${money(inc)}`,`รายจ่าย: ฿${money(out)}`,`คงเหลือ: ${net<0?"−":""}฿${money(Math.abs(net))}`,`จำนวนรายการ: ${list.length}`].join("\n");if(navigator.share){try{await navigator.share({title:"JIN Cashbook - รายงาน",text});return}catch(e){if(e?.name==="AbortError")return;}}try{await navigator.clipboard.writeText(text);alert("คัดลอกรายงานแล้ว สามารถนำไปวางใน LINE / Messenger / อีเมลได้")}catch(_){alert(text)}}
function saveReportPdf(){
  const html = buildReportHtml();
  const w = window.open("", "_blank");
  if(!w){
    alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up แล้วกด Save PDF อีกครั้ง");
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JIN Cashbook - Save PDF</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef5fd;color:#182536;font-family:Arial,"Noto Sans Thai",sans-serif}.printbar{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#0758dc,#087bf4);color:#fff;padding:10px;display:flex;gap:8px;align-items:center;box-shadow:0 3px 12px rgba(0,50,140,.25)}.printbar button{border:0;border-radius:10px;padding:10px 13px;font-weight:900;color:#fff;background:rgba(255,255,255,.16)}.printbar .go{margin-left:auto;background:#ff8a00}.printbar small{font-weight:900}.wrap{max-width:900px;margin:auto;padding:12px}.report-sheet{background:#fff;padding:20px;box-shadow:0 4px 18px rgba(20,60,110,.12);border-radius:14px}.report-heading{text-align:center}.report-heading h1{margin:0;color:#0758dc;font-size:25px}.report-heading h2{margin:2px 0;font-size:17px}.report-period{font-weight:900;color:#30485f;margin-top:6px}.report-generated{font-size:10px;color:#7a8999;margin-top:2px}.report-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.rs{border-radius:12px;padding:10px;color:#fff}.rs small{display:block;font-size:10px}.rs b{display:block;font-size:16px;margin-top:4px}.rs.income{background:#12b95b}.rs.expense{background:#ef3b5d}.rs.balance{background:#1769e0}.rs.count{background:#7657db}.report-table{width:100%;border-collapse:collapse;font-size:11px}.report-table th,.report-table td{border:1px solid #cbd7e5;padding:7px}.report-table th{background:#edf3fa;color:#29425d}.report-right{text-align:right;white-space:nowrap}.report-in{color:#0a9f36;font-weight:900}.report-out{color:#e91d43;font-weight:900}.report-empty{text-align:center;color:#7b8998;padding:20px}.report-footer{text-align:center;color:#8996a5;font-size:9px;margin-top:12px}@media(max-width:600px){.report-sheet{padding:12px;border-radius:10px}.report-summary{grid-template-columns:1fr 1fr}.report-table{font-size:9px}.report-table th,.report-table td{padding:5px}.report-table th:nth-child(4),.report-table td:nth-child(4){display:none}}@media print{body{background:#fff}.printbar{display:none!important}.wrap{max-width:none;padding:0}.report-sheet{box-shadow:none;border-radius:0;padding:0}.report-table{font-size:9pt}.report-table th,.report-table td{padding:5px}.report-table th:nth-child(4),.report-table td:nth-child(4){display:table-cell}@page{size:A4;margin:10mm}}
  </style></head><body><div class="printbar"><button onclick="window.close()">← กลับรายงาน</button><small>📄 JIN Cashbook · เตรียมบันทึก PDF</small><button class="go" onclick="doPrint()">⬇ Save PDF / พิมพ์</button></div><main class="wrap">${html}</main><script>function doPrint(){setTimeout(function(){window.print()},80)}window.addEventListener('load',function(){setTimeout(function(){window.print()},350)});</script></body></html>`);
  w.document.close();
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
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
