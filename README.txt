BTC INTELLIGENCE V1 — PWA móvil gratuita
=======================================
1. Abrir https://app.netlify.com/drop en el navegador Android e iniciar sesión en una cuenta gratuita.
2. Cargar el ZIP completo btc-intelligence-v1.zip (si el navegador permite ZIP), o descomprimirlo y subir la carpeta completa desde un navegador compatible.
3. Abrir la dirección HTTPS asignada por Netlify. En Chrome: menú > Añadir a pantalla de inicio > Instalar.
El archivo ZIP incluye el proyecto estático completo y no necesita npm ni compilación.
Los WebSockets Bybit intentan conectar directamente desde el móvil. Ciertas redes o regiones pueden bloquearlos.
Las llamadas REST de Bybit/Binance pueden verse limitadas por CORS o bloqueo regional del navegador. El panel indica si no hay Open Interest o velas; no las inventa.
Las bandas del mapa son un MODELO TEÓRICO SIMPLE en torno al precio actual basado en hipótesis fijas de distribución de apalancamientos (5x,10x,20x,25x,50x,75x,100x), no un mapa de liquidación de traders conocidos y NO son datos de órdenes. El peso absoluto no debe interpretarse como el monto real liquidable.
No hay servidor propio, cuentas bursátiles, claves API ni órdenes reales. Las alertas funcionan exclusivamente mientras se encuentra abierta la página, y su historial no es persistente.
El Open Interest de Binance y Bybit se consulta sin autenticación, con prioridades y fuente explicitada. Las métricas de volumen y liquidaciones provienen de Bybit y solo desde que se abre la página.
