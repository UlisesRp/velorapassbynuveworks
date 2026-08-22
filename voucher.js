const $=s=>document.querySelector(s);
const token=new URLSearchParams(location.search).get("token");
let currentVoucher=null;

function fmtDate(v){if(!v)return"—";return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v+"T12:00:00"))}
function fmtShort(v){if(!v)return"—";return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T12:00:00")).toUpperCase()}
function fmtDateTime(v){return new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeStyle:"short"}).format(new Date(v))}
function fmtTime(v){if(!v)return"—";const [h,m]=v.split(":");const d=new Date(2000,0,1,Number(h),Number(m));return new Intl.DateTimeFormat("es-MX",{hour:"2-digit",minute:"2-digit"}).format(d)}
function diff(a,b){if(!a||!b)return{days:0,nights:0};const x=new Date(a+"T12:00:00"),y=new Date(b+"T12:00:00"),n=Math.max(0,Math.round((y-x)/86400000));return{days:n+1,nights:n}}
function set(id,val){const el=$(id);if(el)el.textContent=(val===0?"0":val)||"—"}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}

function normalize(row){return {id:row.id,folio:row.code,publicToken:row.public_token,...(row.payload||{}),status:row.status,createdAt:row.created_at,viewedAt:row.viewed_at,signedAt:row.signed_at,signerName:row.signer_name,signature:row.signature_data}}

async function loadVoucher(){
  if(!token){showMissing();return}
  const {data,error}=await db.rpc("get_voucher_by_token",{p_token:token});
  if(error){console.error(error);showMissing();return}
  const row=Array.isArray(data)?data[0]:data;
  if(!row){showMissing();return}
  currentVoucher=normalize(row);
  await db.rpc("mark_voucher_viewed",{p_token:token});
  render(currentVoucher);
}
function showMissing(){document.body.innerHTML='<main style="font-family:sans-serif;padding:40px;text-align:center"><h1>Voucher no encontrado</h1><p>Revisa que el enlace sea correcto.</p></main>'}

function render(v){
  const duration=diff(v.startDate,v.endDate),stay=diff(v.checkIn||v.startDate,v.checkOut||v.endDate);
  document.title=`${v.folio} · ${v.passenger} · Velora Travel`;
  set("#vFolio",v.folio);set("#vIssuedAt",fmtDate(v.createdAt?.slice(0,10)));set("#vPassengerGreeting",v.passenger);set("#vPassenger",v.passenger);set("#vPassengerCount",v.passengerCount||"1");set("#vPhone",v.phone);set("#vEmail",v.email);
  set("#vDestination",v.destination);set("#vStartDate",fmtDate(v.startDate));set("#vEndDate",fmtDate(v.endDate));set("#vDuration",`${duration.days} días / ${duration.nights} noches`);set("#vTripType",v.tripType);set("#vGeneralLocator",v.generalLocator);
  set("#vTransportOperator",v.transportOperator||[v.outboundAirline,v.returnAirline].filter(Boolean).join(" / "));
  set("#vOutboundSummary",[v.outboundAirline,v.outboundFlight].filter(Boolean).join(" · "));set("#vOutboundFlightTime",[fmtDate(v.outboundFlightDate),fmtTime(v.outboundDepartureTime)].filter(x=>x&&x!=="—").join(" · "));set("#vOutboundFlightLocator",v.outboundFlightLocator);
  set("#vReturnSummary",[v.returnAirline,v.returnFlight].filter(Boolean).join(" · "));set("#vReturnFlightTime",[fmtDate(v.returnFlightDate),fmtTime(v.returnDepartureTime)].filter(x=>x&&x!=="—").join(" · "));set("#vReturnFlightLocator",v.returnFlightLocator);
  set("#vArrivalTransferLocator",v.arrivalTransferLocator);set("#vDepartureTransferLocator",v.departureTransferLocator);set("#vBaggage",[v.carryOnBaggage,v.checkedBaggage,v.baggage].filter(Boolean).join(" · "));
  set("#vHotel",v.hotel);set("#vCheckIn",fmtDate(v.checkIn||v.startDate));set("#vCheckOut",fmtDate(v.checkOut||v.endDate));set("#vRoom",v.room);set("#vLodgingPlan",v.lodgingPlan);set("#vNights",stay.nights);set("#vLodgingLocator",v.lodgingLocator);
  set("#vFoodDetails",v.foodDetails);set("#vToursDetails",v.toursDetails);set("#vIncluded",v.included);
  const services={serviceFlightsCard:!!v.serviceFlights,serviceLodgingCard:!!v.serviceLodging,serviceTransfersCard:!!v.serviceTransfers,serviceFoodCard:!!v.serviceFood,serviceToursCard:!!v.serviceTours,serviceBaggageCard:!!v.serviceBaggage};
  Object.entries(services).forEach(([key,on])=>$("#"+key)?.classList.toggle("not-included",!on));
  set("#vNotes",v.notes||"Sin observaciones adicionales.");set("#vAdvisor",v.advisor||"Velora Travel");set("#vAdvisorWhatsapp",v.advisorWhatsapp||"55 1900 0905");set("#vAdvisorEmail",v.advisorEmail||"hola@veloratravel.com");set("#vAdvisorInstagram",v.advisorInstagram||"@veloratravel");

  set("#tOutAirline",v.outboundAirline);set("#tOutFlight",v.outboundFlight);set("#tOutDate",fmtShort(v.outboundFlightDate));set("#tOutOriginCode",v.outboundOriginCode);set("#tOutOriginCity",v.outboundOriginCity);set("#tOutDestCode",v.outboundDestinationCode);set("#tOutDestCity",v.outboundDestinationCity);set("#tOutDeparture",fmtTime(v.outboundDepartureTime));set("#tOutDepTerminal",v.outboundDepartureTerminal);set("#tOutArrival",fmtTime(v.outboundArrivalTime));set("#tOutArrTerminal",v.outboundArrivalTerminal);
  set("#tReturnAirline",v.returnAirline);set("#tReturnFlight",v.returnFlight);set("#tReturnDate",fmtShort(v.returnFlightDate));set("#tReturnOriginCode",v.returnOriginCode);set("#tReturnOriginCity",v.returnOriginCity);set("#tReturnDestCode",v.returnDestinationCode);set("#tReturnDestCity",v.returnDestinationCity);set("#tReturnDeparture",fmtTime(v.returnDepartureTime));set("#tReturnDepTerminal",v.returnDepartureTerminal);set("#tReturnArrival",fmtTime(v.returnArrivalTime));set("#tReturnArrTerminal",v.returnArrivalTerminal);
  set("#tCarryOn",v.carryOnBaggage);set("#tChecked",v.checkedBaggage);set("#tOutLocator",v.outboundFlightLocator);set("#tReturnLocator",v.returnFlightLocator);set("#tStubAirline",v.outboundAirline||v.returnAirline||"AEROLÍNEA");set("#tPassenger",v.passenger);set("#tRouteOrigin",v.outboundOriginCode);set("#tRouteDest",v.outboundDestinationCode);set("#tIssueDate",fmtShort(v.createdAt?.slice(0,10)));set("#tDocCode",v.folio);

  set("#vAcceptance",v.acceptance||"Confirmo que he revisado los datos de mi viaje y acepto las condiciones aplicables.");
  $("#signerName").value=v.passenger||"";
  if(v.signedAt){$("#signatureSection").style.display="none";$("#signedProof").classList.add("show");set("#proofName",v.signerName||v.passenger);set("#proofDate",fmtDateTime(v.signedAt));$("#proofSignature").src=v.signature}
}

