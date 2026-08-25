const $=s=>document.querySelector(s);
const token=new URLSearchParams(location.search).get("token");
function fmt(v){if(!v)return"—";return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v+"T12:00:00"))}
function money(v){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v||0))}
function diff(a,b){if(!a||!b)return{days:0,nights:0};const x=new Date(a+"T12:00:00"),y=new Date(b+"T12:00:00"),n=Math.max(0,Math.round((y-x)/86400000));return{days:n+1,nights:n}}
function set(s,v){const el=$(s);if(el)el.textContent=(v===0?"0":v)||"—"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function safeQuoteImage(v){const s=String(v||"");return /^data:image\/(jpeg|png|webp);base64,/i.test(s)?s:""}
function truthy(v){return v===true||["true","on","1","yes"].includes(String(v||"").toLowerCase())}
function missing(){document.body.innerHTML='<main style="font-family:sans-serif;padding:40px;text-align:center"><h1>Cotización no encontrada</h1><p>Revisa que el enlace sea correcto.</p></main>'}
async function loadQuote(){
  if(!token){missing();return}
  const {data,error}=await db.rpc("get_public_quote_by_token",{p_token:token});
  if(error){console.error(error);missing();return}
  const row=data;
  if(!row){missing();return}
  await db.rpc("mark_quote_viewed",{p_token:token});
  const q={
    id:row.id,
    folio:row.code,
    publicToken:row.public_token,
    ...(row.payload||{}),
    total:Number(row.total||0),
    createdAt:row.created_at,
    status:row.status
  };
  const d=diff(q.startDate,q.endDate);document.title=`${q.folio} · ${q.client} · Velora Travel`;
  set("#qFolio",q.folio);set("#qIssued",fmt(q.createdAt?.slice(0,10)));set("#qValidUntil",fmt(q.validUntil));set("#qClient",q.client);set("#qTitle",q.title);set("#qDestination",q.destination);set("#qDates",`${fmt(q.startDate)} — ${fmt(q.endDate)}`);set("#qDuration",`${d.days} días / ${d.nights} noches`);set("#qTravelers",`${q.travelerCount||1} pasajero${Number(q.travelerCount||1)>1?"s":""}`);
  $("#qItems").innerHTML=(q.items||[]).map(x=>{
    const photo=safeQuoteImage(x.hotelImage);
    const photoBlock=photo?`<div class="quote-hotel-photo"><img src="${photo}" alt="Hospedaje considerado"></div>`:"";
    return `<div class="quote-public-item"><div class="quote-public-row public-no-price"><div><small>${esc(x.category||"Servicio")}</small><strong>${esc(x.concept||"—")}</strong></div><span>${esc(x.description||"—")}</span></div>${photoBlock}</div>`;
  }).join("");

  const msiEnabled=truthy(q.msiEnabled);
  const deadlineBox=$("#qDeadlineBox");
  const paymentMethodsBox=$("#qPaymentMethodsBox");
  const msiBox=$("#qMsiBox");
  const infoGrid=$("#qInfoGrid");

  set("#qTotal",money(q.total));
  set("#qTripType",q.tripType);

  if(msiEnabled){
    deadlineBox.hidden=true;
    paymentMethodsBox.hidden=true;
    msiBox.hidden=false;
    infoGrid.classList.add("single-info");
    set("#qTotalCaption","MXN · Precio final · Meses sin intereses");
  }else{
    const hasDeadline=Boolean(q.paymentDeadline);
    const methods=String(q.paymentMethods||"").trim();
    deadlineBox.hidden=!hasDeadline;
    if(hasDeadline)set("#qDeadline",fmt(q.paymentDeadline));
    paymentMethodsBox.hidden=!methods;
    if(methods)set("#qPaymentMethods",methods);
    msiBox.hidden=true;
    infoGrid.classList.toggle("single-info",!hasDeadline);
    set("#qTotalCaption","MXN · Precio final de esta cotización");
  }

  set("#qIncludes",q.includes);set("#qExcludes",q.excludes);set("#qNotes",q.notes);set("#qAdvisor",q.advisor||"Velora Travel");set("#qWhatsapp",q.advisorWhatsapp||"55 1900 0905");set("#qEmail",q.advisorEmail||"hola@veloratravel.com");
}
loadQuote();
