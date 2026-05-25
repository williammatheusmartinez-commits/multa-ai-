"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ── Configurações ─────────────────────────────────────────────
const FORMSPREE_ID = "xaqkjrwv";
const WHATSAPP_NUMBER = "13153640044"; // +1 315-364-0044

// ── Cores ─────────────────────────────────────────────────────
const C = {
  white:"#ffffff", offWhite:"#f7faf7", surface:"#eef5ee",
  green900:"#064e3b", green800:"#065f46", green700:"#047857",
  green600:"#059669", green500:"#10b981", green400:"#34d399",
  green200:"#a7f3d0", green100:"#d1fae5", green50:"#ecfdf5",
  glow:"rgba(16,185,129,0.18)", glowStrong:"rgba(16,185,129,0.30)",
  border:"#c6dfc6", text:"#0f2e1f", textMid:"#2d5a3d",
  textMuted:"#5a8a6a", textLight:"#8ab89a",
  danger:"#dc2626", dangerSoft:"#fef2f2",
  gold:"#b45309", goldBg:"#fffbeb", goldBorder:"#fcd34d",
};

// ── Planos ────────────────────────────────────────────────────
const PLANOS = [
  {
    id:"essencial", icon:"🤖", titulo:"IA Essencial", preco:"R$ 69,90", precoNum:69.90,
    cor:C.green600, badge:null, destaque:false,
    itens:["Elaboração automática via IA","Download do recurso em PDF","Sem revisão humana","Sem assinatura de advogado"],
    confirmacao:"Plano confirmado! Seu recurso está disponível abaixo.",
    liberaPDF:true,
  },
  {
    id:"juridico", icon:"⚖️", titulo:"Revisão Jurídica", preco:"R$ 199,00", precoNum:199.00,
    cor:C.green700, badge:"RECOMENDADO", destaque:true,
    itens:["Elaboração via IA","Revisão técnica por advogado","Assinatura digital OAB","Retorno em até 24h úteis","1 rodada de ajustes inclusa"],
    confirmacao:"O advogado revisará e retornará em até 24h com o documento assinado.",
    liberaPDF:false,
  },
];
const PLANOS_MAP = Object.fromEntries(PLANOS.map(p => [p.id, p]));

// ── Disclaimer ────────────────────────────────────────────────
const DISCLAIMER = `DISCLAIMER — OBRIGAÇÃO DE MEIO

A plataforma atua como ferramenta de apoio à elaboração e protocolo de recursos administrativos de trânsito, caracterizando obrigação de meio, e não de resultado.

Dessa forma, a plataforma, seus fundadores, colaboradores, parceiros, profissionais e advogados vinculados não garantem o deferimento, cancelamento de autuação, suspensão de penalidade ou qualquer resultado específico perante órgãos de trânsito, JARI, CETRAN ou autoridades competentes.

A análise e julgamento dos recursos administrativos dependem exclusivamente do entendimento da autoridade competente, podendo variar conforme o caso concreto, legislação aplicável e critérios administrativos adotados.

O usuário declara estar ciente de que a utilização da plataforma não constitui garantia de êxito no procedimento administrativo.`;

// ── Dicas de legislação ───────────────────────────────────────
const TIPS = [
  { art:"Art. 283 CTB", tip:"O recurso de 1ª instância deve ser apresentado em até 30 dias após a notificação da autuação." },
  { art:"Art. 281 CTB", tip:"A autuação é nula se o agente não identificar o condutor infrator ou o proprietário no ato." },
  { art:"Res. 619/2016 CONTRAN", tip:"A notificação por edital só é válida após esgotados os meios de localização do autuado." },
  { art:"Art. 280 CTB", tip:"O auto de infração deve conter: tipificação, local, data, hora, código e identificação do veículo." },
  { art:"Art. 265 CTB", tip:"A suspensão da CNH exige processo administrativo com ampla defesa antes da penalidade." },
  { art:"Art. 282 §4 CTB", tip:"A penalidade de multa deve ser notificada em até 30 dias após a lavratura do auto." },
  { art:"Súmula 312 STJ", tip:"No processo por infração de trânsito, é obrigatória a indicação do condutor no recurso." },
  { art:"Art. 256 CTB", tip:"Penalidades: multa, suspensão, apreensão do veículo, cassação da CNH e curso de reciclagem." },
];

// ── Supabase Client ───────────────────────────────────────────
// Configure as variáveis no .env.local e na Vercel:
// NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseHeaders = { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` };

async function sbFetch(path, opts = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...opts, headers: { ...supabaseHeaders, ...(opts.headers || {}) } });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch { return null; }
}

// ── DB com Supabase + fallback localStorage ───────────────────
const DB_KEY = "multaai_v5_users";
const SESSION_KEY = "multaai_v5_session";
const ADV = { nome:"Dr. Ricardo Souza", senha:"adv123", historico:[], isAdv:true, perfil:{}, veiculos:[] };

