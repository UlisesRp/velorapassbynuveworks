const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

let voucherCache = [];
let quoteCache = [];
let refreshInFlight = false;

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
  const el=$("#toast");
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>el.classList.remove("show"),2400);
}
function friendlyDbError(error){
  console.error(error);
  return error?.message || "Ocurrió un error al guardar la información.";
}

function creatorBadge(record){
  const email=record?.createdByEmail;
  if(!email) return `<span class="creator-badge unknown">Sin registro</span>`;
  const short=email.split("@")[0] || email;
  return `<span class="creator-badge" title="${escapeHtml(email)}">${escapeHtml(short)}</span>`;
}

function normalizeVoucher(row){
  return {
    id: row.id,
    folio: row.code,
    publicToken: row.public_token,
    ...(row.payload || {}),
    status: row.status,
    createdAt: row.created_at,
    viewedAt: row.viewed_at,
    signedAt: row.signed_at,
    signerName: row.signer_name,
    signature: row.signature_data
  };
}
function normalizeQuote(row){
  return {
    id: row.id,
    folio: row.code,
    publicToken: row.public_token,
    ...(row.payload || {}),
    total: Number(row.total || row.payload?.total || 0),
    status: row.status,
    createdAt: row.created_at,
    viewedAt: row.viewed_at,
    convertedVoucherId: row.converted_voucher_id
  };
}

async function loadSharedData({silent=false}={}){
  if(refreshInFlight) return;
  refreshInFlight=true;
  try{
    const [voucherResult, quoteResult, auditResult] = await Promise.all([
      db.from("vouchers").select("*").order("created_at",{ascending:false}),
      db.from("quotes").select("*").order("created_at",{ascending:false}),
      db.from("record_audit").select("record_type,record_id,created_by_email,created_at")
    ]);
    if(voucherResult.error) throw voucherResult.error;
    if(quoteResult.error) throw quoteResult.error;

    // Si todavía no se ejecutó la migración de auditoría, el programa sigue funcionando.
    if(auditResult.error) console.warn("Auditoría de creadores aún no disponible:",auditResult.error);

    const auditMap=new Map(
      (auditResult.data||[]).map(row=>[
        `${row.record_type}:${row.record_id}`,
        row.created_by_email || null
      ])
    );

    voucherCache=(voucherResult.data||[]).map(row=>({
      ...normalizeVoucher(row),
      createdByEmail:auditMap.get(`voucher:${row.id}`) || null
    }));
    quoteCache=(quoteResult.data||[]).map(row=>({
      ...normalizeQuote(row),
      createdByEmail:auditMap.get(`quote:${row.id}`) || null
    }));
    renderFromCache();
  }catch(error){
    if(!silent) toast("No se pudieron cargar los datos de Supabase");
    console.error("Supabase load error:",error);
  }finally{
    refreshInFlight=false;
  }
}


function isValidEmailOrNA(value){
  const clean=String(value||"").trim();
  if(clean.toUpperCase()==="N/A") return true;
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(clean);
}

function validateEmailOrNAField(input){
  if(!input) return true;
  const ok=isValidEmailOrNA(input.value);
  input.setCustomValidity(ok ? "" : 'Escribe un correo válido o "N/A".');
  return ok;
}

$$('[data-email-or-na]').forEach(input=>{
  input.addEventListener('input',()=>validateEmailOrNAField(input));
  input.addEventListener('blur',()=>validateEmailOrNAField(input));
});

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
  if(["dashboard","quotes","vouchers"].includes(name)) loadSharedData({silent:true});
  window.scrollTo({top:0,behavior:"smooth"});
}
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
$$('[data-go]').forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.go)));
$("#contextAction").addEventListener("click",e=>switchView(e.currentTarget.dataset.target||"newVoucher"));

