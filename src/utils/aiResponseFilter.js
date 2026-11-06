/**
 * aiResponseFilter.js
 * 
 * Filtra y extrae limpiamente el texto generado por los webhooks de n8n o modelos de IA,
 * descartando estructuras JSON crudas, metadatos técnicos (tipo_solicitud, categoría,
 * flags de sanitización) y formateando observaciones, análisis y recomendaciones
 * en texto natural para los campos de auditoría.
 */

export function filterAiResponse(data) {
  if (data === null || data === undefined) return "";

  let target = data;

  // 1. Desempaquetar si viene en array (habitual en respuestas de workflows de n8n)
  if (Array.isArray(target)) {
    if (target.length === 0) return "";
    target = target[0]?.json || target[0];
  }

  // 2. Si viene como string, limpiar bloques markdown y parsear si contiene JSON
  if (typeof target === "string") {
    let rawStr = target.trim();

    // Remover bloques de código markdown tipo ```json ... ``` o ``` ... ```
    if (rawStr.startsWith("```")) {
      rawStr = rawStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    // Si tiene estructura de objeto o array JSON, intentar parsear
    if ((rawStr.startsWith("{") && rawStr.endsWith("}")) || (rawStr.startsWith("[") && rawStr.endsWith("]"))) {
      try {
        const parsed = JSON.parse(rawStr);
        target = Array.isArray(parsed) ? (parsed[0]?.json || parsed[0]) : parsed;
      } catch (e) {
        target = rawStr;
      }
    } else {
      target = rawStr;
    }
  }

  // Si después del proceso es un string de texto plano
  if (typeof target === "string") {
    return target
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/^"|"$/g, "")
      .trim();
  }

  // 3. Si es un objeto, extraer los campos relevantes según su estructura
  if (typeof target === "object" && target !== null) {
    // Si viene anidado en propiedades comunes de n8n
    if (target.json && typeof target.json === "object") {
      target = target.json;
    } else if (target.data && typeof target.data === "object" && !Array.isArray(target.data)) {
      target = target.data;
    }

    // Claves directas estándar de salida
    const directKeys = [
      "rewritten", 
      "output", 
      "text", 
      "response", 
      "result", 
      "respuesta", 
      "content", 
      "message"
    ];

    for (const key of directKeys) {
      if (typeof target[key] === "string" && target[key].trim()) {
        return filterAiResponse(target[key]);
      }
    }

    // Casos específicos estructurados de análisis (gastos, TI, seguridad y auditoría)
    const analisis = 
      target.analisis_financiero || 
      target.analisis_tecnico || 
      target.analisis || 
      target.observacion || 
      target.observaciones || 
      target.hallazgo || 
      target.hallazgos || 
      "";

    const recomendacion = 
      target.accion_recomendada || 
      target.recomendacion || 
      target.recomendaciones || 
      target.accion_sugerida || 
      target.accion || 
      "";

    if (analisis && recomendacion) {
      const cleanAnalisis = filterAiResponse(analisis);
      const cleanRecom = filterAiResponse(recomendacion);
      return `${cleanAnalisis}\n\nAcción recomendada:\n${cleanRecom}`.trim();
    }

    if (analisis) {
      return filterAiResponse(analisis);
    }

    if (recomendacion) {
      return `Acción recomendada:\n${filterAiResponse(recomendacion)}`.trim();
    }

    if (target.veredicto_consejero && typeof target.veredicto_consejero === "string") {
      return String(target.veredicto_consejero).trim();
    }

    // Fallback heurístico para objetos con múltiples claves:
    // Extraer campos de texto descriptivo y omitir metadatos técnicos de n8n
    const ignoredKeys = new Set([
      "tipo_solicitud", 
      "categoria", 
      "subcategoria_sugerida", 
      "es_evitable", 
      "nivel_necesidad", 
      "veredicto_consejero", 
      "datos_sanitizados", 
      "id", 
      "status", 
      "success", 
      "ok", 
      "timestamp"
    ]);

    const meaningfulTexts = [];
    for (const [k, v] of Object.entries(target)) {
      if (!ignoredKeys.has(k) && typeof v === "string" && v.trim().length > 15) {
        meaningfulTexts.push(v.trim());
      }
    }

    if (meaningfulTexts.length > 0) {
      return meaningfulTexts.join("\n\n");
    }

    // Último recurso
    return JSON.stringify(target, null, 2);
  }

  return String(target || "").trim();
}

export default filterAiResponse;

