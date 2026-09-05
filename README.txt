VELORA PASS · V1.7 · by Nuve Works

ESTADO
Demo funcional en localStorage. Aún NO está conectada a Supabase.

NOVEDADES V1.7
1. Módulo de cotizaciones:
   - Nueva cotización
   - Historial
   - Conceptos dinámicos y suma automática
   - Documento público quote.html
   - Copiar enlace / abrir / imprimir o guardar PDF
   - Convertir datos básicos de una cotización a un nuevo voucher

2. Voucher ampliado:
   - Confirmación de viaje
   - Boletaje de avión construido en HTML/CSS (NO es una imagen)
   - Vuelo de ida y regreso con:
     aerolínea, número de vuelo, localizador, fecha,
     aeropuerto/código/ciudad, horas y terminales
   - Equipaje de mano y documentado
   - Localizadores de traslados
   - Hospedaje y pagos
   - Servicios incluidos

3. Políticas:
   - Se integraron completas las 21 secciones del documento
     Velora_Travel_Politicas_y_Condiciones.docx.
   - Se muestran antes de la firma.
   - La casilla de aceptación y firma indican expresamente la
     lectura y aceptación de las políticas.

4. Firma:
   - Firma digital con mouse o dedo
   - Nombre del firmante
   - Fecha y hora
   - Estado Pendiente / Firmado

SIGUIENTE PASO
Conectar Supabase para que:
- cotizaciones y vouchers existan entre dispositivos,
- los enlaces funcionen desde el teléfono del cliente,
- vistos/firmas/estados aparezcan en tiempo real,
- códigos tengan UNIQUE a nivel de base de datos,
- la información sobreviva a despliegues y cambios de navegador.

V1.8 · LOGIN CON SUPABASE
- Pantalla privada de acceso al panel.
- Inicio de sesión con Supabase Auth (correo + contraseña).
- Sesión persistente: si el navegador conserva la sesión, no pide login cada vez.
- Botón Cerrar sesión.
- Muestra el correo del usuario autenticado.
- El panel permanece oculto mientras Supabase comprueba la sesión.

IMPORTANTE
- Esta V1.8 NO incluye supabase-client.js para no sobrescribir las credenciales reales que ya configuraste.
- Conserva tu supabase-client.js actual.
- El ZIP trae supabase-client.example.js solo como referencia.
- Vouchers y cotizaciones todavía usan localStorage. El siguiente paso es migrarlos a las tablas Supabase ya creadas.


V1.9
- Vouchers y cotizaciones migrados de localStorage a Supabase.
- Todos los usuarios autenticados ven los mismos registros.
- Actualización automática del panel cada pocos segundos y al volver a la ventana.
- Links públicos ahora usan public_token y funcionan en otros dispositivos.
- voucher.html y quote.html cargan Supabase para lectura pública por token.
- Eliminación de vouchers y cotizaciones desde el panel.
- Se eliminó Inversión y pagos del voucher: el voucher se entrega una vez liquidado.
- Corregido encimado del panel lateral en el formulario de vuelos.

IMPORTANTE
Conserva tu supabase-client.js real en la carpeta del proyecto. Esta entrega no lo incluye.


V1.9.1 FIX
- Se eliminó el bloqueo global de interacción durante los refrescos de Supabase.
- Los refrescos automáticos continúan, pero ya no deshabilitan botones ni formularios.
- "Llenar ejemplo" de voucher y cotización tiene protección de error para evitar fallos silenciosos.
- No se modificó el diseño, Supabase, login, vouchers, cotizaciones ni enlaces.


V1.9.2 · AUTOR DE REGISTROS
- Inicio muestra quién creó cada voucher y cada cotización.
- El dato se obtiene del usuario autenticado de Supabase.
- La auditoría se guarda en una tabla privada separada; NO se envía al cliente en el voucher/cotización pública.
- Ejecutar SUPABASE_V1.9.2_AUDITORIA.sql una vez en Supabase > SQL Editor.
- Registros anteriores a esta versión aparecen como "Sin registro", porque no existe información fiable para atribuirlos retroactivamente.


V1.9.3 · CORREO CON N/A
- El correo del cliente acepta un email válido o el valor literal N/A.
- Aplica tanto en Voucher como en Cotización.
- Tours / Experiencias conserva el indicador visual atenuado cuando no está marcado como incluido.
- No se modificaron otras funciones.


V1.9.4 · EDITAR USUARIO
- Sesión activa muestra nombre + correo.
- Nuevo botón Editar usuario.
- Cada usuario puede cambiar su propio nombre para mostrar.
- El correo de acceso no cambia.
- Creado por usa el nombre editable.
- Ejecutar SUPABASE_V1.9.4_PERFILES.sql una vez en Supabase.
- La migración no borra registros.


