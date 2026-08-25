const $=s=>document.querySelector(s);
const token=new URLSearchParams(location.search).get("token");
let currentQuote=null;
function fmt(v){if(!v)return"—";return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v+"T12:00:00"))}
function money(v){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v||0))}
function diff(a,b){if(!a||!b)return{days:0,nights:0};const x=new Date(a+"T12:00:00"),y=new Date(b+"T12:00:00"),n=Math.max(0,Math.round((y-x)/86400000));return{days:n+1,nights:n}}
function set(s,v){const el=$(s);if(el)el.textContent=(v===0?"0":v)||"—"}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function safeQuoteImage(v){const s=String(v||"");return /^data:image\/(jpeg|png|webp);base64,/i.test(s)?s:""}
function truthy(v){return v===true||["true","on","1","yes"].includes(String(v||"").toLowerCase())}
function missing(){document.body.innerHTML='<main style="font-family:sans-serif;padding:40px;text-align:center"><h1>Cotización no encontrada</h1><p>Revisa que el enlace sea correcto.</p></main>'}

function renderAcceptance(q){
  const pending=$("#qAcceptancePending");
  const done=$("#qAcceptanceDone");
  const accepted=Boolean(q.acceptedAt)||q.status==="accepted"||q.status==="converted";

  pending.hidden=accepted;
  done.hidden=!accepted;

  if(accepted){
    const text=q.acceptedAt
      ? `Aceptada el ${new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeStyle:"short"}).format(new Date(q.acceptedAt))}`
      : "Cotización aceptada";
    set("#qAcceptedAtText",text);
  }
}

async function acceptCurrentQuote(){
  if(!currentQuote||!token)return;

  const button=$("#acceptQuoteButton");
  if(!confirm("¿Deseas aceptar esta cotización y solicitar que Velora Travel continúe con la reservación?"))return;

  button.disabled=true;
  button.textContent="Aceptando…";

  const {data,error}=await db.rpc("accept_quote",{
    p_token:token,
    p_client_name:currentQuote.client||null
  });

  if(error){
    console.error(error);
    button.disabled=false;
    button.textContent="Aceptar cotización";
    alert("No se pudo registrar la aceptación. Intenta nuevamente.");
    return;
  }

  currentQuote.status="accepted";
  currentQuote.acceptedAt=data?.accepted_at||new Date().toISOString();
  renderAcceptance(currentQuote);
}

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
    acceptedAt:row.accepted_at||null,
    acceptedByName:row.accepted_by_name||null,
    status:row.status
  };
  currentQuote=q;
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
  renderAcceptance(q);
}

$("#acceptQuoteButton")?.addEventListener("click",acceptCurrentQuote);
loadQuote();
