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