V1.9.5 · COTIZACIÓN SIN DESGLOSE + MSI
- El agente sigue capturando conceptos y costos internos.
- La cotización pública ya NO muestra importes por concepto.
- El cliente ve únicamente el COSTO TOTAL FINAL.
- Se eliminó el anticipo del documento público para no mostrar otro importe.
- Nuevo campo opcional: Extra por meses sin intereses.
- Si MSI queda vacío, la cotización se guarda normalmente y se suma $0.
- Si el agente captura un monto MSI, se suma al total final.
- El monto MSI NO se muestra separado al cliente.
- Supabase usa get_public_quote_by_token() para no exponer los importes internos ni siquiera en la respuesta de red.
- Ejecutar SUPABASE_V1.9.5_COTIZACION_PUBLICA.sql una vez en Supabase.


V1.9.6 · COTIZACIÓN PÚBLICA
- Cada concepto con categoría Hospedaje permite adjuntar una imagen del hotel.
- La imagen se comprime automáticamente antes de guardar la cotización.
- No existe galería de imágenes: la copia comprimida queda únicamente ligada a esa cotización para que el enlace público pueda mostrarla.
- Nuevo switch para activar/desactivar Meses sin intereses.
- MSI desactivado:
  - el cargo extra MSI vale 0;
  - se muestran Fecha límite de liquidación y Formas de pago;
  - Formas de pago es obligatorio para generar la cotización.
- MSI activado:
  - aparece el campo opcional de monto extra MSI;
  - se ocultan y deshabilitan Fecha límite y Formas de pago;
  - la cotización pública NO muestra fecha límite;
  - la cotización pública muestra una leyenda de Meses sin intereses.
- El cliente sigue viendo solamente el costo total final. Nunca recibe importes individuales ni el cargo MSI desglosado.
- Ejecutar SUPABASE_V1.9.6_COTIZACION_FOTO_MSI.sql una vez en Supabase.


V1.9.7 · FLUJO COMPARTIDO DE COTIZACIONES
- Corregido: Abrir y Copiar enlace ahora usan el ID interno correcto y funcionan con cotizaciones creadas por cualquier usuario.
- El historial muestra siempre "Creado por".
- Nuevo estado visual:
  - Enviada
  - Vista por cliente
  - Aceptada
  - Reserva creada
- La cotización pública tiene botón "Aceptar cotización".
- La aceptación se guarda en Supabase con fecha/hora.
- Cualquier usuario autenticado puede mover una cotización compartida a Reserva.
- El botón ahora dice "→ Reserva".
- Al generar el voucher desde una cotización, la cotización queda marcada como "Reserva creada" y enlazada mediante converted_voucher_id.
- No se modificó la política de costos públicos: el cliente sigue viendo solo el total final.
- Ejecutar SUPABASE_V1.9.7_ACEPTACION_RESERVA.sql una vez.


============================================================
VELORA APP V2.0 · OPERACIÓN INTERNA TIPO AuRA
============================================================
- El panel administrativo pasa a llamarse Velora App.
- Sin membresías, planes ni panel de cobro del software.
- Módulos internos: Clientes, Cotizaciones, Reservas, Pagos de clientes, Calendario, Reportes y Confirmaciones.
- Clientes: alta, edición, baja, adultos/menores, notas y envío directo a cotización.
- Cotizaciones: conserva todo V1.9.7 y añade agencia/cliente guardado.
- Cotización aceptada -> Reserva (ya no genera voucher directamente).
- Reservas: creación manual o desde cotización, estatus, total, saldo, factura, creador y seguimiento.
- Pagos: abonos por reserva; al cubrir el total la reserva queda Liquidada.
- Confirmación/Voucher: solo puede generarse desde una reserva sin saldo pendiente; queda vinculada a la reserva.
- Calendario: salidas de reservas + citas/seguimientos/eventos manuales.
- Reportes: cotizaciones, aceptadas, reservas, venta, cobrado, pendiente, comparativo contra mes anterior y desglose por agencia.
- Agencias incluidas: Velora Travel y Pink Sky Travel.
- Todos los usuarios autenticados autorizados comparten la operación.
- Ejecutar SUPABASE_V2.0_OPERACION_INTERNA.sql una sola vez en Supabase.
- Conservar el supabase-client.js real al sustituir archivos.


V2.0.1 · HOTFIX DE FECHAS
- Eliminado el límite que obligaba a que salida y regreso fueran en el mismo mes.
- Ahora se permiten viajes que crucen de mes y de año.
- La única restricción es que la fecha de regreso no sea anterior a la fecha de salida.
- Aplica a cotizaciones y confirmaciones.
- No requiere cambios en Supabase ni ejecutar SQL.


V2.0.2 · FECHAS DE VUELO INTELIGENTES
- Mantiene el hotfix de fechas V2.0.1: salida y regreso pueden cruzar de mes o de año.
- Al capturar Fecha de salida, Vuelo de ida toma esa misma fecha por default.
- Al capturar Fecha de regreso, Vuelo de regreso toma esa misma fecha por default.
- Si el agente cambia manualmente una fecha de vuelo, queda independiente y ya no se sobrescribe automáticamente.
- Al convertir una cotización a Reserva/Confirmación, las fechas de vuelo se precargan con salida y regreso.
- Las fechas de vuelo permanecen totalmente editables.
- No requiere cambios en Supabase ni ejecutar SQL.