function voucherLink(token){
  const u=new URL("voucher.html",location.href);
  u.searchParams.set("token",token);
  return u.href;
}
function quoteLink(token){
  const u=new URL("quote.html",location.href);
  u.searchParams.set("token",token);
  return u.href;
}
function showModal(type,folio,link){
  $("#modalType").textContent=type==="quote"?"COTIZACIÓN GENERADA":"VOUCHER GENERADO";
  $("#modalFolio").textContent=folio;
  $("#modalText").textContent=type==="quote"?"Ya puedes abrir la cotización o copiar su enlace para enviarlo.":"Ya puedes abrir el documento completo o copiar su enlace.";
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

window.openVoucher=id=>{
  const v=voucherCache.find(x=>x.id===id);
  if(v?.publicToken) window.open(voucherLink(v.publicToken),"_blank","noopener");
};
window.copyVoucherLink=async id=>{
  const v=voucherCache.find(x=>x.id===id); if(!v?.publicToken)return;
  const link=voucherLink(v.publicToken);
  try{await navigator.clipboard.writeText(link);toast("Enlace copiado")}
  catch{prompt("Copia este enlace:",link)}
};
window.openQuote=id=>{
  const q=quoteCache.find(x=>x.id===id);
  if(q?.publicToken) window.open(quoteLink(q.publicToken),"_blank","noopener");
};
window.copyQuoteLink=async id=>{
  const q=quoteCache.find(x=>x.id===id); if(!q?.publicToken)return;
  const link=quoteLink(q.publicToken);
  try{await navigator.clipboard.writeText(link);toast("Enlace copiado")}
  catch{prompt("Copia este enlace:",link)}
};
window.deleteVoucher=async id=>{
  const v=voucherCache.find(x=>x.id===id); if(!v)return;
  const warning=v.signedAt?"Este voucher YA ESTÁ FIRMADO. ¿Seguro que quieres eliminarlo definitivamente?":`¿Eliminar definitivamente el voucher ${v.folio}?`;
  if(!confirm(warning)) return;
  const {error}=await db.from("vouchers").delete().eq("id",id);
  if(error){toast("No se pudo eliminar el voucher");console.error(error);return}
  toast("Voucher eliminado");
  await loadSharedData({silent:true});
};
window.deleteQuote=async id=>{
  const q=quoteCache.find(x=>x.id===id); if(!q)return;
  if(!confirm(`¿Eliminar definitivamente la cotización ${q.folio}?`)) return;
  const {error}=await db.from("quotes").delete().eq("id",id);
  if(error){toast("No se pudo eliminar la cotización");console.error(error);return}
  toast("Cotización eliminada");
  await loadSharedData({silent:true});
};

function voucherStatus(v){
  if(v.signedAt || v.status==="signed") return `<span class="status signed">Firmado</span>`;
  if(v.viewedAt || v.status==="viewed") return `<span class="status viewed">Visto</span>`;
  return `<span class="status pending">Pendiente</span>`;
}
function voucherRow(v,compact=false){
  const actions=`<div class="row-actions"><button class="icon-btn" title="Copiar enlace" onclick="copyVoucherLink('${v.id}')">⧉</button><button class="icon-btn" title="Abrir" onclick="openVoucher('${v.id}')">↗</button><button class="icon-btn delete-btn" title="Eliminar" onclick="deleteVoucher('${v.id}')">⌫</button></div>`;
  if(compact) return `<tr><td><strong>${escapeHtml(v.folio)}</strong></td><td>${escapeHtml(v.passenger)}</td><td>${escapeHtml(v.destination)}</td><td>${creatorBadge(v)}</td><td>${voucherStatus(v)}</td><td>${actions}</td></tr>`;
  return `<tr><td><strong>${escapeHtml(v.folio)}</strong></td><td>${escapeHtml(v.passenger)}</td><td>${escapeHtml(v.destination)}</td><td>${formatDate(v.createdAt?.slice(0,10))}</td><td>${voucherStatus(v)}</td><td>${v.signedAt?shortDateTime(v.signedAt):"—"}</td><td>${actions}</td></tr>`;
}
function quoteCard(q,compact=false){
  const actions=`<div class="row-actions"><button class="icon-btn" title="Copiar enlace" onclick="copyQuoteLink('${q.id}')">⧉</button><button class="icon-btn" title="Abrir" onclick="openQuote('${q.id}')">↗</button>${compact?"":`<button class="icon-btn convert-btn" title="Pasar datos a voucher" onclick="convertQuoteToVoucher('${q.id}')">→ Voucher</button>`}<button class="icon-btn delete-btn" title="Eliminar" onclick="deleteQuote('${q.id}')">⌫</button></div>`;
  const creatorLine=compact?`<p class="record-creator">Creado por ${creatorBadge(q)}</p>`:"";
  return `<article class="quote-list-card"><div><span class="quote-folio">${escapeHtml(q.folio)}</span><h3>${escapeHtml(q.client)}</h3><p>${escapeHtml(q.destination)} · ${formatDate(q.startDate)}</p>${creatorLine}</div><div class="quote-list-total"><small>Total</small><strong>${money(q.total)}</strong>${actions}</div></article>`;
}

function renderFromCache(){
  $("#statTotal").textContent=voucherCache.length;
  $("#statPending").textContent=voucherCache.filter(x=>!x.signedAt && x.status!=="signed").length;
  $("#statSigned").textContent=voucherCache.filter(x=>x.signedAt || x.status==="signed").length;
  $("#statQuotes").textContent=quoteCache.length;

  const rv=voucherCache.slice(0,5);
  $("#recentVoucherTable").innerHTML=rv.map(v=>voucherRow(v,true)).join("");
  $("#recentVoucherEmpty").hidden=rv.length>0;
  const rq=quoteCache.slice(0,4);
  $("#recentQuotes").innerHTML=rq.map(q=>quoteCard(q,true)).join("");
  $("#recentQuoteEmpty").hidden=rq.length>0;
  renderVoucherList();
  renderQuoteList();
}
function renderVoucherList(){
  const q=$("#searchVouchers").value.trim().toLowerCase();
  const items=voucherCache.filter(v=>[v.folio,v.passenger,v.destination].join(" ").toLowerCase().includes(q));
  $("#allVoucherTable").innerHTML=items.map(v=>voucherRow(v)).join("");
  $("#allVoucherEmpty").hidden=items.length>0;
}
function renderQuoteList(){
  const q=$("#searchQuotes").value.trim().toLowerCase();
  const items=quoteCache.filter(v=>[v.folio,v.client,v.destination,v.title].join(" ").toLowerCase().includes(q));
  $("#allQuotes").innerHTML=items.map(v=>quoteCard(v)).join("");
  $("#allQuotesEmpty").hidden=items.length>0;
}
$("#searchVouchers").addEventListener("input",renderVoucherList);
$("#searchQuotes").addEventListener("input",renderQuoteList);

// Calendarios: regreso limitado al mismo mes de salida.
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
}
["checkIn","checkOut"].forEach(name=>["input","change"].forEach(evt=>voucherForm[name].addEventListener(evt,updateVoucherComputed)));
voucherForm.startDate.addEventListener("change",()=>{
  if(!voucherForm.outboundFlightDate.value)voucherForm.outboundFlightDate.value=voucherForm.startDate.value;
  if(!voucherForm.checkIn.value)voucherForm.checkIn.value=voucherForm.startDate.value;
});
voucherForm.endDate.addEventListener("change",()=>{
  if(!voucherForm.returnFlightDate.value)voucherForm.returnFlightDate.value=voucherForm.endDate.value;
  if(!voucherForm.checkOut.value)voucherForm.checkOut.value=voucherForm.endDate.value;
  updateVoucherComputed();
});

voucherForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!validateEmailOrNAField(voucherForm.email)){voucherForm.email.reportValidity();return;}
  const submit=voucherForm.querySelector('button[type="submit"]');
  submit.disabled=true; submit.textContent="Guardando…";
  try{
    const payload=Object.fromEntries(new FormData(voucherForm).entries());
    delete payload.durationPreview;
    delete payload.nightsPreview;
    const {data:row,error}=await db.from("vouchers").insert({payload,status:"pending"}).select("*").single();
    if(error) throw error;
    const voucher=normalizeVoucher(row);
    showModal("voucher",voucher.folio,voucherLink(voucher.publicToken));
    await loadSharedData({silent:true});
  }catch(error){toast(friendlyDbError(error))}
  finally{submit.disabled=false;submit.textContent="Generar voucher"}
});

$("#fillVoucherDemo").addEventListener("click",()=>{
  try{
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
  f.notes.value="Presentarse en el aeropuerto con anticipación suficiente.";f.advisor.value="Velora Travel";
  updateDuration(f);updateVoucherComputed();toast("Ejemplo completo cargado");
  }catch(error){console.error("Error llenando ejemplo de voucher:",error);toast("No se pudo llenar el ejemplo");}
});

// Cotizaciones
const quoteForm=$("#quoteForm");
wireDates(quoteForm);
let quoteItemCounter=0;
function addQuoteItem(data={}){
  const id=++quoteItemCounter;
  const row=document.createElement("div");
  row.className="quote-item-row";row.dataset.id=id;
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

quoteForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!validateEmailOrNAField(quoteForm.email)){quoteForm.email.reportValidity();return;}
  const items=getQuoteItems();
  if(!items.length){toast("Agrega al menos un concepto");return}
  const submit=quoteForm.querySelector('button[type="submit"]');
  submit.disabled=true; submit.textContent="Guardando…";
  try{
    const payload=Object.fromEntries(new FormData(quoteForm).entries());
    delete payload.category;delete payload.concept;delete payload.description;delete payload.amount;delete payload.durationPreview;
    payload.items=items;
    const total=items.reduce((s,x)=>s+x.amount,0);
    const {data:row,error}=await db.from("quotes").insert({payload,total,status:"sent"}).select("*").single();
    if(error) throw error;
    const quote=normalizeQuote(row);
    showModal("quote",quote.folio,quoteLink(quote.publicToken));
    await loadSharedData({silent:true});
  }catch(error){toast(friendlyDbError(error))}
  finally{submit.disabled=false;submit.textContent="Generar cotización"}
});

