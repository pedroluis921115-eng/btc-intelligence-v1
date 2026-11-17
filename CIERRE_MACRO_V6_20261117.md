# BTC Intelligence V6 — Agenda macroeconómica semanal (2026-11-17)

## Objetivo y experiencia
Agregar a la pestaña ANALISIS un apartado visual «MACRO · EVENTOS QUE IMPORTAN» que ayude a evitar entradas durante publicaciones de alto impacto potencial para BTC. Por defecto muestra los **próximos 7 días**; opción **14 días**; como máximo 5 eventos por vista, sin listados de noticias de bajo valor.

## Selección estricta (no todos los eventos marcados high por el proveedor)
- CRÍTICO: decisión FOMC de tipos, proyecciones de la Fed, IPC/CPI, nóminas no agrícolas/NFP, informe PCE.
- IMPORTANTE: PIB avance, ventas minoristas, PPI, actas FOMC, ISM cuando esté disponible con importancia alta.
- Excluye del resumen rutinarios como jobless claims semanales, vivienda y demás lecturas de impacto incierto. **No añade previsiones sin fuente**, ni trata las publicaciones como señal de LONG/SHORT.
- El estado de cada evento es futuro/menos de 24 h/menos de 1 h/menos de 15 min/publicado. Solo se muestra el valor real si el proveedor lo publicó después de la hora programada. El conteo de urgencia NO implica garantía de impacto.
- Hora mostrada siempre en **America/Sao_Paulo** con zona horaria BRT.
- Fuente de datos: XOOMAR (https://xoomar.com/markets/api/calendar) vía API pública y gratuita para uso de consulta; a su vez publica calendarios basados en BLS, BEA, Fed y otras agencias de EE. UU. Attribution Data: XOOMAR visible en la UI. La fuente **no incluye consenso forecast**.
- Actualiza al abrir y, mientras la pestaña de Análisis está abierta y visible, cada 30 minutos; botón de actualización manual con espera mínima de 1 minuto; jamás tareas residentes ni alertas con aplicación cerrada.
- La API se había comprobado con HTTP 200 y CORS desde la URL GH Pages. Si la respuesta excede 72 h de antigüedad o tiene datos mal formados, se marca **desactualizada** y NO se muestran fechas como verificadas.
- Si los próximos 7 días no contienen eventos priorizados, indicará honestamente «sin publicaciones prioritarias» y mostrará cuál es el siguiente evento importante disponible a 30 días.

## Límites y alcance del valor VERDE
- Las fechas son calendarios, no previsiones de dirección de BTC. Pueden reprogramarse; consultar a la fuente antes de publicar cifras.
- No incluye discursos improvisados, titulares de última hora, guerras, geopolítica, ETF o balances de empresas; requieren fuentes separadas y hechos verificables. No se rellena con rumores.
- No se usan APIs privadas, órdenes reales ni gasto mensual. Sin Work ni procesos de Windows.
- Pruebas: node tests/macro_calendar_v6.test.cjs (16 casos); node tests/macro_calendar_browser.cjs (móvil 320/390 y laptop 1280; fuente vigente y fallida); python scripts/run_visual_v6_tests.py (24 grupos tras integración); node scripts/verify-deploy.mjs (GitHub Pages).
- Se preservan SCALP AI, QuantLab y BTC Signal Engine, y todas las funciones anteriores de V6.
