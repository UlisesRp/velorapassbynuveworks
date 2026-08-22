const STORAGE_KEY = "veloraPassVouchersV1";
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const id = params.get("id");
const vouchers = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
const save = items => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

function formatDate(v){
  if(!v) return "—";
  return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v+"T12:00:00"));
}
function formatDateTime(v){
  return new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeStyle:"short"}).format(new Date(v));
}
function money(v){
  const n = Number(v || 0);
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n);
}
function dateDiff(start,end){
  if(!start || !end) return {days:0,nights:0};
  const a = new Date(start+"T12:00:00");
  const b = new Date(end+"T12:00:00");
  const nights = Math.max(0, Math.round((b-a)/86400000));
  return {days:nights+1,nights};
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2400);
}
function getVoucher(){ return vouchers().find(v=>v.id===id); }

function render(){
  const v=getVoucher();
  if(!v){
    document.body.innerHTML=`<main style="font-family:sans-serif;padding:40px;text-align:center"><h1>Cupón no encontrado</h1><p>Revisa que el enlace sea correcto.</p></main>`;
    return;
  }

  const duration=dateDiff(v.startDate,v.endDate);
  const stay=dateDiff(v.checkIn||v.startDate,v.checkOut||v.endDate);
  const balance=Math.max(0,Number(v.totalPrice||0)-Number(v.paymentsMade||0));

  document.title=`${v.folio} · ${v.passenger} · Velora Travel`;
  $("#vFolio").textContent=v.folio;
  $("#vIssuedAt").textContent=formatDate(v.createdAt.slice(0,10));
  $("#vPassengerGreeting").textContent=v.passenger;
  $("#vPassenger").textContent=v.passenger;
  $("#vPassengerCount").textContent=v.passengerCount||"1";
  $("#vPhone").textContent=v.phone||"—";
  $("#vEmail").textContent=v.email||"—";

  $("#vDestination").textContent=v.destination||"—";
  $("#vStartDate").textContent=formatDate(v.startDate);
  $("#vEndDate").textContent=formatDate(v.endDate);
  $("#vDuration").textContent=`${duration.days} días / ${duration.nights} noches`;
  $("#vTripType").textContent=v.tripType||"—";
  $("#vGeneralLocator").textContent=v.generalLocator||"—";

  $("#vAirline").textContent=v.airline||"—";
  $("#vOutboundFlight").textContent=v.outboundFlight||"—";
  $("#vOutboundFlightTime").textContent=[formatDate(v.outboundFlightDate), v.outboundFlightTime].filter(x=>x && x!=="—").join(" · ")||"—";
  $("#vOutboundFlightLocator").textContent=v.outboundFlightLocator||"—";
  $("#vReturnFlight").textContent=v.returnFlight||"—";
  $("#vReturnFlightTime").textContent=[formatDate(v.returnFlightDate), v.returnFlightTime].filter(x=>x && x!=="—").join(" · ")||"—";
  $("#vReturnFlightLocator").textContent=v.returnFlightLocator||"—";
  $("#vArrivalTransferLocator").textContent=v.arrivalTransferLocator||"—";
  $("#vDepartureTransferLocator").textContent=v.departureTransferLocator||"—";
  $("#vBaggage").textContent=v.baggage||"—";

  $("#vHotel").textContent=v.hotel||"—";
  $("#vCheckIn").textContent=formatDate(v.checkIn||v.startDate);
  $("#vCheckOut").textContent=formatDate(v.checkOut||v.endDate);
  $("#vRoom").textContent=v.room||"—";
  $("#vLodgingPlan").textContent=v.lodgingPlan||"—";
  $("#vNights").textContent=stay.nights;
  $("#vLodgingLocator").textContent=v.lodgingLocator||"—";

  $("#vFoodDetails").textContent=v.foodDetails||"—";
  $("#vToursDetails").textContent=v.toursDetails||"—";
  $("#vIncluded").textContent=v.included||"—";

  const services = {
    serviceFlightsCard: !!v.serviceFlights,
    serviceLodgingCard: !!v.serviceLodging,
    serviceTransfersCard: !!v.serviceTransfers,
    serviceFoodCard: !!v.serviceFood,
    serviceToursCard: !!v.serviceTours,
    serviceBaggageCard: !!v.serviceBaggage
  };
  Object.entries(services).forEach(([id,on])=>$("#"+id)?.classList.toggle("not-included",!on));
  $("#vTotalPrice").textContent=money(v.totalPrice);
  $("#vDeposit").textContent=money(v.deposit);
  $("#vPaymentsMade").textContent=money(v.paymentsMade);
  $("#vBalance").textContent=money(balance);
  $("#vPaymentDeadline").textContent=formatDate(v.paymentDeadline);
  $("#vNotes").textContent=v.notes||"Sin observaciones adicionales.";
  $("#vAdvisor").textContent=v.advisor||"Velora Travel";
  $("#vAdvisorWhatsapp").textContent=v.advisorWhatsapp||"55 1900 0905";
  $("#vAdvisorEmail").textContent=v.advisorEmail||"hola@veloratravel.com";
  $("#vAdvisorInstagram").textContent=v.advisorInstagram||"@veloratravel";
  $("#vAcceptance").textContent=v.acceptance||"Confirmo que he revisado los datos de mi viaje y que la información mostrada es correcta.";
  $("#signerName").value=v.passenger;

  if(v.signedAt){
    $("#signatureSection").style.display="none";
    $("#signedProof").classList.add("show");
    $("#proofName").textContent=v.signerName||v.passenger;
    $("#proofDate").textContent=formatDateTime(v.signedAt);
    $("#proofSignature").src=v.signature;
  }else{
    markViewed(v);
  }
}
function markViewed(v){
  if(v.viewedAt) return;
  const items=vouchers();
  const item=items.find(x=>x.id===v.id);
  if(item){ item.viewedAt=new Date().toISOString(); save(items); }
}

