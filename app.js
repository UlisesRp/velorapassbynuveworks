const VOUCHER_KEY = "veloraPassVouchersV1";
const QUOTE_KEY = "veloraPassQuotesV1";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const getStore = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const saveStore = (key, items) => localStorage.setItem(key, JSON.stringify(items));
const getVouchers = () => getStore(VOUCHER_KEY);
const getQuotes = () => getStore(QUOTE_KEY);
const saveVouchers = items => saveStore(VOUCHER_KEY, items);
const saveQuotes = items => saveStore(QUOTE_KEY, items);

function cryptoChunk(){
  return (crypto.randomUUID ? crypto.randomUUID().replaceAll("-","") : Date.now().toString(36)+Math.random().toString(36).slice(2)).toUpperCase();
}
function makeCode(prefix, existing){
  const stamp = new Date().toISOString().slice(2,10).replaceAll("-","");
  const code = `${prefix}-${stamp}-${cryptoChunk().slice(0,10)}`;
  if(existing.has(code)) return makeCode(prefix, existing);
  return code;
}
function makeVoucherCode(){ return makeCode("VL", new Set(getVouchers().map(x=>x.folio))); }
function makeQuoteCode(){ return makeCode("COT", new Set(getQuotes().map(x=>x.folio))); }

function escapeHtml(str=""){
  return String(str).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function formatDate(v){
  if(!v) return "—";
  return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T12:00:00"));
}
function shortDateTime(v){
  if(!v) return "—";
  return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
}
function money(v){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v||0));
}
function dayDiff(a,b){
  if(!a || !b) return null;
  const start=new Date(a+"T12:00:00"), end=new Date(b+"T12:00:00");
  const nights=Math.round((end-start)/86400000);
  return nights<0?null:{nights,days:nights+1};
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove("show"),2200);
}

const viewTitles={
  dashboard:"Panel general",
  newQuote:"Nueva cotización",
  quotes:"Cotizaciones",
  newVoucher:"Nuevo voucher",
  vouchers:"Vouchers"
};
function switchView(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $$(".nav-link").forEach(v=>v.classList.toggle("active",v.dataset.view===name));
  $(`#${name}View`)?.classList.add("active");
  $("#pageTitle").textContent=viewTitles[name]||"Velora Pass";
  const action=$("#contextAction");
  if(name==="newQuote"){ action.textContent="Ver cotizaciones"; action.dataset.target="quotes"; }
  else if(name==="quotes"){ action.textContent="＋ Nueva cotización"; action.dataset.target="newQuote"; }
  else if(name==="newVoucher"){ action.textContent="Ver vouchers"; action.dataset.target="vouchers"; }
  else { action.textContent="＋ Nuevo voucher"; action.dataset.target="newVoucher"; }
  if(["dashboard","quotes","vouchers"].includes(name)) render();
  window.scrollTo({top:0,behavior:"smooth"});
}
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.go)));
$("#contextAction").addEventListener("click",e=>switchView(e.currentTarget.dataset.target||"newVoucher"));

function voucherLink(id){ const u=new URL("voucher.html",location.href);u.searchParams.set("id",id);return u.href; }
function quoteLink(id){ const u=new URL("quote.html",location.href);u.searchParams.set("id",id);return u.href; }

function showModal(type,folio,link){
  $("#modalType").textContent=type==="quote"?"COTIZACIÓN GENERADA":"VOUCHER GENERADO";
  $("#modalFolio").textContent=folio;
  $("#modalText").textContent=type==="quote"?"Ya puedes abrir la cotización o copiar su enlace.":"Ya puedes abrir el documento completo o copiar su enlace.";
  $("#modalLink").value=link;
  $("#openDocument").href=link;
  $("#documentModal").classList.add("open");
}
$("#modalClose").addEventListener("click",()=>$("#documentModal").classList.remove("open"));
$("#documentModal").addEventListener("click",e=>{if(e.target.id==="documentModal")e.currentTarget.classList.remove("open")});
$("#copyLink").addEventListener("click",async()=>{
  const link=$("#modalLink").value;
  try{await navigator.clipboard.writeText(link);toast("Enlace copiado")}
  catch{$("#modalLink").select();document.execCommand("copy");toast("Enlace copiado")}
});

