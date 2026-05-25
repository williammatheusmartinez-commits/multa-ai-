"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const FORMSPREE_ID = "xaqkjrwv";
const WHATSAPP_NUMBER = "5511999999999"; // Substitua pelo número real com DDI+DDD

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

const PLANOS = [
  {
    id:"essencial", icon:"🤖", titulo:"IA Essencial", preco:"R$ 69,90",
    cor:C.green600, badge:null, destaque:false,
    itens:["Elaboração automática do recurso via IA","Download do recurso em PDF","Sem revisão humana","Sem assinatura de advogado"],
    confirmacao:"Plano confirmado! Acesse o Histórico para baixar o PDF do seu recurso.",
    liberaPDF:true,
  },
  {
    id:"juridico", icon:"⚖️", titulo:"Revisão Jurídica", preco:"R$ 199,00",
    cor:C.green700, badge:"RECOMENDADO", destaque:true,
    itens:["Elaboração automática via IA","Revisão técnica por advogado especialista","Assinatura digital com número OAB","Retorno em até 24 horas úteis","1 rodada de ajustes inclusa"],
    confirmacao:"O advogado revisará seu recurso e retornará em até 24h úteis com o documento assinado.",
    liberaPDF:false,
  },
];

const PLANOS_MAP = Object.fromEntries(PLANOS.map(p => [p.id, p]));

const DISCLAIMER = `DISCLAIMER — OBRIGAÇÃO DE MEIO

A plataforma atua como ferramenta de apoio à elaboração e protocolo de recursos administrativos de trânsito, caracterizando obrigação de meio, e não de resultado.

Dessa forma, a plataforma, seus fundadores, colaboradores, parceiros, profissionais e advogados vinculados não garantem o deferimento, cancelamento de autuação, suspensão de penalidade ou qualquer resultado específico perante órgãos de trânsito, JARI, CETRAN ou autoridades competentes.

A análise e julgamento dos recursos administrativos dependem exclusivamente do entendimento da autoridade competente, podendo variar conforme o caso concreto, legislação aplicável e critérios administrativos adotados.

O usuário declara estar ciente de que a utilização da plataforma não constitui garantia de êxito no procedimento administrativo.`;

// ── DB com localStorage (persiste entre sessões) ──────────────
const DB_KEY = "multaai_users";
const ADV_KEY = "advogado@multa.ai";
const ADV_DEFAULT = { nome:"Dr. Ricardo Souza", senha:"adv123", historico:[], isAdv:true, perfil:{} };

const DB = {
  _cache: null, // cache em memória para evitar múltiplas releituras

  _load() {
    if (this._cache) return this._cache;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DB_KEY) : null;
      const stored = raw ? JSON.parse(raw) : {};
      if (!stored[ADV_KEY]) stored[ADV_KEY] = { ...ADV_DEFAULT };
      this._cache = stored;
      return stored;
    } catch {
      this._cache = { [ADV_KEY]: { ...ADV_DEFAULT } };
      return this._cache;
    }
  },

  _save(store) {
    this._cache = store;
    try { if (typeof window !== "undefined") localStorage.setItem(DB_KEY, JSON.stringify(store)); } catch {}
  },

  get(e) { return this._load()[e] || null; },

  set(e, d) {
    const store = this._load();
    store[e] = d;
    this._save(store);
  },

  update(e, patch) {
    const store = this._load();
    if (store[e]) { store[e] = {...store[e], ...patch}; this._save(store); }
  },

  addHistorico(e, entry) {
    const store = this._load();
    if (!store[e]) return;
    store[e].historico = [entry, ...(store[e].historico || [])];
    this._save(store);
  },

  updateHistorico(e, id, patch) {
    const store = this._load();
    if (!store[e]) return;
    store[e].historico = store[e].historico.map(h => h.id === id ? {...h,...patch} : h);
    this._save(store);
  },

  getAllCasos() {
    const store = this._load();
    const l = [];
    Object.entries(store).forEach(([email, u]) => {
      if (u.isAdv) return;
      (u.historico || []).forEach(h => { if (h.planoPago) l.push({...h, clienteEmail:email, clienteNome:u.nome}); });
    });
    return l;
  },
};

async function enviarFormspree(dados) {
  try {
    await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"}, body:JSON.stringify(dados)
    });
  } catch(e) { console.error("Formspree error:", e); }
}

const useIsMobile = () => {
  const [m, setM] = useState(false);
  useEffect(() => { const f = () => setM(window.innerWidth < 768); f(); window.addEventListener("resize",f); return () => window.removeEventListener("resize",f); }, []);
  return m;
};
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}); } catch { return iso; } };

// ── Logo ──────────────────────────────────────────────────────
function Logo({ size=36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="21" fill={C.green50} stroke={C.green400} strokeWidth="1.2"/>
      {[0,60,120,180,240,300].map((deg,i) => (
        <line key={i} x1="22" y1="22" x2={22+18*Math.cos(deg*Math.PI/180)} y2={22+18*Math.sin(deg*Math.PI/180)} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.5" strokeLinecap="round"/>
      ))}
      <circle cx="22" cy="22" r="13" fill={C.green500}/>
      <circle cx="22" cy="22" r="11" fill={C.green600}/>
      <path d="M22 12 L28 15 L28 23 C28 27 22 30 22 30 C20 30 16 27 16 23 L16 15 Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M18.5 22 L21 24.5 L25.5 19.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Spinner({ label="Aguarde..." }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"60px 0"}}>
      <div style={{position:"relative",width:56,height:56}}>
        <svg width="56" height="56" viewBox="0 0 56 56" style={{animation:"spin 1.1s linear infinite",position:"absolute"}}>
          <circle cx="28" cy="28" r="24" stroke={C.green100} strokeWidth="4" fill="none"/>
          <path d="M28 4 A24 24 0 0 1 52 28" stroke={C.green500} strokeWidth="4" strokeLinecap="round" fill="none"/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><Logo size={30}/></div>
      </div>
      <div style={{textAlign:"center",color:C.textMuted,fontSize:14}}>{label}</div>
    </div>
  );
}

