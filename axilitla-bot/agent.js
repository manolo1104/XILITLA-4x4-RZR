// Agente de IA con Claude para Axilitla 4x4

const Anthropic = require('@anthropic-ai/sdk');
const { RUTAS, VEHICULOS, DATOS_BANCO } = require('./data');
const { checkAvailability, createBooking } = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Historial de conversación por usuario (teléfono -> { history, draft })
const sessions = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { history: [], draft: {} });
  }
  return sessions.get(phone);
}

function clearSession(phone) {
  sessions.delete(phone);
}

// ══════════════════════════════════════════════════════════
// HERRAMIENTAS QUE PUEDE USAR EL AGENTE
// ══════════════════════════════════════════════════════════
const tools = [
  {
    name: 'obtener_vehiculos_para_grupo',
    description: 'Obtiene la lista de vehículos disponibles según el número de adultos y niños del grupo del cliente.',
    input_schema: {
      type: 'object',
      properties: {
        adultos: { type: 'number', description: 'Número de adultos en el grupo' },
        ninos: { type: 'number', description: 'Número de niños en el grupo (puede ser 0)' }
      },
      required: ['adultos', 'ninos']
    }
  },
  {
    name: 'verificar_disponibilidad',
    description: 'Verifica en tiempo real si un vehículo específico está disponible en una fecha y hora determinadas para una ruta.',
    input_schema: {
      type: 'object',
      properties: {
        vehiculo_id: { type: 'string', description: 'ID del vehículo (ej: DEF-01, MAVERIC-01)' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (ej: 2026-04-20)' },
        hora_inicio: { type: 'number', description: 'Hora de inicio en formato decimal (ej: 9 para 9:00am, 10.5 para 10:30am)' },
        ruta: { type: 'string', description: 'Nombre exacto de la ruta (ej: Ruta Miradores)' }
      },
      required: ['vehiculo_id', 'fecha', 'hora_inicio', 'ruta']
    }
  },
  {
    name: 'crear_reserva',
    description: 'Crea la reserva en Google Sheets con estado "Pendiente de pago" y genera un folio único. Usar solo cuando el cliente haya confirmado todos los datos: vehículo, ruta, fecha, hora y nombre.',
    input_schema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nombre completo del cliente' },
        telefono: { type: 'string', description: 'Número de WhatsApp del cliente (solo dígitos, sin @)' },
        vehiculo_id: { type: 'string', description: 'ID del vehículo seleccionado' },
        vehiculo_nombre: { type: 'string', description: 'Nombre del vehículo (ej: Defender, Maverick X3)' },
        ruta: { type: 'string', description: 'Nombre de la ruta seleccionada' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        hora_inicio: { type: 'number', description: 'Hora de inicio en formato decimal' },
        precio: { type: 'number', description: 'Precio total en pesos MXN' },
        personas: { type: 'number', description: 'Total de personas (adultos + niños)' }
      },
      required: ['cliente', 'telefono', 'vehiculo_id', 'vehiculo_nombre', 'ruta', 'fecha', 'hora_inicio', 'precio', 'personas']
    }
  }
];

