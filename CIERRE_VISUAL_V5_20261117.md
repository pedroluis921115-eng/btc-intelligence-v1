# BTC Intelligence V5 — Diseño visual operativo

**Objetivo:** Ayudar al usuario a analizar BTCUSDT manualmente en 4H/1H/15M/5M, con menos lectura, menos desplazamiento, sin bots ni decisiones automáticas.

## Cambios ejecutados
- Tres pestañas: **ANÁLISIS**, **LIQUIDEZ**, **OPERACIÓN**. La primera usa tarjetas visuales, lectura de temporalidades, estructura por encima/debajo del precio, presión agresiva de 5 minutos y OI/precio cerrado.
- La conclusión (ESPERAR, VIGILAR LONG/SHORT, REVISAR LONG/SHORT) refleja estrictamente el motor descriptivo V4: NO es una señal científica ni indica probabilidades.
- Evidencias, mapas L2, muros, comparaciones, alertas largas, control de procedencia y otros diagnósticos se conservan detrás de una pestaña y un desplegable **Avanzados**. No fueron eliminados ni duplicados.
- Mapa estimado OI original conservado en Liquidez, arriba de otros mapas técnicos.
- OI independiente para **Binance USD-M BTCUSDT, Bybit BTCUSDT lineal y OKX BTC-USDT-SWAP** en BTC (Bybit OI muestreado 5 minutos; Binance y OKX instantáneos). Normalización: Binance openInterest BTC; Bybit openInterest BTC; OKX oiCcy BTC, NO oi (contratos). Solo suma de 3 contratos si todos están vigentes; no es el OI mundial ni la totalidad de mercados de cada exchange. Variaciones desde apertura de la pestaña, NO ventanas sincronizadas entre bolsas.
- Se consultan estas 3 fuentes solamente cuando está activa la pestaña Liquidez, con máximo ~1 consulta/90 s por exchange; sin procesos locales residentes ni notificaciones de fondo. Se muestran fallos de red.
- Operación conserva planificador, parciales y diario local, separados del análisis.
- Marca/ventana/manifest actualizado a V5.

## Invariantes
**Cero órdenes reales**, cero claves, cero servidores extra, cero modelos residentes, cero nuevos procesos al iniciar Windows. NO modificar SCALP AI, QuantLab Fund V12 ni laboratorio BTC Signal Engine.

## Verificación exigida antes de VERDE
1. node tests/multi_oi_v5.test.cjs (unit/campo de BTC correcto, datos caducados, agregación).
2. node tests/visual_v5_browser.cjs (320/390/1280 px, tres pestañas, mapa, OI, funciones heredadas).
3. python scripts/run_visual_v5_tests.py (regresiones anteriores; el test del mapa ahora selecciona pestaña Liquidez).
4. node tests/visual_v5_live_oi.cjs (Binance, Bybit, OKX desde Chrome, API públicas reales).
5. node scripts/verify-deploy.mjs, posterior a push.
6. powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test_desktop_shortcut_shutdown.ps1; verificar que tras cerrar el icono quedan 0 procesos del perfil dedicado.

**Límites:** No se ha demostrado mejora de trading; las zonas de estructura no son órdenes visibles. No se marca como PASS la validación prolongada en Android físico. Todo el diario queda local y no se sincroniza por sí solo.
