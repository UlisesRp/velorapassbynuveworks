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
