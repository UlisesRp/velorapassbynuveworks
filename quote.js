const STORAGE_KEY="veloraPassQuotesV1";
const $=s=>document.querySelector(s);
const id=new URLSearchParams(location.search).get("id");
const getAll=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch{return[]}};
function fmt(v){if(!v)return"—";return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v+"T12:00:00"))}
function money(v){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v||0))}
function diff(a,b){if(!a||!b)return{days:0,nights:0};const x=new Date(a+"T12:00:00"),y=new Date(b+"T12:00:00"),n=Math.max(0,Math.round((y-x)/86400000));return{days:n+1,nights:n}}
function set(s,v){const el=$(s);if(el)el.textContent=v||"—"}
const q=getAll().find(x=>x.id===id);
if(!q){document.body.innerHTML='<main style="font-family:sans-serif;padding:40px;text-align:center"><h1>Cotización no encontrada</h1><p>Revisa que el enlace sea correcto.</p></main>'}
else{
  const d=diff(q.startDate,q.endDate);document.title=`${q.folio} · ${q.client} · Velora Travel`;
  set("#qFolio",q.folio);set("#qIssued",fmt(q.createdAt.slice(0,10)));set("#qValidUntil",fmt(q.validUntil));set("#qClient",q.client);set("#qTitle",q.title);set("#qDestination",q.destination);set("#qDates",`${fmt(q.startDate)} — ${fmt(q.endDate)}`);set("#qDuration",`${d.days} días / ${d.nights} noches`);set("#qTravelers",`${q.travelerCount||1} pasajero${Number(q.travelerCount||1)>1?"s":""}`);
  $("#qItems").innerHTML=(q.items||[]).map(x=>`<div class="quote-public-row"><div><small>${x.category||"Servicio"}</small><strong>${x.concept||"—"}</strong></div><span>${x.description||"—"}</span><b>${money(x.amount)}</b></div>`).join("");
  set("#qTotal",money(q.total));set("#qDeposit",money(q.deposit));set("#qDeadline",fmt(q.paymentDeadline));set("#qTripType",q.tripType);set("#qIncludes",q.includes);set("#qExcludes",q.excludes);set("#qNotes",q.notes);set("#qAdvisor",q.advisor||"Velora Travel");set("#qWhatsapp",q.advisorWhatsapp||"55 1900 0905");set("#qEmail",q.advisorEmail||"hola@veloratravel.com");
}