V2.0.3 · HOTFIX VALIDACIÓN DE CORREO
- Corregida la expresión regular del correo electrónico.
- Ahora acepta correctamente correos válidos como usuario@gmail.com.
- Sigue aceptando N/A.
- Sigue rechazando formatos inválidos.
- No requiere SQL ni cambios en Supabase.


V2.1 · FIRMA DE RESERVA ANTES DE COBRO
======================================

Nuevo flujo obligatorio:
1. El agente envía cotización.
2. El cliente acepta la cotización.
3. Solo entonces puede convertirse en Reserva.
4. La Reserva se crea en estado "Pendiente de firma".
5. Velora App genera un enlace público de la Reserva.
6. El cliente revisa y firma la Reserva.
7. La firma cambia el estado a "Firmada" y habilita Registrar pago.
8. Los pagos permanecen bloqueados antes de la firma, incluso a nivel Supabase.
9. Una vez liquidada, se habilita Generar confirmación final.

Cambios visuales:
- Corregido el formulario de Reservas para que fechas, inputs y selects no se encimen.
- Se amplió la columna de captura y se agregaron límites responsive.
- El estatus ya no se cambia manualmente: lo controla el flujo real.
- Las tarjetas muestran Pendiente de firma / Firmada / Liquidada.
- Se muestra quién firmó y cuándo.
- Botones nuevos: Copiar reserva y Abrir reserva.
- Registrar pago queda deshabilitado hasta la firma.
- Generar confirmación queda deshabilitado hasta firma + liquidación.

Archivos nuevos:
- reservation.html
- reservation.js
- SUPABASE_V2.1_FIRMA_RESERVA_ANTES_PAGO.sql

IMPORTANTE:
- Ejecutar el SQL V2.1 una sola vez.
- Conservar el supabase-client.js real del proyecto.
- La migración NO borra registros existentes.


V2.1.1 · POLÍTICAS Y ÁREA DE FIRMA
==================================
- El área de firma ahora está claramente delimitada con borde, fondo y etiqueta "ÁREA DE FIRMA".
- Se agregaron antes de la firma las Políticas y Condiciones Generales de Servicio de Velora Travel.
- Las políticas se tomaron del documento Velora_Travel_Politicas_y_Condiciones.docx.
- El cliente debe marcar dos aceptaciones:
  1) que revisó la información de la reserva;
  2) que leyó y acepta las Políticas y Condiciones.
- La firma guarda también la versión de políticas aceptada: VELORA-POLITICAS-V1.
- Supabase registra terms_version y terms_accepted_at.
- Ejecutar SUPABASE_V2.1.1_POLITICAS_ACEPTADAS.sql una sola vez.
- La migración no borra registros existentes.

NOTA:
Las políticas fuente están redactadas específicamente para Velora Travel.


V2.1.2 · HOTFIX SIDEBAR
=======================
- El sidebar queda limitado al alto real de la pantalla.
- "Sesión activa" y "Cerrar sesión" permanecen siempre accesibles.
- El menú central usa únicamente el espacio disponible.
- Si la pantalla tiene poca altura, solo el menú hace scroll vertical.
- Eliminado el scroll horizontal del sidebar.
- Menú ligeramente más compacto en laptops.
- No requiere SQL ni cambios en Supabase.


V2.1.3 · MENÚ HAMBURGUESA
=========================
- Sidebar reducido a un rail minimalista.
- Logo compacto.
- Indicador "Supabase" reducido a una pequeña píldora de estado.
- Inicio, Clientes, Cotizaciones, Reservas, Pagos, Calendario, Reportes y Confirmaciones pasan al menú hamburguesa.
- Sesión activa, Editar usuario y Cerrar sesión también viven dentro del menú hamburguesa.
- El drawer se abre sobre el contenido y no altera el ancho de la página.
- Se cierra al elegir una sección, tocar fuera del menú o presionar Escape.
- No requiere SQL ni cambios en Supabase.


V2.1.4 · HOTFIX DRAWER REAL
===========================
- Corregido el menú V2.1.3 que quedaba aplastado dentro del rail.
- Causa: una regla antigua max-width:100% impedía que el sidebar creciera.
- El rail ahora mantiene SIEMPRE 76 px.
- La hamburguesa abre un panel independiente de 286 px hacia la derecha.
- Textos, correo y botones ya no se comprimen.
- Añadida cabecera del menú con botón X.
- Supabase queda reducido a un indicador circular verde.
- El panel sigue teniendo scroll vertical si la altura es reducida.
- No requiere SQL ni cambios en Supabase.


V2.1.5 · HOTFIX CLICS DEL MENÚ
==============================
- Corregido el orden de capas del menú hamburguesa.
- El backdrop gris estaba por encima del sidebar y absorbía los clics.
- Inicio, Clientes, Nueva cotización, Cotizaciones, Reservas, Pagos,
  Calendario, Reportes, Confirmaciones, Editar usuario y Cerrar sesión
  vuelven a ser clicables.
- No se modificó el diseño del drawer V2.1.4.
- No requiere SQL ni cambios en Supabase.