window.openVoucher=id=>window.open(voucherLink(id),"_blank");
window.copyVoucherLink=async id=>{const link=voucherLink(id);try{await navigator.clipboard.writeText(link);toast("Enlace copiado")}catch{prompt("Copia este enlace:",link)}};
window.openQuote=id=>window.open(quoteLink(id),"_blank");
window.copyQuoteLink=async id=>{const link=quoteLink(id);try{await navigator.clipboard.writeText(link);toast("Enlace copiado")}catch{prompt("Copia este enlace:",link)}};

function voucherRow(v,compact=false){
  const status=v.signedAt?`<span class="status signed">Firmado</span>`:`<span class="status pending">Pendiente</span>`;
  const actions=`<div class="row-actions"><button class="icon-btn" title="Copiar enlace" onclick="copyVoucherLink('${v.id}')">⧉</button><button class="icon-btn" title="Abrir" onclick="openVoucher('${v.id}')">↗</button></div>`;
  if(compact) return `<tr><td><strong>${v.folio}</strong></td><td>${escapeHtml(v.passenger)}</td><td>${escapeHtml(v.destination)}</td><td>${status}</td><td>${actions}</td></tr>`;
  return `<tr><td><strong>${v.folio}</strong></td><td>${escapeHtml(v.passenger)}</td><td>${escapeHtml(v.destination)}</td><td>${formatDate(v.createdAt.slice(0,10))}</td><td>${status}</td><td>${v.signedAt?shortDateTime(v.signedAt):"—"}</td><td>${actions}</td></tr>`;
}
function quoteCard(q,compact=false){
  const total=money(q.total);
  const actions=compact?`<button class="icon-btn" onclick="openQuote('${q.id}')">↗</button>`:
  `<div class="row-actions"><button class="icon-btn" title="Copiar enlace" onclick="copyQuoteLink('${q.id}')">⧉</button><button class="icon-btn" title="Abrir" onclick="openQuote('${q.id}')">↗</button><button class="icon-btn convert-btn" title="Pasar datos a voucher" onclick="convertQuoteToVoucher('${q.id}')">→ Voucher</button></div>`;
  return `<article class="quote-list-card"><div><span class="quote-folio">${q.folio}</span><h3>${escapeHtml(q.client)}</h3><p>${escapeHtml(q.destination)} · ${formatDate(q.startDate)}</p></div><div class="quote-list-total"><small>Total</small><strong>${total}</strong>${actions}</div></article>`;
}

function render(){
  const vouchers=getVouchers().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const quotes=getQuotes().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  $("#statTotal").textContent=vouchers.length;
  $("#statPending").textContent=vouchers.filter(x=>!x.signedAt).length;
  $("#statSigned").textContent=vouchers.filter(x=>x.signedAt).length;
  $("#statQuotes").textContent=quotes.length;

  const rv=vouchers.slice(0,5);
  $("#recentVoucherTable").innerHTML=rv.map(v=>voucherRow(v,true)).join("");
  $("#recentVoucherEmpty").hidden=rv.length>0;
  const rq=quotes.slice(0,4);
  $("#recentQuotes").innerHTML=rq.map(q=>quoteCard(q,true)).join("");
  $("#recentQuoteEmpty").hidden=rq.length>0;

  renderVoucherList();
  renderQuoteList();
}
function renderVoucherList(){
  const q=$("#searchVouchers").value.trim().toLowerCase();
  const items=getVouchers().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    .filter(v=>[v.folio,v.passenger,v.destination].join(" ").toLowerCase().includes(q));
  $("#allVoucherTable").innerHTML=items.map(v=>voucherRow(v)).join("");
  $("#allVoucherEmpty").hidden=items.length>0;
}
function renderQuoteList(){
  const q=$("#searchQuotes").value.trim().toLowerCase();
  const items=getQuotes().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    .filter(v=>[v.folio,v.client,v.destination,v.title].join(" ").toLowerCase().includes(q));
  $("#allQuotes").innerHTML=items.map(v=>quoteCard(v)).join("");
  $("#allQuotesEmpty").hidden=items.length>0;
}
$("#searchVouchers").addEventListener("input",renderVoucherList);
$("#searchQuotes").addEventListener("input",renderQuoteList);

