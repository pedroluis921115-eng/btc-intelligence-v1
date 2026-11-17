# BTC Intelligence V6 — Corrección de eventos importantes (17/11/2026)

## Problema constatado
La agenda anterior sólo seleccionaba datos macro de XOOMAR, excluía resultados empresariales relevantes y eliminaba los anuncios económicos dos horas después de su publicación. Así se omitieron NVIDIA, ventas minoristas y producción industrial del 17/11/2026.

## Solución aplicada
- Macro: conservar **todos los eventos prioritarios de HOY hasta el fin del día en Curitiba**, con PUBLICADO sólo si hay valor real en la fuente. Incluir FOMC Minutes e Industrial Production de prioridad media con reglas explícitas; seguir excluyendo estadísticas rutinarias.
- Empresas: agenda selectiva de NVIDIA, Microsoft, Apple, Amazon, Alphabet, Meta, Tesla, AMD, Broadcom, Oracle, Netflix, Micron y Palantir. **No es exhaustiva** y no representa a todos los sectores. Fuente de fechas: Nasdaq. Horas precisas **sólo si se comprobaron por comunicado oficial**, de lo contrario mostrar «hora pendiente». No deducir hora a partir del marcador «after hours».
- NVIDIA 17/11/2026: comunicado del 28/10/2026 anuncia aproximadamente 13:20 PT para resultados y conferencia 14:00 PT, equivalentes a **18:20 y 19:00 BRT**. Fuente: https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/
- Calendario empresarial: data/corporate-calendar.json, generado por scripts/update_corporate_calendar.py, con verificaciones de estructura y override oficial data/corporate-verified.json. Action GitHub diaria (07:17 BRT aproximado, hora de ejecución no garantizada), sin procesos residentes en Windows. Si Nasdaq no responde o el archivo tiene más de 40 horas, la web indica que la agenda empresarial no es fiable; **no afirma que no haya eventos**.
- Los avisos funcionan sólo con la web abierta. No hay órdenes ni alertas en segundo plano ni modelos locales. Costo directo cero, sujeto a límites de GitHub Actions.

## Límites explícitos
- Los resultados empresariales no determinan la dirección de BTC. «Crítico» = merece atención por posible volatilidad, no garantía.
- Nasdaq sólo confirma fechas aproximadas de empresas, no la hora exacta ni garantiza futuras revisiones. Los horarios confirmados pertenecen a los comunicados de cada empresa.
- No incorpora discursos improvisados de la Fed, geopolítica, anuncios de emergencias o todas las empresas del mercado. Las limitaciones de cobertura y frecuencia siguen siendo verificables, no un «PASS» total de información económica.
- No obtiene automáticamente los resultados contables reales de las empresas ni previsiones de consenso. En la sección económica sí muestra un dato publicado cuando XOOMAR lo proporciona.

## Pruebas
- node tests/important_events_v6.test.cjs — 14 pruebas focales con NVIDIA, PCE, ventas minoristas, producción industrial, FOMC, día local y datos obsoletos.
- node tests/important_events_browser.cjs — tres resoluciones 320/390/1280: NVIDIA 18:20/19:00 BRT visible, retail sales + producción industrial publicados, FOMC Minutes en el horizonte.
- python scripts/run_visual_v6_tests.py — **27 grupos PASS, 0 fallos**.
- node scripts/verify-deploy.mjs y comprobación manual del browser público — realizar tras publicación.
- Actualización GitHub Actions: confirmar primera ejecución en la nube antes de declarar que está operativa continuamente.

## Invariantes
Conservar SCALP AI, Fund V12, BTC Signal Engine, mapa OI, tres pestañas, datos técnicos existentes, 0 trading real, ningún servicio nuevo en Windows.
