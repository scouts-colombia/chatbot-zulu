# Smoke del modelo operativo Gemini 3.7 Flash

**Fecha:** 2026-08-19
**Resultado:** VERDE

Se ejecutó `pnpm smoke:model` contra el proyecto y corpus activos usando el
wrapper de producción. La llamada confirmó en conjunto:

- modelo `gemini-3.7-flash`;
- nivel de razonamiento `low`;
- File Search con grounding utilizable y 2 citas normalizadas;
- salida JSON válida según el contrato de Zulú;
- estado semántico `respondido`;
- 3348 tokens totales y 7210 ms de latencia en esta muestra.

El smoke no persiste ni imprime la respuesta cruda del proveedor. El resultado
es evidencia de compatibilidad del SDK, la cuenta, el corpus y la configuración
actuales; no es un benchmark de calidad ni latencia.
