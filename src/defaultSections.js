export const DEFAULT_SECTIONS = {
    'Infraestructura del Site': [
      {
        id: 1,
        pregunta: '¿El site cuenta con mecanismos que aseguren la continuidad operativa ante fallas de energía o conectividad (UPS, planta, enlaces redundantes)?',
        evidencia: 'Autonomía eléctrica, Enlaces de Internet disponibles, Proveedor/SLA',
        nota: 'Cubre: UPS, planta, enlaces, módems, balanceador',
        escalaEvaluacion: [
          '0 - Sin respaldo eléctrico ni de conectividad.',
          '1 - Respaldo básico sin formalizar.',
          '2 - Respaldo parcial documentado.',
          '3 - Respaldo documentado y operativo.',
          '4 - Respaldo aprobado, probado y mejorado.',
        ],
      },
      {
        id: 2,
        pregunta: '¿El site cuenta con condiciones físicas y ambientales adecuadas para alojar y proteger la infraestructura tecnológica?',
        evidencia: 'Descripción del site, Fotos (opcional)',
        nota: 'Cubre: ubicación aislada, climatización, racks, cableado físico',
        escalaEvaluacion: [
          '0 - Sin control físico ni ambiental.',
          '1 - Control básico con varias deficiencias.',
          '2 - Control parcial de ambiente, racks, orden y limpieza.',
          '3 - Control adecuado, documentado y aplicado.',
          '4 - Control óptimo, monitoreado y mejorado.',
        ],
      },
      {
        id: 3,
        pregunta: '¿La infraestructura tecnológica del site es suficiente y funcional para soportar la operación?',
        evidencia: 'Descripción general de componentes, Arquitectura o listado resumido',
        nota: 'Cubre: switches, routers, firewall, servidores, NAS, PBX, SIP',
        escalaEvaluacion: [
          '0 - No existe infraestructura tecnológica suficiente.',
          '1 - Infraestructura básica con deficiencias importantes.',
          '2 - Infraestructura parcialmente suficiente y funcional.',
          '3 - Infraestructura suficiente, funcional y documentada.',
          '4 - Infraestructura óptima, monitoreada y mejorada.',
        ],
      },
      { id: 4, pregunta: '¿Existen controles de seguridad física y lógica para proteger el acceso al site y los activos tecnológicos?', evidencia: 'Controles implementados, Responsables/proveedor', nota: 'Cubre: CCTV, control acceso, firewall/UTM, FM-200' },
      {
        id: 5,
        pregunta: '¿La operación del site se gestiona de forma formal, con inventario actualizado, mantenimiento programado y responsables definidos?',
        evidencia: 'Inventario, Plan de continuidad, Procedimientos operativos',
        nota: 'Cubre: Inventario, Mantenimiento, Continuidad, Autorización de accesos',
        escalaEvaluacion: [
          '0 - Sin gestión del site.',
          '1 - Gestión informal.',
          '2 - Gestión parcialmente documentada.',
          '3 - Gestión documentada y aplicada.',
          '4 - Gestión monitoreada y mejorada.',
        ],
      }
    ],
    'Cláusula 4: Contexto de la organización': [
      { id: '4.1', pregunta: '¿La organización tiene identificados los factores internos y externos que pueden afectar la seguridad de la información?', requisito: '4.1 Factores internos y externos', escalaEvaluacion: ['0 - No identificados.', '1 - Identificados informalmente.', '2 - Parcialmente documentados.', '3 - Documentados y considerados.', '4 - Revisados y actualizados periódicamente.'] },
      { id: '4.2', pregunta: '¿La organización tiene identificadas las partes interesadas y sus expectativas respecto a la seguridad de la información?', requisito: '4.2 Partes interesadas', escalaEvaluacion: ['0 - No identificadas.', '1 - Identificadas informalmente.', '2 - Parcialmente documentadas.', '3 - Documentadas y consideradas.', '4 - Revisadas y actualizadas periódicamente.'] },
      { id: '4.3', pregunta: '¿La organización tiene definido qué procesos, áreas, sistemas o información deben protegerse dentro del alcance del SGSI?', requisito: '4.3 Alcance del SGSI', escalaEvaluacion: ['0 - No definido.', '1 - Definido informalmente.', '2 - Parcialmente documentado.', '3 - Documentado y aplicado.', '4 - Revisado y mejorado periódicamente.'] },
    ],
    'Cláusula 5: Liderazgo': [
      { id: '5.1', pregunta: '¿La alta dirección reconoce los riesgos de seguridad de la información y participa en su gestión?', requisito: '5.1 Compromiso de la alta dirección', escalaEvaluacion: ['0 - Sin involucramiento.', '1 - Involucramiento informal.', '2 - Participación parcial.', '3 - Participación documentada.', '4 - Liderazgo activo y medido.'] },
      { id: '5.2', pregunta: '¿La organización cuenta con una política de seguridad de la información aprobada, vigente y respaldada por la dirección?', requisito: '5.2 Política de seguridad', escalaEvaluacion: ['0 - No existe política.', '1 - Política informal.', '2 - Política parcialmente documentada.', '3 - Política aprobada y comunicada.', '4 - Política revisada y mejorada.'] },
      { id: '5.3', pregunta: '¿Existen responsables definidos para tomar decisiones y gestionar temas de seguridad de la información?', requisito: '5.3 Roles y responsabilidades', escalaEvaluacion: ['0 - Sin responsables.', '1 - Responsables informales.', '2 - Responsabilidades parciales.', '3 - Responsables definidos y aplicados.', '4 - Responsabilidades revisadas y mejoradas.'] },
    ],
    'Cláusula 6: Planificación': [
      { id: '6.1', pregunta: '¿La organización identifica, evalúa y atiende riesgos que puedan afectar la confidencialidad, integridad o disponibilidad de la información?', requisito: '6.1 Gestión de riesgos', escalaEvaluacion: ['0 - No gestiona riesgos.', '1 - Gestión informal.', '2 - Gestión parcial.', '3 - Riesgos documentados y tratados.', '4 - Riesgos monitoreados y actualizados.'] },
      { id: '6.2', pregunta: '¿La organización ha definido objetivos de seguridad de la información y mecanismos para medir su avance?', requisito: '6.2 Objetivos de seguridad', escalaEvaluacion: ['0 - Sin objetivos.', '1 - Objetivos informales.', '2 - Objetivos parciales.', '3 - Objetivos definidos y medidos.', '4 - Objetivos revisados y mejorados.'] },
    ],
    'Cláusula 7: Apoyo': [
      { id: '7.1', pregunta: '¿La organización cuenta con recursos humanos, tecnológicos o financieros asignados para gestionar la seguridad de la información?', requisito: '7.1 Recursos', escalaEvaluacion: ['0 - Sin recursos.', '1 - Recursos informales.', '2 - Recursos parciales.', '3 - Recursos asignados y evidenciados.', '4 - Recursos evaluados y optimizados.'] },
      { id: '7.2', pregunta: '¿El personal recibe capacitación periódica en seguridad de la información, incluyendo concientización y pruebas de phishing cuando aplique?', requisito: '7.2 Competencia y concientización', escalaEvaluacion: ['0 - Sin capacitación.', '1 - Capacitación informal.', '2 - Capacitación parcial.', '3 - Capacitación periódica con evidencia.', '4 - Capacitación medida y mejorada.'] },
      { id: '7.3', pregunta: '¿La organización comunica y documenta adecuadamente las políticas, procedimientos o lineamientos de seguridad de la información?', requisito: '7.3 Comunicación y documentación', escalaEvaluacion: ['0 - No se documenta ni comunica.', '1 - Comunicación informal.', '2 - Documentación parcial.', '3 - Documentado y comunicado.', '4 - Documentación controlada y actualizada.'] },
    ],
    'Cláusula 8: Operación': [
      { id: '8.1', pregunta: '¿Existen procesos definidos para operar y controlar la seguridad de la información en las actividades diarias?', requisito: '8.1 Procesos operativos del SGSI', escalaEvaluacion: ['0 - Sin procesos.', '1 - Procesos informales.', '2 - Procesos parciales.', '3 - Procesos documentados y aplicados.', '4 - Procesos monitoreados y mejorados.'] },
    ],
    'Cláusula 9: Evaluación del desempeño': [
      { id: '9.1', pregunta: '¿La organización mide o da seguimiento al desempeño de sus prácticas y controles de seguridad?', requisito: '9.1 Seguimiento y medición', escalaEvaluacion: ['0 - Sin seguimiento.', '1 - Seguimiento informal.', '2 - Seguimiento parcial.', '3 - Seguimiento documentado.', '4 - Indicadores revisados y mejorados.'] },
      { id: '9.2', pregunta: '¿La organización realiza auditorías o revisiones periódicas sobre la gestión de seguridad de la información?', requisito: '9.2 Auditorías o revisiones', escalaEvaluacion: ['0 - Sin auditorías.', '1 - Revisiones informales.', '2 - Revisiones parciales.', '3 - Auditorías periódicas con evidencia.', '4 - Auditorías con seguimiento y mejora.'] },
      { id: '9.3', pregunta: '¿La dirección revisa periódicamente los resultados, riesgos y necesidades de mejora en seguridad de la información?', requisito: '9.3 Revisión por la dirección', escalaEvaluacion: ['0 - Sin revisión directiva.', '1 - Revisión informal.', '2 - Revisión parcial.', '3 - Revisión documentada por dirección.', '4 - Revisión con decisiones y mejoras.'] },
    ],
    'Cláusula 10: Mejora': [
      { id: '10.1', pregunta: '¿La organización analiza incidentes, fallos o desviaciones de seguridad y aplica acciones correctivas para evitar su repetición?', requisito: '10.1 Acciones correctivas', escalaEvaluacion: ['0 - Sin acciones correctivas.', '1 - Acciones reactivas.', '2 - Acciones parciales.', '3 - Acciones documentadas y aplicadas.', '4 - Acciones verificadas y mejoradas.'] },
      { id: '10.2', pregunta: '¿La organización cuenta con iniciativas o acciones para mejorar continuamente la seguridad de la información?', requisito: '10.2 Mejora continua', escalaEvaluacion: ['0 - Sin mejora.', '1 - Mejoras informales.', '2 - Mejoras parciales.', '3 - Mejoras documentadas.', '4 - Mejora continua implementada.'] },
    ],
    'Seguridad de la Información: Controles técnicos y operativos': [
      { id: 1, pregunta: '¿El control de accesos contempla alta, modificación y baja de usuarios, MFA, política de contraseñas, privilegios mínimos y aceptación de confidencialidad?', requisito: '1. Control de accesos y privilegios', escalaEvaluacion: ['0 - Sin control de accesos.', '1 - Accesos informales.', '2 - Controles parciales.', '3 - Accesos controlados y documentados.', '4 - Accesos revisados y mejorados.'] },
      { id: 2, pregunta: '¿Se mantiene un inventario actualizado de los activos tecnológicos relevantes para la operación?', requisito: '2. Inventario de activos tecnológicos', escalaEvaluacion: ['0 - No existe inventario.', '1 - Inventario informal.', '2 - Inventario parcial.', '3 - Inventario actualizado y documentado.', '4 - Inventario revisado y controlado.'] },
      { id: 3, pregunta: '¿Existe un Plan de Respuesta a Incidentes de seguridad, documentado y probado periódicamente?', requisito: '3. Respuesta a incidentes', escalaEvaluacion: ['0 - No existe plan.', '1 - Respuesta informal.', '2 - Plan parcial o sin pruebas.', '3 - Plan documentado y probado.', '4 - Plan actualizado y mejorado.'] },
      { id: 4, pregunta: '¿Se aplican controles para proteger datos sensibles, como clasificación, cifrado, DLP o separación de información crítica?', requisito: '4. Protección de datos sensibles', escalaEvaluacion: ['0 - Sin protección de datos.', '1 - Protección informal.', '2 - Controles parciales.', '3 - Controles documentados y aplicados.', '4 - Controles monitoreados y mejorados.'] },
      { id: 5, pregunta: '¿Se gestionan parches y actualizaciones de seguridad de forma oportuna y controlada?', requisito: '5. Gestión de parches y actualizaciones', escalaEvaluacion: ['0 - Sin gestión de parches.', '1 - Actualizaciones reactivas.', '2 - Gestión parcial.', '3 - Parches gestionados con evidencia.', '4 - Gestión monitoreada y optimizada.'] },
      { id: 6, pregunta: '¿Existen mecanismos de monitoreo y detección de amenazas, como SIEM, EDR, XDR, SOC o servicios administrados de seguridad?', requisito: '6. Monitoreo y detección de amenazas', escalaEvaluacion: ['0 - Sin monitoreo.', '1 - Monitoreo básico.', '2 - Monitoreo parcial.', '3 - Monitoreo implementado y gestionado.', '4 - Monitoreo continuo y optimizado.'] },
      { id: 7, pregunta: '¿Los equipos corporativos cuentan con protección contra malware o EDR, instalada, actualizada y administrada centralizadamente?', requisito: '7. Protección de equipos corporativos', escalaEvaluacion: ['0 - Equipos sin protección.', '1 - Protección básica.', '2 - Protección parcial.', '3 - Protección actualizada y administrada.', '4 - Protección monitoreada y optimizada.'] },
      { id: 8, pregunta: '¿Existen controles para proteger la red, el acceso remoto y los servicios expuestos, incluyendo segmentación WiFi, BYOD, VPN, revisión de puertos y reglas autorizadas?', requisito: '8. Seguridad de red, acceso remoto y servicios expuestos', escalaEvaluacion: ['0 - Sin controles de red.', '1 - Controles básicos.', '2 - Controles parciales.', '3 - Controles documentados y aplicados.', '4 - Controles revisados y mejorados.'] },
      { id: 9, pregunta: '¿Los proveedores que tratan información de la empresa cuentan con contratos, cláusulas de seguridad, SLA y evaluaciones periódicas?', requisito: '9. Gestión de proveedores', escalaEvaluacion: ['0 - Sin control de proveedores.', '1 - Gestión informal.', '2 - Control parcial.', '3 - Proveedores controlados contractualmente.', '4 - Proveedores evaluados y monitoreados.'] },
    ],
    'Inteligencia Artificial y LFPDPPP': [
      { id: 'IA-1', pregunta: 'IA: ¿La organización utiliza o planea utilizar inteligencia artificial y con qué objetivo principal?', evidencia: 'Áreas impactadas, Casos de uso actuales o planeados (ej. Copilot, chatbots, automatización)', nota: 'Cubre: Uso actual de IA, Objetivo de IA, Áreas impactadas, Necesidad inmediata vs mediano plazo' },
      { id: 'IA-2', pregunta: 'IA: ¿Qué nivel de automatización con IA se tiene o se planea implementar y qué riesgos o inquietudes se han identificado?', evidencia: 'Nivel: Automatización básica / Asistente con IA / Integración con sistemas internos. Riesgos percibidos (privacidad, control, errores, impacto laboral)', nota: 'Cubre: Chatbot completo, Inquietudes y temores, Nivel de autonomía, Integración con sistemas' },
      { id: 'DP-1', pregunta: '🔐 LFPDPPP: ¿La organización cumple con los requisitos básicos de la LFPDPPP (aviso de privacidad vigente, finalidades claras y consentimiento adecuado)?', evidencia: 'Aviso de privacidad, Fecha de actualización, Diferenciación de tipos de datos', nota: 'Cubre: Aviso de privacidad, Finalidades, Consentimiento expreso/tácito' },
      { id: 'DP-2', pregunta: '🔐 LFPDPPP: ¿La organización cuenta con medidas y procedimientos formales para la protección de datos personales (seguridad, ARCO, responsables y transferencias)?', evidencia: 'Procedimiento ARCO, Responsable designado, Medidas administrativas/técnicas/físicas, Contratos/cláusulas de transferencia', nota: 'Cubre: Procedimiento ARCO, Responsable de datos, Medidas de seguridad, Transferencias nacionales/internacionales' }
    ]
  };

  const pendingQuestions = React.useMemo(() => {
    const list = [];
    Object.entries(sections).forEach(([section, questions]) => {
      questions.forEach(q => {
        const key = `${section}-${q.id}`;
        if (responses[key]?.evaluacion === undefined) {
          list.push({ ...q, section });
        }
      });
    });
    return list;
  }, [responses]);

  const handleSuggestionClick = (section, id) => {
    setActiveSection(section);

    setTimeout(() => {
      const el = document.getElementById(`question-${section}-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-cyan-50/50', 'transition-colors', 'duration-500');
        setTimeout(() => el.classList.remove('bg-cyan-50/50'), 2000);
      }
    }, 100);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateResponse = (section, id, field, value) => {
    const key = `${section}-${id}`;
    setResponses(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const calculateSectionScore = (section) => {
    const questions = sections[section];
    let total = 0;
    let count = 0;
    
    questions.forEach(q => {
      const key = `${section}-${q.id}`;
      if (responses[key]?.evaluacion !== undefined) {
        total += parseInt(responses[key].evaluacion);
        count++;
      }
    });
    
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  };