const canvas=$("#signaturePad");let ctx,drawing=false,hasInk=false,last=null;
function resizeCanvas(){if(!canvas)return;const rect=canvas.getBoundingClientRect(),ratio=Math.max(devicePixelRatio||1,1),snapshot=hasInk?canvas.toDataURL():null;canvas.width=rect.width*ratio;canvas.height=190*ratio;ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);ctx.lineWidth=2.2;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#292225";if(snapshot){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,190);img.src=snapshot}}
function point(e){const r=canvas.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:p.clientX-r.left,y:p.clientY-r.top}}
function start(e){if(currentVoucher?.signedAt)return;drawing=true;hasInk=true;last=point(e);e.preventDefault()}
function move(e){if(!drawing)return;const p=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;e.preventDefault()}
function end(){drawing=false;last=null}
canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);["pointerup","pointerleave","pointercancel"].forEach(x=>canvas.addEventListener(x,end));canvas.addEventListener("touchstart",start,{passive:false});canvas.addEventListener("touchmove",move,{passive:false});canvas.addEventListener("touchend",end);
$("#clearSignature").addEventListener("click",()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false});
$("#signButton").addEventListener("click",async()=>{
  if(!currentVoucher||currentVoucher.signedAt)return;
  const name=$("#signerName").value.trim();
  if(!$("#acceptCheck").checked){toast("Debes aceptar la información y las políticas");return}
  if(name.length<3){toast("Escribe el nombre de quien firma");return}
  if(!hasInk){toast("Falta la firma");return}
  const button=$("#signButton");button.disabled=true;button.textContent="Guardando firma…";
  const signature=canvas.toDataURL("image/png");
  const {data,error}=await db.rpc("sign_voucher",{p_token:token,p_signer_name:name,p_signature_data:signature});
  if(error||!data){console.error(error);toast("No se pudo guardar la firma");button.disabled=false;button.textContent="Firmar y confirmar voucher";return}
  toast("Voucher firmado correctamente");
  await loadVoucher();
});
window.addEventListener("resize",resizeCanvas);
loadVoucher().then(()=>setTimeout(resizeCanvas,50));