const canvas=$("#signaturePad");
let ctx, drawing=false, hasInk=false, last=null;
function resizeCanvas(){
  if(!canvas) return;
  const rect=canvas.getBoundingClientRect();
  const ratio=Math.max(window.devicePixelRatio||1,1);
  const snapshot=hasInk ? canvas.toDataURL() : null;
  canvas.width=rect.width*ratio;
  canvas.height=190*ratio;
  ctx=canvas.getContext("2d");
  ctx.scale(ratio,ratio);
  ctx.lineWidth=2.2;
  ctx.lineCap="round";
  ctx.lineJoin="round";
  ctx.strokeStyle="#292225";
  if(snapshot){
    const img=new Image();
    img.onload=()=>ctx.drawImage(img,0,0,rect.width,190);
    img.src=snapshot;
  }
}
function point(e){
  const r=canvas.getBoundingClientRect();
  const p=e.touches?e.touches[0]:e;
  return {x:p.clientX-r.left,y:p.clientY-r.top};
}
function start(e){ if(getVoucher()?.signedAt) return; drawing=true;hasInk=true;last=point(e);e.preventDefault(); }
function move(e){ if(!drawing)return;const p=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;e.preventDefault(); }
function end(){drawing=false;last=null}

canvas.addEventListener("pointerdown",start);
canvas.addEventListener("pointermove",move);
["pointerup","pointerleave","pointercancel"].forEach(ev=>canvas.addEventListener(ev,end));
canvas.addEventListener("touchstart",start,{passive:false});
canvas.addEventListener("touchmove",move,{passive:false});
canvas.addEventListener("touchend",end);

$("#clearSignature").addEventListener("click",()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;});
$("#signButton").addEventListener("click",()=>{
  const v=getVoucher(); if(!v||v.signedAt)return;
  const name=$("#signerName").value.trim();
  if(!$("#acceptCheck").checked){toast("Marca la casilla de aceptación");return}
  if(name.length<3){toast("Escribe el nombre de quien firma");return}
  if(!hasInk){toast("Falta la firma");return}

  const items=vouchers();
  const item=items.find(x=>x.id===id);
  item.signerName=name;
  item.signature=canvas.toDataURL("image/png");
  item.signedAt=new Date().toISOString();
  save(items);
  toast("Cupón firmado correctamente");
  setTimeout(()=>render(),450);
});

window.addEventListener("resize",resizeCanvas);
render();
setTimeout(resizeCanvas,50);