// Shared same-month calendar behavior
function constrainSameMonth(form){
  const start=form.startDate,end=form.endDate;
  if(!start.value){end.min="";end.max="";return}
  const [y,m]=start.value.split("-").map(Number);
  const last=new Date(y,m,0).getDate();
  end.min=start.value;
  end.max=`${y}-${String(m).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
  if(end.value&&(end.value<end.min||end.value>end.max))end.value="";
}
function updateDuration(form){
  const d=dayDiff(form.startDate.value,form.endDate.value);
  if(form.durationPreview)form.durationPreview.value=d?`${d.days} días / ${d.nights} noches`:"";
}
function wireDates(form){
  ["change","input"].forEach(evt=>{
    form.startDate.addEventListener(evt,()=>{constrainSameMonth(form);updateDuration(form)});
    form.endDate.addEventListener(evt,()=>updateDuration(form));
  });
}

const voucherForm=$("#voucherForm");
wireDates(voucherForm);
function updateVoucherComputed(){
  const stay=dayDiff(voucherForm.checkIn.value,voucherForm.checkOut.value);
  voucherForm.nightsPreview.value=stay?stay.nights:"";
  voucherForm.balancePreview.value=money(Math.max(0,Number(voucherForm.totalPrice.value||0)-Number(voucherForm.paymentsMade.value||0)));
}
["checkIn","checkOut","totalPrice","paymentsMade"].forEach(name=>["input","change"].forEach(evt=>voucherForm[name].addEventListener(evt,updateVoucherComputed)));
voucherForm.startDate.addEventListener("change",()=>{
  if(!voucherForm.outboundFlightDate.value)voucherForm.outboundFlightDate.value=voucherForm.startDate.value;
  if(!voucherForm.checkIn.value)voucherForm.checkIn.value=voucherForm.startDate.value;
});
voucherForm.endDate.addEventListener("change",()=>{
  if(!voucherForm.returnFlightDate.value)voucherForm.returnFlightDate.value=voucherForm.endDate.value;
  if(!voucherForm.checkOut.value)voucherForm.checkOut.value=voucherForm.endDate.value;
  updateVoucherComputed();
});

voucherForm.addEventListener("submit",e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(voucherForm).entries());
  const voucher={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),folio:makeVoucherCode(),...data,createdAt:new Date().toISOString(),viewedAt:null,signedAt:null,signerName:null,signature:null};
  const items=getVouchers();items.push(voucher);saveVouchers(items);
  showModal("voucher",voucher.folio,voucherLink(voucher.id));render();
});

$("#fillVoucherDemo").addEventListener("click",()=>{
  const f=voucherForm;
  const start=new Date(Date.now()+9*86400000);
  const last=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
  const end=new Date(start.getFullYear(),start.getMonth(),Math.min(start.getDate()+4,last));
  const iso=d=>d.toISOString().slice(0,10);
  f.passenger.value="Karen Rivero";f.passengerCount.value=2;f.phone.value="55 1900 0905";f.email.value="karen@ejemplo.com";
  f.destination.value="Cancún, Quintana Roo";f.startDate.value=iso(start);constrainSameMonth(f);f.endDate.value=iso(end);f.tripType.value="Vacaciones";f.generalLocator.value="VEL-CUN-2026";
  f.outboundAirline.value="Volaris";f.outboundFlight.value="Y4 1234";f.outboundFlightLocator.value="ZCY123";f.outboundFlightDate.value=iso(start);f.outboundOriginCode.value="AIFA";f.outboundOriginCity.value="Ciudad de México";f.outboundDestinationCode.value="CUN";f.outboundDestinationCity.value="Cancún";f.outboundDepartureTime.value="07:45";f.outboundDepartureTerminal.value="1";f.outboundArrivalTime.value="10:25";f.outboundArrivalTerminal.value="3";
  f.returnAirline.value="Volaris";f.returnFlight.value="Y4 5678";f.returnFlightLocator.value="ZCY124";f.returnFlightDate.value=iso(end);f.returnOriginCode.value="CUN";f.returnOriginCity.value="Cancún";f.returnDestinationCode.value="AIFA";f.returnDestinationCity.value="Ciudad de México";f.returnDepartureTime.value="18:30";f.returnDepartureTerminal.value="3";f.returnArrivalTime.value="21:10";f.returnArrivalTerminal.value="1";
  f.transportOperator.value="Volaris / Operador local";f.arrivalTransferLocator.value="TR-IN-528441";f.departureTransferLocator.value="TR-OUT-528442";f.carryOnBaggage.value="1 equipaje de mano · 10 kg";f.checkedBaggage.value="1 equipaje documentado · 23 kg";
  f.hotel.value="Riu Palace Costa Mujeres";f.checkIn.value=iso(start);f.checkOut.value=iso(end);f.room.value="Junior Suite · 2 adultos";f.lodgingPlan.value="Todo incluido";f.lodgingLocator.value="HTL-839201";
  ["serviceFlights","serviceLodging","serviceTransfers","serviceFood","serviceBaggage"].forEach(n=>f[n].checked=true);
  f.foodDetails.value="Plan todo incluido";f.toursDetails.value="Sin tours incluidos";f.included.value="Asistencia Velora durante el viaje";
  f.totalPrice.value=28600;f.deposit.value=8000;f.paymentsMade.value=12000;f.paymentDeadline.value=iso(new Date(Date.now()+5*86400000));
  f.notes.value="Presentarse en el aeropuerto con anticipación suficiente.";f.advisor.value="Velora Travel";
  updateDuration(f);updateVoucherComputed();toast("Ejemplo completo cargado");
});

// Quotes
const quoteForm=$("#quoteForm");
wireDates(quoteForm);
let quoteItemCounter=0;
function addQuoteItem(data={}){
  const id=++quoteItemCounter;
  const row=document.createElement("div");
  row.className="quote-item-row";
  row.dataset.id=id;
  row.innerHTML=`<label class="field"><span>Categoría</span><select name="category"><option>Hospedaje</option><option>Vuelos</option><option>Traslados</option><option>Tours / experiencias</option><option>Seguro</option><option>Otro</option></select></label><label class="field"><span>Concepto</span><input name="concept" placeholder="Ej. Hotel 4 noches"></label><label class="field quote-desc"><span>Detalle</span><input name="description" placeholder="Descripción para el cliente"></label><label class="field"><span>Importe</span><input type="number" min="0" step="0.01" name="amount" value="0"></label><button type="button" class="remove-item" title="Eliminar">×</button>`;
  $("#quoteItems").appendChild(row);
  row.querySelector('[name="category"]').value=data.category||"Hospedaje";
  row.querySelector('[name="concept"]').value=data.concept||"";
  row.querySelector('[name="description"]').value=data.description||"";
  row.querySelector('[name="amount"]').value=data.amount||0;
  row.querySelector('[name="amount"]').addEventListener("input",updateQuoteTotal);
  row.querySelector(".remove-item").addEventListener("click",()=>{row.remove();if(!$("#quoteItems").children.length)addQuoteItem();updateQuoteTotal()});
  updateQuoteTotal();
}
function getQuoteItems(){
  return [...$("#quoteItems").querySelectorAll(".quote-item-row")].map(row=>({
    category:row.querySelector('[name="category"]').value,
    concept:row.querySelector('[name="concept"]').value.trim(),
    description:row.querySelector('[name="description"]').value.trim(),
    amount:Number(row.querySelector('[name="amount"]').value||0)
  })).filter(x=>x.concept||x.description||x.amount);
}
function updateQuoteTotal(){
  const total=getQuoteItems().reduce((s,x)=>s+x.amount,0);
  $("#quoteTotalPreview").textContent=money(total);
  return total;
}
$("#addQuoteItem").addEventListener("click",()=>addQuoteItem());
addQuoteItem();

quoteForm.addEventListener("submit",e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(quoteForm).entries());
  delete data.category;delete data.concept;delete data.description;delete data.amount;delete data.durationPreview;
  const items=getQuoteItems();
  if(!items.length){toast("Agrega al menos un concepto");return}
  const quote={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),folio:makeQuoteCode(),...data,items,total:items.reduce((s,x)=>s+x.amount,0),createdAt:new Date().toISOString(),viewedAt:null};
  const all=getQuotes();all.push(quote);saveQuotes(all);
  showModal("quote",quote.folio,quoteLink(quote.id));render();
});
$("#fillQuoteDemo").addEventListener("click",()=>{
  const f=quoteForm;const start=new Date(Date.now()+14*86400000);const last=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();const end=new Date(start.getFullYear(),start.getMonth(),Math.min(start.getDate()+4,last));const iso=d=>d.toISOString().slice(0,10);
  f.client.value="Mariana González Ruiz";f.phone.value="55 1234 5678";f.email.value="mariana@ejemplo.com";f.travelerCount.value=2;f.tripType.value="Vacaciones";f.title.value="Cancún · Todo Incluido";f.destination.value="Cancún, Quintana Roo";f.startDate.value=iso(start);constrainSameMonth(f);f.endDate.value=iso(end);f.validUntil.value=iso(new Date(Date.now()+3*86400000));
  $("#quoteItems").innerHTML="";addQuoteItem({category:"Vuelos",concept:"Vuelos redondos",description:"CDMX – Cancún – CDMX",amount:6800});addQuoteItem({category:"Hospedaje",concept:"Hotel 4 noches",description:"Junior Suite · Todo incluido",amount:17800});addQuoteItem({category:"Traslados",concept:"Traslados aeropuerto",description:"Llegada y salida",amount:2400});
  f.deposit.value=8000;f.paymentDeadline.value=iso(new Date(Date.now()+8*86400000));f.includes.value="Vuelos redondos\n4 noches de hospedaje\nPlan todo incluido\nTraslados aeropuerto-hotel-aeropuerto";f.excludes.value="Gastos personales\nPropinas\nServicios no indicados";f.notes.value="Tarifa sujeta a disponibilidad al momento de reservar.";f.advisor.value="Velora Travel";updateDuration(f);updateQuoteTotal();toast("Ejemplo de cotización cargado");
});

window.convertQuoteToVoucher=id=>{
  const q=getQuotes().find(x=>x.id===id);if(!q)return;
  switchView("newVoucher");
  voucherForm.passenger.value=q.client||"";voucherForm.passengerCount.value=q.travelerCount||1;voucherForm.phone.value=q.phone||"";voucherForm.email.value=q.email||"";voucherForm.destination.value=q.destination||"";voucherForm.startDate.value=q.startDate||"";constrainSameMonth(voucherForm);voucherForm.endDate.value=q.endDate||"";voucherForm.tripType.value=q.tripType||"";voucherForm.totalPrice.value=q.total||0;voucherForm.deposit.value=q.deposit||0;voucherForm.paymentDeadline.value=q.paymentDeadline||"";voucherForm.notes.value=q.notes||"";voucherForm.advisor.value=q.advisor||"";voucherForm.advisorWhatsapp.value=q.advisorWhatsapp||"55 1900 0905";voucherForm.advisorEmail.value=q.advisorEmail||"hola@veloratravel.com";updateDuration(voucherForm);updateVoucherComputed();toast("Datos de la cotización cargados en el voucher");
};

window.addEventListener("focus",render);
window.addEventListener("storage",render);
render();
