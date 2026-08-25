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
  const name=String(record?.createdByName||"").trim();
  const email=String(record?.createdByEmail||"").trim();
  if(name) return `<span class="creator-badge" title="${escapeHtml(email||name)}">${escapeHtml(name)}</span>`;
  if(email){
    const short=email.split("@")[0] || email;
    return `<span class="creator-badge" title="${escapeHtml(email)}">${escapeHtml(short)}</span>`;
  }
  return `<span class="creator-badge unknown">Sin registro</span>`;
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
    acceptedAt: row.accepted_at,
    acceptedByName: row.accepted_by_name,
    convertedVoucherId: row.converted_voucher_id
  };
}

async function loadSharedData({silent=false}={}){
  if(refreshInFlight) return;
  refreshInFlight=true;
  try{
    const [voucherResult, quoteResult, auditResult, profilesResult] = await Promise.all([
      db.from("vouchers").select("*").order("created_at",{ascending:false}),
      db.from("quotes").select("*").order("created_at",{ascending:false}),
      db.from("record_audit").select("record_type,record_id,created_by,created_by_email,created_at"),
      db.from("profiles").select("id,display_name,email")
    ]);
    if(voucherResult.error) throw voucherResult.error;
    if(quoteResult.error) throw quoteResult.error;

    if(auditResult.error) console.warn("Auditoría de creadores aún no disponible:",auditResult.error);
    if(profilesResult.error) console.warn("Perfiles de usuario aún no disponibles:",profilesResult.error);

    const profileMap=new Map((profilesResult.data||[]).map(row=>[row.id,{displayName:row.display_name||null,email:row.email||null}]));
    const auditMap=new Map((auditResult.data||[]).map(row=>[`${row.record_type}:${row.record_id}`,{userId:row.created_by||null,email:row.created_by_email||null}]));

    voucherCache=(voucherResult.data||[]).map(row=>{
      const audit=auditMap.get(`voucher:${row.id}`)||{};
      const profile=audit.userId?profileMap.get(audit.userId):null;
      return {...normalizeVoucher(row),createdByName:profile?.displayName||null,createdByEmail:profile?.email||audit.email||null};
    });
    quoteCache=(quoteResult.data||[]).map(row=>{
      const audit=auditMap.get(`quote:${row.id}`)||{};
      const profile=audit.userId?profileMap.get(audit.userId):null;
      return {...normalizeQuote(row),createdByName:profile?.displayName||null,createdByEmail:profile?.email||audit.email||null};
    });
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
function quoteStatus(q){
  if(q.convertedVoucherId || q.status==="converted"){
    return `<span class="status quote-converted">Reserva creada</span>`;
  }
  if(q.acceptedAt || q.status==="accepted"){
    return `<span class="status quote-accepted">Aceptada</span>`;
  }
  if(q.viewedAt || q.status==="viewed"){
    return `<span class="status viewed">Vista por cliente</span>`;
  }
  return `<span class="status pending">Enviada</span>`;
}

function quoteCard(q,compact=false){
  // IMPORTANTE: las acciones internas trabajan con el ID de la fila, no con el public_token.
  const openButton=`<button class="icon-btn" title="Abrir cotización" onclick="openQuote('${q.id}')">↗</button>`;
  const copyButton=`<button class="icon-btn" title="Copiar enlace" onclick="copyQuoteLink('${q.id}')">⧉</button>`;

  let reserveButton="";
  if(!compact){
    reserveButton=(q.convertedVoucherId || q.status==="converted")
      ? `<button class="icon-btn convert-btn converted" type="button" disabled title="Esta cotización ya fue convertida a reserva">Reserva creada</button>`
      : `<button class="icon-btn convert-btn ${q.acceptedAt||q.status==="accepted"?"accepted-ready":""}" title="Mover datos a reserva" onclick="convertQuoteToVoucher('${q.id}')">→ Reserva</button>`;
  }

  const actions=compact
    ? openButton
    : `<div class="row-actions">${copyButton}${openButton}${reserveButton}<button class="icon-btn danger-btn" title="Eliminar cotización" onclick="deleteQuote('${q.id}')">⌫</button></div>`;

  const creatorLine=`<p class="record-creator">Creado por ${creatorBadge(q)}</p>`;
  const statusLine=`<div class="quote-status-line">${quoteStatus(q)}${q.acceptedAt?`<span class="quote-accepted-date">${shortDateTime(q.acceptedAt)}</span>`:""}</div>`;
  const msi=Number(q.msiAmount||0);
  const msiLine=msi>0?`<span class="internal-msi-badge">MSI +${money(msi)}</span>`:"";

  return `<article class="quote-list-card">
    <div>
      <span class="quote-folio">${escapeHtml(q.folio)}</span>
      <h3>${escapeHtml(q.client)}</h3>
      <p>${escapeHtml(q.destination)} · ${formatDate(q.startDate)}</p>
      ${creatorLine}
      ${statusLine}
      ${msiLine}
    </div>
    <div class="quote-list-total">
      <small>Total final</small>
      <strong>${money(q.total)}</strong>
      ${actions}
    </div>
  </article>`;
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

let pendingQuoteConversionId=null;
let pendingQuoteConversionFolio="";

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

    if(pendingQuoteConversionId){
      const sourceQuoteId=pendingQuoteConversionId;
      const {error:quoteUpdateError}=await db
        .from("quotes")
        .update({
          status:"converted",
          converted_voucher_id:row.id
        })
        .eq("id",sourceQuoteId);

      if(quoteUpdateError){
        console.error("No se pudo marcar la cotización como convertida:",quoteUpdateError);
        toast("Reserva creada; no se pudo actualizar el estado de la cotización");
      }else{
        pendingQuoteConversionId=null;
        pendingQuoteConversionFolio="";
      }
    }

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

function readQuoteImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function compressQuoteImage(file){
  if(!file) return "";
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa una imagen JPG, PNG o WEBP");
  if(file.size>15*1024*1024) throw new Error("La imagen es demasiado pesada. Usa una menor a 15 MB.");

  const source=await readQuoteImage(file);
  const img=await new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("No se pudo procesar la imagen"));
    image.src=source;
  });

  const maxW=1200,maxH=760;
  const ratio=Math.min(1,maxW/img.width,maxH/img.height);
  const width=Math.max(1,Math.round(img.width*ratio));
  const height=Math.max(1,Math.round(img.height*ratio));

  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#ffffff";
  ctx.fillRect(0,0,width,height);
  ctx.drawImage(img,0,0,width,height);
  return canvas.toDataURL("image/jpeg",0.76);
}

