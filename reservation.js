const $=s=>document.querySelector(s);
const token=new URLSearchParams(location.search).get("token");
let currentReservation=null;

function money(v){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v||0));
}
function fmtDate(v){
  if(!v)return"—";
  return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"})
    .format(new Date(v+"T12:00:00"));
}
function fmtDateTime(v){
  if(!v)return"—";
  return new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeStyle:"short"}).format(new Date(v));
}
function esc(v=""){
  return String(v).replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function safeImage(v){
  const s=String(v||"");
  return /^data:image\/(jpeg|png|webp);base64,/i.test(s)?s:"";
}
function toast(msg){
  const el=$("#toast");
  el.textContent=msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2300);
}
function showMissing(){
  document.body.innerHTML='<main style="font-family:sans-serif;padding:45px;text-align:center"><h1>Reserva no encontrada</h1><p>Revisa que el enlace sea correcto.</p></main>';
}

async function loadReservation(){
  if(!token){showMissing();return;}

  const {data,error}=await db.rpc("get_public_reservation_by_token",{p_token:token});
  if(error){console.error(error);showMissing();return;}
  if(!data){showMissing();return;}

  currentReservation=data;
  await db.rpc("mark_reservation_viewed",{p_token:token});
  renderReservation(data);
}

function renderReservation(r){
  document.title=`${r.code} · ${r.client_name} · ${r.agency}`;

  $("#rCode").textContent=r.code||"—";
  $("#rAgency").textContent=r.agency||"—";
  $("#rClient").textContent=r.client_name||"—";
  $("#rDestination").textContent=r.destination||"—";
  $("#rStart").textContent=fmtDate(r.start_date);
  $("#rEnd").textContent=fmtDate(r.end_date);
  $("#rTravelers").textContent=String(r.traveler_count||1);
  $("#rTotal").textContent=money(r.total);

  const isVelora=String(r.agency||"").toLowerCase().includes("velora");
  $("#rBrandLogo").style.display=isVelora?"block":"none";
  $("#rBrandText").style.display=isVelora?"none":"block";
  $("#rBrandText").textContent=r.agency||"Agencia de viajes";

  const services=Array.isArray(r.payload?.services)?r.payload.services:[];
  const serviceRoot=$("#rServices");
  const serviceSection=$("#rServicesSection");

  if(services.length){
    serviceRoot.innerHTML=services.map(item=>{
      const photo=safeImage(item.hotelImage);
      return `<article class="reservation-service">
        <div>
          <small>${esc(item.category||"Servicio")}</small>
          <strong>${esc(item.concept||"—")}</strong>
        </div>
        <p>${esc(item.description||"—")}</p>
        ${photo?`<div class="reservation-service-photo"><img src="${photo}" alt="Servicio de hospedaje"></div>`:""}
      </article>`;
    }).join("");
  }else{
    serviceSection.style.display="none";
  }

  const msi=Boolean(r.payload?.msiEnabled);
  const methods=String(r.payload?.paymentMethods||"").trim();
  if(msi){
    $("#rPayment").textContent="Meses sin intereses, conforme a las condiciones indicadas en la cotización aceptada.";
  }else if(methods){
    $("#rPayment").textContent=methods;
  }else{
    $("#rPaymentSection").style.display="none";
  }

  const signed=Boolean(r.signed_at);
  const state=$("#rState");
  state.textContent=signed?"Firmada por el cliente":"Pendiente de firma";
  state.classList.toggle("signed",signed);

  $("#reservationSignerName").value=r.client_name||"";

  if(signed){
    $("#reservationSignatureSection").style.display="none";
    $("#reservationSignedProof").classList.add("show");
    $("#reservationProofName").textContent=r.signer_name||r.client_name||"—";
    $("#reservationProofDate").textContent=fmtDateTime(r.signed_at);
    if(r.signature_data) $("#reservationProofSignature").src=r.signature_data;
  }
}

const canvas=$("#reservationSignaturePad");
let ctx=null,drawing=false,hasInk=false,last=null;

function resizeCanvas(){
  if(!canvas)return;
  const rect=canvas.getBoundingClientRect();
  const ratio=Math.max(window.devicePixelRatio||1,1);
  const snapshot=hasInk?canvas.toDataURL():null;

  canvas.width=Math.max(1,Math.round(rect.width*ratio));
  canvas.height=Math.round(190*ratio);

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
  return{x:p.clientX-r.left,y:p.clientY-r.top};
}
function start(e){
  if(currentReservation?.signed_at)return;
  drawing=true;hasInk=true;last=point(e);e.preventDefault();
}
function move(e){
  if(!drawing||!ctx)return;
  const p=point(e);
  ctx.beginPath();
  ctx.moveTo(last.x,last.y);
  ctx.lineTo(p.x,p.y);
  ctx.stroke();
  last=p;
  e.preventDefault();
}
function end(){drawing=false;last=null;}

canvas.addEventListener("pointerdown",start);
canvas.addEventListener("pointermove",move);
["pointerup","pointerleave","pointercancel"].forEach(x=>canvas.addEventListener(x,end));
canvas.addEventListener("touchstart",start,{passive:false});
canvas.addEventListener("touchmove",move,{passive:false});
canvas.addEventListener("touchend",end);

$("#clearReservationSignature").addEventListener("click",()=>{
  if(ctx)ctx.clearRect(0,0,canvas.width,canvas.height);
  hasInk=false;
});

$("#signReservationButton").addEventListener("click",async()=>{
  if(!currentReservation||currentReservation.signed_at)return;

  const name=$("#reservationSignerName").value.trim();
  if(!$("#reservationAcceptCheck").checked){
    toast("Debes confirmar que revisaste los datos de la reserva");
    return;
  }
  if(!$("#reservationTermsCheck").checked){
    toast("Debes leer y aceptar las Políticas y Condiciones");
    return;
  }
  if(name.length<3){
    toast("Escribe el nombre de quien firma");
    return;
  }
  if(!hasInk){
    toast("Falta la firma");
    return;
  }

  const button=$("#signReservationButton");
  button.disabled=true;
  button.textContent="Guardando firma…";

  const signature=canvas.toDataURL("image/png");
  const {data,error}=await db.rpc("sign_reservation",{
    p_token:token,
    p_signer_name:name,
    p_signature_data:signature,
    p_terms_version:"VELORA-POLITICAS-V1"
  });

  if(error||!data){
    console.error(error);
    toast("No se pudo guardar la firma");
    button.disabled=false;
    button.textContent="Firmar y confirmar reserva";
    return;
  }

  toast("Reserva firmada correctamente");
  await loadReservation();
});

window.addEventListener("resize",resizeCanvas);
loadReservation().then(()=>setTimeout(resizeCanvas,60));