// ══════════════════════════════════════════════════════════
// EJECUTAR HERRAMIENTAS
// ══════════════════════════════════════════════════════════
async function executeTool(toolName, input, phone) {
  switch (toolName) {

    case 'obtener_vehiculos_para_grupo': {
      const { adultos, ninos } = input;

      if (adultos > 6) {
        return { error: 'El máximo es 6 adultos por vehículo. Para grupos más grandes se pueden contratar múltiples unidades.' };
      }

      const compatibles = VEHICULOS.filter(v =>
        v.capacidadAdultos >= adultos && v.capacidadNinos >= (ninos || 0)
      );

      // Agrupar por nombre para no mostrar duplicados
      const vistos = new Set();
      const unicos = compatibles.filter(v => {
        const clave = v.nombre;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });

      return {
        vehiculos: unicos.map(v => ({
          id: v.id,
          nombre: v.nombre,
          emoji: v.emoji,
          capacidad: `${v.capacidadAdultos} adultos${v.capacidadNinos > 0 ? ` + ${v.capacidadNinos} niños` : ''}`,
          descripcion: v.descripcion,
          precios: v.rutas
        }))
      };
    }

    case 'verificar_disponibilidad': {
      const { vehiculo_id, fecha, hora_inicio, ruta } = input;
      const vehiculo = VEHICULOS.find(v => v.id === vehiculo_id);

      if (!vehiculo) {
        return { disponible: false, error: 'Vehículo no encontrado' };
      }

      const duracion = RUTAS[ruta]?.duracion || 2;
      const disponible = await checkAvailability(fecha, vehiculo_id, hora_inicio, duracion);

      if (!disponible) {
        // Buscar unidad alternativa del mismo modelo
        const mismoModelo = VEHICULOS.filter(v => v.nombre === vehiculo.nombre && v.id !== vehiculo_id);
        const alternativas = [];
        for (const alt of mismoModelo) {
          const altDisp = await checkAvailability(fecha, alt.id, hora_inicio, duracion);
          if (altDisp) alternativas.push(alt.id);
        }

        return {
          disponible: false,
          vehiculo_solicitado: vehiculo_id,
          alternativas_mismo_modelo: alternativas,
          mensaje: alternativas.length > 0
            ? `El ${vehiculo_id} no está disponible, pero hay otra unidad de ${vehiculo.nombre} disponible.`
            : `El ${vehiculo.nombre} no está disponible en ese horario. Considera otro horario u otro vehículo.`
        };
      }

      return { disponible: true, vehiculo_id, fecha, hora_inicio, ruta, duracion };
    }

    case 'crear_reserva': {
      try {
        const folio = await createBooking({
          fecha: input.fecha,
          cliente: input.cliente,
          telefono: input.telefono,
          vehiculoId: input.vehiculo_id,
          vehiculoNombre: input.vehiculo_nombre,
          ruta: input.ruta,
          horaInicio: input.hora_inicio,
          precio: input.precio,
          personas: input.personas
        });

        // Guardar folio en sesión
        const session = getSession(phone);
        session.draft = { folio, ...input };

        return {
          success: true,
          folio,
          mensaje: `Reserva creada con folio ${folio}`
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    default:
      return { error: `Herramienta desconocida: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════
// PROMPT DEL SISTEMA
// ══════════════════════════════════════════════════════════
function buildSystemPrompt() {
  return `Eres el asistente virtual de *Axilitla 4x4*, la empresa de aventuras en vehículos off-road más emocionante de Xilitla, San Luis Potosí, México. 🌿🏔️🏎️

Tu misión es VENDER recorridos y hacer que el cliente SIENTA la emoción de la aventura antes incluso de subirte al vehículo. Eres apasionado, entusiasta y conoces Xilitla de memoria.

━━━━━━━━━━━━━━━━━━━━━━━━
🗺️ NUESTRAS RUTAS
━━━━━━━━━━━━━━━━━━━━━━━━

🌿 *Ruta Nanacatli* — 2 horas
${RUTAS['Ruta Nanacatli'].descripcion}

🏔️ *Ruta Miradores* — 3 horas
${RUTAS['Ruta Miradores'].descripcion}

💧 *Ruta Nacimiento* — 4 horas
${RUTAS['Ruta Nacimiento'].descripcion}

⛪ *Ruta Trinidad* — 4 horas
${RUTAS['Ruta Trinidad'].descripcion}

━━━━━━━━━━━━━━━━━━━━━━━━
🏎️ NUESTRA FLOTA (13 vehículos)
━━━━━━━━━━━━━━━━━━━━━━━━

• 🏎️ *RZR 500* — hasta 2 adultos + 1 niño — El deportivo ágil
• 💪 *RZR 900* — hasta 4 adultos — Potencia doble
• 🔥 *Can-Am 800* — hasta 2 adultos — La bestia canadiense
• 👨‍👩‍👧‍👦 *Defender Familiar* — hasta 6 adultos + 2 niños — El más grande
• 🛡️ *Defender* — hasta 6 adultos — Robusto y confiable (5 unidades)
• ⭐ *Polaris Pro S* — hasta 4 adultos — La experiencia premium (2 unidades)
• 🚀 *Maverick X3* — hasta 4 adultos — El más rápido (2 unidades)

━━━━━━━━━━━━━━━━━━━━━━━━
💰 FORMAS DE PAGO
━━━━━━━━━━━━━━━━━━━━━━━━

*Transferencia / Depósito bancario:*
• Banco: ${DATOS_BANCO.banco}
• Titular: ${DATOS_BANCO.titular}
• Cuenta: ${DATOS_BANCO.cuenta}
• CLABE: ${DATOS_BANCO.clabe}
• Concepto: Tu número de folio (ej: AX-007)

Una vez hecho el pago, el cliente envía el comprobante por este mismo chat.

━━━━━━━━━━━━━━━━━━━━━━━━
📋 FLUJO DE RESERVA (SIGUE ESTE ORDEN)
━━━━━━━━━━━━━━━━━━━━━━━━

1. Saluda con emoción. Pregunta: ¿cuántos son? (adultos y niños)
2. Usa la herramienta para mostrar vehículos compatibles
3. Describe las rutas con entusiasmo, menciona precios
4. Cuando el cliente elija, pregunta: ¿qué fecha y a qué hora?
5. Verifica disponibilidad con la herramienta (SIEMPRE verifica)
6. Pide el nombre completo del cliente
7. Crea la reserva con la herramienta correspondiente
8. Envía el folio + instrucciones de pago
9. Pide que manden el comprobante por este chat
10. Una vez que el dueño recibe el comprobante, confirma manualmente

━━━━━━━━━━━━━━━━━━━━━━━━
🎯 REGLAS IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━

• Usa *negritas* como en WhatsApp, no markdown estándar
• Responde SIEMPRE en español, de forma cálida y natural
• Si el cliente duda por precio, dí: "Esta experiencia no la encuentras en ningún otro lado, y el recuerdo te va a durar toda la vida"
• Siempre empuja hacia una fecha concreta: "¿Qué tal este fin de semana?"
• Si no hay disponibilidad, ofrece alternativas de horario o vehículo
• NUNCA inventes disponibilidad. Usa siempre la herramienta de verificación
• Mantén la conversación corta y directa, como en WhatsApp
• Una vez que crees la reserva, siempre menciona el folio en cada mensaje
• No uses emojis en exceso, solo donde den impacto`;
}

// ══════════════════════════════════════════════════════════
// PROCESAR MENSAJE
// ══════════════════════════════════════════════════════════
async function processMessage(phone, message) {
  const session = getSession(phone);

  session.history.push({ role: 'user', content: message });

  // Mantener historial manejable (últimos 30 mensajes)
  if (session.history.length > 30) {
    session.history = session.history.slice(-30);
  }

  let response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: buildSystemPrompt(),
    tools,
    messages: session.history
  });

  // Loop agéntico: ejecutar herramientas mientras sean necesarias
  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content;
    session.history.push({ role: 'assistant', content: assistantContent });

    const toolResults = [];
    for (const block of assistantContent) {
      if (block.type === 'tool_use') {
        console.log(`🔧 Usando herramienta: ${block.name}`, JSON.stringify(block.input));
        const result = await executeTool(block.name, block.input, phone);
        console.log(`✅ Resultado:`, JSON.stringify(result));

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result)
        });
      }
    }

    session.history.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools,
      messages: session.history
    });
  }

  // Extraer texto de respuesta
  const textBlock = response.content.find(b => b.type === 'text');
  const replyText = textBlock?.text || 'Lo siento, hubo un problema. Por favor escribe de nuevo 🙏';

  session.history.push({ role: 'assistant', content: response.content });

  return replyText;
}

module.exports = { processMessage, getSession, clearSession };
