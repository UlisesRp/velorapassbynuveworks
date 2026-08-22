const STORAGE_KEY = "veloraPassVouchersV1";

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

function getVouchers(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveVouchers(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

function makeFolio(){
  // Código automático con UUID criptográfico.
  // Se conserva el UUID completo internamente y se muestra un código legible.
  // En producción, Supabase tendrá además una restricción UNIQUE.
  const uuid = crypto.randomUUID
    ? crypto.randomUUID().replaceAll("-","").toUpperCase()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase();

  const stamp = new Date().toISOString().slice(2,10).replaceAll("-","");
  const code = `VL-${stamp}-${uuid.slice(0,10)}`;

  // Evita cualquier repetición dentro del almacenamiento actual.
  const existing = new Set(getVouchers().map(v => v.folio));
  if(existing.has(code)) return makeFolio();
  return code;
}
function formatDate(v){
  if(!v) return "—";
  return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T12:00:00"));
}
function shortDateTime(v){
  if(!v) return "—";
  return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}

function switchView(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $$(".nav-link").forEach(v=>v.classList.toggle("active",v.dataset.view===name));
  const target = $(`#${name}View`);
  if(target) target.classList.add("active");
  const titles={dashboard:"Panel de cupones",new:"Nuevo cupón",vouchers:"Cupones"};
  $("#pageTitle").textContent=titles[name]||"Velora Pass";
  if(name==="dashboard"||name==="vouchers") render();
  window.scrollTo({top:0,behavior:"smooth"});
}

$$(".nav-link").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
$$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.go)));
$("#newVoucherTop").addEventListener("click",()=>switchView("new"));

function voucherLink(id){
  const base = new URL("voucher.html", location.href);
  base.searchParams.set("id",id);
  return base.href;
}

function rowMarkup(v, compact=false){
  const status = v.signedAt ? `<span class="status signed">Firmado</span>` : `<span class="status pending">Pendiente</span>`;
  const action = `<div class="row-actions">
    <button class="icon-btn" title="Copiar enlace" onclick="copyVoucherLink('${v.id}')">⧉</button>
    <button class="icon-btn" title="Abrir cupón" onclick="openVoucher('${v.id}')">↗</button>
  </div>`;
  if(compact){
    return `<tr>
      <td><strong>${v.folio}</strong></td>
      <td>${escapeHtml(v.passenger)}</td>
      <td>${escapeHtml(v.destination)}</td>
      <td>${formatDate(v.startDate)}</td>
      <td>${status}</td>
      <td>${action}</td>
    </tr>`;
  }
  return `<tr>
    <td><strong>${v.folio}</strong></td>
    <td>${escapeHtml(v.passenger)}</td>
    <td>${escapeHtml(v.destination)}</td>
    <td>${formatDate(v.createdAt.slice(0,10))}</td>
    <td>${status}</td>
    <td>${v.signedAt ? shortDateTime(v.signedAt) : "—"}</td>
    <td>${action}</td>
  </tr>`;
}
function escapeHtml(str=""){
  return String(str).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function render(){
  const items=getVouchers().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  $("#statTotal").textContent=items.length;
  $("#statPending").textContent=items.filter(x=>!x.signedAt).length;
  $("#statSigned").textContent=items.filter(x=>x.signedAt).length;
  const today=new Date(); const in30=new Date(Date.now()+30*86400000);
  $("#statUpcoming").textContent=items.filter(x=>{
    const d=new Date(x.startDate+"T12:00:00"); return d>=today && d<=in30;
  }).length;

  const recent=items.slice(0,5);
  $("#recentTable").innerHTML=recent.map(v=>rowMarkup(v,true)).join("");
  $("#recentEmpty").hidden=recent.length>0;

  renderAll();
}
function renderAll(){
  const q=$("#searchVouchers").value.trim().toLowerCase();
  const items=getVouchers().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    .filter(v=>[v.folio,v.passenger,v.destination].join(" ").toLowerCase().includes(q));
  $("#allTable").innerHTML=items.map(v=>rowMarkup(v,false)).join("");
  $("#allEmpty").hidden=items.length>0;
}
$("#searchVouchers").addEventListener("input",renderAll);

window.openVoucher=(id)=>window.open(voucherLink(id),"_blank");
window.copyVoucherLink=async(id)=>{
  const link=voucherLink(id);
  try{ await navigator.clipboard.writeText(link); toast("Enlace copiado"); }
  catch{ prompt("Copia este enlace:",link); }
};




function moneyMXN(value){
  const n = Number(value || 0);
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n);
}

function dayDiff(startValue,endValue){
  if(!startValue || !endValue) return null;
  const a = new Date(startValue+"T12:00:00");
  const b = new Date(endValue+"T12:00:00");
  const nights = Math.round((b-a)/86400000);
  if(nights < 0) return null;
  return {nights, days:nights+1};
}

function configureReturnDate(){
  const form = $("#voucherForm");
  const start = form.startDate;
  const end = form.endDate;

  if(!start.value){
    end.min = "";
    end.max = "";
    updateComputedFields();
    return;
  }

  const [y,m] = start.value.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const month = String(m).padStart(2,"0");
  end.min = start.value;
  end.max = `${y}-${month}-${String(lastDay).padStart(2,"0")}`;

  if(end.value && (end.value < end.min || end.value > end.max)){
    end.value = "";
  }

  if(!form.outboundFlightDate.value) form.outboundFlightDate.value = start.value;
  if(!form.checkIn.value) form.checkIn.value = start.value;

  updateComputedFields();
}