$("#fillQuoteDemo").addEventListener("click",()=>{
  try{
  const f=quoteForm;const start=new Date(Date.now()+14*86400000);const last=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();const end=new Date(start.getFullYear(),start.getMonth(),Math.min(start.getDate()+4,last));const iso=d=>d.toISOString().slice(0,10);
  f.client.value="Mariana González Ruiz";f.phone.value="55 1234 5678";f.email.value="mariana@ejemplo.com";f.travelerCount.value=2;f.tripType.value="Vacaciones";f.title.value="Cancún · Todo Incluido";f.destination.value="Cancún, Quintana Roo";f.startDate.value=iso(start);constrainSameMonth(f);f.endDate.value=iso(end);f.validUntil.value=iso(new Date(Date.now()+3*86400000));
  $("#quoteItems").innerHTML="";addQuoteItem({category:"Vuelos",concept:"Vuelos redondos",description:"CDMX – Cancún – CDMX",amount:6800});addQuoteItem({category:"Hospedaje",concept:"Hotel 4 noches",description:"Junior Suite · Todo incluido",amount:17800});addQuoteItem({category:"Traslados",concept:"Traslados aeropuerto",description:"Llegada y salida",amount:2400});
  f.deposit.value=8000;f.paymentDeadline.value=iso(new Date(Date.now()+8*86400000));f.includes.value="Vuelos redondos\n4 noches de hospedaje\nPlan todo incluido\nTraslados aeropuerto-hotel-aeropuerto";f.excludes.value="Gastos personales\nPropinas\nServicios no indicados";f.notes.value="Tarifa sujeta a disponibilidad al momento de reservar.";f.advisor.value="Velora Travel";updateDuration(f);updateQuoteTotal();toast("Ejemplo de cotización cargado");
  }catch(error){console.error("Error llenando ejemplo de cotización:",error);toast("No se pudo llenar el ejemplo");}
});

window.convertQuoteToVoucher=id=>{
  const q=quoteCache.find(x=>x.id===id);if(!q)return;
  switchView("newVoucher");
  voucherForm.passenger.value=q.client||"";voucherForm.passengerCount.value=q.travelerCount||1;voucherForm.phone.value=q.phone||"";voucherForm.email.value=q.email||"";voucherForm.destination.value=q.destination||"";voucherForm.startDate.value=q.startDate||"";constrainSameMonth(voucherForm);voucherForm.endDate.value=q.endDate||"";voucherForm.tripType.value=q.tripType||"";voucherForm.notes.value=q.notes||"";voucherForm.advisor.value=q.advisor||"";voucherForm.advisorWhatsapp.value=q.advisorWhatsapp||"55 1900 0905";voucherForm.advisorEmail.value=q.advisorEmail||"hola@veloratravel.com";updateDuration(voucherForm);updateVoucherComputed();toast("Datos de la cotización cargados en el voucher");
};

async function initSharedData(){
  if(typeof db==="undefined") return;
  const {data}=await db.auth.getSession();
  if(data.session) await loadSharedData();
  db.auth.onAuthStateChange((_event,session)=>{
    if(session) setTimeout(()=>loadSharedData(),0);
    else {voucherCache=[];quoteCache=[];renderFromCache();}
  });
}
window.addEventListener("focus",()=>{
  if(document.body.classList.contains("auth-ready")) loadSharedData({silent:true});
});
setInterval(()=>{
  if(document.body.classList.contains("auth-ready") && !document.hidden) loadSharedData({silent:true});
},5000);

initSharedData();
