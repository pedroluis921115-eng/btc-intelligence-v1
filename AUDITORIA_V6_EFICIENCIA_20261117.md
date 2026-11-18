# AUDITORÍA V6 · UTILIDAD, DUPLICADOS Y EFICIENCIA
Fecha 2026-11-17 · Base 8f4aa1b · ALCANCE: auditar, no modificar producción.

## Dictamen
TÉCNICO: PASS CON RESERVAS. EFICIENCIA/CLARIDAD: HOLD. No hay evidencia de rendimiento económico mejorado.

## Evidencia
- GitHub Pages PUBLICATION_PASS, V6, 39 controles PASS y 1 HOLD de Android prolongado.
- Regresión COMPLETA 30/30 grupos PASS.
- Navegador Chromium apuntando a GitHub Pages: móvil 390x844, laptop 1280x800; 3 vistas operativas, sin excepciones JS, HTTP >=400, IDs DOM duplicados ni scroll horizontal.
- Análisis a 390px: ~2379px alto; agenda macro ~859px; Liquidez ~1927px; Operación plegada ~424px.
- Durante ~18s con cambios de pestaña: solicitudes Bybit kline 10, open-interest 7, account-ratio 2, tickers 2, funding/history 1; además otras fuentes públicas. Es una muestra, NO promedio sostenido.
- Heap JS Chromium headless ~3.3–4.2 MB; NO equivale a toda la memoria RAM de Chrome o Android. ~927 elementos DOM y 19 details plegados.
- Código revisado: dos WebSocket públicos en app.js, Bybit y Binance depth20; aproximadamente 21 setInterval declarados entre módulos (no implica que todos trabajen constantemente). Sin funciones createOrder/placeOrder, endpoint de órdenes o claves API en los 12 módulos revisados.

## P1 — Exceso de información y contradicciones visuales
1. Análisis: BTC+OI nuevo, MERCADO (OI y flujo antiguos) e INFORMACIÓN IMPORTANTE repiten conceptos. Pueden usar marcos distintos y parecer contradictorios.
2. INFORMACIÓN IMPORTANTE: si no hay un evento excepcional, promociona funding normal como dato importante (valor operativo escaso).
3. La pantalla Análisis supera 2.3k px en móvil; 859px son agenda semanal. Sobra texto para escáner de entrada rápida.
4. Liquidez muestra mapa principal, mapa original plegado del mismo modelo, OI 15m/1h, y tres tarjetas por exchange con importes absolutos. Mantener modelo científico, pero ocultar el recuento exhaustivo por defecto.
5. Cabecera: dice asistente manual V4 y Binance + Bybit pese a V6 y OI OKX.
6. OI nuevo: umbral fijo 0.20% para calificar estabilidad no está calibrado por mercado o intervalo, es heurístico. Algunas tarjetas usan verde/rojo en movimientos descriptivos, pudiendo sugerir LONG/SHORT injustificadamente.
7. La comparación de OI en 15m/1h está alineada por vela de Bybit, pero las otras lecturas OI del bloque MERCADO siguen temporalidad de la interfaz antigua. Es la duplicación más perjudicial.

## P2 — Recursos y calibración
8. El WebSocket Binance depth20 sigue activado SIEMPRE aunque los módulos de comparación de libros L2 se retiraron de la vista. Revisar consumidores antes de iniciar solo a demanda.
9. Múltiples peticiones similares de OI/kline Bybit por radar, OI nuevo, sentimiento y modelo. Centralizar caché, coalescencia y caducidad.
10. ~21 temporizadores definidos en módulos. Revisar consolidación y actividad real, sin suponer problema de RAM por esta cifra sola.
11. Resumen antiguo topSnapshot está oculto, pero se actualiza y aporta a otros módulos: no eliminar sin mapear las dependencias.
12. Mapa OI sobre velas históricas podría parecer que las bandas hipotéticas actuales existían históricamente. Conserva texto de limitación, pero cambiar representación para evitar ambigüedad.
13. EN VIVO de cabecera describe la conexión principal, no garantiza OI, macro y funding vigentes.
14. El calendario macro y corporativo cubre anuncios programados importantes, no noticias imprevistas ni consenso verificado. No inferir la reacción futura de BTC.
15. Android prolongado y rentabilidad permanecen sin verificar.

## Conservar
- 4H/1H/15M/5M, zonas estructurales, OI y precio de velas cerradas 15m/1h, flujo ejecutado 5m por separado.
- Mapa OI expresamente hipotético, agenda macro de impacto filtrado y fuente visible.
- Calculadora de riesgo, parciales y diario PAPER/REAL manual; sin órdenes reales.
- Caducidad de datos, normalización por exchange, pruebas científicas anteriores.

## Siguiente MACROMISIÓN (no ejecutada)
A. Un solo bloque BTC+OI+flujo en Análisis; eliminar MERCADO repetido; funding rutinario secundario.
B. Agenda compacta: evento de hoy y próximo evento crítico; semana completa desplegable.
C. Liquidez: mapa + evolución OI 15m/1h primero, tres totales por venue plegados.
D. Consultas Bybit compartidas y Binance L2 inicializado solo bajo demanda si no lo requiere otra lectura útil. Medir peticiones antes/después.
E. Corregir V4 de cabecera, tonos del OI y etiqueta de ventana. No nuevas fuentes ni indicadores.
F. 30/30 pruebas PASS, verificación en web pública móvil/escritorio, recursos antes/después, cero procesos residentes, cero órdenes y rollback verificable.

## Criterios de éxito
Análisis de 1–2 pantallas en móvil, sin duplicados o periodos engañosos. Mantener precisión, fuente, integridad del laboratorio y opciones avanzadas útiles. Hasta entonces: HOLD de optimización. No ocultar defectos tras un 30/30 técnico.

REALIZADO: AUDITORÍA, sin correcciones de producto en este trabajo.