function addQuoteItem(data={}){
  const id=++quoteItemCounter;
  const row=document.createElement("div");
  row.className="quote-item-row";
  row.dataset.id=id;
  row._hotelImageData=data.hotelImage||"";

  row.innerHTML=`<label class="field"><span>Categoría</span><select name="category"><option>Hospedaje</option><option>Vuelos</option><option>Traslados</option><option>Tours / experiencias</option><option>Seguro</option><option>Otro</option></select></label><label class="field"><span>Concepto</span><input name="concept" placeholder="Ej. Hotel 4 noches"></label><label class="field quote-desc"><span>Detalle</span><input name="description" placeholder="Descripción para el cliente"></label><label class="field"><span>Importe</span><input type="number" min="0" step="0.01" name="amount" value="0"></label><button type="button" class="remove-item" title="Eliminar">×</button><div class="hotel-image-capture" hidden><div class="hotel-image-upload"><label><span>Imagen del hotel para el cliente</span><input type="file" name="hotelImageFile" accept="image/jpeg,image/png,image/webp"><small>Se comprime automáticamente y se adjunta únicamente a esta cotización.</small></label></div><div class="hotel-image-preview" hidden><img alt="Vista previa del hotel"><button type="button" class="remove-hotel-image">Quitar imagen</button></div></div>`;

  $("#quoteItems").appendChild(row);

  const category=row.querySelector('[name="category"]');
  const amount=row.querySelector('[name="amount"]');
  const imageCapture=row.querySelector(".hotel-image-capture");
  const imageInput=row.querySelector('[name="hotelImageFile"]');
  const preview=row.querySelector(".hotel-image-preview");
  const previewImg=preview.querySelector("img");
  const removeImage=row.querySelector(".remove-hotel-image");

  category.value=data.category||"Hospedaje";
  row.querySelector('[name="concept"]').value=data.concept||"";
  row.querySelector('[name="description"]').value=data.description||"";
  amount.value=data.amount||0;

  function renderHotelImage(){
    const isHotel=category.value==="Hospedaje";
    imageCapture.hidden=!isHotel;
    const hasImage=Boolean(row._hotelImageData);
    preview.hidden=!hasImage;
    if(hasImage) previewImg.src=row._hotelImageData;
    else previewImg.removeAttribute("src");
  }

  category.addEventListener("change",renderHotelImage);
  amount.addEventListener("input",updateQuoteTotal);

  imageInput.addEventListener("change",async()=>{
    const file=imageInput.files?.[0];
    if(!file) return;
    imageInput.disabled=true;
    try{
      row._hotelImageData=await compressQuoteImage(file);
      renderHotelImage();
      toast("Imagen del hotel lista");
    }catch(error){
      console.error(error);
      row._hotelImageData="";
      imageInput.value="";
      renderHotelImage();
      toast(error.message||"No se pudo procesar la imagen");
    }finally{
      imageInput.disabled=false;
    }
  });

  removeImage.addEventListener("click",()=>{
    row._hotelImageData="";
    imageInput.value="";
    renderHotelImage();
  });

  row.querySelector(".remove-item").addEventListener("click",()=>{
    row.remove();
    if(!$("#quoteItems").children.length)addQuoteItem();
    updateQuoteTotal();
  });

  renderHotelImage();
  updateQuoteTotal();
}