function updateComputedFields(){
  const form = $("#voucherForm");

  const trip = dayDiff(form.startDate.value, form.endDate.value);
  form.durationPreview.value = trip ? `${trip.days} días / ${trip.nights} noches` : "";

  if(form.endDate.value){
    if(!form.returnFlightDate.value) form.returnFlightDate.value = form.endDate.value;
    if(!form.checkOut.value) form.checkOut.value = form.endDate.value;
  }

  const stay = dayDiff(form.checkIn.value, form.checkOut.value);
  form.nightsPreview.value = stay ? String(stay.nights) : "";

  const total = Number(form.totalPrice.value || 0);
  const paid = Number(form.paymentsMade.value || 0);
  form.balancePreview.value = moneyMXN(Math.max(0,total-paid));
}

function syncServiceCheckboxesFromData(form){
  if(form.outboundFlight.value || form.returnFlight.value || form.airline.value) form.serviceFlights.checked = true;
  if(form.hotel.value) form.serviceLodging.checked = true;
  if(form.arrivalTransferLocator.value || form.departureTransferLocator.value) form.serviceTransfers.checked = true;
  if(form.foodDetails.value) form.serviceFood.checked = true;
  if(form.toursDetails.value) form.serviceTours.checked = true;
  if(form.baggage.value) form.serviceBaggage.checked = true;
}

const voucherForm = $("#voucherForm");
["change","input"].forEach(evt=>{
  voucherForm.startDate.addEventListener(evt, configureReturnDate);
  voucherForm.endDate.addEventListener(evt, updateComputedFields);
  voucherForm.checkIn.addEventListener(evt, updateComputedFields);
  voucherForm.checkOut.addEventListener(evt, updateComputedFields);
  voucherForm.totalPrice.addEventListener(evt, updateComputedFields);
  voucherForm.paymentsMade.addEventListener(evt, updateComputedFields);
});

$("#voucherForm").addEventListener("submit",e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget).entries());
  const voucher={
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    folio:makeFolio(),
    ...data,
    createdAt:new Date().toISOString(),
    viewedAt:null,
    signedAt:null,
    signerName:null,
    signature:null
  };
  const items=getVouchers(); items.push(voucher); saveVouchers(items);
  const link=voucherLink(voucher.id);
  $("#modalFolio").textContent=voucher.folio;
  $("#modalLink").value=link;
  $("#openPassenger").href=link;
  $("#createdModal").classList.add("open");
  render();
});

$("#fillDemo").addEventListener("click",()=>{
  const f=$("#voucherForm");
  const start=new Date(Date.now()+12*86400000);
  const end=new Date(start.getFullYear(), start.getMonth(), Math.min(start.getDate()+4, new Date(start.getFullYear(), start.getMonth()+1, 0).getDate()));
  const iso=d=>d.toISOString().slice(0,10);

  f.passenger.value="Mariana González Ruiz";
  f.passengerCount.value="2";
  f.phone.value="55 1234 5678";
  f.email.value="mariana@ejemplo.com";

  f.destination.value="Cancún, Quintana Roo";
  f.startDate.value=iso(start);
  configureReturnDate();
  f.endDate.value=iso(end);
  f.tripType.value="Vacaciones";
  f.generalLocator.value="VEL-CUN-2026-0839";

  f.airline.value="Aeroméxico";
  f.outboundFlight.value="AM 512";
  f.outboundFlightLocator.value="ABC123";
  f.outboundFlightDate.value=iso(start);
  f.outboundFlightTime.value="07:15";
  f.returnFlight.value="AM 513";
  f.returnFlightLocator.value="XYZ789";
  f.returnFlightDate.value=iso(end);
  f.returnFlightTime.value="18:40";
  f.arrivalTransferLocator.value="TR-IN-528441";
  f.departureTransferLocator.value="TR-OUT-528442";
  f.baggage.value="1 maleta documentada de 25 kg + equipaje de mano";

  f.hotel.value="Riu Palace Costa Mujeres";
  f.checkIn.value=iso(start);
  f.checkOut.value=iso(end);
  f.room.value="Junior Suite · 2 adultos";
  f.lodgingPlan.value="Todo incluido";
  f.lodgingLocator.value="HTL-839201";

  f.foodDetails.value="Plan todo incluido en el hotel";
  f.toursDetails.value="Sin tours incluidos";
  f.included.value="Asistencia Velora durante el viaje";

  f.totalPrice.value="28600";
  f.deposit.value="8000";
  f.paymentsMade.value="12000";
  f.paymentDeadline.value=iso(new Date(Date.now()+7*86400000));

  f.notes.value="Presentarse en el aeropuerto con anticipación suficiente y llevar identificación oficial vigente.";
  f.advisor.value="Velora Travel";
  f.advisorWhatsapp.value="55 1900 0905";
  f.advisorEmail.value="hola@veloratravel.com";
  f.advisorInstagram.value="@veloratravel";

  syncServiceCheckboxesFromData(f);
  updateComputedFields();
  toast("Ejemplo completo cargado");
});

$("#modalClose").addEventListener("click",()=>$("#createdModal").classList.remove("open"));
$("#createdModal").addEventListener("click",e=>{ if(e.target.id==="createdModal") e.currentTarget.classList.remove("open"); });
$("#copyLink").addEventListener("click",async()=>{
  const link=$("#modalLink").value;
  try{ await navigator.clipboard.writeText(link); toast("Enlace copiado"); }
  catch{ $("#modalLink").select(); document.execCommand("copy"); toast("Enlace copiado"); }
});

window.addEventListener("focus",render);
window.addEventListener("storage",render);
render();
