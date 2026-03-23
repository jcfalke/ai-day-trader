import { useState, useRef, useEffect } from "react";

const ACCENT = "#00C6A7";
const DARK = "#0A1628";
const MID = "#112240";

const TOPICS = [
  { id: "beneficios", label: "Beneficios de la Póliza", icon: "📋" },
  { id: "idcard", label: "ID Card", icon: "🪪" },
  { id: "doctores", label: "Buscar Doctores", icon: "🔍" },
  { id: "pagos", label: "Pagos de Prima", icon: "💳" },
  { id: "citas", label: "Agendar Cita Médica", icon: "📅" },
  { id: "cambio", label: "Cambio de Doctor", icon: "🔄" },
];

const CHANNEL_ICONS = { whatsapp: "💬", llamada: "📞", email: "✉️", sms: "📱" };

const FLOWS = {
  beneficios: [
    { from: "bot", text: "¡Con gusto! Para consultar los beneficios de tu póliza necesito verificar tu identidad. ¿Puedes proporcionarme tu número de póliza o ID de miembro?" },
    { from: "bot", text: "Tu plan incluye: consultas médicas, emergencias, hospitalización, medicamentos de formulario y servicios preventivos. ¿Deseas información detallada de algún beneficio?" },
  ],
  idcard: [
    { from: "bot", text: "Puedo ayudarte con tu ID Card. ¿Necesitas una copia digital o física?" },
    { from: "bot", text: "Te enviaré tu ID Card al correo registrado en los próximos minutos. ¿Hay algo más en que pueda ayudarte?" },
  ],
  doctores: [
    { from: "bot", text: "Para buscar doctores en tu red, ¿puedes indicarme tu código postal o ciudad?" },
    { from: "bot", text: "¿Qué especialidad necesitas? (Médico general, cardiólogo, pediatra, etc.)" },
    { from: "bot", text: "Encontré 12 médicos en tu área. Te envío el enlace al directorio. ¿Lo prefieres?" },
  ],
  pagos: [
    { from: "bot", text: "Para asistirte con tu pago de prima, ¿cuál es tu número de póliza?" },
    { from: "bot", text: "Tu próximo pago es de $280.00 con vencimiento el 1 de abril. ¿Deseas pagar ahora o configurar autopago?" },
  ],
  citas: [
    { from: "bot", text: "¿Con qué tipo de especialista necesitas la cita?" },
    { from: "bot", text: "¿Tienes preferencia de fecha u horario?" },
    { from: "bot", text: "Tenemos disponibilidad el martes 25 a las 10:00 AM y el jueves 27 a las 2:00 PM. ¿Cuál prefieres?" },
    { from: "bot", text: "¡Cita confirmada! Recibirás un recordatorio 24 horas antes. ¿Necesitas algo más?" },
  ],
  cambio: [
    { from: "bot", text: "¿Tienes en mente algún doctor específico o necesitas buscar opciones en tu red?" },
    { from: "bot", text: "Para procesar el cambio necesito tu número de póliza y el nombre del nuevo médico." },
    { from: "bot", text: "¡Listo! Tu cambio de médico primario será efectivo el primer día del próximo mes. ¿Te puedo ayudar en algo más?" },
  ],
};

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: MID, borderRadius: 18, width: "fit-content", marginBottom: 8 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isBot = msg.from === "bot";
  return (
    <div style={{ display: "flex", justifyContent: isBot ? "flex-start" : "flex-end", marginBottom: 10, animation: "fadeUp 0.3s ease" }}>
      {isBot && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}, #007B6E)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0, marginTop: 2 }}>🤖</div>
      )}
      <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: isBot ? "4px 18px 18px 18px" : "18px 4px 18px 18px", background: isBot ? MID : `linear-gradient(135deg, ${ACCENT}, #007B6E)`, color: "#fff", fontSize: 14, lineHeight: 1.5 }}>
        {msg.text}
      </div>
    </div>
  );
}