function getQuoteItems(){
  return [...$("#quoteItems").querySelectorAll(".quote-item-row")].map(row=>{
    const category=row.querySelector('[name="category"]').value;
    return {
      category,
      concept:row.querySelector('[name="concept"]').value.trim(),
      description:row.querySelector('[name="description"]').value.trim(),
      amount:Number(row.querySelector('[name="amount"]').value||0),
      hotelImage:category==="Hospedaje"?(row._hotelImageData||""):""
    };
  }).filter(x=>x.concept||x.description||x.amount||x.hotelImage);
}

function quoteUsesMsi(){
  return Boolean(quoteForm.msiEnabled?.checked);
}

function syncQuotePaymentMode(){
  const enabled=quoteUsesMsi();
  const msiAmountField=$("#msiAmountField");
  const deadlineField=$("#paymentDeadlineField");
  const methodsField=$("#paymentMethodsField");

  msiAmountField.hidden=!enabled;
  deadlineField.hidden=enabled;
  methodsField.hidden=enabled;

  quoteForm.msiAmount.disabled=!enabled;
  quoteForm.paymentDeadline.disabled=enabled;
  quoteForm.paymentMethods.disabled=enabled;
  quoteForm.paymentMethods.required=!enabled;

  updateQuoteTotal();
}

function updateQuoteTotal(){
  const baseTotal=getQuoteItems().reduce((s,x)=>s+x.amount,0);
  const msiAmount=quoteUsesMsi()?Math.max(0,Number(quoteForm.msiAmount?.value||0)):0;
  const finalTotal=baseTotal+msiAmount;

  $("#quoteBaseTotalPreview").textContent=money(baseTotal);
  $("#quoteTotalPreview").textContent=money(finalTotal);

  return {baseTotal,msiAmount,finalTotal,msiEnabled:quoteUsesMsi()};
}

$("#addQuoteItem").addEventListener("click",()=>addQuoteItem());
quoteForm.msiEnabled?.addEventListener("change",syncQuotePaymentMode);
quoteForm.msiAmount?.addEventListener("input",updateQuoteTotal);
addQuoteItem();
syncQuotePaymentMode();

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

    const pricing=updateQuoteTotal();
    payload.baseTotal=pricing.baseTotal;
    payload.msiEnabled=pricing.msiEnabled;
    payload.msiAmount=pricing.msiAmount;
    payload.paymentDeadline=pricing.msiEnabled?"":(quoteForm.paymentDeadline?.value||"");
    payload.paymentMethods=pricing.msiEnabled?"":(quoteForm.paymentMethods?.value||"").trim();

    const {data:row,error}=await db.from("quotes").insert({
      payload,
      total:pricing.finalTotal,
      status:"sent"
    }).select("*").single();
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
  f.msiEnabled.checked=false;f.msiAmount.value="";f.deposit.value=8000;f.paymentDeadline.value=iso(new Date(Date.now()+8*86400000));f.paymentMethods.value="Transferencia bancaria\nTarjeta de crédito o débito\nDepósito bancario";f.includes.value="Vuelos redondos\n4 noches de hospedaje\nPlan todo incluido\nTraslados aeropuerto-hotel-aeropuerto";f.excludes.value="Gastos personales\nPropinas\nServicios no indicados";f.notes.value="Tarifa sujeta a disponibilidad al momento de reservar.";f.advisor.value="Velora Travel";syncQuotePaymentMode();updateDuration(f);updateQuoteTotal();toast("Ejemplo de cotización cargado");
  }catch(error){console.error("Error llenando ejemplo de cotización:",error);toast("No se pudo llenar el ejemplo");}
});

window.convertQuoteToVoucher=id=>{
  const q=quoteCache.find(x=>x.id===id);
  if(!q){
    toast("No se encontró la cotización");
    return;
  }

  if(q.convertedVoucherId || q.status==="converted"){
    toast("Esta cotización ya fue convertida a reserva");
    return;
  }

  pendingQuoteConversionId=q.id;
  pendingQuoteConversionFolio=q.folio;

  switchView("newVoucher");
  voucherForm.passenger.value=q.client||"";
  voucherForm.passengerCount.value=q.travelerCount||1;
  voucherForm.phone.value=q.phone||"";
  voucherForm.email.value=q.email||"";
  voucherForm.destination.value=q.destination||"";
  voucherForm.startDate.value=q.startDate||"";
  constrainSameMonth(voucherForm);
  voucherForm.endDate.value=q.endDate||"";
  voucherForm.tripType.value=q.tripType||"";
  voucherForm.notes.value=q.notes||"";
  voucherForm.advisor.value=q.advisor||"";
  voucherForm.advisorWhatsapp.value=q.advisorWhatsapp||"55 1900 0905";
  voucherForm.advisorEmail.value=q.advisorEmail||"hola@veloratravel.com";

  updateDuration(voucherForm);
  updateVoucherComputed();

  const acceptedText=(q.acceptedAt||q.status==="accepted")
    ?"Cotización aceptada: datos cargados para crear la reserva"
    :"Datos cargados para crear la reserva";
  toast(acceptedText);
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

window.addEventListener("velora:user-profile-updated",()=>{ loadSharedData({silent:true}); });
