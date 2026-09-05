(() => {
  const state={clients:[],reservations:[],payments:[],events:[],profiles:new Map(),calendarCursor:new Date(new Date().getFullYear(),new Date().getMonth(),1),selectedCalendarDate:null};
  const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const isoDate=d=>new Date(d).toISOString().slice(0,10);
  const today=()=>new Date().toISOString().slice(0,10);
  const agencyClass=a=>String(a||"").toLowerCase().includes("pink")?"pink":"agency";
  const agencyOf=v=>v||"Velora Travel";
  const num=v=>Number(v||0);
  const byId=(arr,id)=>arr.find(x=>x.id===id);
  const creatorName=row=>state.profiles.get(row.created_by)?.display_name || state.profiles.get(row.created_by)?.email?.split("@")[0] || "Sin registro";
  const paymentsFor=id=>state.payments.filter(p=>p.reservation_id===id);
  const paidFor=id=>paymentsFor(id).reduce((s,p)=>s+num(p.amount),0);
  const balanceFor=r=>Math.max(0,num(r.total)-paidFor(r.id));
  const effectiveStatus=r=>{
    if(r.status==="cancelled") return "cancelled";
    if(num(r.total)>0 && balanceFor(r)<=0 && r.signed_at) return "liquidated";
    if(r.signed_at) return "confirmed";
    return "pending";
  };
  const statusLabel=s=>({pending:"Pendiente de firma",confirmed:"Firmada",liquidated:"Liquidada",cancelled:"Cancelada"}[s]||s);
  const statusClass=s=>s==="liquidated"?"ok":s==="cancelled"?"danger":s==="pending"?"warn":"agency";

  async function loadOps({silent=false}={}){
    if(typeof db==="undefined")return;
    try{
      const [c,r,p,e,pr]=await Promise.all([
        db.from("clients").select("*").order("created_at",{ascending:false}),
        db.from("reservations").select("*").order("created_at",{ascending:false}),
        db.from("payments").select("*").order("paid_at",{ascending:false}),
        db.from("events").select("*").order("event_date",{ascending:true}),
        db.from("profiles").select("id,display_name,email")
      ]);
      for(const result of [c,r,p,e]) if(result.error) throw result.error;
      state.clients=c.data||[];state.reservations=r.data||[];state.payments=p.data||[];state.events=e.data||[];
      state.profiles=new Map((pr.data||[]).map(x=>[x.id,x]));
      renderAll();
    }catch(error){console.error("Velora App V2 load:",error);if(!silent)toast("Falta ejecutar la migración V2.0 en Supabase");}
  }

  function renderAll(){
    renderClientOptions();renderClients();renderReservations();renderPayments();renderDashboard();renderCalendar();renderReports();
  }

  function renderClientOptions(){
    const opts=state.clients.filter(c=>c.status!=="inactive").map(c=>`<option value="${c.id}">${esc(c.full_name)} · ${esc(c.agency)}</option>`).join("");
    const q=$("#quoteClientSelect");if(q){const val=q.value;q.innerHTML=`<option value="">Captura manual</option>${opts}`;q.value=val;}
    const r=$("#reservationClientSelect");if(r){const val=r.value;r.innerHTML=`<option value="">Captura manual</option>${opts}`;r.value=val;}
    const pay=$("#paymentReservationSelect");if(pay){
      const val=pay.value;
      pay.innerHTML=`<option value="">Selecciona reserva firmada</option>`+
        state.reservations
          .filter(x=>x.status!=="cancelled" && Boolean(x.signed_at))
          .map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.client_name)} · Saldo ${money(balanceFor(x))}</option>`)
          .join("");
      pay.value=val;
    }
  }

  const clientForm=$("#clientForm");
  function resetClient(){clientForm?.reset();if(clientForm){clientForm.elements.id.value="";clientForm.adults.value=1;clientForm.minors.value=0;clientForm.status.value="active";}$("#clientFormTitle").textContent="Nuevo cliente";}
  $("#resetClientForm")?.addEventListener("click",resetClient);
  clientForm?.addEventListener("submit",async e=>{
    e.preventDefault();const f=clientForm;
    const payload={agency:f.agency.value,full_name:f.fullName.value.trim(),phone:f.phone.value.trim(),email:f.email.value.trim(),adults:num(f.adults.value),minors:num(f.minors.value),notes:f.notes.value.trim(),status:f.status.value,updated_at:new Date().toISOString()};
    if(!payload.full_name)return;
    const id=f.elements.id.value;let result;
    if(id) result=await db.from("clients").update(payload).eq("id",id);
    else result=await db.from("clients").insert(payload);
    if(result.error){toast(result.error.message);return;}toast(id?"Cliente actualizado":"Cliente guardado");resetClient();await loadOps({silent:true});
  });
  $("#searchClients")?.addEventListener("input",renderClients);
  function renderClients(){
    const root=$("#clientsList");if(!root)return;const q=$("#searchClients").value.trim().toLowerCase();
    const rows=state.clients.filter(c=>[c.full_name,c.phone,c.email,c.agency].join(" ").toLowerCase().includes(q));
    root.innerHTML=rows.map(c=>`<article class="ops-card"><div><div class="ops-card-meta"><span class="ops-chip ${agencyClass(c.agency)}">${esc(c.agency)}</span><span class="ops-chip ${c.status==="active"?"ok":""}">${c.status==="active"?"Activo":"Inactivo"}</span></div><h3>${esc(c.full_name)}</h3><p>${esc(c.phone||"Sin teléfono")} · ${esc(c.email||"Sin correo")}</p><p>${num(c.adults)} adulto(s) · ${num(c.minors)} menor(es)</p>${c.notes?`<p>${esc(c.notes)}</p>`:""}</div><div class="ops-card-actions"><button class="ghost-btn compact-btn" onclick="v2QuoteClient('${c.id}')">Cotizar</button><button class="ghost-btn compact-btn" onclick="v2EditClient('${c.id}')">Editar</button><button class="icon-btn danger-btn" onclick="v2DeleteClient('${c.id}')">⌫</button></div></article>`).join("");
    $("#clientsEmpty").hidden=rows.length>0;
  }
  window.v2EditClient=id=>{const c=byId(state.clients,id);if(!c)return;switchView("clients");const f=clientForm;f.elements.id.value=c.id;f.agency.value=c.agency;f.fullName.value=c.full_name;f.phone.value=c.phone||"";f.email.value=c.email||"";f.adults.value=c.adults??1;f.minors.value=c.minors??0;f.notes.value=c.notes||"";f.status.value=c.status||"active";$("#clientFormTitle").textContent="Editar cliente";window.scrollTo({top:0,behavior:"smooth"});};
  window.v2DeleteClient=async id=>{const c=byId(state.clients,id);if(!c||!confirm(`¿Eliminar a ${c.full_name} de la base de clientes?`))return;const {error}=await db.from("clients").delete().eq("id",id);if(error){toast(error.message);return;}toast("Cliente eliminado");await loadOps({silent:true});};
  window.v2QuoteClient=id=>{const c=byId(state.clients,id);if(!c)return;switchView("newQuote");quoteForm.agency.value=c.agency;quoteForm.clientRecordId.value=c.id;quoteForm.client.value=c.full_name;quoteForm.phone.value=c.phone||"";quoteForm.email.value=c.email||"N/A";quoteForm.adults.value=Math.max(1,num(c.adults)||1);quoteForm.minors.value=Math.max(0,num(c.minors));syncQuoteTravelerCount();toast("Cliente cargado en cotización");};
  $("#quoteClientSelect")?.addEventListener("change",e=>{const c=byId(state.clients,e.target.value);if(!c)return;quoteForm.agency.value=c.agency;quoteForm.client.value=c.full_name;quoteForm.phone.value=c.phone||"";quoteForm.email.value=c.email||"N/A";quoteForm.adults.value=Math.max(1,num(c.adults)||1);quoteForm.minors.value=Math.max(0,num(c.minors));syncQuoteTravelerCount();});

  function reservationLink(token){
    const u=new URL("reservation.html",location.href);
    u.searchParams.set("token",token);
    return u.href;
  }

  function reservationPassengerCounts(r){
    const payload=r?.payload||{};
    const adults=Math.max(1,num(payload.adults ?? r?.adults ?? 1));
    const minors=Math.max(0,num(payload.minors ?? r?.minors ?? 0));
    return {adults,minors,total:adults+minors};
  }

  function normalizePassengerList(list){
    return Array.isArray(list)
      ? list.map(p=>({
          type:p?.type==="minor"?"minor":"adult",
          name:String(p?.name||"").trim(),
          age:Number.isFinite(Number(p?.age))?Number(p.age):null
        }))
      : [];
  }

  function reservationPassengersComplete(r){
    if(!r)return false;
    const {adults,minors,total}=reservationPassengerCounts(r);
    const passengers=normalizePassengerList(r.payload?.passengers);
    if(passengers.length!==total)return false;

    const adultRows=passengers.filter(p=>p.type==="adult");
    const minorRows=passengers.filter(p=>p.type==="minor");
    if(adultRows.length!==adults || minorRows.length!==minors)return false;

    return passengers.every(p=>{
      if(p.name.length<3 || p.age===null)return false;
      if(p.type==="minor")return p.age>=0 && p.age<=12;
      return p.age>=13 && p.age<=120;
    });
  }

  function reservationSendGuard(r){
    if(!r?.public_token){
      toast("La reserva todavía no tiene enlace público");
      return false;
    }
    if(!reservationPassengersComplete(r)){
      toast("Completa nombre y edad de todos los pasajeros antes de enviar la reserva");
      return false;
    }
    return true;
  }

  function showReservationModal(r){
    if(!reservationSendGuard(r))return;
    const link=reservationLink(r.public_token);
    $("#modalType").textContent="RESERVA LISTA PARA FIRMA";
    $("#modalFolio").textContent=r.code;
    $("#modalText").textContent="Copia este enlace y envíaselo al cliente. El pago quedará bloqueado hasta que firme la reserva.";
    $("#modalLink").value=link;
    $("#openDocument").href=link;
    $("#documentModal").classList.add("open");
  }

  window.v2OpenReservation=id=>{
    const r=byId(state.reservations,id);
    if(!reservationSendGuard(r))return;
    window.open(reservationLink(r.public_token),"_blank","noopener");
  };

  window.v2CopyReservation=id=>{ 
    const r=byId(state.reservations,id);
    if(!reservationSendGuard(r))return;
    const link=reservationLink(r.public_token);
    navigator.clipboard?.writeText(link)
      .then(()=>toast("Enlace de reserva copiado"))
      .catch(()=>{
        const input=$("#modalLink");
        if(input){input.value=link;input.select();document.execCommand("copy");toast("Enlace de reserva copiado");}
      });
  };

  const reservationForm=$("#reservationForm");

  function readReservationPassengerForm(){
    return [...$("#reservationPassengersList").querySelectorAll(".reservation-passenger-row")].map(row=>({
      type:row.dataset.type==="minor"?"minor":"adult",
      name:row.querySelector('[name="passengerName"]').value.trim(),
      age:row.querySelector('[name="passengerAge"]').value===""?null:Number(row.querySelector('[name="passengerAge"]').value)
    }));
  }

  function passengerFormComplete(){
    const passengers=readReservationPassengerForm();
    const adults=Math.max(1,num(reservationForm.adults.value)||1);
    const minors=Math.max(0,num(reservationForm.minors.value));
    if(passengers.length!==adults+minors)return false;
    return passengers.every(p=>{
      if(p.name.length<3 || p.age===null)return false;
      return p.type==="minor" ? p.age>=0&&p.age<=12 : p.age>=13&&p.age<=120;
    });
  }

  function updatePassengerFormStatus(){
    const badge=$("#reservationPassengersStatus");
    if(!badge)return;
    const complete=passengerFormComplete();
    badge.textContent=complete?"Completo":"Pendiente";
    badge.classList.toggle("complete",complete);
  }

  function renderReservationPassengerRows(saved=[]){
    if(!reservationForm)return;
    const root=$("#reservationPassengersList");
    const adults=Math.max(1,num(reservationForm.adults.value)||1);
    const minors=Math.max(0,num(reservationForm.minors.value));
    reservationForm.travelerCount.value=adults+minors;

    const existing=normalizePassengerList(saved.length?saved:readReservationPassengerForm());
    const adultsSaved=existing.filter(p=>p.type==="adult");
    const minorsSaved=existing.filter(p=>p.type==="minor");
    const rows=[];

    for(let i=0;i<adults;i++){
      const p=adultsSaved[i]||{};
      rows.push(`
        <div class="reservation-passenger-row" data-type="adult">
          <div class="reservation-passenger-label"><span>ADULTO</span><strong>Pasajero ${i+1}</strong></div>
          <label class="field"><span>Nombre completo *</span><input name="passengerName" value="${esc(p.name||"")}" placeholder="Nombre como aparece en identificación"></label>
          <label class="field"><span>Edad *</span><input name="passengerAge" type="number" min="13" max="120" value="${p.age??""}" placeholder="Edad"></label>
        </div>`);
    }

    for(let i=0;i<minors;i++){
      const p=minorsSaved[i]||{};
      rows.push(`
        <div class="reservation-passenger-row minor" data-type="minor">
          <div class="reservation-passenger-label"><span>MENOR</span><strong>Menor ${i+1}</strong></div>
          <label class="field"><span>Nombre completo *</span><input name="passengerName" value="${esc(p.name||"")}" placeholder="Nombre completo"></label>
          <label class="field"><span>Edad *</span><input name="passengerAge" type="number" min="0" max="12" value="${p.age??""}" placeholder="0 a 12"></label>
        </div>`);
    }

    root.innerHTML=rows.join("");
    root.querySelectorAll("input").forEach(input=>input.addEventListener("input",updatePassengerFormStatus));
    updatePassengerFormStatus();
  }

  function resetReservation(){
    reservationForm?.reset();
    if(reservationForm){
      reservationForm.elements.id.value="";
      reservationForm.quoteId.value="";
      reservationForm.adults.value=1;
      reservationForm.minors.value=0;
      reservationForm.travelerCount.value=1;
      reservationForm.status.value="pending";
      renderReservationPassengerRows([]);
    }
    $("#reservationFormTitle").textContent="Nueva reserva";
  }

  $("#resetReservationForm")?.addEventListener("click",resetReservation);

  ["input","change"].forEach(evt=>{
    reservationForm?.adults.addEventListener(evt,()=>renderReservationPassengerRows());
    reservationForm?.minors.addEventListener(evt,()=>renderReservationPassengerRows());
  });

  $("#reservationClientSelect")?.addEventListener("change",e=>{
    const c=byId(state.clients,e.target.value);if(!c)return;
    const f=reservationForm;
    f.agency.value=c.agency;
    f.clientName.value=c.full_name;
    f.phone.value=c.phone||"";
    f.email.value=c.email||"N/A";
    f.adults.value=Math.max(1,num(c.adults)||1);
    f.minors.value=Math.max(0,num(c.minors));
    renderReservationPassengerRows([]);
  });

  renderReservationPassengerRows([]);
  reservationForm?.addEventListener("submit",async e=>{
    e.preventDefault();const f=reservationForm;
    const id=f.elements.id.value;
    const existing=id?byId(state.reservations,id):null;

    const passengers=readReservationPassengerForm();
    const adults=Math.max(1,num(f.adults.value)||1);
    const minors=Math.max(0,num(f.minors.value));
    f.travelerCount.value=adults+minors;

    const payload={
      agency:f.agency.value,
      client_id:f.clientId.value||null,
      quote_id:f.quoteId.value||null,
      client_name:f.clientName.value.trim(),
      phone:f.phone.value.trim(),
      email:f.email.value.trim(),
      destination:f.destination.value.trim(),
      start_date:f.startDate.value,
      end_date:f.endDate.value,
      traveler_count:adults+minors,
      total:num(f.total.value),
      status:existing?.status||"pending",
      requires_invoice:f.requiresInvoice.checked,
      notes:f.notes.value.trim(),
      payload:{
        ...(existing?.payload||{}),
        adults,
        minors,
        passengers
      },
      updated_at:new Date().toISOString()
    };

    let result;
    if(id){
      result=await db.from("reservations").update(payload).eq("id",id).select("*").single();
    }else{
      result=await db.from("reservations").insert(payload).select("*").single();
    }

    if(result.error){toast(result.error.message);return;}

    const saved=result.data;
    const complete=reservationPassengersComplete(saved);
    toast(
      complete
        ? (id?"Reserva actualizada · lista para enviar":"Reserva creada · lista para enviar al cliente")
        : (id?"Reserva guardada · faltan datos de pasajeros":"Reserva creada · completa los pasajeros antes de enviarla")
    );
    await loadOps({silent:true});
    if(complete){
      resetReservation();
      showReservationModal(saved);
    }else{
      if(saved?.id)window.v2EditReservation(saved.id);
    }
  });
  $("#searchReservations")?.addEventListener("input",renderReservations);
  function renderReservations(){
    const root=$("#reservationsList");if(!root)return;const q=$("#searchReservations").value.trim().toLowerCase();
    const rows=state.reservations.filter(r=>[r.code,r.client_name,r.destination,r.agency].join(" ").toLowerCase().includes(q));
    root.innerHTML=rows.map(r=>{
      const paid=paidFor(r.id),bal=balanceFor(r),st=effectiveStatus(r);
      const signed=Boolean(r.signed_at);
      const passengerReady=reservationPassengersComplete(r);
      const canPay=signed && st!=="cancelled" && bal>0;
      const canConfirm=signed && st!=="cancelled" && bal<=0;
      const signatureLine=signed
        ? `<p class="reservation-signature-proof">✓ Firmada por ${esc(r.signer_name||r.client_name)} · ${shortDateTime(r.signed_at)}</p>`
        : `<p class="reservation-signature-pending">Falta firma del cliente para habilitar cobros.</p>`;
      const passengerLine=passengerReady
        ? `<p class="reservation-passengers-ready">✓ Datos de pasajeros completos.</p>`
        : `<p class="reservation-passengers-missing">⚠ Completa nombre y edad de todos los pasajeros antes de enviar.</p>`;

      return `<article class="ops-card reservation-card">
        <div>
          <div class="ops-card-meta">
            <span class="ops-chip ${agencyClass(r.agency)}">${esc(r.agency)}</span>
            <span class="ops-chip ${statusClass(st)}">${statusLabel(st)}</span>
            ${r.requires_invoice?'<span class="ops-chip warn">Factura</span>':''}
            ${r.quote_id?'<span class="ops-chip">Desde cotización</span>':''}
          </div>
          <h3>${esc(r.code)} · ${esc(r.client_name)}</h3>
          <p>${esc(r.destination)} · ${formatDate(r.start_date)} → ${formatDate(r.end_date)}</p>
          <p>Creada por ${esc(creatorName(r))}</p>
          ${passengerLine}
          ${signatureLine}
          <div class="reservation-finance">
            <div><small>Total</small><strong>${money(r.total)}</strong></div>
            <div><small>Pagado</small><strong>${money(paid)}</strong></div>
            <div><small>Saldo</small><strong>${money(bal)}</strong></div>
          </div>
        </div>
        <div class="ops-card-actions reservation-actions">
          <button class="ghost-btn compact-btn" onclick="v2CopyReservation('${r.id}')" ${passengerReady?"":'disabled title="Completa nombre y edad de todos los pasajeros"'}>Copiar reserva</button>
          <button class="ghost-btn compact-btn" onclick="v2OpenReservation('${r.id}')" ${passengerReady?"":'disabled title="Completa nombre y edad de todos los pasajeros"'}>Abrir reserva</button>
          <button class="ghost-btn compact-btn" onclick="v2RegisterPayment('${r.id}')" ${canPay?"":'disabled title="El cliente debe firmar la reserva antes de registrar pagos"'}>Registrar pago</button>
          <button class="ghost-btn compact-btn" onclick="v2Confirmation('${r.id}')" ${r.voucher_id||canConfirm?"":'disabled title="La confirmación final se genera después de la firma y liquidación"'}>${r.voucher_id?'Abrir confirmación':'Generar confirmación'}</button>
          <button class="ghost-btn compact-btn" onclick="v2EditReservation('${r.id}')">Editar</button>
          <button class="icon-btn danger-btn" onclick="v2DeleteReservation('${r.id}')">⌫</button>
        </div>
      </article>`;
    }).join("");
    $("#reservationsEmpty").hidden=rows.length>0;
  }
  window.v2EditReservation=id=>{
    const r=byId(state.reservations,id);if(!r)return;
    switchView("reservations");
    const f=reservationForm;
    const counts=reservationPassengerCounts(r);
    f.elements.id.value=r.id;
    f.quoteId.value=r.quote_id||"";
    f.agency.value=r.agency;
    f.clientId.value=r.client_id||"";
    f.clientName.value=r.client_name;
    f.phone.value=r.phone||"";
    f.email.value=r.email||"";
    f.destination.value=r.destination;
    f.startDate.value=r.start_date;
    f.endDate.value=r.end_date;
    f.adults.value=counts.adults;
    f.minors.value=counts.minors;
    f.travelerCount.value=counts.total;
    f.total.value=r.total;
    f.status.value=r.status;
    f.requiresInvoice.checked=!!r.requires_invoice;
    f.notes.value=r.notes||"";
    renderReservationPassengerRows(r.payload?.passengers||[]);
    $("#reservationFormTitle").textContent=`Editar ${r.code}`;
    window.scrollTo({top:0,behavior:"smooth"});
  };
  window.v2DeleteReservation=async id=>{const r=byId(state.reservations,id);if(!r||!confirm(`¿Eliminar la reserva ${r.code}? Los pagos ligados también se eliminarán.`))return;const {error}=await db.from("reservations").delete().eq("id",id);if(error){toast(error.message);return;}toast("Reserva eliminada");await loadOps({silent:true});};
  window.v2RegisterPayment=id=>{
    const r=byId(state.reservations,id);
    if(!r)return;
    if(!r.signed_at){toast("Primero el cliente debe firmar la reserva");return;}
    if(r.status==="cancelled"){toast("La reserva está cancelada");return;}
    switchView("payments");
    $("#paymentReservationSelect").value=id;
    $("#paymentForm").amount.focus();
  };
  window.v2Confirmation=async id=>{
    const r=byId(state.reservations,id);
    if(!r)return;
    if(r.voucher_id){
      const {data,error}=await db.from("vouchers").select("public_token").eq("id",r.voucher_id).single();
      if(error){toast("No se pudo abrir la confirmación");return;}
      window.open(voucherLink(data.public_token),"_blank","noopener");
      return;
    }
    if(!r.signed_at){toast("La reserva todavía no ha sido firmada por el cliente");return;}
    if(balanceFor(r)>0){toast(`La reserva aún tiene saldo pendiente de ${money(balanceFor(r))}`);return;}

    switchView("newVoucher");
    const f=voucherForm;
    f.sourceReservationId.value=r.id;
    f.sourceReservationCode.value=r.code;
    f.agency.value=r.agency;
    const passengerList=normalizePassengerList(r.payload?.passengers);
    f.passenger.value=passengerList[0]?.name||r.client_name;
    f.passengerCount.value=r.traveler_count||1;
    f.phone.value=r.phone||"";
    f.email.value=r.email||"N/A";
    f.destination.value=r.destination;
    f.startDate.value=r.start_date;
    constrainSameMonth(f);
    f.endDate.value=r.end_date;
    f.generalLocator.value=r.code;

    const qp=r.payload||{};
    f.tripType.value=qp.tripType||"Vacaciones";
    f.notes.value=r.notes||qp.notes||"";
    f.advisor.value=qp.advisor||"Velora Travel";
    f.advisorWhatsapp.value=qp.advisorWhatsapp||"55 1900 0905";
    f.advisorEmail.value=qp.advisorEmail||"hola@veloratravel.com";
    updateDuration(f);
    updateVoucherComputed();
    toast("Reserva firmada y liquidada cargada en confirmación final");
  };

  // Override legacy quote -> voucher flow: now quote -> reservation.
  window.convertQuoteToVoucher=async id=>{
    const q=quoteCache.find(x=>x.id===id);
    if(!q){toast("No se encontró la cotización");return;}
    if(q.convertedReservationId){toast("Esta cotización ya tiene reserva");switchView("reservations");return;}
    if(!(q.acceptedAt||q.status==="accepted")){
      toast("El cliente debe aceptar la cotización antes de crear la reserva");
      return;
    }

    const publicServices=(q.items||[]).map(item=>({
      category:item.category||"Servicio",
      concept:item.concept||"",
      description:item.description||"",
      hotelImage:item.hotelImage||""
    }));

    const payload={
      agency:agencyOf(q.agency),
      client_id:q.clientRecordId||null,
      quote_id:q.id,
      client_name:q.client,
      phone:q.phone||"",
      email:q.email||"",
      destination:q.destination,
      start_date:q.startDate,
      end_date:q.endDate,
      traveler_count:Math.max(1,num(q.adults ?? q.travelerCount)||1)+Math.max(0,num(q.minors)),
      total:num(q.total),
      status:"pending",
      requires_invoice:false,
      notes:q.notes||"",
      payload:{
        tripType:q.tripType||"",
        adults:Math.max(1,num(q.adults ?? q.travelerCount)||1),
        minors:Math.max(0,num(q.minors)),
        passengers:[],
        advisor:q.advisor||"",
        advisorWhatsapp:q.advisorWhatsapp||"",
        advisorEmail:q.advisorEmail||"",
        quoteFolio:q.folio,
        quoteAcceptedAt:q.acceptedAt||null,
        services:publicServices,
        msiEnabled:Boolean(q.msiEnabled),
        paymentMethods:q.paymentMethods||"",
        includes:q.includes||"",
        excludes:q.excludes||""
      }
    };

    const {data:res,error}=await db.from("reservations").insert(payload).select("*").single();
    if(error){toast(error.message);return;}

    const {error:updateError}=await db.from("quotes")
      .update({status:"converted",converted_reservation_id:res.id})
      .eq("id",q.id);
    if(updateError)console.error(updateError);

    toast("Reserva creada · captura los datos de pasajeros antes de enviarla");
    await Promise.all([loadSharedData({silent:true}),loadOps({silent:true})]);
    switchView("reservations");
    if(res) setTimeout(()=>window.v2EditReservation(res.id),120);
  };

  const paymentForm=$("#paymentForm");if(paymentForm)paymentForm.paidAt.value=today();
  paymentForm?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=paymentForm,r=byId(state.reservations,f.reservationId.value);
    if(!r)return;
    if(!r.signed_at){toast("No se puede cobrar: la reserva aún no está firmada");return;}
    if(r.status==="cancelled"){toast("No se puede cobrar una reserva cancelada");return;}

    const amount=num(f.amount.value);
    if(amount<=0)return;

    const {error}=await db.from("payments").insert({
      reservation_id:r.id,
      amount,
      method:f.method.value,
      paid_at:f.paidAt.value,
      reference:f.reference.value.trim(),
      notes:f.notes.value.trim()
    });

    if(error){toast(error.message);return;}

    const newPaid=paidFor(r.id)+amount;
    const nextStatus=num(r.total)>0&&newPaid>=num(r.total)?"liquidated":"confirmed";
    await db.from("reservations")
      .update({status:nextStatus,updated_at:new Date().toISOString()})
      .eq("id",r.id);

    toast(nextStatus==="liquidated"?"Pago registrado · Reserva liquidada":"Pago registrado");
    f.reset();
    f.paidAt.value=today();
    await loadOps({silent:true});
  });
  $("#searchPayments")?.addEventListener("input",renderPayments);
  function renderPayments(){const body=$("#paymentsTable");if(!body)return;const q=$("#searchPayments").value.trim().toLowerCase();const rows=state.payments.filter(p=>{const r=byId(state.reservations,p.reservation_id);return [r?.code,r?.client_name,p.reference,p.method].join(" ").toLowerCase().includes(q)});body.innerHTML=rows.map(p=>{const r=byId(state.reservations,p.reservation_id);return `<tr><td>${formatDate(p.paid_at)}</td><td><strong>${esc(r?.code||"—")}</strong></td><td>${esc(r?.client_name||"—")}</td><td>${esc(p.method||"—")}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(creatorName(p))}</td><td><button class="icon-btn danger-btn" onclick="v2DeletePayment('${p.id}')">⌫</button></td></tr>`}).join("");$("#paymentsEmpty").hidden=rows.length>0;}
  window.v2DeletePayment=async id=>{const p=byId(state.payments,id);if(!p||!confirm("¿Eliminar este pago? El saldo de la reserva se recalculará."))return;const {error}=await db.from("payments").delete().eq("id",id);if(error){toast(error.message);return;}const r=byId(state.reservations,p.reservation_id);const remaining=paymentsFor(r.id).filter(x=>x.id!==id).reduce((s,x)=>s+num(x.amount),0);const status=num(r.total)>0&&remaining>=num(r.total)?"liquidated":(r.signed_at?"confirmed":"pending");await db.from("reservations").update({status,updated_at:new Date().toISOString()}).eq("id",r.id);toast("Pago eliminado");await loadOps({silent:true});};

  const eventForm=$("#eventForm");
  if(eventForm) eventForm.eventDate.value=today();

  function selectedDateLabel(iso){
    if(!iso)return"";
    return new Intl.DateTimeFormat("es-MX",{
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric"
    }).format(new Date(iso+"T12:00:00"));
  }

  function calendarEntriesForDate(iso){
    const reservations=state.reservations
      .filter(r=>r.start_date===iso && r.status!=="cancelled")
      .sort((a,b)=>String(a.client_name||"").localeCompare(String(b.client_name||"")));

    const events=state.events
      .filter(e=>e.event_date===iso)
      .sort((a,b)=>String(a.event_time||"").localeCompare(String(b.event_time||"")));

    return {reservations,events};
  }

  function closeCalendarDayModal(){
    $("#calendarDayModal")?.classList.remove("open");
  }

  function openCalendarDay(iso){
    if(!iso)return;
    state.selectedCalendarDate=iso;

    const modal=$("#calendarDayModal");
    const {reservations,events}=calendarEntriesForDate(iso);
    const total=reservations.length+events.length;

    $("#calendarDayModalTitle").textContent=selectedDateLabel(iso);
    $("#calendarDayExistingCount").textContent=String(total);

    const rows=[
      ...reservations.map(r=>`
        <div class="calendar-day-existing-item reservation">
          <span>✈</span>
          <div>
            <strong>${esc(r.client_name)}</strong>
            <small>Reserva · ${esc(r.destination)} · ${esc(r.agency)}</small>
          </div>
        </div>`),
      ...events.map(e=>`
        <div class="calendar-day-existing-item event">
          <span>□</span>
          <div>
            <strong>${esc(e.title)}</strong>
            <small>${esc(e.event_time||"Sin hora")} · ${esc(e.event_type||"Evento")} · ${esc(e.agency)}</small>
          </div>
        </div>`)
    ];

    $("#calendarDayExistingList").innerHTML=rows.join("");
    $("#calendarDayExistingEmpty").hidden=total>0;

    modal?.classList.add("open");
    renderCalendar();
  }

  function prepareQuoteFromCalendar(iso){
    closeCalendarDayModal();
    switchView("newQuote");

    if(typeof quoteForm!=="undefined" && quoteForm){
      quoteForm.startDate.value=iso;
      quoteForm.startDate.dispatchEvent(new Event("change",{bubbles:true}));
      setTimeout(()=>quoteForm.client?.focus(),80);
    }

    toast(`Cotización iniciada para ${formatDate(iso)}`);
  }

  function prepareReservationFromCalendar(iso){
    closeCalendarDayModal();
    resetReservation();
    switchView("reservations");

    if(reservationForm){
      reservationForm.startDate.value=iso;
      reservationForm.endDate.min=iso;
      if(reservationForm.endDate.value && reservationForm.endDate.value<iso){
        reservationForm.endDate.value="";
      }
      setTimeout(()=>reservationForm.clientName?.focus(),80);
    }

    toast(`Reserva iniciada para ${formatDate(iso)}`);
  }

  function prepareEventFromCalendar(iso){
    closeCalendarDayModal();
    switchView("calendar");

    if(eventForm){
      eventForm.eventDate.value=iso;
      eventForm.scrollIntoView({behavior:"smooth",block:"start"});
      eventForm.classList.add("calendar-form-highlight");
      setTimeout(()=>{
        eventForm.classList.remove("calendar-form-highlight");
        eventForm.title?.focus();
      },450);
    }

    toast(`Evento para ${formatDate(iso)}`);
  }

  eventForm?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=eventForm;

    const {error}=await db.from("events").insert({
      agency:f.agency.value,
      title:f.title.value.trim(),
      event_date:f.eventDate.value,
      event_time:f.eventTime.value||null,
      event_type:f.eventType.value,
      client_name:f.clientName.value.trim(),
      notes:f.notes.value.trim()
    });

    if(error){
      toast(error.message);
      return;
    }

    const savedDate=f.eventDate.value;
    toast("Evento guardado");

    f.reset();
    f.eventDate.value=savedDate||today();

    if(savedDate){
      const [y,m]=savedDate.split("-").map(Number);
      state.calendarCursor=new Date(y,m-1,1);
      state.selectedCalendarDate=savedDate;
    }

    await loadOps({silent:true});
  });

  $("#calendarPrev")?.addEventListener("click",()=>{
    state.calendarCursor=new Date(
      state.calendarCursor.getFullYear(),
      state.calendarCursor.getMonth()-1,
      1
    );
    renderCalendar();
  });

  $("#calendarNext")?.addEventListener("click",()=>{
    state.calendarCursor=new Date(
      state.calendarCursor.getFullYear(),
      state.calendarCursor.getMonth()+1,
      1
    );
    renderCalendar();
  });

  $("#calendarToday")?.addEventListener("click",()=>{
    const d=new Date();
    state.calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
    state.selectedCalendarDate=today();
    renderCalendar();
  });

  $("#calendarGrid")?.addEventListener("click",e=>{
    const day=e.target.closest(".calendar-day");
    if(!day)return;
    openCalendarDay(day.dataset.date);
  });

  $("#calendarDayModalClose")?.addEventListener("click",closeCalendarDayModal);
  $("#calendarDayModal")?.addEventListener("click",e=>{
    if(e.target.id==="calendarDayModal")closeCalendarDayModal();
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape")closeCalendarDayModal();
  });

  $$("[data-calendar-action]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const iso=state.selectedCalendarDate;
      if(!iso)return;

      const action=btn.dataset.calendarAction;
      if(action==="quote")prepareQuoteFromCalendar(iso);
      if(action==="reservation")prepareReservationFromCalendar(iso);
      if(action==="event")prepareEventFromCalendar(iso);
    });
  });

  function renderCalendar(){
    const grid=$("#calendarGrid");
    if(!grid)return;

    const y=state.calendarCursor.getFullYear();
    const m=state.calendarCursor.getMonth();

    $("#calendarTitle").textContent=new Intl.DateTimeFormat("es-MX",{
      month:"long",
      year:"numeric"
    }).format(state.calendarCursor);

    const first=new Date(y,m,1);
    const last=new Date(y,m+1,0);
    const mondayIndex=(first.getDay()+6)%7;
    const cells=[];

    for(let i=0;i<mondayIndex;i++){
      const d=new Date(y,m,-mondayIndex+i+1);
      cells.push({d,out:true});
    }

    for(let day=1;day<=last.getDate();day++){
      cells.push({d:new Date(y,m,day),out:false});
    }

    while(cells.length%7){
      cells.push({
        d:new Date(y,m+1,cells.length-mondayIndex-last.getDate()+1),
        out:true
      });
    }

    grid.innerHTML=cells.map(c=>{
      const iso=isoDate(c.d);
      const res=state.reservations.filter(r=>r.start_date===iso&&r.status!=="cancelled");
      const events=state.events.filter(e=>e.event_date===iso);
      const count=res.length+events.length;
      const selected=state.selectedCalendarDate===iso;

      return `<button type="button"
        class="calendar-day ${c.out?'outside':''} ${iso===today()?'today':''} ${selected?'selected':''}"
        data-date="${iso}"
        aria-label="${esc(selectedDateLabel(iso))}. ${count} elementos.">
          <div class="calendar-day-top">
            <span class="calendar-day-number">${c.d.getDate()}</span>
            ${count?`<span class="calendar-day-count">${count}</span>`:""}
          </div>

          ${res.slice(0,2).map(r=>`
            <span class="calendar-entry" title="${esc(r.client_name)}">
              ✈ ${esc(r.destination)}
            </span>`).join("")}

          ${events.slice(0,3).map(e=>`
            <span class="calendar-entry event" title="${esc(e.title)}">
              ${esc(e.event_time||'')} ${esc(e.title)}
            </span>`).join("")}

          ${count>5?`<span class="calendar-more">+${count-5} más</span>`:""}
          <span class="calendar-day-hover-action">＋ Agregar</span>
        </button>`;
    }).join("");

    const monthPrefix=`${y}-${String(m+1).padStart(2,'0')}`;
    const monthEvents=state.events.filter(e=>e.event_date?.startsWith(monthPrefix));

    $("#eventList").innerHTML=monthEvents.slice(0,12).map(e=>`
      <div class="event-item">
        <div class="event-item-actions">
          <button onclick="v2DeleteEvent('${e.id}')" title="Eliminar evento">×</button>
        </div>
        <strong>${esc(e.title)}</strong>
        <span>${formatDate(e.event_date)} ${esc(e.event_time||'')} · ${esc(e.agency)}</span>
      </div>`).join("");
  }

  window.v2DeleteEvent=async id=>{
    if(!confirm("¿Eliminar este evento?"))return;
    const {error}=await db.from("events").delete().eq("id",id);
    if(error){
      toast(error.message);
      return;
    }
    await loadOps({silent:true});
  };

  function renderDashboard(){const active=state.reservations.filter(r=>!["cancelled","liquidated"].includes(effectiveStatus(r)));const balance=state.reservations.filter(r=>r.status!=="cancelled").reduce((s,r)=>s+balanceFor(r),0);const t=new Date(),future=new Date(t.getTime()+30*86400000);const upcoming=state.reservations.filter(r=>{const d=new Date(r.start_date+"T12:00:00");return r.status!=="cancelled"&&d>=new Date(t.toDateString())&&d<=future}).sort((a,b)=>a.start_date.localeCompare(b.start_date));$("#opsStatClients").textContent=state.clients.filter(c=>c.status!=="inactive").length;$("#opsStatReservations").textContent=active.length;$("#opsStatBalance").textContent=money(balance);$("#opsStatUpcoming").textContent=upcoming.length;$("#opsUpcomingReservations").innerHTML=upcoming.slice(0,5).map(r=>`<div class="ops-compact-row"><div><strong>${esc(r.client_name)}</strong><span>${esc(r.destination)}</span></div><div><strong>${formatDate(r.start_date)}</strong><small>${esc(r.agency)}</small></div></div>`).join("");$("#opsUpcomingEmpty").hidden=upcoming.length>0;const events=state.events.filter(e=>e.event_date>=today()).sort((a,b)=>(a.event_date+a.event_time).localeCompare(b.event_date+b.event_time));$("#opsUpcomingEvents").innerHTML=events.slice(0,5).map(e=>`<div class="ops-compact-row"><div><strong>${esc(e.title)}</strong><span>${esc(e.client_name||e.event_type)}</span></div><div><strong>${formatDate(e.event_date)}</strong><small>${esc(e.event_time||e.agency)}</small></div></div>`).join("");$("#opsEventsEmpty").hidden=events.length>0;}

  const reportMonth=$("#reportMonth");if(reportMonth)reportMonth.value=today().slice(0,7);reportMonth?.addEventListener("change",renderReports);
  function monthBounds(ym){const [y,m]=ym.split('-').map(Number);const start=new Date(y,m-1,1),end=new Date(y,m,1);const prevStart=new Date(y,m-2,1),prevEnd=start;return {start,end,prevStart,prevEnd};}
  const inRange=(v,a,b)=>{if(!v)return false;const d=new Date(v);return d>=a&&d<b};
  const compareText=(cur,prev,isMoney=false)=>{if(prev===0)return cur===0?"Sin cambio":"Nuevo este mes";const pct=((cur-prev)/prev)*100;return `${pct>=0?'+':''}${pct.toFixed(0)}% vs mes anterior`;};
  function monthMetrics(start,end,agency=null){const quotes=(typeof quoteCache!=="undefined"?quoteCache:[]).filter(q=>inRange(q.createdAt,start,end)&&(!agency||agencyOf(q.agency)===agency));const accepted=quotes.filter(q=>q.acceptedAt||q.status==="accepted"||q.status==="converted");const reservations=state.reservations.filter(r=>inRange(r.created_at,start,end)&&(!agency||r.agency===agency));const reservationIds=new Set(reservations.map(r=>r.id));const payments=state.payments.filter(p=>reservationIds.has(p.reservation_id));const sales=reservations.filter(r=>r.status!=="cancelled").reduce((s,r)=>s+num(r.total),0);const collected=payments.reduce((s,p)=>s+num(p.amount),0);const pending=reservations.filter(r=>r.status!=="cancelled").reduce((s,r)=>s+balanceFor(r),0);return {quotes:quotes.length,accepted:accepted.length,reservations:reservations.length,sales,collected,pending};}
  function renderReports(){if(!reportMonth)return;const {start,end,prevStart,prevEnd}=monthBounds(reportMonth.value);const cur=monthMetrics(start,end),prev=monthMetrics(prevStart,prevEnd);$("#reportQuotes").textContent=cur.quotes;$("#reportQuotesCompare").textContent=compareText(cur.quotes,prev.quotes);$("#reportAccepted").textContent=cur.accepted;$("#reportAcceptedCompare").textContent=compareText(cur.accepted,prev.accepted);$("#reportReservations").textContent=cur.reservations;$("#reportReservationsCompare").textContent=compareText(cur.reservations,prev.reservations);$("#reportSales").textContent=money(cur.sales);$("#reportSalesCompare").textContent=compareText(cur.sales,prev.sales,true);$("#reportCollected").textContent=money(cur.collected);$("#reportCollectedCompare").textContent=compareText(cur.collected,prev.collected,true);$("#reportPending").textContent=money(cur.pending);for(const [id,agency] of [["#reportVelora","Velora Travel"],["#reportPink","Pink Sky Travel"]]){const m=monthMetrics(start,end,agency);$(id).innerHTML=`<div class="agency-report-row"><span>Cotizaciones</span><strong>${m.quotes}</strong></div><div class="agency-report-row"><span>Reservas</span><strong>${m.reservations}</strong></div><div class="agency-report-row"><span>Venta</span><strong>${money(m.sales)}</strong></div><div class="agency-report-row"><span>Cobrado</span><strong>${money(m.collected)}</strong></div><div class="agency-report-row"><span>Pendiente</span><strong>${money(m.pending)}</strong></div>`;}}

  document.addEventListener("click",e=>{const go=e.target.closest('[data-go]');if(go&&["clients","reservations","payments","calendar","reports"].includes(go.dataset.go))setTimeout(()=>renderAll(),0);});
  async function boot(){if(typeof db==="undefined")return;const {data}=await db.auth.getSession();if(data.session)await loadOps();db.auth.onAuthStateChange((_event,session)=>{if(session)setTimeout(()=>loadOps({silent:true}),50);else{state.clients=[];state.reservations=[];state.payments=[];state.events=[];renderAll();}});}
  window.addEventListener("focus",()=>{if(document.body.classList.contains("auth-ready"))loadOps({silent:true});});
  window.addEventListener("velora:user-profile-updated",()=>loadOps({silent:true}));
  setInterval(()=>{if(document.body.classList.contains("auth-ready")&&!document.hidden)loadOps({silent:true});},10000);
  boot();
})();