// ── PDF Modal ─────────────────────────────────────────────────
function PDFModal({ recurso, dados, historico_penalidade, userName, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:15}}>📄 Recurso Administrativo</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={() => navigator.clipboard.writeText(recurso)} style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Copiar</button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
          </div>
        </div>
        <div style={{overflowY:"auto",padding:"24px 28px",flex:1}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:13,lineHeight:1.85,color:"#1a1a1a"}}>
            <div style={{textAlign:"center",fontWeight:700,fontSize:14,textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:`2px solid ${C.green500}`,paddingBottom:12,marginBottom:20}}>
              RECURSO ADMINISTRATIVO DE TRÂNSITO
            </div>
            {dados && (
              <div style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:8,padding:16,marginBottom:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
                {Object.entries(dados).filter(([,v])=>v&&v!=="N/A"&&v!=="—").map(([k,v])=>(
                  <div key={k}><strong style={{color:C.green800}}>{k.replace(/_/g," ").toUpperCase()}:</strong> {v}</div>
                ))}
              </div>
            )}
            {historico_penalidade && (
              <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"12px 16px",marginBottom:20,fontSize:12}}>
                <strong style={{color:"#92400e"}}>HISTÓRICO RELATADO PELO CLIENTE:</strong><br/>{historico_penalidade}
              </div>
            )}
            {(recurso||"").split("\n").map((l,i) => <p key={i} style={{marginBottom:l.trim()?8:4}}>{l||"\u00A0"}</p>)}
            <div style={{marginTop:32,paddingTop:14,borderTop:"1px solid #ddd",fontSize:10,color:"#888",textAlign:"center",lineHeight:1.7}}>
              Gerado por Multa.AI · {new Date().toLocaleDateString("pt-BR")} · {userName||"Usuário"}<br/>
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
  const [chegouAoFinal, setChegouAoFinal] = useState(false);
  const [aceito, setAceito] = useState(false);

  const onScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) setChegouAoFinal(true);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:18,width:"100%",maxWidth:580,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.4)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,padding:"18px 24px",flexShrink:0}}>
          <div style={{color:C.green400,fontSize:11,fontWeight:700,letterSpacing:"0.08em",marginBottom:4}}>TERMOS DE USO</div>
          <div style={{color:"#fff",fontWeight:800,fontSize:17}}>Disclaimer — Leia antes de continuar</div>
        </div>
        <div style={{overflowY:"auto",padding:"20px 24px",flex:1}} onScroll={onScroll}>
          <div style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.textMuted}}>
            📜 Role até o final para habilitar o aceite.
          </div>
          <div style={{fontSize:13,color:C.text,lineHeight:1.85,whiteSpace:"pre-wrap",fontFamily:"Georgia,serif"}}>
            {DISCLAIMER}
          </div>
          <div style={{height:50}}/>
        </div>
        <div style={{padding:"16px 24px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,cursor:chegouAoFinal?"pointer":"default",opacity:chegouAoFinal?1:0.5}}
            onClick={() => chegouAoFinal && setAceito(a => !a)}>
            <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${aceito?C.green500:C.border}`,background:aceito?C.green500:"white",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",flexShrink:0}}>
              {aceito && <span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:13,color:aceito?C.text:C.textMuted}}>
              {chegouAoFinal ? "Li e estou ciente dos termos acima" : "Role até o final para habilitar o aceite"}
            </span>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onRecusar} style={{padding:"10px 20px",borderRadius:9,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Recusar</button>
            <button onClick={() => aceito && onAceitar()} disabled={!aceito}
              style={{flex:1,padding:"11px",borderRadius:9,border:"none",background:aceito?`linear-gradient(135deg,${C.green700},${C.green500})`:C.surface,color:aceito?"#fff":C.textLight,fontSize:13,fontWeight:700,cursor:aceito?"pointer":"not-allowed",fontFamily:"inherit",transition:"all 0.2s"}}>
              Aceitar e gerar recurso →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Perfil Modal ──────────────────────────────────────────────
function PerfilModal({ user, setUser, onClose }) {
  const p = user.perfil || {};
  const [form, setForm] = useState({
    nome: user.nome||"", telefone: p.telefone||"", cpf: p.cpf||"",
    endereco: p.endereco||"", dataNasc: p.dataNasc||"",
    cnh: p.cnh||"", placa: p.placa||"", veiculo: p.veiculo||""
  });
  const [salvo, setSalvo] = useState(false);
  const f = (k,v) => setForm(prev => ({...prev,[k]:v}));

  const salvar = () => {
    DB.update(user.email, { nome:form.nome, perfil:form });
    setUser(u => ({...u, nome:form.nome, perfil:form}));
    setSalvo(true);
    setTimeout(() => { setSalvo(false); onClose(); }, 1200);
  };

  const inp = (label, key, ph, tipo="text") => (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,color:C.textMuted,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
      <input type={tipo} value={form[key]} onChange={e => f(key, e.target.value)} placeholder={ph}
        style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:13,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}
        onFocus={e=>e.target.style.borderColor=C.green500} onBlur={e=>e.target.style.borderColor=C.border}/>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{color:"#fff",fontWeight:800,fontSize:16}}>👤 Meu Perfil</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{flex:1,padding:22,overflowY:"auto"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.green700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Dados Pessoais</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
            <div style={{gridColumn:"1/-1"}}>{inp("Nome completo *","nome","João da Silva")}</div>
            {inp("CPF","cpf","000.000.000-00")}
            {inp("Data de nascimento","dataNasc","DD/MM/AAAA")}
            <div style={{gridColumn:"1/-1"}}>{inp("Endereço completo","endereco","Rua, nº, Bairro, Cidade - UF")}</div>
            {inp("Telefone / WhatsApp","telefone","(11) 99999-9999")}
            {inp("Número da CNH","cnh","00000000000")}
          </div>
          <div style={{fontSize:11,fontWeight:700,color:C.green700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12,marginTop:8}}>Dados do Veículo</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
            {inp("Placa do veículo","placa","ABC-1234")}
            {inp("Modelo/Marca","veiculo","Honda Civic 2020")}
          </div>
          {salvo ? (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:C.green50,border:`1px solid ${C.green100}`,borderRadius:10,marginTop:8}}>
              <span style={{fontSize:18}}>✓</span>
              <span style={{fontSize:13,color:C.green700,fontWeight:600}}>Perfil salvo!</span>
            </div>
          ) : (
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={onClose} style={{padding:"10px 16px",borderRadius:9,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
              <button onClick={salvar} style={{flex:1,padding:"11px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Salvar perfil →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auth Drawer ───────────────────────────────────────────────
function AuthDrawer({ onClose, onLogin, initialMode="login" }) {
  const [mode, setMode] = useState(initialMode);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [esqueciEmail, setEsqueciEmail] = useState("");
  const [esqueciMsg, setEsqueciMsg] = useState("");

  useEffect(() => { setMode(initialMode); setErr(""); setEsqueci(false); }, [initialMode]);

  const submit = () => {
    setErr("");
    if (!email.includes("@")) { setErr("E-mail inválido."); return; }
    if (senha.length < 6) { setErr("Senha mínima: 6 caracteres."); return; }
    if (mode === "signup" && !nome.trim()) { setErr("Informe seu nome."); return; }
    setLoading(true);
    setTimeout(() => {
      if (mode === "signup") {
        if (DB.get(email)) { setErr("E-mail já cadastrado."); setLoading(false); return; }
        DB.set(email, { nome, senha, historico:[], perfil:{} });
        onLogin({ email, nome, historico:[], perfil:{} });
      } else {
        const u = DB.get(email);
        if (!u || u.senha !== senha) { setErr("E-mail ou senha incorretos."); setLoading(false); return; }
        onLogin({ email, nome:u.nome, historico:u.historico||[], isAdv:u.isAdv||false, perfil:u.perfil||{} });
      }
    }, 700);
  };

  const recuperarSenha = () => {
    if (!esqueciEmail.includes("@")) { setEsqueciMsg("Informe um e-mail válido."); return; }
    const u = DB.get(esqueciEmail);
    setEsqueciMsg(u ? `Sua senha cadastrada é: ${u.senha}` : "E-mail não encontrado. Verifique ou crie uma conta.");
  };

  const campo = (label, type, val, setVal, ph, showToggle) => (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,color:C.textMuted,display:"block",marginBottom:6,fontWeight:600}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={showToggle !== undefined ? (showSenha ? "text" : "password") : type}
          value={val} onChange={e => setVal(e.target.value)} placeholder={ph}
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{width:"100%",padding:`11px ${showToggle!==undefined?"44px":14}px 11px 14px`,borderRadius:9,border:`1.5px solid ${C.border}`,fontSize:14,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}
          onFocus={e=>e.target.style.borderColor=C.green500} onBlur={e=>e.target.style.borderColor=C.border}/>
        {showToggle !== undefined && (
          <button type="button" onClick={() => setShowSenha(s=>!s)}
            style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.textMuted,padding:4}}>
            {showSenha ? "🙈" : "👁️"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",backdropFilter:"blur(3px)"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:380,height:"100vh",background:C.white,boxShadow:"-8px 0 40px rgba(0,0,0,0.15)",display:"flex",flexDirection:"column",animation:"slideIn 0.28s cubic-bezier(0.22,1,0.36,1)"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"26px 22px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Logo size={30}/>
              <span style={{color:"#fff",fontWeight:800,fontSize:17}}>Multa<span style={{color:"#6ee7b7"}}>.AI</span></span>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          {!esqueci && (
            <div style={{display:"flex",background:"rgba(0,0,0,0.15)",borderRadius:9,padding:3}}>
              {["login","signup"].map(m => (
                <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{flex:1,padding:"9px",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,borderRadius:7,transition:"all 0.2s",background:mode===m?C.white:"transparent",color:mode===m?C.green700:"rgba(255,255,255,0.8)"}}>
                  {m==="login"?"Entrar":"Criar conta"}
                </button>
              ))}
            </div>
          )}
          {esqueci && <div style={{color:"rgba(255,255,255,0.85)",fontSize:14,fontWeight:600}}>🔑 Recuperar acesso</div>}
        </div>

        <div style={{flex:1,padding:22,overflowY:"auto"}}>
          {esqueci ? (
            <div>
              <p style={{fontSize:13,color:C.textMuted,marginBottom:16,lineHeight:1.6}}>Informe o e-mail cadastrado para recuperar o acesso.</p>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,color:C.textMuted,display:"block",marginBottom:6,fontWeight:600}}>E-mail cadastrado</label>
                <input type="email" value={esqueciEmail} onChange={e=>setEsqueciEmail(e.target.value)} placeholder="joao@email.com"
                  style={{width:"100%",padding:"11px 14px",borderRadius:9,border:`1.5px solid ${C.border}`,fontSize:14,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}/>
              </div>
              {esqueciMsg && (
                <div style={{padding:"10px 14px",borderRadius:8,marginBottom:14,fontSize:13,background:esqueciMsg.includes("senha")?C.green50:C.dangerSoft,border:`1px solid ${esqueciMsg.includes("senha")?C.green100:"#fca5a5"}`,color:esqueciMsg.includes("senha")?C.green700:C.danger}}>
                  {esqueciMsg}
                </div>
              )}
              <button onClick={recuperarSenha} style={{width:"100%",padding:"12px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
                Recuperar acesso →
              </button>
              <button onClick={() => { setEsqueci(false); setEsqueciMsg(""); }} style={{width:"100%",padding:"10px",borderRadius:9,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                ← Voltar ao login
              </button>
            </div>
          ) : (
            <>
              {mode === "signup" && (
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:C.textMuted,display:"block",marginBottom:6,fontWeight:600}}>Nome completo</label>
                  <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="João da Silva"
                    style={{width:"100%",padding:"11px 14px",borderRadius:9,border:`1.5px solid ${C.border}`,fontSize:14,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}
                    onFocus={e=>e.target.style.borderColor=C.green500} onBlur={e=>e.target.style.borderColor=C.border}/>
                </div>
              )}
              {campo("E-mail","email",email,setEmail,"joao@email.com")}
              {campo("Senha","password",senha,setSenha,"••••••••",true)}
              {err && <div style={{color:C.danger,fontSize:13,marginBottom:14,padding:"9px 12px",background:C.dangerSoft,borderRadius:8,border:"1px solid #fca5a5"}}>{err}</div>}
              <button onClick={submit} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:loading?0.7:1}}>
                {loading ? "Aguarde..." : mode==="login" ? "Entrar →" : "Criar minha conta →"}
              </button>
              {mode === "login" && (
                <button onClick={() => setEsqueci(true)} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:"transparent",color:C.green600,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginTop:8,textDecoration:"underline"}}>
                  Esqueci minha senha
                </button>
              )}
              <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:8,lineHeight:1.6}}>🔒 Seus dados são protegidos</p>
              {mode === "login" && (
                <div style={{marginTop:14,padding:"11px 13px",background:C.green50,borderRadius:9,border:`1px solid ${C.green100}`,fontSize:12,color:C.textMuted,lineHeight:1.7}}>
                  <strong style={{color:C.textMid}}>Acesso advogado:</strong><br/>
                  <code>advogado@multa.ai</code> / <code>adv123</code>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pagamento Modal ───────────────────────────────────────────
function PagamentoModal({ plano, onClose, onSuccess, dadosCliente={}, dadosMulta={}, recurso="", historico_penalidade="" }) {
  const info = PLANOS_MAP[plano] || { titulo:plano, preco:"" };
  const [metodo, setMetodo] = useState("pix");
  const [fase, setFase] = useState("escolha");
  const [cartao, setCartao] = useState({ numero:"", nome:"", validade:"", cvv:"" });
  const [err, setErr] = useState("");

  const processar = async () => {
    if (metodo === "cartao") {
      if (cartao.numero.replace(/\s/g,"").length < 16) { setErr("Número inválido."); return; }
      if (!cartao.nome.trim()) { setErr("Nome obrigatório."); return; }
      if (!cartao.validade.match(/\d{2}\/\d{2}/)) { setErr("Validade inválida (MM/AA)."); return; }
      if (cartao.cvv.length < 3) { setErr("CVV inválido."); return; }
    }
    setErr(""); setFase("processando");
    await enviarFormspree({
      _subject: `🚨 Nova contratação Multa.AI — ${info.titulo} (${info.preco})`,
      "Plano": info.titulo, "Valor": info.preco,
      "Método de pagamento": metodo === "pix" ? "PIX" : "Cartão",
      "Data/Hora": new Date().toLocaleString("pt-BR"),
      "Nome cliente": dadosCliente.nome||"—",
      "E-mail cliente": dadosCliente.email||"—",
      "Telefone cliente": dadosCliente.telefone||"—",
      "Número do auto": dadosMulta?.numero_auto||"—",
      "Infração": dadosMulta?.descricao_infracao||"—",
      "Placa": dadosMulta?.placa||"—",
      "Valor da multa": dadosMulta?.valor_multa||"—",
      "Histórico da penalidade": historico_penalidade||"—",
      "Recurso (primeiros 500 chars)": recurso?.slice(0,500)||"—",
    });
    setTimeout(() => { setFase("sucesso"); setTimeout(onSuccess, 2000); }, 1600);
  };

  const fmtNum = v => v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const fmtVal = v => v.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d{0,2})/,"$1/$2");

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:18,width:"100%",maxWidth:430,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:600,letterSpacing:"0.08em"}}>{info.titulo.toUpperCase()}</div>
            <div style={{color:"#fff",fontWeight:800,fontSize:20}}>{info.preco}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{padding:22}}>
          {fase === "escolha" && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
                {[{id:"pix",icon:"⚡",label:"PIX",sub:"Imediato"},{id:"cartao",icon:"💳",label:"Cartão",sub:"Crédito/débito"}].map(({id,icon,label,sub}) => (
                  <button key={id} onClick={() => setMetodo(id)} style={{padding:"12px 8px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",textAlign:"center",border:`2px solid ${metodo===id?C.green500:C.border}`,background:metodo===id?C.green50:C.white,transition:"all 0.2s"}}>
                    <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                    <div style={{fontWeight:700,color:C.text,fontSize:13}}>{label}</div>
                    <div style={{fontSize:11,color:C.textMuted}}>{sub}</div>
                  </button>
                ))}
              </div>
              {metodo === "pix" && (
                <div style={{textAlign:"center"}}>
                  <div style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:10,padding:16,display:"inline-block",marginBottom:12}}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <rect width="100" height="100" fill="white"/>
                      <rect x="5" y="5" width="32" height="32" fill="none" stroke={C.green700} strokeWidth="3" rx="2"/>
                      <rect x="63" y="5" width="32" height="32" fill="none" stroke={C.green700} strokeWidth="3" rx="2"/>
                      <rect x="5" y="63" width="32" height="32" fill="none" stroke={C.green700} strokeWidth="3" rx="2"/>
                      <rect x="12" y="12" width="18" height="18" fill={C.green700} rx="1"/>
                      <rect x="70" y="12" width="18" height="18" fill={C.green700} rx="1"/>
                      <rect x="12" y="70" width="18" height="18" fill={C.green700} rx="1"/>
                      {[42,52,62,42,52,62].map((x,i) => <rect key={i} x={x} y={12+i*8} width="7" height="6" fill={C.green600} rx="1"/>)}
                    </svg>
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:11,color:C.textMuted,background:C.offWhite,borderRadius:7,padding:"7px 12px",marginBottom:12}}>multa-ai@pagamento.com</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                    <button onClick={() => navigator.clipboard.writeText("multa-ai@pagamento.com")} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📋 Copiar</button>
                    <button onClick={processar} style={{padding:"7px 18px",borderRadius:7,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Já paguei →</button>
                  </div>
                </div>
              )}
              {metodo === "cartao" && (
                <div>
                  {[{l:"Número",k:"numero",p:"0000 0000 0000 0000",f:fmtNum},{l:"Nome no cartão",k:"nome",p:"JOAO DA SILVA",f:v=>v.toUpperCase()},{l:"Validade",k:"validade",p:"MM/AA",f:fmtVal},{l:"CVV",k:"cvv",p:"123",f:v=>v.replace(/\D/g,"").slice(0,4)}].map(({l,k,p,f}) => (
                    <div key={k} style={{marginBottom:11}}>
                      <label style={{fontSize:11,color:C.textMuted,display:"block",marginBottom:5,fontWeight:600}}>{l}</label>
                      <input value={cartao[k]} onChange={e => setCartao(prev=>({...prev,[k]:f(e.target.value)}))} placeholder={p}
                        style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:13,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                  ))}
                  {err && <div style={{color:C.danger,fontSize:12,marginBottom:10,padding:"7px 10px",background:C.dangerSoft,borderRadius:7}}>{err}</div>}
                  <button onClick={processar} style={{width:"100%",padding:"12px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    Pagar {info.preco} →
                  </button>
                </div>
              )}
              <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:12}}>🔒 Pagamento 100% seguro · SSL · PCI DSS</p>
            </>
          )}
          {fase === "processando" && <Spinner label="Processando..."/>}
          {fase === "sucesso" && (
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:C.green50,border:`2px solid ${C.green400}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px",boxShadow:`0 0 0 10px ${C.glow}`}}>✓</div>
              <div style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:6}}>Pagamento confirmado!</div>
              <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7}}>{info.confirmacao||"Obrigado pela contratação!"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Painel Advogado ───────────────────────────────────────────
function PainelAdvogado({ onLogout }) {
  // casos é readonly: carregado uma vez ao montar o painel
  const [casos, setCasos] = useState(() => DB.getAllCasos());
  useEffect(() => { setCasos(DB.getAllCasos()); }, []);
  const [sel, setSel] = useState(null);
  const [nota, setNota] = useState("");
  const [concluidos, setConcluidos] = useState({});
  const [pdfModal, setPdfModal] = useState(null);
  const isMobile = useIsMobile();

  return (
    <div style={{minHeight:"100vh",background:C.offWhite,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <header style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Logo size={30}/>
          <span style={{fontWeight:800,fontSize:16}}>Multa<span style={{color:C.green500}}>.AI</span></span>
          <span style={{background:C.green100,color:C.green700,fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,marginLeft:4}}>PAINEL ADVOGADO</span>
        </div>
        <button onClick={onLogout} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Sair</button>
      </header>
      {pdfModal && <PDFModal {...pdfModal} userName="Advogado" onClose={() => setPdfModal(null)}/>}
      <div style={{maxWidth:980,margin:"0 auto",padding:"28px 20px"}}>
        <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Casos recebidos</div>
        <div style={{color:C.textMuted,fontSize:14,marginBottom:24}}>{casos.length} caso{casos.length!==1?"s":""}</div>
        {casos.length === 0 ? (
          <div style={{textAlign:"center",padding:"60px 20px",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,color:C.textMuted}}>
            <div style={{fontSize:40,marginBottom:10}}>📭</div>
            <div style={{fontWeight:600,marginBottom:4}}>Nenhum caso ainda</div>
            <div style={{fontSize:13}}>Quando clientes contratarem planos, os casos aparecerão aqui.</div>
          </div>
        ) : (
          <div style={{display:"flex",gap:20,flexDirection:isMobile?"column":"row"}}>
            <div style={{width:isMobile?"100%":290,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
              {casos.map(c => (
                <div key={c.id} onClick={() => { setSel(c); setNota(""); }} style={{background:C.white,border:`2px solid ${sel?.id===c.id?C.green500:C.border}`,borderRadius:12,padding:"13px 15px",cursor:"pointer",transition:"all 0.2s",boxShadow:sel?.id===c.id?`0 0 0 3px ${C.glow}`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{fontWeight:700,fontSize:14}}>{c.clienteNome}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:concluidos[c.id]?C.green100:C.goldBg,color:concluidos[c.id]?C.green700:C.gold,border:`1px solid ${concluidos[c.id]?C.green100:C.goldBorder}`}}>
                      {concluidos[c.id]?"✓ Concluído":"⏳ Pendente"}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:C.textMuted,marginBottom:3}}>{c.clienteEmail}</div>
                  <div style={{fontSize:11,color:C.green600,fontWeight:600,marginBottom:3}}>{PLANOS_MAP[c.planoPago]?.titulo||c.planoPago} · {PLANOS_MAP[c.planoPago]?.preco}</div>
                  <div style={{fontSize:12,color:C.textMid}}>{c.dados?.descricao_infracao||"Infração"}</div>
                  <div style={{fontSize:11,color:C.textLight,marginTop:4}}>{fmtDate(c.data)}</div>
                </div>
              ))}
            </div>
            {sel ? (
              <div style={{flex:1,background:C.white,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:"rgba(255,255,255,0.65)",fontSize:11,marginBottom:2}}>CASO</div>
                    <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{sel.clienteNome} · {sel.clienteEmail}</div>
                  </div>
                  <button onClick={() => setPdfModal({recurso:sel.recurso,dados:sel.dados,historico_penalidade:sel.historico_penalidade})} style={{padding:"6px 12px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📄 Ver recurso</button>
                </div>
                <div style={{padding:18}}>
                  {sel.historico_penalidade && (
                    <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#92400e"}}>
                      <strong>Histórico relatado:</strong><br/>{sel.historico_penalidade}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                    {Object.entries(sel.dados||{}).filter(([,v])=>v&&v!=="N/A").map(([k,v]) => (
                      <div key={k} style={{background:C.green50,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>{k.replace(/_/g," ")}</div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:"block",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.06em"}}>Feedback ao cliente</label>
                  <textarea value={nota} onChange={e=>setNota(e.target.value)} rows={4} placeholder="Observações, aprovação ou sugestões..."
                    style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit",lineHeight:1.6}}/>
                  <div style={{display:"flex",gap:10,marginTop:12}}>
                    <button onClick={() => setSel(null)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Voltar</button>
                    <button onClick={() => { setConcluidos(p=>({...p,[sel.id]:true})); setSel(null); }} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Marcar como revisado</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,minHeight:200,color:C.textMuted,fontSize:14}}>← Selecione um caso</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────
function LandingPage({ onOpenAuth }) {
  const isMobile = useIsMobile();
  return (
    <div style={{color:C.text}}>
      {/* Hero */}
      <section style={{background:`linear-gradient(160deg,${C.green900} 0%,${C.green700} 55%,${C.green600} 100%)`,padding:isMobile?"64px 20px 80px":"88px 40px 104px",position:"relative",overflow:"hidden"}}>
        {[480,350,230].map((r,i) => <div key={i} style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.05)",pointerEvents:"none"}}/>)}
        <div style={{maxWidth:740,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.1)",borderRadius:30,padding:"5px 14px",marginBottom:26,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green400,boxShadow:"0 0 0 3px rgba(52,211,153,0.3)"}}/>
            <span style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontWeight:600}}>Baseado no CTB 2025</span>
          </div>
          <h1 style={{color:"#fff",fontSize:isMobile?"30px":"50px",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.1,marginBottom:18}}>
            Cada multa tem uma defesa.<br/><span style={{color:C.green400}}>A sua também.</span>
          </h1>
          <p style={{color:"rgba(255,255,255,0.72)",fontSize:isMobile?14:17,lineHeight:1.7,maxWidth:520,margin:"0 auto 34px"}}>
            Envie o auto de infração, a IA analisa e gera um recurso completo fundamentado no CTB em segundos.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={() => onOpenAuth("signup")} style={{padding:"14px 30px",borderRadius:11,border:"none",background:C.green400,color:C.green900,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(52,211,153,0.4)"}}>Criar conta grátis →</button>
            <button onClick={() => onOpenAuth("login")} style={{padding:"14px 26px",borderRadius:11,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.85)",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Já tenho conta</button>
          </div>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:11,marginTop:18}}>Plano IA Essencial a partir de R$ 69,90</p>
        </div>
      </section>

      {/* Stats */}
      <section style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"22px 32px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"grid",gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:16}}>
          {[{n:"30 dias",label:"Prazo legal para recurso"},{n:"Art. 283",label:"Base legal no CTB"},{n:"JARI",label:"Junta de Recursos"},{n:"2 Planos",label:"IA ou revisão jurídica"}].map(({n,label}) => (
            <div key={n} style={{textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:isMobile?20:22,color:C.green600,marginBottom:3}}>{n}</div>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.5}}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" style={{background:C.offWhite,padding:isMobile?"48px 20px":"68px 40px"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:44}}>
            <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.1em",marginBottom:8,textTransform:"uppercase"}}>Como funciona</div>
            <h2 style={{fontSize:isMobile?24:32,fontWeight:800,letterSpacing:"-0.03em"}}>Simples, rápido e fundamentado</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?1:2},1fr)`,gap:18}}>
            {[
              {icon:"📤",title:"Upload do auto de infração",desc:"Envie foto ou PDF. Aceita múltiplos arquivos para casos complexos."},
              {icon:"📝",title:"Histórico da penalidade",desc:"Descreva o contexto para fortalecer os argumentos de defesa da IA."},
              {icon:"🤖",title:"IA gera o recurso",desc:"Analisa e redige um recurso completo fundamentado no CTB e CONTRAN."},
              {icon:"⚖️",title:"Escolha seu plano",desc:"Baixe o PDF (IA Essencial) ou contrate revisão jurídica com assinatura OAB."},
            ].map(({icon,title,desc},i) => (
              <div key={title} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"22px 20px",display:"flex",gap:16,alignItems:"flex-start",boxShadow:`0 2px 12px ${C.glow}`}}>
                <div style={{width:46,height:46,borderRadius:11,background:C.green50,border:`1px solid ${C.green100}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontWeight:800,fontSize:14}}>{title}</span>
                    <span style={{width:18,height:18,borderRadius:"50%",background:C.green500,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span>
                  </div>
                  <div style={{fontSize:13,color:C.textMuted,lineHeight:1.65}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section style={{background:C.white,padding:isMobile?"48px 20px":"68px 40px",borderTop:`1px solid ${C.border}`}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.1em",marginBottom:8,textTransform:"uppercase"}}>Planos</div>
            <h2 style={{fontSize:isMobile?24:32,fontWeight:800,letterSpacing:"-0.03em"}}>Escolha o suporte ideal</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
            {PLANOS.map(p => (
              <div key={p.id} style={{background:p.destaque?C.green50:C.white,border:`2px solid ${p.destaque?C.green500:C.border}`,borderRadius:16,padding:"24px 20px",display:"flex",flexDirection:"column",boxShadow:p.destaque?`0 6px 24px ${C.glowStrong}`:"none"}}>
                {p.badge && <div style={{background:C.green600,color:"#fff",fontSize:10,fontWeight:800,letterSpacing:"0.1em",textAlign:"center",padding:"5px 0",borderRadius:8,marginBottom:14}}>{p.badge}</div>}
                <div style={{fontSize:26,marginBottom:10}}>{p.icon}</div>
                <div style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:6}}>{p.titulo}</div>
                <div style={{fontWeight:800,fontSize:28,color:p.cor,marginBottom:16,letterSpacing:"-0.03em"}}>{p.preco}</div>
                <div style={{flex:1,marginBottom:20}}>
                  {p.itens.map((item,i) => (
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                      <span style={{color:C.green500,fontSize:13,flexShrink:0,marginTop:1}}>✓</span>
                      <span style={{fontSize:13,color:C.textMuted,lineHeight:1.5}}>{item}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => onOpenAuth("signup")} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:p.destaque?`linear-gradient(135deg,${p.cor},${C.green500})`:C.surface,color:p.destaque?"#fff":C.textMid,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:p.destaque?`0 4px 14px ${C.glowStrong}`:"none"}}>
                  Começar →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legislação */}
      <section style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,padding:isMobile?"48px 20px":"68px 40px"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:34}}>
            <div style={{fontSize:11,fontWeight:700,color:C.green400,letterSpacing:"0.1em",marginBottom:8,textTransform:"uppercase"}}>Legislação</div>
            <h2 style={{fontSize:isMobile?22:30,fontWeight:800,letterSpacing:"-0.03em",color:"#fff"}}>Conheça seus direitos</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?1:2},1fr)`,gap:12}}>
            {TIPS.map(({art,tip}) => (
              <div key={art} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderLeft:`3px solid ${C.green400}`,borderRadius:10,padding:"13px 15px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green400,letterSpacing:"0.06em",marginBottom:4}}>{art}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.65}}>{tip}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{background:C.green900,padding:"24px 32px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}><Logo size={26}/><span style={{color:"rgba(255,255,255,0.7)",fontWeight:700,fontSize:14}}>Multa<span style={{color:C.green400}}>.AI</span></span></div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",lineHeight:1.6,textAlign:isMobile?"center":"right"}}>© 2025 Multa.AI · Recursos administrativos de trânsito<br/>Obrigação de meio, não de resultado.</div>
        </div>
      </footer>
    </div>
  );
}

// ── Aba Documentos ────────────────────────────────────────────
function AbaDocumentos({ setView }) {
  const isMobile = useIsMobile();
  const [checados, setChecados] = useState({});
  const toggle = id => setChecados(p => ({...p,[id]:!p[id]}));

  const GRUPOS = [
    { titulo:"Documentos do Condutor / Proprietário", icon:"👤", cor:C.green700, docs:[
      {id:"cnh",label:"CNH — Carteira Nacional de Habilitação",desc:"Cópia frente e verso. Deve estar dentro da validade.",obrig:true},
      {id:"rg",label:"RG ou documento de identidade com foto",desc:"CPF e RG, ou CNH como documento único.",obrig:true},
      {id:"cpf",label:"CPF",desc:"Caso não esteja no documento de identidade.",obrig:true},
      {id:"endereco",label:"Comprovante de endereço",desc:"Emitido nos últimos 90 dias (conta de luz, água, banco).",obrig:true},
      {id:"contato",label:"E-mail e telefone de contato",desc:"Para receber notificações sobre o andamento do recurso.",obrig:true},
    ]},
    { titulo:"Documentos do Veículo", icon:"🚗", cor:C.green600, docs:[
      {id:"crlv",label:"CRLV — Certificado de Registro e Licenciamento",desc:"Documento atual do veículo. Cópia frente e verso.",obrig:true},
      {id:"seguro",label:"Apólice de seguro (se houver)",desc:"Pode auxiliar na comprovação de uso do veículo.",obrig:false},
    ]},
    { titulo:"Documentos da Infração", icon:"📄", cor:C.green800, docs:[
      {id:"auto",label:"Auto de infração ou notificação de autuação",desc:"Original ou cópia do documento recebido.",obrig:true},
      {id:"notif",label:"Notificação de penalidade (se já recebida)",desc:"Segunda notificação com valor da multa e pontos.",obrig:false},
      {id:"foto_local",label:"Fotos do local da infração (se disponível)",desc:"Imagens que comprovem sinalização deficiente, ausência de placas etc.",obrig:false},
      {id:"testemunha",label:"Declaração de testemunhas (se houver)",desc:"Declaração escrita e assinada de quem presenciou o fato.",obrig:false},
    ]},
    { titulo:"Documentos por Tipo de Infração", icon:"⚖️", cor:C.green900, docs:[
      {id:"laudo_radar",label:"Radar/velocidade: laudo técnico do equipamento",desc:"Solicite ao órgão autuador o certificado de calibração.",obrig:false},
      {id:"cnh_terceiro",label:"Infração por outro condutor: CNH do condutor real",desc:"CNH e declaração de quem estava ao volante.",obrig:false},
      {id:"med",label:"Emergência médica: atestado ou relatório médico",desc:"Documento que comprove a urgência da situação.",obrig:false},
    ]},
  ];

  const total = GRUPOS.reduce((a,g) => a+g.docs.length, 0);
  const totalChecados = Object.values(checados).filter(Boolean).length;
  const pct = Math.round((totalChecados/total)*100);

  return (
    <div style={{maxWidth:860,margin:"0 auto",padding:isMobile?"20px 16px":"28px 24px",animation:"fadeUp 0.3s ease both"}}>

      {/* Banner upload de documentos de qualificação */}
      <div style={{background:C.white,border:`2px solid ${C.green200}`,borderRadius:14,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"flex-start",gap:14}}>
        <span style={{fontSize:24,flexShrink:0}}>📎</span>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>Envie seus documentos para agilizar a qualificação do recurso</div>
          <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7,marginBottom:10}}>
            Ao contratar o plano de Revisão Jurídica, o advogado precisará dos seus documentos para qualificar o recurso. Separe com antecedência:
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
            {[
              {icon:"🪪",label:"CNH frente e verso",desc:"Dentro da validade"},
              {icon:"📋",label:"RG ou identidade com foto",desc:"CPF incluído ou separado"},
              {icon:"🏠",label:"Comprovante de endereço",desc:"Últimos 90 dias — luz, água ou banco"},
              {icon:"🚗",label:"CRLV do veículo",desc:"Documento de licenciamento atual"},
            ].map(({icon,label,desc}) => (
              <div key={label} style={{display:"flex",alignItems:"center",gap:10,background:C.green50,border:`1px solid ${C.green100}`,borderRadius:9,padding:"10px 12px"}}>
                <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{label}</div>
                  <div style={{fontSize:11,color:C.textMuted}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,borderRadius:16,padding:isMobile?"20px":"28px 32px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        {[300,200,120].map((r,i) => <div key={i} style={{position:"absolute",right:-60+i*20,top:"50%",transform:"translateY(-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.05)",pointerEvents:"none"}}/>)}
        <div style={{position:"relative",zIndex:1}}>
          <div style={{color:C.green400,fontSize:11,fontWeight:700,letterSpacing:"0.08em",marginBottom:8}}>CHECKLIST</div>
          <div style={{color:"#fff",fontWeight:800,fontSize:isMobile?18:22,marginBottom:8}}>Documentos para Protocolo do Recurso</div>
          <p style={{color:"rgba(255,255,255,0.65)",fontSize:13,lineHeight:1.7,marginBottom:16}}>Marque os documentos que você já possui.</p>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:20,height:8,overflow:"hidden",maxWidth:400}}>
            <div style={{background:C.green400,height:"100%",width:`${pct}%`,borderRadius:20,transition:"width 0.4s"}}/>
          </div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:6}}>{totalChecados} de {total} · {pct}% completo</div>
        </div>
      </div>

      {GRUPOS.map(grupo => (
        <div key={grupo.titulo} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",marginBottom:16}}>
          <div style={{background:grupo.cor,padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{grupo.icon}</span>
            <div style={{color:"#fff",fontWeight:700,fontSize:14}}>{grupo.titulo}</div>
          </div>
          {grupo.docs.map(doc => (
            <div key={doc.id} onClick={() => toggle(doc.id)}
              style={{display:"flex",alignItems:"flex-start",gap:14,padding:"14px 20px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,background:checados[doc.id]?C.green50:"transparent",transition:"background 0.2s"}}>
              <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${checados[doc.id]?C.green500:C.border}`,background:checados[doc.id]?C.green500:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.2s"}}>
                {checados[doc.id] && <span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:600,color:checados[doc.id]?C.green700:C.text,textDecoration:checados[doc.id]?"line-through":"none"}}>{doc.label}</span>
                  {doc.obrig
                    ? <span style={{fontSize:10,fontWeight:700,background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:20,padding:"1px 8px"}}>OBRIGATÓRIO</span>
                    : <span style={{fontSize:10,fontWeight:700,background:C.green50,color:C.green700,border:`1px solid ${C.green100}`,borderRadius:20,padding:"1px 8px"}}>OPCIONAL</span>
                  }
                </div>
                <div style={{fontSize:12,color:C.textMuted,lineHeight:1.5}}>{doc.desc}</div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,borderRadius:14,padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
        <div>
          <div style={{color:"#fff",fontWeight:700,fontSize:15,marginBottom:4}}>Quer suporte jurídico?</div>
          <div style={{color:"rgba(255,255,255,0.65)",fontSize:13}}>Contrate a Revisão Jurídica com assinatura OAB por R$ 199,00.</div>
        </div>
        <button onClick={() => setView("advogado")} style={{padding:"11px 22px",borderRadius:10,border:"none",background:C.green400,color:C.green900,fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Ver planos →</button>
      </div>
    </div>
  );
}

// ── Aba Planos (Advogado) ─────────────────────────────────────
function AbaPlanos({ user, recursoAtual, dadosMulta, historico_penalidade, onPlanoPago }) {
  const [planoPago, setPlanoPago] = useState(null);
  const [showPagamento, setShowPagamento] = useState(null);
  const isMobile = useIsMobile();

  const aoConfirmar = () => {
    const planoId = showPagamento;
    setPlanoPago(planoId);
    setShowPagamento(null);
    // FIX: propaga o plano pago para o AppLogado
    onPlanoPago(planoId);
  };

  return (
    <div style={{maxWidth:800,margin:"0 auto",padding:isMobile?"20px 16px":"28px 24px"}}>
      {showPagamento && (
        <PagamentoModal
          plano={showPagamento}
          onClose={() => setShowPagamento(null)}
          onSuccess={aoConfirmar}
          dadosCliente={{nome:user?.nome, email:user?.email, telefone:user?.perfil?.telefone}}
          dadosMulta={dadosMulta}
          recurso={recursoAtual}
          historico_penalidade={historico_penalidade}
        />
      )}

      <div style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,borderRadius:16,padding:isMobile?"20px":"28px 32px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        {[320,220,130].map((r,i) => <div key={i} style={{position:"absolute",right:-60+i*20,top:"50%",transform:"translateY(-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.05)",pointerEvents:"none"}}/>)}
        <div style={{position:"relative",zIndex:1}}>
          <div style={{color:C.green400,fontSize:11,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>PLANOS DISPONÍVEIS</div>
          <div style={{color:"#fff",fontWeight:800,fontSize:isMobile?18:22}}>Escolha como usar seu recurso</div>
          <p style={{color:"rgba(255,255,255,0.65)",fontSize:13,lineHeight:1.7,maxWidth:520,marginTop:8}}>Do download automático à revisão com assinatura OAB.</p>
        </div>
      </div>

      {planoPago && (
        <div style={{background:C.white,border:`2px solid ${C.green400}`,borderRadius:14,padding:"18px 22px",marginBottom:24,display:"flex",alignItems:"center",gap:14,boxShadow:`0 4px 20px ${C.glow}`}}>
          <div style={{width:46,height:46,borderRadius:"50%",background:C.green50,border:`2px solid ${C.green400}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,boxShadow:`0 0 0 6px ${C.glow}`}}>✓</div>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>{PLANOS_MAP[planoPago]?.titulo} — contratado!</div>
            <div style={{fontSize:13,color:C.textMuted,lineHeight:1.6}}>{PLANOS_MAP[planoPago]?.confirmacao}</div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginBottom:20}}>
        {PLANOS.map(plano => (
          <div key={plano.id} style={{background:C.white,border:`2px solid ${planoPago===plano.id?C.green500:plano.destaque?plano.cor:C.border}`,borderRadius:16,overflow:"hidden",boxShadow:plano.destaque?`0 6px 24px ${C.glowStrong}`:"0 2px 8px rgba(0,0,0,0.04)",display:"flex",flexDirection:"column",transition:"all 0.2s"}}>
            {plano.badge && <div style={{background:C.green600,color:"#fff",fontSize:10,fontWeight:800,letterSpacing:"0.1em",textAlign:"center",padding:"5px 0"}}>{plano.badge}</div>}
            <div style={{padding:"22px 20px",flex:1,display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:28,marginBottom:10}}>{plano.icon}</div>
              <div style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:6}}>{plano.titulo}</div>
              <div style={{fontWeight:800,fontSize:28,color:plano.cor,marginBottom:16,letterSpacing:"-0.03em"}}>{plano.preco}</div>
              <div style={{flex:1,marginBottom:18}}>
                {plano.itens.map((item,i) => (
                  <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:C.green50,border:`1.5px solid ${C.green400}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                      <span style={{color:C.green600,fontSize:9,fontWeight:800}}>✓</span>
                    </div>
                    <span style={{fontSize:13,color:C.textMuted,lineHeight:1.5}}>{item}</span>
                  </div>
                ))}
              </div>
              {planoPago === plano.id ? (
                <div style={{padding:"11px",borderRadius:10,background:C.green50,border:`1px solid ${C.green100}`,textAlign:"center",fontSize:13,fontWeight:700,color:C.green700}}>✓ Contratado</div>
              ) : (
                <button onClick={() => !planoPago && setShowPagamento(plano.id)} disabled={!!planoPago}
                  style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:planoPago?C.surface:`linear-gradient(135deg,${plano.cor},${plano.id==="essencial"?C.green500:C.green600})`,color:planoPago?C.textLight:"#fff",fontSize:14,fontWeight:700,cursor:planoPago?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:plano.destaque&&!planoPago?`0 4px 14px ${C.glowStrong}`:"none",transition:"all 0.2s"}}>
                  Contratar →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* WhatsApp */}
      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Tenho uma dúvida sobre recurso de multa de trânsito.`} target="_blank" rel="noopener noreferrer"
        style={{background:"#dcfce7",border:"2px solid #22c55e",borderRadius:14,padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16,textDecoration:"none",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>💬</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#166534",marginBottom:2}}>Fale com um especialista pelo WhatsApp</div>
            <div style={{fontSize:12,color:"#166534",opacity:0.8}}>Tire suas dúvidas antes de contratar</div>
          </div>
        </div>
        <div style={{padding:"10px 20px",borderRadius:9,background:"#22c55e",color:"#fff",fontSize:13,fontWeight:800,whiteSpace:"nowrap"}}>
          Abrir WhatsApp →
        </div>
      </a>

      <div style={{padding:"10px 14px",background:C.green50,border:`1px solid ${C.green100}`,borderRadius:9,fontSize:11,color:C.textMuted,lineHeight:1.6}}>
        🔒 Pagamento seguro · SSL · PCI DSS · Advogados registrados na OAB · Obrigação de meio, não de resultado.
      </div>
    </div>
  );
}

// ── App Logado ────────────────────────────────────────────────
function AppLogado({ user, setUser, view, setView }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [recurso, setRecurso] = useState("");
  const [dadosMulta, setDadosMulta] = useState(null);
  const [historicoPenalidade, setHistoricoPenalidade] = useState("");
  const [error, setError] = useState("");
  const [tipIdx, setTipIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [planoPagoAtual, setPlanoPagoAtual] = useState(null);
  const [historicoId, setHistoricoId] = useState(null);
  const fileRef = useRef();
  const isMobile = useIsMobile();
  const historico = user.historico || [];

  const historicoIdRef = useRef(null);
  const historicoPenalidadeRef = useRef("");

  // Sync ref com state
  useEffect(() => { historicoPenalidadeRef.current = historicoPenalidade; }, [historicoPenalidade]);

  const salvarHistorico = useCallback((dados, rec) => {
    const id = Date.now().toString();
    historicoIdRef.current = id;
    setHistoricoId(id);
    const entry = {
      id, data: new Date().toISOString(), dados, recurso: rec,
      historico_penalidade: historicoPenalidadeRef.current,
      planoPago: null
    };
    DB.addHistorico(user.email, entry);
    setUser(u => ({...u, historico:[entry,...(u.historico||[])]}));
    return id;
  }, [user.email, setUser]);

  // Fix: usa ref para garantir historicoId mais recente mesmo em closure
  const aoPlanoContratado = useCallback((planoId) => {
    setPlanoPagoAtual(planoId);
    const hid = historicoIdRef.current;
    if (hid) {
      DB.updateHistorico(user.email, hid, { planoPago: planoId });
      setUser(u => ({...u, historico: u.historico.map(h => h.id===hid ? {...h, planoPago:planoId} : h)}));
    }
  }, [user.email, setUser]);

  const handleFiles = useCallback((newFiles) => {
    setError("");
    const valid = Array.from(newFiles).filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    if (valid.length === 0) { setError("Envie imagens (JPG, PNG) ou PDFs."); return; }
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  }, []);

  const removeFile = (i) => setFiles(prev => prev.filter((_,idx) => idx !== i));

  const executarGeracao = useCallback(async () => {
    if (files.length === 0) return;
    setStep(3); setError("");
    const penalidade = historicoPenalidadeRef.current;
    try {
      const f = files[0];
      const isPdf = f.type === "application/pdf";
      const mediaType = isPdf ? "application/pdf" : (f.type || "image/jpeg");
      const fileB64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const response = await fetch("/api/recurso", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fileB64, fileType: isPdf ? "pdf" : "image", mediaType, historicoPenalidade: penalidade })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${response.status}`);
      }
      const parsed = await response.json();
      if (!parsed.dados || !parsed.recurso) throw new Error("Resposta incompleta da IA.");
      setDadosMulta(parsed.dados);
      setRecurso(parsed.recurso);
      salvarHistorico(parsed.dados, parsed.recurso);
      setStep(4);
    } catch(e) {
      const msg = e.message || "";
      if (msg.includes("configurada")) setError("Chave de API não configurada. Verifique as variáveis de ambiente na Vercel.");
      else if (msg.includes("502") || msg.includes("IA")) setError("Erro ao processar com a IA. Tente novamente em alguns segundos.");
      else setError("Não foi possível analisar. Verifique se a imagem está legível e tente novamente.");
      setStep(2);
    }
  }, [files, salvarHistorico]);

  // FIX: ao clicar em gerar, mostra disclaimer. Só executa após aceite.
  const clicarGerar = () => {
    if (files.length === 0) return;
    setShowDisclaimer(true);
  };

  const aoAceitarDisclaimer = () => {
    setShowDisclaimer(false);
    executarGeracao(); // chama diretamente, sem depender de estado
  };

  const resetar = () => {
    setStep(1); setFiles([]); setDadosMulta(null); setRecurso("");
    setHistoricoPenalidade(""); setError(""); setPlanoPagoAtual(null);
    setHistoricoId(null); historicoIdRef.current = null;
    historicoPenalidadeRef.current = "";
  };

  const STEPS_LABELS = ["Upload","Histórico","Gerando","Recurso"];
  const podeBaixarPDF = planoPagoAtual !== null;

  return (
    <>
      {showDisclaimer && <DisclaimerModal onAceitar={aoAceitarDisclaimer} onRecusar={() => setShowDisclaimer(false)}/>}
      {pdfModal && <PDFModal {...pdfModal} userName={user.nome} onClose={() => setPdfModal(null)}/>}

      {/* Abas */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",overflowX:"auto"}}>
        {[{id:"home",label:"📄 Gerar Recurso"},{id:"documentos",label:"📋 Documentos"},{id:"advogado",label:"⚖️ Planos"},{id:"historico",label:"🕓 Histórico"}].map(({id,label}) => (
          <button key={id} onClick={() => setView(id)} style={{padding:"14px 18px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:view===id?700:400,color:view===id?C.green700:C.textMuted,whiteSpace:"nowrap",borderBottom:`2px solid ${view===id?C.green500:"transparent"}`,transition:"all 0.2s"}}>{label}</button>
        ))}
      </div>

      {/* Steps — só na aba home */}
      {view==="home" && step < 4 && (
        <div style={{background:C.offWhite,borderBottom:`1px solid ${C.border}`,padding:`10px ${isMobile?16:28}px`,display:"flex",alignItems:"center",gap:6,overflowX:"auto"}}>
          {STEPS_LABELS.map((label,i) => {
            const n=i+1, done=step>n, active=step===n;
            return (
              <div key={n} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:done?C.green500:active?C.green600:C.surface,color:done||active?"#fff":C.textLight,border:`2px solid ${done?C.green500:active?C.green600:C.border}`,boxShadow:active?`0 0 0 3px ${C.glow}`:"none",transition:"all 0.3s"}}>{done?"✓":n}</div>
                  <span style={{fontSize:12,fontWeight:active?700:400,color:active?C.text:done?C.textMid:C.textLight}}>{label}</span>
                </div>
                {i < STEPS_LABELS.length-1 && <div style={{width:20,height:2,margin:"0 6px",background:step>n?C.green400:C.border,borderRadius:2,transition:"background 0.4s"}}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* Aba Planos */}
      {view==="advogado" && <AbaPlanos user={user} recursoAtual={recurso} dadosMulta={dadosMulta} historico_penalidade={historicoPenalidade} onPlanoPago={aoPlanoContratado}/>}

      {/* Aba Documentos */}
      {view==="documentos" && <AbaDocumentos setView={setView}/>}

      {/* Aba Histórico */}
      {view==="historico" && (
        <div style={{maxWidth:800,margin:"0 auto",padding:"28px 20px",animation:"fadeUp 0.3s ease both"}}>
          <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Seus recursos</div>
          <div style={{color:C.textMuted,fontSize:14,marginBottom:20}}>{historico.length} recurso{historico.length!==1?"s":""} gerado{historico.length!==1?"s":""}</div>
          {historico.length === 0 ? (
            <div style={{textAlign:"center",padding:"56px 20px",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:10}}>📄</div>
              <div style={{fontWeight:600,marginBottom:8}}>Nenhum recurso ainda</div>
              <button onClick={() => setView("home")} style={{padding:"10px 22px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Gerar recurso →</button>
            </div>
          ) : historico.map(h => (
            <div key={h.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"15px 18px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{h.dados?.descricao_infracao||"Infração"}</div>
                  <div style={{fontSize:12,color:C.textMuted}}>{fmtDate(h.data)} · Placa: {h.dados?.placa||"—"} · {h.dados?.valor_multa||"—"}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {h.planoPago && <span style={{fontSize:11,background:C.green50,color:C.green700,border:`1px solid ${C.green100}`,borderRadius:20,padding:"2px 10px",fontWeight:600}}>✓ {PLANOS_MAP[h.planoPago]?.titulo}</span>}
                  {h.planoPago ? (
                    <button onClick={() => setPdfModal({recurso:h.recurso,dados:h.dados,historico_penalidade:h.historico_penalidade})} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📄 Ver PDF</button>
                  ) : (
                    <span style={{fontSize:11,color:C.textMuted,background:C.surface,borderRadius:20,padding:"3px 10px",border:`1px solid ${C.border}`}}>🔒 Contrate um plano</span>
                  )}
                </div>
              </div>
              <div style={{fontSize:12,color:C.textMuted,background:C.offWhite,borderRadius:7,padding:"7px 11px",lineHeight:1.6,maxHeight:52,overflow:"hidden",whiteSpace:"pre-wrap"}}>{h.recurso?.slice(0,220)}...</div>
            </div>
          ))}
        </div>
      )}

      {/* Aba Home */}
      {view==="home" && (
        <div style={{maxWidth:1060,margin:"0 auto",padding:`24px ${isMobile?16:22}px 60px`,display:"flex",gap:22,flexDirection:isMobile?"column":"row"}}>
          <div style={{flex:1,minWidth:0}}>

            {/* STEP 1: Upload */}
            {step===1 && (
              <div style={{animation:"fadeUp 0.35s ease both",background:C.white,borderRadius:16,border:`1px solid ${C.border}`,boxShadow:`0 2px 16px ${C.glow}`,overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"20px 24px",position:"relative",overflow:"hidden"}}>
                  {[150,100,60].map((r,i) => <div key={i} style={{position:"absolute",right:-24+i*6,top:"50%",transform:"translateY(-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.07)",pointerEvents:"none"}}/>)}
                  <div style={{position:"relative",zIndex:1}}>
                    <div style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:600,letterSpacing:"0.08em",marginBottom:5}}>PASSO 1 DE 4</div>
                    <h2 style={{color:"#fff",fontSize:isMobile?17:20,fontWeight:800,letterSpacing:"-0.03em",marginBottom:5}}>Envie o auto de infração</h2>
                    <p style={{color:"rgba(255,255,255,0.68)",fontSize:12,lineHeight:1.6}}>Foto ou PDF legível · Aceita múltiplos arquivos (máx. 5)</p>
                  </div>
                </div>
                <div style={{padding:"20px 24px"}}>
                  <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
                    onDrop={e=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}
                    onClick={() => fileRef.current.click()}
                    style={{border:`2px dashed ${dragging?C.green500:files.length>0?C.green400:C.border}`,borderRadius:12,padding:"24px 18px",textAlign:"center",cursor:"pointer",background:dragging?C.green50:files.length>0?C.green50:C.offWhite,transition:"all 0.2s",marginBottom:14}}>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{display:"none"}} onChange={e => handleFiles(e.target.files)}/>
                    {files.length === 0 ? (
                      <div>
                        <div style={{fontSize:32,marginBottom:8}}>📄</div>
                        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Arraste ou clique para enviar</div>
                        <div style={{fontSize:12,color:C.textMuted}}>JPG, PNG ou PDF · Múltiplos arquivos · máx. 5</div>
                      </div>
                    ) : (
                      <div style={{fontSize:13,color:C.green600,fontWeight:600}}>{files.length} arquivo{files.length>1?"s":""} selecionado{files.length>1?"s":""} · Clique para adicionar mais</div>
                    )}
                  </div>

                  {/* Lista de arquivos */}
                  {files.length > 0 && (
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                      {files.map((f,i) => (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px"}}>
                          <span style={{fontSize:14}}>{f.type.startsWith("image/")?"🖼️":"📄"}</span>
                          <span style={{fontSize:11,color:C.textMid,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                          <button onClick={e=>{e.stopPropagation();removeFile(i);}} style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:16,padding:0,lineHeight:1,display:"flex",alignItems:"center"}}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && <div style={{color:C.danger,fontSize:13,marginBottom:12,padding:"8px 12px",background:C.dangerSoft,borderRadius:8,border:"1px solid #fca5a5"}}>{error}</div>}

                  <button onClick={() => files.length > 0 && setStep(2)} disabled={files.length===0}
                    style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:files.length>0?`linear-gradient(135deg,${C.green700},${C.green500})`:C.surface,color:files.length>0?"#fff":C.textLight,fontSize:14,fontWeight:800,cursor:files.length>0?"pointer":"not-allowed",boxShadow:files.length>0?`0 4px 16px ${C.glowStrong}`:"none",transition:"all 0.2s",fontFamily:"inherit"}}>
                    {files.length > 0 ? "Próximo: histórico da penalidade →" : "Selecione pelo menos um arquivo"}
                  </button>
                  <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:10,lineHeight:1.6}}>🔒 Dados processados com segurança</p>
                </div>
              </div>
            )}

            {/* STEP 2: Histórico da penalidade */}
            {step===2 && (
              <div style={{animation:"fadeUp 0.35s ease both",background:C.white,borderRadius:16,border:`1px solid ${C.border}`,boxShadow:`0 2px 16px ${C.glow}`,overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"20px 24px"}}>
                  <div style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:600,letterSpacing:"0.08em",marginBottom:5}}>PASSO 2 DE 4</div>
                  <h2 style={{color:"#fff",fontSize:isMobile?17:20,fontWeight:800,letterSpacing:"-0.03em",marginBottom:5}}>Histórico da penalidade</h2>
                  <p style={{color:"rgba(255,255,255,0.68)",fontSize:12,lineHeight:1.6}}>Descreva o contexto para fortalecer a defesa (opcional)</p>
                </div>
                <div style={{padding:"20px 24px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <label style={{fontSize:13,fontWeight:600,color:C.text}}>O que aconteceu?</label>
                    <span style={{fontSize:11,color:historicoPenalidade.length>450?C.danger:C.textMuted}}>{historicoPenalidade.length}/500</span>
                  </div>
                  <textarea value={historicoPenalidade}
                    onChange={e => { if(e.target.value.length<=500) setHistoricoPenalidade(e.target.value); }}
                    rows={5} placeholder="Ex: A infração ocorreu em cruzamento sem sinalização adequada. A placa de preferencial estava obstruída por vegetação..."
                    style={{width:"100%",background:C.offWhite,border:`1.5px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:13,lineHeight:1.75,padding:"12px 14px",outline:"none",fontFamily:"inherit",resize:"vertical",marginBottom:14}}
                    onFocus={e=>e.target.style.borderColor=C.green500} onBlur={e=>e.target.style.borderColor=C.border}/>
                  <div style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.textMid,lineHeight:1.6}}>
                    💡 Quanto mais detalhes, mais precisa será a defesa. Este campo é opcional.
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={() => setStep(1)} style={{padding:"12px 20px",borderRadius:11,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Voltar</button>
                    <button onClick={clicarGerar} style={{flex:1,padding:"13px",borderRadius:11,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 16px ${C.glowStrong}`}}>
                      Gerar Recurso com IA →
                    </button>
                  </div>
                  <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:10}}>Você precisará aceitar o disclaimer antes de continuar</p>
                </div>
              </div>
            )}

            {/* STEP 3: Gerando */}
            {step===3 && (
              <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`}}>
                <Spinner label="Analisando com IA..."/>
              </div>
            )}

            {/* STEP 4: Resultado */}
            {step===4 && dadosMulta && (
              <div style={{animation:"fadeUp 0.35s ease both"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,borderRadius:16,padding:"14px 20px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{color:"rgba(255,255,255,0.65)",fontSize:10,fontWeight:600,letterSpacing:"0.08em",marginBottom:2}}>RECURSO GERADO ✓</div>
                    <div style={{color:"#fff",fontWeight:800,fontSize:15}}>Pronto! Revise e edite o texto abaixo.</div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={resetar} style={{padding:"6px 13px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.8)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Novo</button>
                    <button onClick={() => { navigator.clipboard.writeText(recurso); setCopied(true); setTimeout(()=>setCopied(false),2000); }} style={{padding:"6px 14px",borderRadius:7,border:"none",background:copied?"#fff":"rgba(255,255,255,0.2)",color:copied?C.green700:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
                      {copied?"✓ Copiado!":"Copiar"}
                    </button>
                    {podeBaixarPDF && (
                      <button onClick={() => setPdfModal({recurso,dados:dadosMulta,historico_penalidade:historicoPenalidade})} style={{padding:"6px 13px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.8)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                        📄 PDF
                      </button>
                    )}
                  </div>
                </div>

                {/* Dados extraídos */}
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.07em",marginBottom:11,textTransform:"uppercase"}}>Dados extraídos</div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?138:162}px,1fr))`,gap:7}}>
                    {Object.entries(dadosMulta).filter(([,v])=>v&&v!=="N/A"&&v!=="—").map(([k,v]) => (
                      <div key={k} style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{k.replace(/_/g," ")}</div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prévia do recurso */}
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.07em",marginBottom:9,textTransform:"uppercase"}}>Prévia do recurso · edite se necessário</div>
                  <textarea value={recurso} onChange={e=>setRecurso(e.target.value)} rows={isMobile?10:13}
                    style={{width:"100%",background:C.offWhite,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:12,lineHeight:1.75,padding:"11px 13px",outline:"none",fontFamily:"inherit"}}/>
                </div>

                {/* PDF bloqueado / liberado */}
                {!podeBaixarPDF ? (
                  <div style={{background:"#fffbeb",border:"2px solid #fcd34d",borderRadius:13,padding:"16px 20px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:24}}>🔒</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:"#92400e",marginBottom:3}}>PDF disponível após contratar um plano</div>
                        <div style={{fontSize:12,color:"#b45309"}}>IA Essencial (R$ 69,90) libera o download · Revisão Jurídica inclui assinatura OAB</div>
                      </div>
                    </div>
                    <button onClick={() => setView("advogado")} style={{padding:"10px 20px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                      Ver planos →
                    </button>
                  </div>
                ) : (
                  <div style={{background:C.green50,border:`2px solid ${C.green400}`,borderRadius:13,padding:"16px 20px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:24}}>✅</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:C.green700,marginBottom:2}}>PDF liberado!</div>
                      <div style={{fontSize:12,color:C.textMuted}}>{PLANOS_MAP[planoPagoAtual]?.confirmacao}</div>
                    </div>
                  </div>
                )}

                <div style={{padding:"9px 13px",background:C.green50,border:`1px solid ${C.green100}`,borderRadius:9,fontSize:11,color:C.textMuted,lineHeight:1.6}}>
                  ⚠️ <strong style={{color:C.textMid}}>Aviso legal:</strong> Obrigação de meio, não de resultado. Verifique os prazos junto ao órgão autuador.
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {!isMobile && (
            <div style={{width:244,flexShrink:0,display:"flex",flexDirection:"column",gap:13}}>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:17}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.08em",marginBottom:11,textTransform:"uppercase"}}>💡 Saiba seus direitos</div>
                <div style={{background:C.green50,border:`1px solid ${C.green100}`,borderLeft:`3px solid ${C.green500}`,borderRadius:9,padding:"11px 13px",marginBottom:9}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.06em",marginBottom:3}}>{TIPS[tipIdx].art}</div>
                  <div style={{fontSize:12,color:C.textMid,lineHeight:1.65}}>{TIPS[tipIdx].tip}</div>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={() => setTipIdx(i=>(i-1+TIPS.length)%TIPS.length)} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:C.offWhite,color:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Ant.</button>
                  <button onClick={() => setTipIdx(i=>(i+1)%TIPS.length)} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:C.offWhite,color:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Próx. →</button>
                </div>
                <div style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:5}}>{tipIdx+1} / {TIPS.length}</div>
              </div>

              <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,borderRadius:13,padding:17}}>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:10,fontWeight:600,letterSpacing:"0.08em",marginBottom:7}}>⏱ ATENÇÃO AO PRAZO</div>
                <div style={{color:"#fff",fontWeight:700,fontSize:13,lineHeight:1.6}}>Você tem <span style={{fontSize:19,fontWeight:800}}>30 dias</span> para apresentar o recurso após a notificação.</div>
                <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,marginTop:4}}>Art. 283 do CTB</div>
              </div>

              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:17}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.08em",marginBottom:11,textTransform:"uppercase"}}>Planos</div>
                {PLANOS.map(p => (
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.icon} {p.titulo}</div>
                    <div style={{fontSize:12,fontWeight:700,color:p.cor,whiteSpace:"nowrap",marginLeft:6}}>{p.preco}</div>
                  </div>
                ))}
                <button onClick={() => setView("advogado")} style={{width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${C.green200}`,background:C.green50,color:C.green700,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver planos →</button>
              </div>

              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Tenho dúvida sobre recurso de multa.`} target="_blank" rel="noopener noreferrer"
                style={{background:"#dcfce7",border:"1px solid #22c55e",borderRadius:13,padding:"14px 17px",display:"flex",alignItems:"center",gap:10,textDecoration:"none",cursor:"pointer"}}>
                <span style={{fontSize:22}}>💬</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#166534"}}>WhatsApp</div>
                  <div style={{fontSize:11,color:"#166534",opacity:0.7}}>Fale com especialista</div>
                </div>
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────
const SESSION_KEY = "multaai_session";

export default function Root() {
  // Recupera sessão salva ao carregar a página
  const [user, setUser] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Recarrega dados frescos do DB para ter histórico atualizado
      const fresh = DB.get(parsed.email);
      return fresh ? { ...parsed, historico: fresh.historico || [], perfil: fresh.perfil || {} } : null;
    } catch { return null; }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [view, setView] = useState("home");
  const [showPerfil, setShowPerfil] = useState(false);
  const isMobile = useIsMobile();

  const openAuth = (mode="login") => { setAuthMode(mode); setAuthOpen(true); };

  const handleLogin = u => {
    setUser(u);
    setAuthOpen(false);
    setView("home");
    // Salva sessão no localStorage
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email:u.email, nome:u.nome, isAdv:u.isAdv||false })); } catch {}
  };

  const handleLogout = () => {
    setUser(null);
    setView("home");
    // Remove sessão salva
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  };

  // Sincroniza o user com o DB quando setUser é chamado
  const setUserSync = (updater) => {
    setUser(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Atualiza sessão salva com nome mais recente
      try { if (next) localStorage.setItem(SESSION_KEY, JSON.stringify({ email:next.email, nome:next.nome, isAdv:next.isAdv||false })); } catch {}
      return next;
    });
  };

  const isAdv = user?.isAdv === true;

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans','Helvetica Neue',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        textarea,input{font-family:'Plus Jakarta Sans',sans-serif!important;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#f7faf7;} ::-webkit-scrollbar-thumb{background:#c6dfc6;border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
      `}</style>

      {authOpen && <AuthDrawer onClose={() => setAuthOpen(false)} onLogin={handleLogin} initialMode={authMode}/>}
      {showPerfil && user && <PerfilModal user={user} setUser={setUserSync} onClose={() => setShowPerfil(false)}/>}

      {/* Header */}
      {!isAdv && (
        <header style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:`0 ${isMobile?14:28}px`,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:`0 1px 10px ${C.glow}`}}>
          {/* FIX: logo volta ao menu inicial */}
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
            onClick={() => {
              if (user) { setView("home"); }
              else { window.scrollTo({top:0,behavior:"smooth"}); }
            }}>
            <Logo size={32}/>
            <div>
              <div style={{fontWeight:800,fontSize:isMobile?14:16,letterSpacing:"-0.04em"}}>Multa<span style={{color:C.green500}}>.AI</span></div>
              {!isMobile && <div style={{fontSize:9,color:C.textLight,letterSpacing:"0.06em",fontWeight:500}}>RECURSOS ADMINISTRATIVOS DE TRÂNSITO</div>}
            </div>
          </div>

          <nav style={{display:"flex",alignItems:"center",gap:8}}>
            {!user && !isMobile && (
              <button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({behavior:"smooth"})}
                style={{background:"transparent",border:"none",color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:"6px 10px"}}>
                Como funciona
              </button>
            )}
            {user ? (
              <>
                {/* FIX: avatar abre perfil */}
                <button onClick={() => setShowPerfil(true)} style={{display:"flex",alignItems:"center",gap:6,background:C.green50,border:`1px solid ${C.green100}`,borderRadius:20,padding:"4px 12px 4px 4px",cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:C.green500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>
                    {user.nome?.charAt(0).toUpperCase()}
                  </div>
                  {!isMobile && <span style={{fontSize:12,color:C.textMid,fontWeight:600}}>{user.nome?.split(" ")[0]}</span>}
                  <span style={{fontSize:11,color:C.textMuted}}>▾</span>
                </button>
                <button onClick={handleLogout} style={{padding:"6px 11px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Sair</button>
              </>
            ) : (
              <>
                <button onClick={() => openAuth("login")} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Entrar</button>
                <button onClick={() => openAuth("signup")} style={{padding:"7px 14px",borderRadius:7,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Criar conta</button>
              </>
            )}
          </nav>
        </header>
      )}

      {isAdv ? (
        <PainelAdvogado onLogout={handleLogout}/>
      ) : user ? (
        <AppLogado user={user} setUser={setUserSync} view={view} setView={setView}/>
      ) : (
        <LandingPage onOpenAuth={openAuth}/>
      )}
    </div>
  );
}
