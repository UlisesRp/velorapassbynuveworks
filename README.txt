VELORA PASS · DEMO FUNCIONAL

Archivos:
- index.html: panel interno para crear y revisar cupones.
- voucher.html: vista que recibe y firma el pasajero.
- styles.css: estilos.
- app.js: lógica del panel.
- voucher.js: lógica de firma.

Cómo probar:
1. Abre index.html.
2. En "Nuevo cupón", pulsa "Llenar ejemplo" o captura tus datos.
3. Genera el cupón.
4. Abre "Vista del pasajero".
5. Marca aceptación, firma con mouse/dedo y confirma.
6. Regresa al panel: el estado aparecerá como "Firmado".

Esta demo usa localStorage, por lo que panel y pasajero deben abrirse en el mismo navegador/origen.
Para operación real entre dispositivos, el siguiente paso es conectar Supabase para:
- autenticación del equipo,
- base de datos,
- links públicos únicos,
- guardado de firmas,
- fecha/hora y auditoría,
- estados vistos/firmados,
- PDFs permanentes.


CAMBIOS V1.1
- Código de cupón generado automáticamente con identificador criptográfico.
- Verificación local para no repetir códigos ya existentes.
- Fecha de regreso limitada al mismo mes de la fecha de salida.
- Fecha de regreso nunca puede ser anterior a la fecha de salida.

IMPORTANTE:
En la versión final conectada a Supabase se añadirá una restricción UNIQUE sobre el código.
Eso convierte la regla "no repetir jamás" en una garantía de base de datos, incluso con varios usuarios/dispositivos.


CAMBIOS V1.2
- El código único del cupón sigue siendo automático.
- Los localizadores son manuales.
- Se separaron:
  - Localizador de hospedaje
  - Localizador de traslados
- Ambos aparecen también en la vista del pasajero.


CAMBIOS V1.3
- Se mantiene Localizador de hospedaje.
- Se separaron los localizadores de traslados:
  - Traslado de llegada
  - Traslado de salida
- Se agregaron localizadores de vuelos:
  - Vuelo de ida
  - Vuelo de regreso
- Todos aparecen también en la vista del pasajero.


CAMBIOS V1.4
- El cupón del pasajero adopta la estructura de la Confirmación de Viaje de Velora:
  1. Datos del viajero
  2. Detalles del viaje
  3. Transportación
  4. Hospedaje
  5. Servicios incluidos
  6. Inversión y pagos
  7. Información importante
  8. Contacto Velora Travel
- Se conserva la firma digital al final.
- Se conservaron los localizadores separados de hospedaje, traslados y vuelos.
- Se agregaron los campos necesarios para llenar la estructura completa.


AJUSTE DE ESTRUCTURA
- La vista del cupón/confirmación fue adaptada para salir con estructura tipo documento oficial de Velora.
- Secciones visibles:
  1. Datos del viajero
  2. Detalles del viaje
  3. Transportación
  4. Hospedaje
  5. Servicios incluidos
  6. Inversión y pagos
  7. Información importante
  8. Contacto Velora Travel
- La firma del pasajero se mantiene al final del documento.


CAMBIOS V1.5
Formulario alineado con todos los datos solicitados en el voucher fuente:
1. Datos del viajero
2. Detalles del viaje
3. Transportación
4. Hospedaje
5. Servicios incluidos
6. Inversión y pagos
7. Información importante
8. Contacto Velora Travel

Automáticos:
- Código único de confirmación
- Fecha de emisión
- Duración del viaje
- Noches de hospedaje
- Saldo pendiente

Captura adicional conservada por operación:
- Localizador general / reserva
- Localizador de hospedaje
- Localizador traslado llegada
- Localizador traslado salida
- Localizador vuelo ida
- Localizador vuelo regreso


CAMBIOS V1.6
- Integrado logo oficial de Velora Pass by Nuve Works al panel.
- Logo recortado y optimizado para no mostrar espacio blanco excesivo.
- Branding responsive para escritorio y móvil.
- Identidad Velora Pass añadida al encabezado y panel lateral.

NOTA SUPABASE
Esta versión sigue usando localStorage.
La conexión real multi-dispositivo y las firmas compartidas se implementarán con Supabase.