export default function App() {
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [flowKey, setFlowKey] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const addBotMessage = (text, delay = 800) => new Promise(res => {
    setTyping(true);
    setTimeout(() => { setTyping(false); setMessages(m => [...m, { from: "bot", text }]); res(); }, delay);
  });

  const startChat = async (ch) => {
    setChannel(ch);
    setStarted(true);
    await addBotMessage("¡Hola! 👋 Soy el asistente virtual de Calalo's Agency.", 600);
    await addBotMessage("¿En qué puedo ayudarte hoy?", 1000);
    setShowTopics(true);
  };

  const goToMenu = async () => {
    setFlowKey(null);
    setFlowStep(0);
    setShowTopics(true);
    await addBotMessage("¿En qué más puedo ayudarte? 👇", 400);
  };

  const goToChannels = () => {
    setStarted(false);
    setChannel(null);
    setMessages([]);
    setFlowKey(null);
    setFlowStep(0);
    setShowTopics(false);
  };

  const handleTopic = async (topic) => {
    setShowTopics(false);
    setFlowKey(topic.id);
    setFlowStep(0);
    setMessages(m => [...m, { from: "user", text: `${topic.icon} ${topic.label}` }]);
    const flow = FLOWS[topic.id];
    if (flow?.[0]) {
      await addBotMessage(flow[0].text);
      if (flow.length === 1) setTimeout(() => setShowTopics(true), 400);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { from: "user", text: userMsg }]);
    if (flowKey && FLOWS[flowKey]) {
      const flow = FLOWS[flowKey];
      const nextStep = flowStep + 1;
      if (nextStep < flow.length) {
        setFlowStep(nextStep);
        await addBotMessage(flow[nextStep].text);
        if (nextStep === flow.length - 1) setTimeout(() => setShowTopics(true), 600);
      } else {
        await addBotMessage("¿Hay algo más en que pueda ayudarte?");
        setShowTopics(true); setFlowKey(null); setFlowStep(0);
      }
    } else {
      await addBotMessage("¿Hay algo más en que pueda ayudarte?");
      setShowTopics(true);
    }
  };

  const btnStyle = (color = ACCENT) => ({
    background: "transparent",
    border: `1px solid ${color}40`,
    borderRadius: 20,
    padding: "7px 14px",
    color: color,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    gap: 5,
    transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        input::placeholder { color: #4a6a8a; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, background: "#0D1F38", borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", height: "92vh", maxHeight: 780 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${DARK}, #112240)`, padding: "20px 20px 16px", borderBottom: `1px solid rgba(0,198,167,0.15)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #007B6E)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏥</div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#fff", fontSize: 16 }}>Calalo's Agency</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, animation: "pulse 2s infinite" }} />
                <span style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}>En línea · Tiempo real</span>
              </div>
            </div>
            {channel && <div style={{ marginLeft: "auto", fontSize: 20 }}>{CHANNEL_ICONS[channel]}</div>}
          </div>
        </div>

        {!started ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#fff", fontSize: 20, textAlign: "center", marginBottom: 6 }}>Calalo's Agency</div>
            <div style={{ color: "#6B8FA8", fontSize: 13, textAlign: "center", marginBottom: 28 }}>Atención inmediata para tus clientes en todos los canales</div>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 14, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Simular canal de entrada</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              {[{ id: "whatsapp", label: "WhatsApp", icon: "💬" }, { id: "llamada", label: "Llamada", icon: "📞" }, { id: "email", label: "Email", icon: "✉️" }, { id: "sms", label: "SMS", icon: "📱" }].map(ch => (
                <button key={ch.id} onClick={() => startChat(ch.id)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 12px", cursor: "pointer", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.2s", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,198,167,0.1)"; e.currentTarget.style.borderColor = ACCENT; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                  <span style={{ fontSize: 26 }}>{ch.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{ch.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
              {messages.map((msg, i) => <Message key={i} msg={msg} />)}
              {typing && <TypingIndicator />}

              {!typing && (
                <div style={{ marginTop: 4 }}>
                  {showTopics ? (
                    <>
                      <div style={{ color: "#4a6a8a", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Selecciona una opción:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {TOPICS.map(t => (
                          <button key={t.id} onClick={() => handleTopic(t)} style={{ background: "rgba(0,198,167,0.06)", border: "1px solid rgba(0,198,167,0.2)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s", fontFamily: "inherit" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,198,167,0.15)"; e.currentTarget.style.borderColor = ACCENT; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,198,167,0.06)"; e.currentTarget.style.borderColor = "rgba(0,198,167,0.2)"; }}>
                            <span style={{ fontSize: 16 }}>{t.icon}</span>
                            <span>{t.label}</span>
                            <span style={{ marginLeft: "auto", color: ACCENT }}>›</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={goToChannels} style={{ ...btnStyle("#6B8FA8"), marginTop: 12 }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(107,143,168,0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        ← Cambiar canal de entrada
                      </button>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                      <button onClick={goToMenu} style={btnStyle(ACCENT)}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,198,167,0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        🏠 Volver al Menú Principal
                      </button>
                      <button onClick={goToChannels} style={btnStyle("#6B8FA8")}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(107,143,168,0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        ← Cambiar canal de entrada
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, background: "#0A1628" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Escribe tu mensaje..." style={{ flex: 1, background: MID, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "10px 16px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = ACCENT}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
              <button onClick={handleSend} style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}, #007B6E)`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