const DB = {
  _cache: null,
  _useSupabase: () => !!(SUPABASE_URL && SUPABASE_ANON_KEY),

  // ── Carrega do localStorage (fallback) ──
  _load() {
    if (this._cache) return this._cache;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DB_KEY) : null;
      const s = raw ? JSON.parse(raw) : {};
      if (!s["advogado@multa.ai"]) s["advogado@multa.ai"] = { ...ADV };
      this._cache = s; return s;
    } catch { this._cache = { "advogado@multa.ai": { ...ADV } }; return this._cache; }
  },
  _save(s) { this._cache = s; try { if (typeof window !== "undefined") localStorage.setItem(DB_KEY, JSON.stringify(s)); } catch {} },

  // ── Supabase: buscar usuário ──
  async getAsync(email) {
    // Advogado padrão: sempre do localStorage (não precisa de Supabase)
    if (email === "advogado@multa.ai") {
      return this.get(email);
    }
    if (this._useSupabase()) {
      const rows = await sbFetch(`/usuarios?email=eq.${encodeURIComponent(email)}&limit=1`, { method: "GET" });
      if (rows && rows.length > 0) {
        const u = rows[0];
        return { nome: u.nome, senha: u.senha, email: u.email, historico: u.historico || [], isAdv: u.is_adv || false, perfil: u.perfil || {}, veiculos: u.veiculos || [] };
      }
      // Não encontrou no Supabase, tenta localStorage como fallback
      return this.get(email);
    }
    return this.get(email);
  },

  // ── Supabase: criar usuário ──
  async setAsync(email, dados) {
    if (this._useSupabase()) {
      await sbFetch(`/usuarios`, {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ email, nome: dados.nome, senha: dados.senha, historico: dados.historico || [], is_adv: dados.isAdv || false, perfil: dados.perfil || {}, veiculos: dados.veiculos || [] })
      });
    }
    // Sempre salva também no localStorage como backup
    this.set(email, dados);
  },

  // ── Supabase: atualizar usuário ──
  async updateAsync(email, patch) {
    if (this._useSupabase()) {
      const campos = {};
      if (patch.nome !== undefined) campos.nome = patch.nome;
      if (patch.perfil !== undefined) campos.perfil = patch.perfil;
      if (patch.veiculos !== undefined) campos.veiculos = patch.veiculos;
      if (patch.historico !== undefined) campos.historico = patch.historico;
      if (Object.keys(campos).length > 0) {
        await sbFetch(`/usuarios?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(campos) });
      }
    }
    this.update(email, patch);
  },

  // ── Supabase: adicionar ao histórico ──
  async addHistoricoAsync(email, entry) {
    if (this._useSupabase()) {
      const rows = await sbFetch(`/usuarios?email=eq.${encodeURIComponent(email)}&select=historico&limit=1`, { method: "GET" });
      const hist = rows?.[0]?.historico || [];
      const novoHist = [entry, ...hist];
      await sbFetch(`/usuarios?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify({ historico: novoHist }) });
    }
    this.addHistorico(email, entry);
  },

  // ── Supabase: atualizar item do histórico ──
  async updateHistoricoAsync(email, id, patch) {
    if (this._useSupabase()) {
      const rows = await sbFetch(`/usuarios?email=eq.${encodeURIComponent(email)}&select=historico&limit=1`, { method: "GET" });
      const hist = (rows?.[0]?.historico || []).map(h => h.id === id ? { ...h, ...patch } : h);
      await sbFetch(`/usuarios?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify({ historico: hist }) });
    }
    this.updateHistorico(email, id, patch);
  },

  // ── Métodos síncronos localStorage (fallback) ──
  get(e) { return this._load()[e] || null; },
  set(e, d) { const s = this._load(); s[e] = d; this._save(s); },
  update(e, p) { const s = this._load(); if (s[e]) { s[e] = { ...s[e], ...p }; this._save(s); } },
  addHistorico(e, entry) { const s = this._load(); if (!s[e]) return; s[e].historico = [entry, ...(s[e].historico || [])]; this._save(s); },
  updateHistorico(e, id, p) { const s = this._load(); if (!s[e]) return; s[e].historico = s[e].historico.map(h => h.id === id ? { ...h, ...p } : h); this._save(s); },
  getAllCasos() {
    const s = this._load(); const l = [];
    Object.entries(s).forEach(([email, u]) => { if (u.isAdv) return; (u.historico || []).forEach(h => { if (h.planoPago) l.push({ ...h, clienteEmail: email, clienteNome: u.nome }); }); });
    return l;
  },
};

// ── Helpers ───────────────────────────────────────────────────
async function enviarFormspree(dados) {
  try { await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(dados) }); } catch {}
}
const useIsMobile = () => { const [m, setM] = useState(false); useEffect(() => { const f = () => setM(window.innerWidth < 768); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []); return m; };
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return iso; } };
const VEICULO_VAZIO = { placa: "", modelo: "", ano: "", cor: "", renavam: "" };

// ── Logo ──────────────────────────────────────────────────────
function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="21" fill={C.green50} stroke={C.green400} strokeWidth="1.2" />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <line key={i} x1="22" y1="22" x2={22 + 18 * Math.cos(deg * Math.PI / 180)} y2={22 + 18 * Math.sin(deg * Math.PI / 180)} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.5" strokeLinecap="round" />
      ))}
      <circle cx="22" cy="22" r="13" fill={C.green500} /><circle cx="22" cy="22" r="11" fill={C.green600} />
      <path d="M22 12 L28 15 L28 23 C28 27 22 30 22 30 C20 30 16 27 16 23 L16 15 Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18.5 22 L21 24.5 L25.5 19.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ label = "Aguarde..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" }}>
      <div style={{ position: "relative", width: 56, height: 56 }}>
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ animation: "spin 1.1s linear infinite", position: "absolute" }}>
          <circle cx="28" cy="28" r="24" stroke={C.green100} strokeWidth="4" fill="none" />
          <path d="M28 4 A24 24 0 0 1 52 28" stroke={C.green500} strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Logo size={30} /></div>
      </div>
      <div style={{ textAlign: "center", color: C.textMuted, fontSize: 14 }}>{label}</div>
    </div>
  );
}

// ── PDF Modal ─────────────────────────────────────────────────
function PDFModal({ recurso, dados, historico_penalidade, perfil, userName, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>📄 Recurso Administrativo</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigator.clipboard.writeText(recurso)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Copiar</button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "24px 32px", flex: 1 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 13, lineHeight: 1.9, color: "#1a1a1a" }}>
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `2px solid ${C.green500}`, paddingBottom: 14, marginBottom: 24 }}>
              RECURSO ADMINISTRATIVO DE TRÂNSITO
            </div>
            {perfil && (perfil.nome || perfil.cpf) && (
              <div style={{ background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 8, padding: 16, marginBottom: 20, fontSize: 12 }}>
                <strong style={{ color: C.green800 }}>QUALIFICAÇÃO DO RECORRENTE</strong><br />
                {perfil.nome && <span>Nome: {perfil.nome}<br /></span>}
                {perfil.cpf && <span>CPF: {perfil.cpf}<br /></span>}
                {perfil.rg && <span>RG: {perfil.rg}<br /></span>}
                {perfil.endereco && <span>Endereço: {perfil.endereco}<br /></span>}
                {perfil.email && <span>E-mail: {perfil.email}<br /></span>}
                {perfil.telefone && <span>Telefone: {perfil.telefone}</span>}
              </div>
            )}
            {dados && (
              <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 8, padding: 16, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                {Object.entries(dados).filter(([, v]) => v && v !== "N/A" && v !== "—").map(([k, v]) => (
                  <div key={k}><strong style={{ color: C.green800 }}>{k.replace(/_/g, " ").toUpperCase()}:</strong> {v}</div>
                ))}
              </div>
            )}
            {historico_penalidade && (
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 12 }}>
                <strong style={{ color: "#92400e" }}>HISTÓRICO RELATADO PELO CLIENTE:</strong><br />{historico_penalidade}
              </div>
            )}
            {(recurso || "").split("\n").map((l, i) => <p key={i} style={{ marginBottom: l.trim() ? 8 : 4 }}>{l || "\u00A0"}</p>)}
            <div style={{ marginTop: 40, paddingTop: 14, borderTop: "1px solid #ddd", fontSize: 10, color: "#888", textAlign: "center", lineHeight: 1.7 }}>
              Gerado por Multa.AI · {new Date().toLocaleDateString("pt-BR")} · {userName || "Usuário"}<br />
              Obrigação de meio, não de resultado.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Disclaimer Modal ──────────────────────────────────────────
function DisclaimerModal({ onAceitar, onRecusar }) {
  const [chegouFinal, setChegouFinal] = useState(false);
  const [aceito, setAceito] = useState(false);
  const scrollRef = useRef(null);

  // Verifica scroll ao montar (conteúdo curto pode já estar no final)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setChegouFinal(true);
    };
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg,${C.green900},${C.green800})`, padding: "18px 24px", flexShrink: 0 }}>
          <div style={{ color: C.green400, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>TERMOS DE USO</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Leia antes de continuar</div>
          {!chegouFinal && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>⬇ Role até o final para habilitar o aceite</div>}
        </div>
        <div ref={scrollRef} style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.9, whiteSpace: "pre-wrap", fontFamily: "Georgia,serif" }}>{DISCLAIMER}</div>
          <div style={{ height: 30 }} />
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, flexShrink: 0, background: C.white }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: chegouFinal ? "pointer" : "default", opacity: chegouFinal ? 1 : 0.45 }}
            onClick={() => chegouFinal && setAceito(a => !a)}>
            <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${aceito ? C.green500 : C.border}`, background: aceito ? C.green500 : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
              {aceito && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: chegouFinal ? C.text : C.textMuted }}>
              {chegouFinal ? "Li e estou ciente dos termos acima" : "Role até o final para habilitar"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onRecusar} style={{ padding: "11px 20px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Recusar</button>
            <button onClick={() => aceito && onAceitar()} disabled={!aceito}
              style={{ flex: 1, padding: "12px", borderRadius: 9, border: "none", background: aceito ? `linear-gradient(135deg,${C.green700},${C.green500})` : C.surface, color: aceito ? "#fff" : C.textLight, fontSize: 13, fontWeight: 700, cursor: aceito ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all 0.2s" }}>
              Aceitar e gerar recurso →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pagamento Modal — PIX via Mercado Pago ────────────────────
function PagamentoModal({ plano, onClose, onSuccess, dadosCliente = {}, dadosMulta = {}, historico_penalidade = "" }) {
  const info = PLANOS_MAP[plano] || { titulo: plano, preco: "", precoNum: 0 };
  const [fase, setFase] = useState("gerando");
  const [pixData, setPixData] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [erroMsg, setErroMsg] = useState("");
  const poolRef = useRef(null);

  useEffect(() => {
    gerarPix();
    return () => { if (poolRef.current) clearInterval(poolRef.current); };
  }, []);

  const gerarPix = async () => {
    setFase("gerando");
    try {
      const res = await fetch("/api/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano: info.titulo,
          email: dadosCliente.email || "cliente@multa.ai",
          nome: dadosCliente.nome || "Cliente",
          valor: info.precoNum || 69.90,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar PIX");
      setPixData(data);
      setFase("aguardando");
      iniciarVerificacao(data.id);
    } catch (e) {
      setErroMsg(e.message);
      setFase("erro");
    }
  };

  const iniciarVerificacao = (id) => {
    poolRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pix?id=${id}`);
        const data = await res.json();
        if (data.status === "approved") {
          clearInterval(poolRef.current);
          setFase("confirmado");
          await enviarFormspree({
            _subject: `✅ PIX confirmado — ${info.titulo} (${info.preco})`,
            "Plano": info.titulo, "Valor": info.preco, "Método": "PIX Mercado Pago",
            "Payment ID": id, "Data": new Date().toLocaleString("pt-BR"),
            "Nome": dadosCliente.nome || "—", "E-mail": dadosCliente.email || "—",
            "Auto": dadosMulta?.numero_auto || "—", "Infração": dadosMulta?.descricao_infracao || "—",
          });
          setTimeout(onSuccess, 2500);
        }
      } catch {}
    }, 3000);
  };

  const copiarPix = () => {
    if (pixData?.qr_code) { navigator.clipboard.writeText(pixData.qr_code); setCopiado(true); setTimeout(() => setCopiado(false), 3000); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 18, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}>{info.titulo.toUpperCase()} · PIX</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>{info.preco}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 17 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {fase === "gerando" && <Spinner label="Gerando QR Code PIX..." />}
          {fase === "aguardando" && pixData && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Escaneie o QR Code com o app do seu banco ou copie o código PIX.
              </div>
              {pixData.qr_code_base64 ? (
                <div style={{ background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 12, padding: 16, display: "inline-block", marginBottom: 16 }}>
                  <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" width={180} height={180} style={{ display: "block" }} />
                </div>
              ) : (
                <div style={{ background: C.green50, borderRadius: 12, padding: 24, marginBottom: 16, fontSize: 13, color: C.textMuted }}>Carregando QR Code...</div>
              )}
              {pixData.qr_code && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>CÓDIGO COPIA E COLA</div>
                  <div style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 10, color: C.textMid, wordBreak: "break-all", lineHeight: 1.6, marginBottom: 10, maxHeight: 60, overflow: "hidden" }}>
                    {pixData.qr_code.slice(0, 80)}...
                  </div>
                  <button onClick={copiarPix} style={{ width: "100%", padding: "12px", borderRadius: 9, border: "none", background: copiado ? C.green500 : `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                    {copiado ? "✓ Código copiado!" : "📋 Copiar código PIX"}
                  </button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "10px 14px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 9 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>Aguardando confirmação do pagamento...</span>
              </div>
              <p style={{ fontSize: 11, color: C.textLight, marginTop: 10, lineHeight: 1.6 }}>Acesso liberado automaticamente após confirmação do banco.</p>
            </div>
          )}
          {fase === "confirmado" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.green50, border: `2px solid ${C.green400}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: `0 0 0 12px ${C.glow}` }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 8 }}>Pagamento confirmado!</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>{info.confirmacao}</div>
            </div>
          )}
          {fase === "erro" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 8 }}>Não foi possível gerar o PIX</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>{erroMsg}</div>
              <button onClick={gerarPix} style={{ width: "100%", padding: "12px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Tentar novamente →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Perfil Modal ──────────────────────────────────────────────
function PerfilModal({ user, setUser, onClose }) {
  const p = user.perfil || {};
  const [form, setForm] = useState({
    nome: user.nome || "", cpf: p.cpf || "", rg: p.rg || "",
    dataNasc: p.dataNasc || "", email: user.email || "",
    telefone: p.telefone || "", cnh: p.cnh || "",
    endereco: p.endereco || "", cidade: p.cidade || "", uf: p.uf || "", cep: p.cep || "",
  });
  const [veiculos, setVeiculos] = useState(user.veiculos?.length ? user.veiculos : [{ ...VEICULO_VAZIO }]);
  const [salvo, setSalvo] = useState(false);
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const fv = (i, k, v) => setVeiculos(prev => prev.map((vv, idx) => idx === i ? { ...vv, [k]: v } : vv));
  const addVeiculo = () => { if (veiculos.length < 5) setVeiculos(prev => [...prev, { ...VEICULO_VAZIO }]); };
  const removeVeiculo = i => setVeiculos(prev => prev.filter((_, idx) => idx !== i));

  const salvar = () => {
    DB.updateAsync(user.email, { nome: form.nome, perfil: form, veiculos });
    setUser(u => ({ ...u, nome: form.nome, perfil: form, veiculos }));
    setSalvo(true);
    setTimeout(() => { setSalvo(false); onClose(); }, 1200);
  };

  const inp = (label, key, ph, full = false) => (
    <div style={{ marginBottom: 11, gridColumn: full ? "1/-1" : undefined }}>
      <label style={{ fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 600 }}>{label}</label>
      <input value={form[key]} onChange={e => f(key, e.target.value)} placeholder={ph}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, background: C.offWhite, color: C.text, outline: "none", fontFamily: "inherit" }}
        onFocus={e => e.target.style.borderColor = C.green500} onBlur={e => e.target.style.borderColor = C.border} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>👤 Meu Perfil</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 17 }}>×</button>
        </div>
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {/* Dados pessoais */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Dados Pessoais</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ gridColumn: "1/-1" }}>{inp("Nome completo *", "nome", "João da Silva", true)}</div>
            {inp("CPF", "cpf", "000.000.000-00")}
            {inp("RG", "rg", "00.000.000-0")}
            {inp("Data de nascimento", "dataNasc", "DD/MM/AAAA")}
            {inp("Número da CNH", "cnh", "00000000000")}
            {inp("Telefone / WhatsApp", "telefone", "(11) 99999-9999")}
            {inp("CEP", "cep", "00000-000")}
            <div style={{ gridColumn: "1/-1" }}>{inp("Endereço completo", "endereco", "Rua, nº, Bairro", true)}</div>
            {inp("Cidade", "cidade", "São Paulo")}
            {inp("UF", "uf", "SP")}
          </div>

          {/* Veículos */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Veículos ({veiculos.length}/5)</span>
            {veiculos.length < 5 && (
              <button onClick={addVeiculo} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${C.green500}`, background: C.green50, color: C.green700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>+ Adicionar</button>
            )}
          </div>
          {veiculos.map((v, i) => (
            <div key={i} style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 14px 10px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>Veículo {i + 1}</span>
                {veiculos.length > 1 && <button onClick={() => removeVeiculo(i)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 13 }}>Remover</button>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["Placa", "placa", "ABC-1234"], ["Modelo/Marca", "modelo", "Honda Civic"], ["Ano", "ano", "2020"], ["Cor", "cor", "Prata"], ["RENAVAM", "renavam", "00000000000"]].map(([label, key, ph]) => (
                  <div key={key} style={{ gridColumn: key === "renavam" ? "1/-1" : undefined }}>
                    <label style={{ fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 600 }}>{label}</label>
                    <input value={v[key] || ""} onChange={e => fv(i, key, e.target.value)} placeholder={ph}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 12, background: C.white, color: C.text, outline: "none", fontFamily: "inherit" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {salvo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 10, marginTop: 8 }}>
              <span style={{ fontSize: 18 }}>✓</span><span style={{ fontSize: 13, color: C.green700, fontWeight: 600 }}>Perfil salvo!</span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={salvar} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Salvar perfil →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auth Drawer ───────────────────────────────────────────────
function AuthDrawer({ onClose, onLogin, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1); // step 1: dados de acesso, step 2: dados pessoais + veículo
  const [nome, setNome] = useState(""); const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [cpf, setCpf] = useState(""); const [telefone, setTelefone] = useState(""); const [cnh, setCnh] = useState("");
  const [placa, setPlaca] = useState(""); const [modelo, setModelo] = useState("");
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [esqueci, setEsqueci] = useState(false); const [esqueciEmail, setEsqueciEmail] = useState(""); const [esqueciMsg, setEsqueciMsg] = useState("");

  useEffect(() => { setMode(initialMode); setErr(""); setEsqueci(false); setStep(1); }, [initialMode]);

  const submitLogin = () => {
    setErr("");
    if (!email.includes("@")) { setErr("E-mail inválido."); return; }
    if (senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    setLoading(true);
    DB.getAsync(email).then(u => {
      if (!u || u.senha !== senha) { setErr("E-mail ou senha incorretos."); setLoading(false); return; }
      onLogin({ email, nome: u.nome, historico: u.historico || [], isAdv: u.isAdv || false, perfil: u.perfil || {}, veiculos: u.veiculos || [] });
    });
  };

  const submitSignupStep1 = () => {
    setErr("");
    if (!nome.trim()) { setErr("Informe seu nome."); return; }
    if (!email.includes("@")) { setErr("E-mail inválido."); return; }
    if (senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    setLoading(true);
    DB.getAsync(email).then(existing => {
      setLoading(false);
      if (existing) { setErr("E-mail já cadastrado. Faça login."); return; }
      setStep(2);
    });
  };

  const submitSignupStep2 = () => {
    setLoading(true);
    const perfil = { nome, cpf, telefone, cnh };
    const veiculos = placa ? [{ placa, modelo, ano: "", cor: "", renavam: "" }] : [];
    DB.setAsync(email, { nome, senha, historico: [], perfil, veiculos }).then(() => {
      onLogin({ email, nome, historico: [], perfil, veiculos });
    });
  };

  const recuperarSenha = () => {
    if (!esqueciEmail.includes("@")) { setEsqueciMsg("E-mail inválido."); return; }
    const u = DB.get(esqueciEmail);
    setEsqueciMsg(u ? `Sua senha cadastrada é: ${u.senha}` : "E-mail não encontrado.");
  };

  const inp = (label, val, setVal, ph, type = "text", toggle = false) => (
    <div style={{ marginBottom: 13 }}>
      <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 5, fontWeight: 600 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={toggle ? (showSenha ? "text" : "password") : type} value={val} onChange={e => setVal(e.target.value)} placeholder={ph}
          onKeyDown={e => e.key === "Enter" && (mode === "login" ? submitLogin() : step === 1 ? submitSignupStep1() : submitSignupStep2())}
          style={{ width: "100%", padding: `10px ${toggle ? "42px" : "14px"} 10px 14px`, borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.offWhite, color: C.text, outline: "none", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = C.green500} onBlur={e => e.target.style.borderColor = C.border} />
        {toggle && <button type="button" onClick={() => setShowSenha(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted, padding: 4 }}>{showSenha ? "🙈" : "👁️"}</button>}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 390, height: "100vh", background: C.white, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", animation: "slideIn 0.28s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "24px 22px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo size={30} /><span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Multa<span style={{ color: "#6ee7b7" }}>.AI</span></span></div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 17 }}>×</button>
          </div>
          {!esqueci && (
            <div style={{ display: "flex", background: "rgba(0,0,0,0.15)", borderRadius: 9, padding: 3 }}>
              {["login", "signup"].map(m => (
                <button key={m} onClick={() => { setMode(m); setErr(""); setStep(1); }} style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, borderRadius: 7, background: mode === m ? C.white : "transparent", color: mode === m ? C.green700 : "rgba(255,255,255,0.8)" }}>
                  {m === "login" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>
          )}
          {esqueci && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600 }}>🔑 Recuperar acesso</div>}
          {mode === "signup" && step === 2 && (
            <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
              {[1, 2].map(s => <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: step >= s ? C.green400 : "rgba(255,255,255,0.2)" }} />)}
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: 22, overflowY: "auto" }}>
          {esqueci ? (
            <div>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 14, lineHeight: 1.6 }}>Informe o e-mail cadastrado.</p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 5, fontWeight: 600 }}>E-mail</label>
                <input type="email" value={esqueciEmail} onChange={e => setEsqueciEmail(e.target.value)} placeholder="joao@email.com"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.offWhite, color: C.text, outline: "none", fontFamily: "inherit" }} />
              </div>
              {esqueciMsg && <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: esqueciMsg.includes("senha") ? C.green50 : C.dangerSoft, border: `1px solid ${esqueciMsg.includes("senha") ? C.green100 : "#fca5a5"}`, color: esqueciMsg.includes("senha") ? C.green700 : C.danger }}>{esqueciMsg}</div>}
              <button onClick={recuperarSenha} style={{ width: "100%", padding: "12px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>Recuperar →</button>
              <button onClick={() => { setEsqueci(false); setEsqueciMsg(""); }} style={{ width: "100%", padding: "10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Voltar ao login</button>
            </div>
          ) : mode === "login" ? (
            <>
              {inp("E-mail", email, setEmail, "joao@email.com", "email")}
              {inp("Senha", senha, setSenha, "••••••••", "password", true)}
              {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12, padding: "9px 12px", background: C.dangerSoft, borderRadius: 8, border: "1px solid #fca5a5" }}>{err}</div>}
              <button onClick={submitLogin} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Aguarde..." : "Entrar →"}
              </button>
              <button onClick={() => setEsqueci(true)} style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "transparent", color: C.green600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 8, textDecoration: "underline" }}>Esqueci minha senha</button>
            </>
          ) : step === 1 ? (
            <>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, fontWeight: 600 }}>PASSO 1 DE 2 — Dados de acesso</div>
              {inp("Nome completo *", nome, setNome, "João da Silva")}
              {inp("E-mail *", email, setEmail, "joao@email.com", "email")}
              {inp("Senha * (mín. 6 caracteres)", senha, setSenha, "••••••••", "password", true)}
              {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12, padding: "9px 12px", background: C.dangerSoft, borderRadius: 8, border: "1px solid #fca5a5" }}>{err}</div>}
              <button onClick={submitSignupStep1} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                Próximo: dados pessoais →
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, fontWeight: 600 }}>PASSO 2 DE 2 — Dados pessoais (opcional, enriquece o recurso)</div>
              {inp("CPF", cpf, setCpf, "000.000.000-00")}
              {inp("Telefone / WhatsApp", telefone, setTelefone, "(11) 99999-9999")}
              {inp("Número da CNH", cnh, setCnh, "00000000000")}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 4 }}>Veículo principal</div>
              {inp("Placa", placa, setPlaca, "ABC-1234")}
              {inp("Modelo/Marca", modelo, setModelo, "Honda Civic 2020")}
              <button onClick={submitSignupStep2} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1, marginBottom: 10 }}>
                {loading ? "Criando conta..." : "Criar minha conta →"}
              </button>
              <button onClick={() => setStep(1)} style={{ width: "100%", padding: "10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Voltar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Aba Protocolo (pós-pagamento) ─────────────────────────────
function AbaProtocolo({ dadosMulta }) {
  const isMobile = useIsMobile();
  const PASSOS = [
    {
      n: 1, icon: "📋", titulo: "Reúna os documentos",
      desc: "Antes de protocolar, tenha em mãos: auto de infração original, RG, CPF, CNH, CRLV e comprovante de endereço. Faça cópias de tudo.",
      dica: "Dica: guarde os originais e leve apenas cópias ao protocolo.",
    },
    {
      n: 2, icon: "🏛️", titulo: "Identifique o órgão autuador",
      desc: "O recurso de 1ª instância é dirigido à JARI (Junta Administrativa de Recursos de Infrações) do órgão que lavrou o auto. Verifique no auto de infração qual é o órgão autuador (CET, DETRAN, PRF, etc.).",
      dica: `${dadosMulta?.local ? `Infração registrada em: ${dadosMulta.local}` : "Verifique o órgão no auto de infração."}`,
    },
    {
      n: 3, icon: "📬", titulo: "Formas de protocolo",
      desc: "A maioria dos órgãos aceita protocolo presencial ou online. Verifique no site do órgão autuador. Muitos já possuem portal digital para envio do recurso sem precisar ir pessoalmente.",
      dica: "DETRAN SP: detran.sp.gov.br · PRF: prf.gov.br · CET SP: cetsp.com.br",
    },
    {
      n: 4, icon: "⏱️", titulo: "Atenção ao prazo",
      desc: "O prazo para apresentar o recurso de 1ª instância (JARI) é de 30 dias corridos a partir da data de notificação da autuação. Após esse prazo, não é mais possível recorrer na JARI.",
      dica: dadosMulta?.data ? `Data da infração: ${dadosMulta.data} — calcule o prazo a partir da data de notificação.` : "Art. 283 do CTB — prazo: 30 dias da notificação.",
    },
    {
      n: 5, icon: "🧾", titulo: "Guarde o protocolo",
      desc: "Ao protocolar, exija o comprovante de protocolo (número de processo ou recibo). Esse comprovante é essencial para acompanhar o andamento e comprovar que o recurso foi apresentado no prazo.",
      dica: "Sem comprovante, não há prova de que o recurso foi entregue.",
    },
    {
      n: 6, icon: "📲", titulo: "Acompanhe o resultado",
      desc: "A JARI tem prazo legal para julgar. Acompanhe pelo site ou app do órgão. Caso o recurso seja negado, ainda é possível recorrer ao CETRAN (Conselho Estadual de Trânsito) em 2ª instância.",
      dica: "Não desista: muitos recursos são deferidos em 2ª instância.",
    },
  ];
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 24px", animation: "fadeUp 0.3s ease both" }}>
      <div style={{ background: `linear-gradient(135deg,${C.green900},${C.green800})`, borderRadius: 16, padding: isMobile ? "20px" : "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        {[300, 200, 120].map((r, i) => <div key={i} style={{ position: "absolute", right: -60 + i * 20, top: "50%", transform: "translateY(-50%)", width: r, height: r, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />)}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ color: C.green400, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>PÓS-PAGAMENTO</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: isMobile ? 18 : 22, marginBottom: 8 }}>Como protocolar seu recurso</div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.7 }}>Siga o passo a passo para garantir que seu recurso seja apresentado corretamente e dentro do prazo.</p>
        </div>
      </div>
      {PASSOS.map(({ n, icon, titulo, desc, dica }) => (
        <div key={n} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 12, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.green600, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{n}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{titulo}</span>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>{desc}</p>
            <div style={{ background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 7, padding: "8px 12px", fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
              💡 {dica}
            </div>
          </div>
        </div>
      ))}
      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Quero ajuda para protocolar meu recurso de trânsito.`} target="_blank" rel="noopener noreferrer"
        style={{ background: "#dcfce7", border: "2px solid #22c55e", borderRadius: 14, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>💬</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#166534", marginBottom: 2 }}>Precisa de ajuda com o protocolo?</div>
            <div style={{ fontSize: 12, color: "#166534", opacity: 0.8 }}>Fale com um especialista pelo WhatsApp</div>
          </div>
        </div>
        <div style={{ padding: "10px 20px", borderRadius: 9, background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>Falar agora →</div>
      </a>
    </div>
  );
}

// ── Aba Documentos ────────────────────────────────────────────
function AbaDocumentos({ setView, onUploadDocs, uploadedDocs }) {
  const isMobile = useIsMobile();
  const [checados, setChecados] = useState({});
  const fileRef = useRef();
  const toggle = id => setChecados(p => ({ ...p, [id]: !p[id] }));

  const GRUPOS = [
    {
      titulo: "Documentos do Condutor / Proprietário", icon: "👤", cor: C.green700, docs: [
        { id: "cnh", label: "CNH — frente e verso", desc: "Dentro da validade.", obrig: true },
        { id: "rg", label: "RG ou documento de identidade com foto", desc: "CPF e RG, ou CNH como documento único.", obrig: true },
        { id: "cpf", label: "CPF", desc: "Caso não esteja no documento de identidade.", obrig: true },
        { id: "endereco", label: "Comprovante de endereço", desc: "Últimos 90 dias — conta de luz, água ou banco.", obrig: true },
      ]
    },
    {
      titulo: "Documentos do Veículo", icon: "🚗", cor: C.green600, docs: [
        { id: "crlv", label: "CRLV — Certificado de Registro e Licenciamento", desc: "Documento atual frente e verso.", obrig: true },
        { id: "seguro", label: "Apólice de seguro (se houver)", desc: "Pode auxiliar na comprovação.", obrig: false },
      ]
    },
    {
      titulo: "Documentos da Infração", icon: "📄", cor: C.green800, docs: [
        { id: "auto", label: "Auto de infração ou notificação de autuação", desc: "Original ou cópia.", obrig: true },
        { id: "foto_local", label: "Fotos do local da infração", desc: "Comprovam sinalização deficiente.", obrig: false },
        { id: "testemunha", label: "Declaração de testemunhas", desc: "Declaração escrita e assinada.", obrig: false },
      ]
    },
  ];

  const total = GRUPOS.reduce((a, g) => a + g.docs.length, 0);
  const totalChecados = Object.values(checados).filter(Boolean).length;
  const pct = Math.round((totalChecados / total) * 100);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 24px", animation: "fadeUp 0.3s ease both" }}>

      {/* Upload de documentos vinculado ao recurso */}
      <div style={{ background: C.white, border: `2px solid ${C.green400}`, borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>📎</span> Envie seus documentos para qualificação do recurso
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 12 }}>
          CNH, RG e comprovante de endereço serão usados para preencher automaticamente a qualificação do recorrente no recurso.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: uploadedDocs.length > 0 ? 12 : 0 }}>
          {uploadedDocs.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 7, padding: "5px 10px" }}>
              <span style={{ fontSize: 14 }}>{f.type.startsWith("image/") ? "🖼️" : "📄"}</span>
              <span style={{ fontSize: 11, color: C.green700, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => onUploadDocs(Array.from(e.target.files))} />
        <button onClick={() => fileRef.current.click()} style={{ padding: "10px 20px", borderRadius: 9, border: `1px solid ${C.green500}`, background: C.green50, color: C.green700, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {uploadedDocs.length > 0 ? `✓ ${uploadedDocs.length} arquivo(s) · Adicionar mais` : "Selecionar documentos"}
        </button>
      </div>

      {/* Checklist */}
      <div style={{ background: `linear-gradient(135deg,${C.green900},${C.green800})`, borderRadius: 16, padding: isMobile ? "20px" : "24px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        {[300, 200, 120].map((r, i) => <div key={i} style={{ position: "absolute", right: -60 + i * 20, top: "50%", transform: "translateY(-50%)", width: r, height: r, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />)}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ color: C.green400, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>CHECKLIST</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: isMobile ? 16 : 20, marginBottom: 6 }}>Documentos para protocolo</div>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 20, height: 7, overflow: "hidden", maxWidth: 360, marginBottom: 4 }}>
            <div style={{ background: C.green400, height: "100%", width: `${pct}%`, borderRadius: 20, transition: "width 0.4s" }} />
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{totalChecados} de {total} · {pct}% completo</div>
        </div>
      </div>

      {GRUPOS.map(grupo => (
        <div key={grupo.titulo} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ background: grupo.cor, padding: "13px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{grupo.icon}</span>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{grupo.titulo}</div>
          </div>
          {grupo.docs.map(doc => (
            <div key={doc.id} onClick={() => toggle(doc.id)}
              style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 18px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, background: checados[doc.id] ? C.green50 : "transparent", transition: "background 0.2s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checados[doc.id] ? C.green500 : C.border}`, background: checados[doc.id] ? C.green500 : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.2s" }}>
                {checados[doc.id] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: checados[doc.id] ? C.green700 : C.text, textDecoration: checados[doc.id] ? "line-through" : "none" }}>{doc.label}</span>
                  {doc.obrig ? <span style={{ fontSize: 10, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 20, padding: "1px 8px" }}>OBRIGATÓRIO</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, background: C.green50, color: C.green700, border: `1px solid ${C.green100}`, borderRadius: 20, padding: "1px 8px" }}>OPCIONAL</span>}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{doc.desc}</div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Quer suporte jurídico?</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>Revisão Jurídica com assinatura OAB por R$ 199,00.</div>
        </div>
        <button onClick={() => setView("planos")} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: C.green400, color: C.green900, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Ver planos →</button>
      </div>
    </div>
  );
}

// ── Aba Planos ────────────────────────────────────────────────
function AbaPlanos({ user, dadosMulta, historicoPenalidade, onPlanoPago, planoPago }) {
  const [showPagamento, setShowPagamento] = useState(null);
  const isMobile = useIsMobile();

  const aoConfirmar = () => {
    onPlanoPago(showPagamento);
    setShowPagamento(null);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 24px" }}>
      {showPagamento && (
        <PagamentoModal plano={showPagamento} onClose={() => setShowPagamento(null)} onSuccess={aoConfirmar}
          dadosCliente={{ nome: user?.nome, email: user?.email, telefone: user?.perfil?.telefone }}
          dadosMulta={dadosMulta} historico_penalidade={historicoPenalidade} />
      )}
      <div style={{ background: `linear-gradient(135deg,${C.green900},${C.green800})`, borderRadius: 16, padding: isMobile ? "20px" : "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        {[320, 220, 130].map((r, i) => <div key={i} style={{ position: "absolute", right: -60 + i * 20, top: "50%", transform: "translateY(-50%)", width: r, height: r, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />)}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ color: C.green400, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>PLANOS DISPONÍVEIS</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: isMobile ? 18 : 22 }}>Escolha como usar seu recurso</div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.7, maxWidth: 480, marginTop: 8 }}>Do download automático à revisão com assinatura OAB.</p>
        </div>
      </div>
      {planoPago && (
        <div style={{ background: C.white, border: `2px solid ${C.green400}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, boxShadow: `0 4px 20px ${C.glow}` }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.green50, border: `2px solid ${C.green400}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>✓</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 3 }}>{PLANOS_MAP[planoPago]?.titulo} — contratado!</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>{PLANOS_MAP[planoPago]?.confirmacao}</div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18, marginBottom: 20 }}>
        {PLANOS.map(plano => (
          <div key={plano.id} style={{ background: C.white, border: `2px solid ${planoPago === plano.id ? C.green500 : plano.destaque ? plano.cor : C.border}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: plano.destaque ? `0 6px 24px ${C.glowStrong}` : "none" }}>
            {plano.badge && <div style={{ background: C.green600, color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textAlign: "center", padding: "5px 0" }}>{plano.badge}</div>}
            <div style={{ padding: "22px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{plano.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>{plano.titulo}</div>
              <div style={{ fontWeight: 800, fontSize: 28, color: plano.cor, marginBottom: 16, letterSpacing: "-0.03em" }}>{plano.preco}</div>
              <div style={{ flex: 1, marginBottom: 18 }}>
                {plano.itens.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: C.green50, border: `1.5px solid ${C.green400}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ color: C.green600, fontSize: 9, fontWeight: 800 }}>✓</span>
                    </div>
                    <span style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
              {planoPago === plano.id ? (
                <div style={{ padding: "11px", borderRadius: 10, background: C.green50, border: `1px solid ${C.green100}`, textAlign: "center", fontSize: 13, fontWeight: 700, color: C.green700 }}>✓ Contratado</div>
              ) : (
                <button onClick={() => !planoPago && setShowPagamento(plano.id)} disabled={!!planoPago}
                  style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: planoPago ? C.surface : `linear-gradient(135deg,${plano.cor},${plano.id === "essencial" ? C.green500 : C.green600})`, color: planoPago ? C.textLight : "#fff", fontSize: 14, fontWeight: 700, cursor: planoPago ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: plano.destaque && !planoPago ? `0 4px 14px ${C.glowStrong}` : "none" }}>
                  Contratar →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Tenho dúvida sobre recurso de multa.`} target="_blank" rel="noopener noreferrer"
        style={{ background: "#dcfce7", border: "2px solid #22c55e", borderRadius: 14, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>💬</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#166534", marginBottom: 2 }}>Fale com um especialista</div>
            <div style={{ fontSize: 12, color: "#166534", opacity: 0.8 }}>Tire dúvidas antes de contratar</div>
          </div>
        </div>
        <div style={{ padding: "10px 20px", borderRadius: 9, background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>WhatsApp →</div>
      </a>
    </div>
  );
}

// ── Painel Advogado ───────────────────────────────────────────
function PainelAdvogado({ onLogout }) {
  const [casos, setCasos] = useState(() => DB.getAllCasos());
  useEffect(() => { setCasos(DB.getAllCasos()); }, []);
  const [sel, setSel] = useState(null);
  const [nota, setNota] = useState("");
  const [concluidos, setConcluidos] = useState({});
  const [pdfModal, setPdfModal] = useState(null);
  const [minutas, setMinutas] = useState({}); // { [casoId]: { nome, url, data } }
  const [uploadingMinuta, setUploadingMinuta] = useState(false);
  const minutaRef = useRef();
  const isMobile = useIsMobile();

  const handleMinutaUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !sel) return;
    if (file.type !== "application/pdf") { alert("Envie apenas arquivos PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Arquivo muito grande. Máximo 10MB."); return; }
    setUploadingMinuta(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result; // base64 data URL
      const minuta = { nome: file.name, url, data: new Date().toISOString() };
      setMinutas(prev => ({ ...prev, [sel.id]: minuta }));
      // Salva no DB para o cliente acessar
      DB.updateHistorico(sel.clienteEmail, sel.id, { minutaAdvogado: minuta });
      // Atualiza casos
      setCasos(DB.getAllCasos());
      setUploadingMinuta(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={30} /><span style={{ fontWeight: 800, fontSize: 16 }}>Multa<span style={{ color: C.green500 }}>.AI</span></span>
          <span style={{ background: C.green100, color: C.green700, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, marginLeft: 4 }}>PAINEL ADVOGADO</span>
        </div>
        <button onClick={onLogout} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Sair</button>
      </header>
      {pdfModal && <PDFModal {...pdfModal} userName="Advogado" onClose={() => setPdfModal(null)} />}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Casos recebidos</div>
        <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>{casos.length} caso{casos.length !== 1 ? "s" : ""}</div>
        {casos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, color: C.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum caso ainda</div>
            <div style={{ fontSize: 13 }}>Casos aparecerão aqui quando clientes contratarem planos.</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ width: isMobile ? "100%" : 290, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {casos.map(c => (
                <div key={c.id} onClick={() => { setSel(c); setNota(""); }} style={{ background: C.white, border: `2px solid ${sel?.id === c.id ? C.green500 : C.border}`, borderRadius: 12, padding: "13px 15px", cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.clienteNome}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: concluidos[c.id] ? C.green100 : C.goldBg, color: concluidos[c.id] ? C.green700 : C.gold, border: `1px solid ${concluidos[c.id] ? C.green100 : C.goldBorder}` }}>
                      {concluidos[c.id] ? "✓ Concluído" : "⏳ Pendente"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>{c.clienteEmail}</div>
                  <div style={{ fontSize: 11, color: C.green600, fontWeight: 600, marginBottom: 3 }}>{PLANOS_MAP[c.planoPago]?.titulo} · {PLANOS_MAP[c.planoPago]?.preco}</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>{c.dados?.descricao_infracao || "Infração"}</div>
                  <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>{fmtDate(c.data)}</div>
                </div>
              ))}
            </div>
            {sel ? (
              <div style={{ flex: 1, background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginBottom: 2 }}>CASO</div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{sel.clienteNome} · {sel.clienteEmail}</div>
                  </div>
                  <button onClick={() => setPdfModal({ recurso: sel.recurso, dados: sel.dados, historico_penalidade: sel.historico_penalidade })} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>📄 Ver recurso</button>
                </div>
                <div style={{ padding: 18 }}>
                  {sel.historico_penalidade && <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}><strong>Histórico:</strong><br />{sel.historico_penalidade}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {Object.entries(sel.dados || {}).filter(([, v]) => v && v !== "N/A").map(([k, v]) => (
                      <div key={k} style={{ background: C.green50, borderRadius: 7, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{k.replace(/_/g, " ")}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 7, textTransform: "uppercase" }}>Feedback ao cliente</label>
                  <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} placeholder="Observações, aprovação ou ajustes..."
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, background: C.offWhite, color: C.text, outline: "none", fontFamily: "inherit", lineHeight: 1.6 }} />

                  {/* ── Envio de minuta revisada ── */}
                  <div style={{ background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 10, padding: "14px 16px", marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>📤</span> Enviar minuta revisada ao cliente
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
                      Faça upload do PDF revisado e assinado. O cliente poderá baixar direto no Histórico.
                    </p>
                    <input ref={minutaRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleMinutaUpload} />
                    {(minutas[sel.id] || sel.minutaAdvogado) ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.white, border: `1px solid ${C.green200}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>📄</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{(minutas[sel.id] || sel.minutaAdvogado)?.nome}</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>Enviado em {fmtDate((minutas[sel.id] || sel.minutaAdvogado)?.data)}</div>
                          </div>
                          <a href={(minutas[sel.id] || sel.minutaAdvogado)?.url} download={(minutas[sel.id] || sel.minutaAdvogado)?.nome}
                            style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.green500}`, background: C.white, color: C.green700, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                            ↓ Baixar
                          </a>
                        </div>
                        <button onClick={() => minutaRef.current.click()}
                          style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                          🔄 Substituir PDF
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => minutaRef.current.click()} disabled={uploadingMinuta}
                        style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: uploadingMinuta ? 0.7 : 1 }}>
                        {uploadingMinuta ? "Processando..." : "📎 Selecionar PDF revisado"}
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button onClick={() => setSel(null)} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Voltar</button>
                    <button onClick={() => { setConcluidos(p => ({ ...p, [sel.id]: true })); setSel(null); }} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Marcar como revisado</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, minHeight: 200, color: C.textMuted, fontSize: 14 }}>← Selecione um caso</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── App Logado ────────────────────────────────────────────────
function AppLogado({ user, setUser, view, setView }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);       // arquivos do auto de infração
  const [docFiles, setDocFiles] = useState([]); // documentos pessoais
  const [recurso, setRecurso] = useState("");
  const [dadosMulta, setDadosMulta] = useState(null);
  const [historicoPenalidade, setHistoricoPenalidade] = useState("");
  const [error, setError] = useState("");
  const [tipIdx, setTipIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPagamento, setShowPagamento] = useState(null);
  const [planoPagoAtual, setPlanoPagoAtual] = useState(null);
  const fileRef = useRef();
  const isMobile = useIsMobile();
  const historico = user.historico || [];

  const historicoIdRef = useRef(null);
  const historicoPenalidadeRef = useRef("");
  useEffect(() => { historicoPenalidadeRef.current = historicoPenalidade; }, [historicoPenalidade]);

  const salvarHistorico = useCallback((dados, rec) => {
    const id = Date.now().toString();
    historicoIdRef.current = id;
    const entry = { id, data: new Date().toISOString(), dados, recurso: rec, historico_penalidade: historicoPenalidadeRef.current, planoPago: null };
    DB.addHistoricoAsync(user.email, entry);
    setUser(u => ({ ...u, historico: [entry, ...(u.historico || [])] }));
    return id;
  }, [user.email, setUser]);

  const aoPlanoContratado = useCallback((planoId) => {
    setPlanoPagoAtual(planoId);
    setShowPagamento(null);
    const hid = historicoIdRef.current;
    if (hid) {
      DB.updateHistoricoAsync(user.email, hid, { planoPago: planoId });
      setUser(u => ({ ...u, historico: u.historico.map(h => h.id === hid ? { ...h, planoPago: planoId } : h) }));
    }
  }, [user.email, setUser]);

  const handleFiles = useCallback((newFiles) => {
    setError("");
    const valid = Array.from(newFiles).filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    if (valid.length === 0) { setError("Envie imagens (JPG, PNG) ou PDFs."); return; }
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  }, []);

  const removeFile = i => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const executarGeracao = useCallback(async () => {
    if (files.length === 0) return;
    setStep(3); setError("");
    const penalidade = historicoPenalidadeRef.current;
    const p = user.perfil || {};
    const v = user.veiculos?.[0] || {};
    try {
      const f = files[0];
      const isPdf = f.type === "application/pdf";
      const mediaType = isPdf ? "application/pdf" : (f.type || "image/jpeg");
      const fileB64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
      const response = await fetch("/api/recurso", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileB64, fileType: isPdf ? "pdf" : "image", mediaType, historicoPenalidade: penalidade, perfil: p, veiculo: v }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `Erro ${response.status}`); }
      const parsed = await response.json();
      if (!parsed.dados || !parsed.recurso) throw new Error("Resposta incompleta da IA.");
      setDadosMulta(parsed.dados);
      setRecurso(parsed.recurso);
      salvarHistorico(parsed.dados, parsed.recurso);
      setStep(4);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("configurada")) setError("Chave de API não configurada na Vercel.");
      else if (msg.includes("502") || msg.includes("IA")) setError("Erro ao processar com a IA. Tente novamente.");
      else setError("Não foi possível analisar. Verifique se a imagem está legível e tente novamente.");
      setStep(2);
    }
  }, [files, user.perfil, user.veiculos, salvarHistorico]);

  const clicarGerar = () => { if (files.length === 0) return; setShowDisclaimer(true); };
  const aoAceitarDisclaimer = () => { setShowDisclaimer(false); executarGeracao(); };
  const resetar = () => { setStep(1); setFiles([]); setDadosMulta(null); setRecurso(""); setHistoricoPenalidade(""); setError(""); setPlanoPagoAtual(null); historicoIdRef.current = null; historicoPenalidadeRef.current = ""; };

  const STEPS_LABELS = ["Upload", "Histórico", "Gerando", "Recurso"];
  const podeBaixarPDF = planoPagoAtual !== null;

  return (
    <>
      {showDisclaimer && <DisclaimerModal onAceitar={aoAceitarDisclaimer} onRecusar={() => setShowDisclaimer(false)} />}
      {pdfModal && <PDFModal {...pdfModal} perfil={user.perfil} userName={user.nome} onClose={() => setPdfModal(null)} />}
      {showPagamento && (
        <PagamentoModal plano={showPagamento} onClose={() => setShowPagamento(null)} onSuccess={() => aoPlanoContratado(showPagamento)}
          dadosCliente={{ nome: user.nome, email: user.email, telefone: user.perfil?.telefone }}
          dadosMulta={dadosMulta} historico_penalidade={historicoPenalidade} />
      )}

      {/* Abas */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto" }}>
        {[
          { id: "home", label: "📄 Gerar Recurso" },
          { id: "documentos", label: "📋 Documentos" },
          { id: "planos", label: "⚖️ Planos" },
          ...(planoPagoAtual ? [{ id: "protocolo", label: "🗂️ Protocolar" }] : []),
          { id: "historico", label: "🕓 Histórico" },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setView(id)} style={{ padding: "14px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: view === id ? 700 : 400, color: view === id ? C.green700 : C.textMuted, whiteSpace: "nowrap", borderBottom: `2px solid ${view === id ? C.green500 : "transparent"}`, transition: "all 0.2s" }}>{label}</button>
        ))}
      </div>

      {/* Steps */}
      {view === "home" && step < 4 && (
        <div style={{ background: C.offWhite, borderBottom: `1px solid ${C.border}`, padding: `10px ${isMobile ? 16 : 28}px`, display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
          {STEPS_LABELS.map((label, i) => {
            const n = i + 1, done = step > n, active = step === n;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: done ? C.green500 : active ? C.green600 : C.surface, color: done || active ? "#fff" : C.textLight, border: `2px solid ${done ? C.green500 : active ? C.green600 : C.border}`, boxShadow: active ? `0 0 0 3px ${C.glow}` : "none", transition: "all 0.3s" }}>{done ? "✓" : n}</div>
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? C.text : done ? C.textMid : C.textLight }}>{label}</span>
                </div>
                {i < STEPS_LABELS.length - 1 && <div style={{ width: 20, height: 2, margin: "0 6px", background: step > n ? C.green400 : C.border, borderRadius: 2, transition: "background 0.4s" }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Aba Planos */}
      {view === "planos" && <AbaPlanos user={user} dadosMulta={dadosMulta} historicoPenalidade={historicoPenalidade} onPlanoPago={aoPlanoContratado} planoPago={planoPagoAtual} />}

      {/* Aba Documentos */}
      {view === "documentos" && <AbaDocumentos setView={setView} onUploadDocs={f => setDocFiles(prev => [...prev, ...f])} uploadedDocs={docFiles} />}

      {/* Aba Protocolo */}
      {view === "protocolo" && <AbaProtocolo dadosMulta={dadosMulta} />}

      {/* Aba Histórico */}
      {view === "historico" && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px", animation: "fadeUp 0.3s ease both" }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Seus recursos</div>
          <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 20 }}>{historico.length} recurso{historico.length !== 1 ? "s" : ""}</div>
          {historico.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 20px", background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, color: C.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Nenhum recurso ainda</div>
              <button onClick={() => setView("home")} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Gerar recurso →</button>
            </div>
          ) : historico.map(h => (
            <div key={h.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "15px 18px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{h.dados?.descricao_infracao || "Infração"}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(h.data)} · Placa: {h.dados?.placa || "—"} · {h.dados?.valor_multa || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {h.planoPago && <span style={{ fontSize: 11, background: C.green50, color: C.green700, border: `1px solid ${C.green100}`, borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>✓ {PLANOS_MAP[h.planoPago]?.titulo}</span>}
                  {h.planoPago ? (
                    <button onClick={() => setPdfModal({ recurso: h.recurso, dados: h.dados, historico_penalidade: h.historico_penalidade })} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: C.textMid, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>📄 Ver recurso</button>
                  ) : (
                    <button onClick={() => { setDadosMulta(h.dados); setRecurso(h.recurso); historicoIdRef.current = h.id; setStep(4); setView("home"); }}
                      style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Pagar e acessar →</button>
                  )}
                  {/* Minuta revisada pelo advogado */}
                  {h.minutaAdvogado && (
                    <a href={h.minutaAdvogado.url} download={h.minutaAdvogado.nome}
                      style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${C.green800},${C.green700})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      ⚖️ Baixar minuta revisada
                    </a>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, background: C.offWhite, borderRadius: 7, padding: "7px 11px", lineHeight: 1.6, maxHeight: 50, overflow: "hidden" }}>{h.recurso?.slice(0, 200)}...</div>
            </div>
          ))}
        </div>
      )}

      {/* Aba Home */}
      {view === "home" && (
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: `24px ${isMobile ? 16 : 22}px 60px`, display: "flex", gap: 22, flexDirection: isMobile ? "column" : "row" }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* STEP 1 */}
            {step === 1 && (
              <div style={{ animation: "fadeUp 0.35s ease both", background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: `0 2px 16px ${C.glow}`, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "20px 24px" }}>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 5 }}>PASSO 1 DE 4</div>
                  <h2 style={{ color: "#fff", fontSize: isMobile ? 17 : 20, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Envie o auto de infração</h2>
                  <p style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 1.6 }}>Foto ou PDF legível · Aceita múltiplos arquivos (máx. 5)</p>
                </div>
                <div style={{ padding: "20px 24px" }}>
                  <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                    onClick={() => fileRef.current.click()}
                    style={{ border: `2px dashed ${dragging ? C.green500 : files.length > 0 ? C.green400 : C.border}`, borderRadius: 12, padding: "24px 18px", textAlign: "center", cursor: "pointer", background: dragging ? C.green50 : files.length > 0 ? C.green50 : C.offWhite, transition: "all 0.2s", marginBottom: 14 }}>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
                    {files.length === 0 ? (
                      <div><div style={{ fontSize: 32, marginBottom: 8 }}>📄</div><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Arraste ou clique para enviar</div><div style={{ fontSize: 12, color: C.textMuted }}>JPG, PNG ou PDF · até 5 arquivos</div></div>
                    ) : (
                      <div style={{ fontSize: 13, color: C.green600, fontWeight: 600 }}>{files.length} arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""} · Clique para adicionar mais</div>
                    )}
                  </div>
                  {files.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      {files.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px" }}>
                          <span style={{ fontSize: 14 }}>{f.type.startsWith("image/") ? "🖼️" : "📄"}</span>
                          <span style={{ fontSize: 11, color: C.textMid, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <button onClick={e => { e.stopPropagation(); removeFile(i); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 16, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12, padding: "8px 12px", background: C.dangerSoft, borderRadius: 8, border: "1px solid #fca5a5" }}>{error}</div>}
                  <button onClick={() => files.length > 0 && setStep(2)} disabled={files.length === 0}
                    style={{ width: "100%", padding: "13px", borderRadius: 11, border: "none", background: files.length > 0 ? `linear-gradient(135deg,${C.green700},${C.green500})` : C.surface, color: files.length > 0 ? "#fff" : C.textLight, fontSize: 14, fontWeight: 800, cursor: files.length > 0 ? "pointer" : "not-allowed", boxShadow: files.length > 0 ? `0 4px 16px ${C.glowStrong}` : "none", fontFamily: "inherit" }}>
                    {files.length > 0 ? "Próximo →" : "Selecione pelo menos um arquivo"}
                  </button>
                  <p style={{ fontSize: 11, color: C.textLight, textAlign: "center", marginTop: 10 }}>🔒 Dados processados com segurança</p>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={{ animation: "fadeUp 0.35s ease both", background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: `0 2px 16px ${C.glow}`, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, padding: "20px 24px" }}>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 5 }}>PASSO 2 DE 4</div>
                  <h2 style={{ color: "#fff", fontSize: isMobile ? 17 : 20, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Histórico da penalidade</h2>
                  <p style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 1.6 }}>Descreva o contexto para fortalecer a defesa (opcional)</p>
                </div>
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>O que aconteceu?</label>
                    <span style={{ fontSize: 11, color: historicoPenalidade.length > 450 ? C.danger : C.textMuted }}>{historicoPenalidade.length}/500</span>
                  </div>
                  <textarea value={historicoPenalidade} onChange={e => { if (e.target.value.length <= 500) setHistoricoPenalidade(e.target.value); }}
                    rows={5} placeholder="Ex: A infração ocorreu em cruzamento sem sinalização. O semáforo estava com defeito. Eu estava conduzindo por emergência médica..."
                    style={{ width: "100%", background: C.offWhite, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, lineHeight: 1.75, padding: "12px 14px", outline: "none", fontFamily: "inherit", resize: "vertical", marginBottom: 14 }}
                    onFocus={e => e.target.style.borderColor = C.green500} onBlur={e => e.target.style.borderColor = C.border} />
                  <div style={{ background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
                    💡 Quanto mais detalhes, mais precisa e fundamentada será a defesa gerada pela IA.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setStep(1)} style={{ padding: "12px 20px", borderRadius: 11, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Voltar</button>
                    <button onClick={clicarGerar} style={{ flex: 1, padding: "13px", borderRadius: 11, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 16px ${C.glowStrong}` }}>
                      Gerar Recurso com IA →
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: C.textLight, textAlign: "center", marginTop: 10 }}>Você precisará aceitar o disclaimer antes de continuar</p>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}` }}>
                <Spinner label="Analisando auto de infração com IA..." />
              </div>
            )}

            {/* STEP 4 — PAGAMENTO OBRIGATÓRIO ANTES DE VER O RECURSO */}
            {step === 4 && dadosMulta && (
              <div style={{ animation: "fadeUp 0.35s ease both" }}>
                {!podeBaixarPDF ? (
                  /* Tela de pagamento */
                  <div>
                    <div style={{ background: `linear-gradient(135deg,${C.green900},${C.green800})`, borderRadius: 16, padding: "28px 24px", marginBottom: 16, textAlign: "center", position: "relative", overflow: "hidden" }}>
                      {[250, 170, 100].map((r, i) => <div key={i} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: r, height: r, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)", pointerEvents: "none" }} />)}
                      <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                        <div style={{ color: C.green400, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>RECURSO GERADO COM SUCESSO</div>
                        <div style={{ color: "#fff", fontWeight: 800, fontSize: isMobile ? 20 : 26, marginBottom: 10 }}>Seu recurso está pronto!</div>
                        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.8, maxWidth: 400, margin: "0 auto" }}>
                          A IA analisou seu auto e elaborou um recurso completo fundamentado no CTB. Escolha um plano abaixo para acessar o documento completo.
                        </div>
                      </div>
                    </div>

                    {/* Dados da infração */}
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 13, padding: 16, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.07em", marginBottom: 11, textTransform: "uppercase" }}>📋 Infração identificada</div>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? 140 : 160}px,1fr))`, gap: 7 }}>
                        {Object.entries(dadosMulta).filter(([, v]) => v && v !== "N/A" && v !== "—").map(([k, v]) => (
                          <div key={k} style={{ background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 7, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{k.replace(/_/g, " ")}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recurso bloqueado visualmente */}
                    <div style={{ background: C.white, border: `2px dashed ${C.border}`, borderRadius: 13, padding: "30px 20px", marginBottom: 16, textAlign: "center", position: "relative", overflow: "hidden" }}>
                      <div style={{ filter: "blur(5px)", userSelect: "none", pointerEvents: "none", opacity: 0.35, fontSize: 12, lineHeight: 2, color: C.text, fontFamily: "Georgia,serif", maxHeight: 72, overflow: "hidden", textAlign: "left" }}>
                        Excelentíssimo Senhor Presidente da Junta Administrativa de Recursos de Infrações — JARI. O recorrente, devidamente qualificado nos autos, vem, respeitosamente, perante Vossa Excelência, com fundamento nos artigos 280, 281, 282 e 283 do Código de Trânsito Brasileiro, interpor RECURSO ADMINISTRATIVO DE PRIMEIRA INSTÂNCIA...
                      </div>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.88)" }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>Conteúdo protegido</div>
                        <div style={{ fontSize: 13, color: C.textMuted }}>Escolha um plano abaixo para desbloquear</div>
                      </div>
                    </div>

                    {/* Planos inline */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                      {PLANOS.map(plano => (
                        <div key={plano.id} style={{ background: C.white, border: `2px solid ${plano.destaque ? C.green500 : C.border}`, borderRadius: 14, padding: "20px 18px", display: "flex", flexDirection: "column", boxShadow: plano.destaque ? `0 6px 24px ${C.glowStrong}` : "none" }}>
                          {plano.badge && <div style={{ background: C.green600, color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textAlign: "center", padding: "4px 0", borderRadius: 6, marginBottom: 12 }}>{plano.badge}</div>}
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{plano.icon}</div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>{plano.titulo}</div>
                          <div style={{ fontWeight: 800, fontSize: 26, color: plano.cor, marginBottom: 12, letterSpacing: "-0.02em" }}>{plano.preco}</div>
                          <div style={{ flex: 1, marginBottom: 14 }}>
                            {plano.itens.map((item, i) => (
                              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                                <span style={{ color: C.green500, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                                <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{item}</span>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => setShowPagamento(plano.id)}
                            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${plano.cor},${plano.id === "essencial" ? C.green500 : C.green600})`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: plano.destaque ? `0 4px 14px ${C.glowStrong}` : "none" }}>
                            Contratar e acessar →
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                      <button onClick={resetar} style={{ padding: "10px 22px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Gerar novo recurso</button>
                    </div>
                    <div style={{ padding: "9px 13px", background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 9, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
                      ⚠️ <strong style={{ color: C.textMid }}>Aviso legal:</strong> Obrigação de meio, não de resultado. Verifique os prazos junto ao órgão autuador.
                    </div>
                  </div>
                ) : (
                  /* Recurso liberado */
                  <div>
                    <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, borderRadius: 16, padding: "14px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 2 }}>ACESSO LIBERADO ✓</div>
                        <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{PLANOS_MAP[planoPagoAtual]?.titulo} — documento disponível</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={resetar} style={{ padding: "6px 13px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>← Novo</button>
                        <button onClick={() => { navigator.clipboard.writeText(recurso); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: copied ? "#fff" : "rgba(255,255,255,0.2)", color: copied ? C.green700 : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {copied ? "✓ Copiado!" : "Copiar"}
                        </button>
                        <button onClick={() => setPdfModal({ recurso, dados: dadosMulta, historico_penalidade: historicoPenalidade })} style={{ padding: "6px 13px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>📄 PDF</button>
                      </div>
                    </div>
                    <div style={{ background: C.green50, border: `2px solid ${C.green400}`, borderRadius: 13, padding: "12px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 22 }}>✅</span>
                      <div style={{ fontSize: 13, color: C.green700, lineHeight: 1.6 }}>{PLANOS_MAP[planoPagoAtual]?.confirmacao}</div>
                    </div>
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 13, padding: 16, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.07em", marginBottom: 9, textTransform: "uppercase" }}>Recurso completo · edite se necessário</div>
                      <textarea value={recurso} onChange={e => setRecurso(e.target.value)} rows={isMobile ? 10 : 14}
                        style={{ width: "100%", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, lineHeight: 1.8, padding: "11px 13px", outline: "none", fontFamily: "Georgia,serif" }} />
                    </div>
                    {/* CTA Protocolo */}
                    <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, borderRadius: 13, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🗂️ Como protocolar?</div>
                        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>Veja o passo a passo completo para apresentar seu recurso.</div>
                      </div>
                      <button onClick={() => setView("protocolo")} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: C.green400, color: C.green900, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Ver passo a passo →</button>
                    </div>
                    <div style={{ padding: "9px 13px", background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 9, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
                      ⚠️ <strong style={{ color: C.textMid }}>Aviso legal:</strong> Obrigação de meio, não de resultado. Verifique os prazos junto ao órgão autuador.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          {!isMobile && (
            <div style={{ width: 244, flexShrink: 0, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 13, padding: 17 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.08em", marginBottom: 11, textTransform: "uppercase" }}>💡 Saiba seus direitos</div>
                <div style={{ background: C.green50, border: `1px solid ${C.green100}`, borderLeft: `3px solid ${C.green500}`, borderRadius: 9, padding: "11px 13px", marginBottom: 9 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.06em", marginBottom: 3 }}>{TIPS[tipIdx].art}</div>
                  <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.65 }}>{TIPS[tipIdx].tip}</div>
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => setTipIdx(i => (i - 1 + TIPS.length) % TIPS.length)} style={{ flex: 1, padding: "6px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.offWhite, color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>← Ant.</button>
                  <button onClick={() => setTipIdx(i => (i + 1) % TIPS.length)} style={{ flex: 1, padding: "6px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.offWhite, color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Próx. →</button>
                </div>
                <div style={{ fontSize: 11, color: C.textLight, textAlign: "center", marginTop: 5 }}>{tipIdx + 1} / {TIPS.length}</div>
              </div>
              <div style={{ background: `linear-gradient(135deg,${C.green700},${C.green600})`, borderRadius: 13, padding: 17 }}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 7 }}>⏱ ATENÇÃO AO PRAZO</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.6 }}>Você tem <span style={{ fontSize: 19, fontWeight: 800 }}>30 dias</span> para apresentar o recurso após a notificação.</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>Art. 283 do CTB</div>
              </div>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 13, padding: 17 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.08em", marginBottom: 11, textTransform: "uppercase" }}>Planos</div>
                {PLANOS.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.icon} {p.titulo}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.cor, whiteSpace: "nowrap", marginLeft: 6 }}>{p.preco}</div>
                  </div>
                ))}
                <button onClick={() => setView("planos")} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1px solid ${C.green200}`, background: C.green50, color: C.green700, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver planos →</button>
              </div>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Tenho dúvida sobre recurso de multa.`} target="_blank" rel="noopener noreferrer"
                style={{ background: "#dcfce7", border: "1px solid #22c55e", borderRadius: 13, padding: "14px 17px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                <span style={{ fontSize: 22 }}>💬</span>
                <div><div style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>WhatsApp</div><div style={{ fontSize: 11, color: "#166534", opacity: 0.7 }}>Fale com especialista</div></div>
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Landing Page ──────────────────────────────────────────────
function LandingPage({ onOpenAuth }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ color: C.text }}>
      <section style={{ background: `linear-gradient(160deg,${C.green900} 0%,${C.green700} 55%,${C.green600} 100%)`, padding: isMobile ? "64px 20px 80px" : "88px 40px 104px", position: "relative", overflow: "hidden" }}>
        {[480, 340, 210].map((r, i) => <div key={i} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: r, height: r, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />)}
        <div style={{ maxWidth: 740, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", borderRadius: 30, padding: "5px 14px", marginBottom: 26, border: "1px solid rgba(255,255,255,0.15)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green400, boxShadow: "0 0 0 3px rgba(52,211,153,0.3)" }} />
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600 }}>Baseado no CTB 2025</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: isMobile ? "30px" : "50px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 18 }}>Cada multa tem uma defesa.<br /><span style={{ color: C.green400 }}>A sua também.</span></h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: isMobile ? 14 : 17, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 34px" }}>Envie o auto de infração, a IA analisa e gera um recurso completo fundamentado no CTB — em segundos.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => onOpenAuth("signup")} style={{ padding: "14px 30px", borderRadius: 11, border: "none", background: C.green400, color: C.green900, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(52,211,153,0.4)" }}>Criar conta grátis →</button>
            <button onClick={() => onOpenAuth("login")} style={{ padding: "14px 26px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Já tenho conta</button>
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 18 }}>Plano IA Essencial a partir de R$ 69,90</p>
        </div>
      </section>

      <section style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "22px 32px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: `repeat(${isMobile ? 2 : 4},1fr)`, gap: 16 }}>
          {[{ n: "30 dias", label: "Prazo legal para recurso" }, { n: "Art. 283", label: "Base legal no CTB" }, { n: "JARI", label: "Junta de Recursos" }, { n: "2 Planos", label: "IA ou revisão jurídica" }].map(({ n, label }) => (
            <div key={n} style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: isMobile ? 20 : 22, color: C.green600, marginBottom: 3 }}>{n}</div><div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{label}</div></div>
          ))}
        </div>
      </section>

      <section id="como-funciona" style={{ background: C.offWhite, padding: isMobile ? "48px 20px" : "68px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>Como funciona</div>
            <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: "-0.03em" }}>Simples, rápido e fundamentado</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobile ? 1 : 2},1fr)`, gap: 18 }}>
            {[
              { icon: "📤", title: "Upload do auto de infração", desc: "Envie foto ou PDF. A IA extrai todos os dados automaticamente." },
              { icon: "📝", title: "Histórico da penalidade", desc: "Descreva o contexto para fortalecer os argumentos de defesa." },
              { icon: "🤖", title: "IA gera o recurso completo", desc: "Recurso técnico fundamentado no CTB e Resoluções CONTRAN." },
              { icon: "⚖️", title: "Pague e acesse", desc: "Escolha o plano e acesse o recurso. Opcional: revisão com assinatura OAB." },
            ].map(({ icon, title, desc }, i) => (
              <div key={title} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px 20px", display: "flex", gap: 16, alignItems: "flex-start", boxShadow: `0 2px 12px ${C.glow}` }}>
                <div style={{ width: 46, height: 46, borderRadius: 11, background: C.green50, border: `1px solid ${C.green100}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: C.green500, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: C.white, padding: isMobile ? "48px 20px" : "68px 40px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green600, letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>Planos</div>
            <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: "-0.03em" }}>Escolha o suporte ideal</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
            {PLANOS.map(p => (
              <div key={p.id} style={{ background: p.destaque ? C.green50 : C.white, border: `2px solid ${p.destaque ? C.green500 : C.border}`, borderRadius: 16, padding: "24px 20px", display: "flex", flexDirection: "column", boxShadow: p.destaque ? `0 6px 24px ${C.glowStrong}` : "none" }}>
                {p.badge && <div style={{ background: C.green600, color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textAlign: "center", padding: "5px 0", borderRadius: 8, marginBottom: 14 }}>{p.badge}</div>}
                <div style={{ fontSize: 26, marginBottom: 10 }}>{p.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>{p.titulo}</div>
                <div style={{ fontWeight: 800, fontSize: 28, color: p.cor, marginBottom: 16, letterSpacing: "-0.03em" }}>{p.preco}</div>
                <div style={{ flex: 1, marginBottom: 20 }}>
                  {p.itens.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <span style={{ color: C.green500, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => onOpenAuth("signup")} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: p.destaque ? `linear-gradient(135deg,${p.cor},${C.green500})` : C.surface, color: p.destaque ? "#fff" : C.textMid, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: p.destaque ? `0 4px 14px ${C.glowStrong}` : "none" }}>
                  Começar →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: `linear-gradient(135deg,${C.green900},${C.green800})`, padding: isMobile ? "48px 20px" : "68px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green400, letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>Legislação</div>
            <h2 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>Conheça seus direitos</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobile ? 1 : 2},1fr)`, gap: 12 }}>
            {TIPS.map(({ art, tip }) => (
              <div key={art} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: `3px solid ${C.green400}`, borderRadius: 10, padding: "13px 15px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green400, letterSpacing: "0.06em", marginBottom: 4 }}>{art}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>{tip}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ background: C.green900, padding: "24px 32px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Logo size={26} /><span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 14 }}>Multa<span style={{ color: C.green400 }}>.AI</span></span></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, textAlign: isMobile ? "center" : "right" }}>© 2025 Multa.AI · Recursos administrativos de trânsito<br />Obrigação de meio, não de resultado.</div>
        </div>
      </footer>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────
export default function Root() {
  const [user, setUser] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const fresh = DB.get(parsed.email);
      return fresh ? { ...parsed, historico: fresh.historico || [], perfil: fresh.perfil || {}, veiculos: fresh.veiculos || [] } : null;
    } catch { return null; }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [view, setView] = useState("home");
  const [showPerfil, setShowPerfil] = useState(false);
  const isMobile = useIsMobile();

  const openAuth = (mode = "login") => { setAuthMode(mode); setAuthOpen(true); };

  const handleLogin = u => {
    setUser(u); setAuthOpen(false); setView("home");
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: u.email, nome: u.nome, isAdv: u.isAdv || false })); } catch {}
  };

  const handleLogout = () => {
    setUser(null); setView("home");
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  };

  const setUserSync = updater => {
    setUser(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { if (next) localStorage.setItem(SESSION_KEY, JSON.stringify({ email: next.email, nome: next.nome, isAdv: next.isAdv || false })); } catch {}
      return next;
    });
  };

  const isAdv = user?.isAdv === true;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        textarea,input{font-family:'Plus Jakarta Sans',sans-serif!important;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#f7faf7;} ::-webkit-scrollbar-thumb{background:#c6dfc6;border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
      `}</style>

      {authOpen && <AuthDrawer onClose={() => setAuthOpen(false)} onLogin={handleLogin} initialMode={authMode} />}
      {showPerfil && user && <PerfilModal user={user} setUser={setUserSync} onClose={() => setShowPerfil(false)} />}

      {!isAdv && (
        <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: `0 ${isMobile ? 14 : 28}px`, height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: `0 1px 10px ${C.glow}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => { if (user) setView("home"); else window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Logo size={32} />
            <div>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, letterSpacing: "-0.04em" }}>Multa<span style={{ color: C.green500 }}>.AI</span></div>
              {!isMobile && <div style={{ fontSize: 9, color: C.textLight, letterSpacing: "0.06em", fontWeight: 500 }}>RECURSOS ADMINISTRATIVOS DE TRÂNSITO</div>}
            </div>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!user && !isMobile && (
              <button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
                style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "6px 10px" }}>Como funciona</button>
            )}
            {user ? (
              <>
                <button onClick={() => setShowPerfil(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 20, padding: "4px 12px 4px 4px", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.green500, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{user.nome?.charAt(0).toUpperCase()}</div>
                  {!isMobile && <span style={{ fontSize: 12, color: C.textMid, fontWeight: 600 }}>{user.nome?.split(" ")[0]}</span>}
                  <span style={{ fontSize: 11, color: C.textMuted }}>▾</span>
                </button>
                <button onClick={handleLogout} style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Sair</button>
              </>
            ) : (
              <>
                <button onClick={() => openAuth("login")} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Entrar</button>
                <button onClick={() => openAuth("signup")} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${C.green700},${C.green500})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Criar conta</button>
              </>
            )}
          </nav>
        </header>
      )}

      {isAdv ? <PainelAdvogado onLogout={handleLogout} /> :
        user ? <AppLogado user={user} setUser={setUserSync} view={view} setView={setView} /> :
          <LandingPage onOpenAuth={openAuth} />}
    </div>
  );
}

