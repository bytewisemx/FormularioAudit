/**
 * aiResponseFilter.js
 * 
 * Filtra y extrae limpiamente el texto generado por los webhooks de n8n o modelos de IA,
 * descartando estructuras JSON crudas, metadatos técnicos (tipo_solicitud, categoría,
 * flags de sanitización) y formateando observaciones, análisis y recomendaciones
 * en texto natural para los campos de auditoría.
 */

function cleanStringEscapes(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\"/g, '"')
    .replace(/^"|"$/g, '')
    .trim();
}

function extractRegexField(str, fieldNames) {
  if (typeof str !== 'string') return null;
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  for (const name of names) {
    const re = new RegExp(`"${name}"\\s*:\\s*"([\\s\\S]*?)(?:"\\s*,|\\n\\s*"[a-zA-Z0-9_]+"|"$|\\n\\s*\\})`, 'i');
    const match = str.match(re);
    if (match && match[1]) {
      const val = cleanStringEscapes(match[1]);
      if (val.length > 0) return val;
    }
  }
  return null;
}

export function filterAiResponse(data) {
  if (data === null || data === undefined) return "";

  let target = data;

  // 1. Desempaquetar si viene en array (habitual en respuestas de workflows de n8n)
  if (Array.isArray(target)) {
    if (target.length === 0) return "";
    // Si es array de strings, unirlos
    if (target.every(item => typeof item === "string")) {
      return target.map(s => filterAiResponse(s)).join("\n\n");
    }
    target = target[0]?.json || target[0];
  }

  // 2. Si viene como string
  if (typeof target === "string") {
    let rawStr = target.trim();

    // Remover bloques de código markdown tipo ```json ... ``` o ``` ... ```
    if (rawStr.startsWith("```")) {
      rawStr = rawStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    // Intentar extraer bloque JSON si contiene llaves aunque tenga texto alrededor
    const firstBrace = rawStr.indexOf("{");
    const lastBrace = rawStr.lastIndexOf("}");
    const firstBracket = rawStr.indexOf("[");
    const lastBracket = rawStr.lastIndexOf("]");

    let parsedCandidate = null;

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = rawStr.slice(firstBrace, lastBrace + 1);
      try {
        parsedCandidate = JSON.parse(jsonCandidate);
      } catch (e) {
        // Si JSON.parse falla por saltos de línea reales dentro de cadenas, intentar reemplazar saltos no escapados
        try {
          const sanitized = jsonCandidate.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");
          parsedCandidate = JSON.parse(sanitized);
        } catch (e2) {
          // Si aún falla, intentamos extraer campos específicos mediante regex
          const analisisFallback = extractRegexField(jsonCandidate, [
            "analisis_financiero", "analisis_tecnico", "analisis", "observacion", "observaciones", "hallazgo", "hallazgos"
          ]);
          const recomendacionFallback = extractRegexField(jsonCandidate, [
            "accion_recomendada", "recomendacion", "recomendaciones", "accion_sugerida", "accion"
          ]);

          if (analisisFallback && recomendacionFallback) {
            return `${analisisFallback}\n\nAcción recomendada:\n${recomendacionFallback}`.trim();
          }
          if (analisisFallback) return analisisFallback;
          if (recomendacionFallback) return `Acción recomendada:\n${recomendacionFallback}`.trim();
        }
      }
    } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        parsedCandidate = JSON.parse(rawStr.slice(firstBracket, lastBracket + 1));
      } catch (e) {}
    }

    if (parsedCandidate) {
      target = Array.isArray(parsedCandidate) ? (parsedCandidate[0]?.json || parsedCandidate[0]) : parsedCandidate;
    } else {
      // Si no es JSON y no se pudo parsear, comprobar si tiene claves de análisis estructurado con regex
      if (rawStr.includes('"analisis_financiero"') || rawStr.includes('"accion_recomendada"') || rawStr.includes('"observacion"')) {
        const af = extractRegexField(rawStr, ["analisis_financiero", "analisis_tecnico", "analisis", "observacion"]);
        const ar = extractRegexField(rawStr, ["accion_recomendada", "recomendacion", "accion"]);
        if (af && ar) return `${af}\n\nAcción recomendada:\n${ar}`.trim();
        if (af) return af;
        if (ar) return `Acción recomendada:\n${ar}`.trim();
      }

      return cleanStringEscapes(rawStr);
    }
  }

  // 3. Si después de procesar es un string plano
  if (typeof target === "string") {
    return cleanStringEscapes(target);
  }

  // 4. Si es un objeto, extraer los campos relevantes según su estructura
  if (typeof target === "object" && target !== null) {
    // Si viene anidado en propiedades comunes de n8n
    if (target.json && typeof target.json === "object") {
      target = target.json;
    } else if (target.data && typeof target.data === "object" && !Array.isArray(target.data)) {
      target = target.data;
    }

    // Claves directas estándar de salida de agentes y LLMs
    const directKeys = [
      "rewritten", 
      "output", 
      "text", 
      "response", 
      "result", 
      "respuesta", 
      "content", 
      "message",
      "generated_text"
    ];

    for (const key of directKeys) {
      if (typeof target[key] === "string" && target[key].trim()) {
        return filterAiResponse(target[key]);
      }
      if (typeof target[key] === "object" && target[key] !== null) {
        return filterAiResponse(target[key]);
      }
    }

    // Casos específicos estructurados de auditoría, TI y análisis
    const analisis = 
      target.analisis_financiero || 
      target.analisis_tecnico || 
      target.analisis_gasto || 
      target.analisis || 
      target.observacion || 
      target.observaciones || 
      target.hallazgo || 
      target.hallazgos || 
      target.diagnostico || 
      target.descripcion || 
      "";

    const recomendacion = 
      target.accion_recomendada || 
      target.recomendacion || 
      target.recomendaciones || 
      target.accion_sugerida || 
      target.accion || 
      target.propuesta || 
      target.solucion || 
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

    if (target.veredicto_consejero && typeof target.veredicto_consejero === "string" && target.veredicto_consejero.length > 20) {
      return cleanStringEscapes(target.veredicto_consejero);
    }

    // Filtrar metadatos técnicos y extraer textos narrativos
    const ignoredKeys = new Set([
      "tipo_solicitud", 
      "categoria", 
      "subcategoria_sugerida", 
      "es_evitable", 
      "nivel_necesidad", 
      "veredicto_consejero", 
      "datos_sanitizados", 
      "id", 
      "_id",
      "status", 
      "success", 
      "ok", 
      "timestamp",
      "created_at",
      "version",
      "model"
    ]);

    const meaningfulTexts = [];
    for (const [k, v] of Object.entries(target)) {
      if (!ignoredKeys.has(k) && typeof v === "string" && v.trim().length > 10) {
        meaningfulTexts.push(v.trim());
      }
    }

    if (meaningfulTexts.length > 0) {
      return meaningfulTexts.map(t => cleanStringEscapes(t)).join("\n\n");
    }

    // Fallback seguro: En lugar de JSON.stringify, tomar cualquier texto legible
    const anyTexts = Object.entries(target)
      .filter(([k, v]) => !ignoredKeys.has(k) && typeof v === "string" && v.trim())
      .map(([k, v]) => `${k}: ${v.trim()}`);

    if (anyTexts.length > 0) {
      return anyTexts.join("\n");
    }

    return "";
  }

  return cleanStringEscapes(String(target || ""));
}

export default filterAiResponse;
