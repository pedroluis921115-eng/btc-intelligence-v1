# BTC Intelligence — cierre de limpieza V6.1 (17 noviembre de 2026)

## Objetivo heredado
Continuar V6 sin reiniciar ni añadir fuentes/indicadores. El usuario necesita mejorar análisis manual BTC (4H/1H/15M/5M), mapas de liquidez estimada, cambios OI y calendario de alto impacto, reduciendo letras, duplicados y RAM. Ninguna orden real, nada que continúe cuando se cierra la web; no tocar SCALP AI, QuantLab ni BTC Signal Engine.

## Cambios efectivamente implementados
1. **ANÁLISIS**: la estructura de 4H→1H→15M→5M y las zonas se ven antes de OI. Se conserva una lectura conjunta Bybit de precio/OI cerrado y presión 5m; el viejo bloque MERCADO con OI de otra temporalidad y funding se mueve a un contenedor interno oculto. Los avisos importantes ya no repiten OI, confluencia o funding rutinarios; máximo 2 hechos no triviales, sin panel vacío.
2. **AGENDA**: resumen visible de hasta dos eventos detectados hoy o próximos, con fuente y hora; la semana completa y resultados de tecnológicas permanecen en un desplegable, 7/14 días. Eventos macro urgentes (<30 min) saltan al resumen visible aunque el calendario esté cerrado. La UI original conserva fuente y caducidad.
3. **LIQUIDEZ**: mapa principal intacto; OI Bybit de 15m/1h intacto; Binance/Bybit/OKX con totales plegados a demanda; mapa original opcional. Ningún cálculo de zona se modifica.
4. **OPERACIÓN**: funding Bybit (coste aproximado de futuros) arriba del planificador y el diario, con actualización mientras está abierta esa pestaña. No se mueven datos de PAPER/REAL ni operaciones reales.
5. **V6 de cabecera**: se elimina texto obsoleto «asistente manual V4», se incluye OKX y la conexión se etiqueta como «PRECIO EN VIVO» solo si hay precio Bybit vigente.
6. **RED**: se desactiva apertura y reconexión automática del WebSocket Binance depth20 (la comparación L2 retiró su utilidad operativa); código preservado para pruebas y diagnóstico expreso debugBinanceL2=1. El precio y libro Bybit y sus liquidaciones siguen operando como antes.
7. **Consultas REST**: módulo market-cache.js público y ligero que comparte el JSON de los endpoints Bybit durante 15 s y permite reutilizar una respuesta de mayor limite para lectores del mismo instrumento/periodo que piden menos puntos, con señales de caducidad, error propagado y máximo 40 entradas. Integrado en app.js, radar.js y oi-easy.js. No cachea trading, endpoints privados ni WebSockets.
8. **Presentación**: sin nuevos servicios ni procesos residentes; icono y URL de GitHub Pages permanecen iguales. Caché del service worker versionada v61-clean-20261117.

## Evidencia comparativa
- Antes (auditoría 0dedc20): Análisis móvil 390px ≈2.379px; después (prueba local del nuevo árbol DOM) ≈1.321px. Reducción ≈44%; no es medida de tiempo para operar ni evidencia de rentabilidad.
- Antes: pestaña Liquidez ≈1.927px con totales expandidos; ahora OI por exchange plegado, mapa intacto.
- Prueba local Chromium en 390x844 y 1280x800: ausencia de overflow, se puede expandir calendario y totales, no se pierde mapa ni 15m/1h; sin errores JavaScript. Advertencia urgente comprobada visible fuera del desplegable.
- Nueva caché: 7 peticiones reutilizadas en sesión de prueba, 0 errores en prueba; 6 llamadas kline y 5 open-interest a Bybit en esa muestra. Antes se habían contado 10 kline y 7 OI, pero la ventana de observación no fue idéntica; no atribuir un porcentaje de reducción causal exacto sin benchmark controlado.
- Memoria heap del navegador headless en muestra ≈2,8–3,3 MB; NO equivale a RAM total de Chrome/Windows y NO prueba consumo del Android.
- Pruebas: suite scripts/run_visual_v6_tests.py con validación V6.1, módulos históricos, planificador, paper/real, mapas, calendarios, OI, fuentes y compatibilidad. No se declaran resultados hasta cierre del último PASS.

## Riesgos y pendientes
- La franja de liquidaciones OI sigue siendo una estimación, no el mapa verdadero de CoinGlass ni un historial real de posición.
- Los umbrales de variación del OI son heurísticos no calibrados económicamente, no porcentajes de oportunidad.
- La fuente macro/corporativa cubre anuncios programados seleccionados; no noticias súbitas ni consenso/earnings surprises generalizados.
- Physical Android prolongado y evidencia de mejora de decisiones/rentabilidad permanecen HOLD, sin maquillarlos como PASS.
- El código L2 Binance queda por compatibilidad pero la conexión no se inicia en el uso normal.
- La caché dura solo 15 s para consultas públicas y no altera las garantías de caducidad de los otros indicadores.

## Rollback
Commit previo a la V6.1: 0dedc20, con auditoría escrita. Si las pruebas públicas de V6.1 fallan, revertir únicamente la revisión funcional nueva, sin alterar historia del diario local, modelos ni otros proyectos.
