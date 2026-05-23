"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ── Tokens ────────────────────────────────────────────────────────
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
    id:"basico", icon:"📝", titulo:"Revisão do Recurso", preco:"R$ 89,90",
    cor:C.green600, badge:null, destaque:false,
    itens:["Revisão completa do recurso gerado pela IA","Assinatura digital com número OAB","Orientação de onde e como protocolar","Retorno em até 24 horas úteis","1 rodada de ajustes inclusa"],
    confirmacao:"Um advogado revisará seu recurso e retornará em até 24h úteis com o documento assinado.",
  },
  {
    id:"consulta", icon:"🎥", titulo:"Revisão + Vídeo 15min", preco:"R$ 350,00",
    cor:C.green700, badge:"MAIS POPULAR", destaque:true,
    itens:["Videoconferência de 15 min com advogado especialista","Revisão e correção completa do recurso","Assinatura digital OAB","Orientação personalizada para o seu caso","Retorno em até 24 horas úteis","1 rodada de ajustes inclusa"],
    confirmacao:"O advogado entrará em contato para agendar sua videoconferência de 15 minutos e iniciar a revisão.",
  },
  {
    id:"premium", icon:"⚖️", titulo:"Gestão Completa + Protocolo", preco:"R$ 1.500,00",
    cor:C.green900, badge:"COMPLETO", destaque:false,
    itens:["Videoconferência de 15 min com advogado especialista","Revisão e correção completa do recurso","Protocolo do recurso junto ao órgão autuador","Procuração Ad Judicia inclusa e assinada","Acompanhamento até a decisão final","Assinatura digital OAB"],
    confirmacao:"O advogado entrará em contato para agendar a videoconferência, coletar a procuração e iniciar o protocolo.",
  },
];

// ── Banco em memória (substituir por DB real em produção) ─────────
const DB = {
  _store:{ "advogado@multa.ai":{ nome:"Dr. Ricardo Souza", senha:"adv123", historico:[], isAdv:true } },
  get(e){ return this._store[e]||null; },
  set(e,d){ this._store[e]=d; },
  addHistorico(e,entry){ if(!this._store[e])return; this._store[e].historico=[entry,...(this._store[e].historico||[])]; },
  updateHistorico(e,id,patch){ if(!this._store[e])return; this._store[e].historico=this._store[e].historico.map(h=>h.id===id?{...h,...patch}:h); },
  getAllCasosRevisao(){ const l=[]; Object.entries(this._store).forEach(([email,u])=>{ if(u.isAdv)return; (u.historico||[]).forEach(h=>{ if(h.revisaoSolicitada) l.push({...h,clienteEmail:email,clienteNome:u.nome}); }); }); return l; },
};

const useIsMobile=()=>{ const [m,setM]=useState(false); useEffect(()=>{ const f=()=>setM(window.innerWidth<768); f(); window.addEventListener("resize",f); return()=>window.removeEventListener("resize",f); },[]); return m; };
const fmtDate=iso=>{ try{ return new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}); }catch{ return iso; } };

// ── Logo ──────────────────────────────────────────────────────────
function Logo({size=36}){
  return(
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="21" fill={C.green50} stroke={C.green400} strokeWidth="1.2"/>
      {[0,60,120,180,240,300].map((deg,i)=>(
        <line key={i} x1="22" y1="22" x2={22+18*Math.cos(deg*Math.PI/180)} y2={22+18*Math.sin(deg*Math.PI/180)} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.5" strokeLinecap="round"/>
      ))}
      <circle cx="22" cy="22" r="13" fill={C.green500}/><circle cx="22" cy="22" r="11" fill={C.green600}/>
      <path d="M22 12 L28 15 L28 23 C28 27 22 30 22 30 C20 30 16 27 16 23 L16 15 Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M18.5 22 L21 24.5 L25.5 19.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Spinner({label="Aguarde..."}){
  return(
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

// ── PDF Modal ─────────────────────────────────────────────────────
function PDFModal({recurso,dados,userName,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:15}}>📄 Prévia do Recurso</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>navigator.clipboard.writeText(recurso)} style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Copiar texto</button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
          </div>
        </div>
        <div style={{overflowY:"auto",padding:"24px 28px",flex:1}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:13,lineHeight:1.85,color:"#1a1a1a"}}>
            <div style={{textAlign:"center",fontWeight:700,fontSize:14,textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:`2px solid ${C.green500}`,paddingBottom:12,marginBottom:20}}>RECURSO ADMINISTRATIVO DE TRÂNSITO</div>
            {dados&&<div style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:8,padding:16,marginBottom:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
              {Object.entries(dados).filter(([,v])=>v&&v!=="N/A"&&v!=="—").map(([k,v])=>(
                <div key={k}><strong style={{color:C.green800}}>{k.replace(/_/g," ").toUpperCase()}:</strong> {v}</div>
              ))}
            </div>}
            {(recurso||"").split("\n").map((l,i)=><p key={i} style={{marginBottom:l.trim()?8:4}}>{l||"\u00A0"}</p>)}
            <div style={{marginTop:32,paddingTop:14,borderTop:"1px solid #ddd",fontSize:11,color:"#888",textAlign:"center"}}>
              Gerado por Multa.AI · {new Date().toLocaleDateString("pt-BR")} · {userName||"Usuário"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth Drawer ───────────────────────────────────────────────────
function AuthDrawer({onClose,onLogin,initialMode="login"}){
  const [mode,setMode]=useState(initialMode);
  const [nome,setNome]=useState(""); const [email,setEmail]=useState(""); const [senha,setSenha]=useState("");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  useEffect(()=>{setMode(initialMode);setErr("");},[initialMode]);
  const submit=()=>{
    setErr("");
    if(!email.includes("@")){setErr("E-mail inválido.");return;}
    if(senha.length<6){setErr("Senha mínima: 6 caracteres.");return;}
    if(mode==="signup"&&!nome.trim()){setErr("Informe seu nome.");return;}
    setLoading(true);
    setTimeout(()=>{
      if(mode==="signup"){
        if(DB.get(email)){setErr("E-mail já cadastrado.");setLoading(false);return;}
        DB.set(email,{nome,senha,historico:[]});
        onLogin({email,nome,historico:[]});
      } else {
        const u=DB.get(email);
        if(!u||u.senha!==senha){setErr("E-mail ou senha incorretos.");setLoading(false);return;}
        onLogin({email,nome:u.nome,historico:u.historico||[],isAdv:u.isAdv||false});
      }
    },700);
  };
  const inp=(label,type,val,setVal,ph)=>(
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,color:C.textMuted,display:"block",marginBottom:6,fontWeight:600}}>{label}</label>
      <input type={type} value={val} onChange={e=>setVal(e.target.value)} placeholder={ph}
        onKeyDown={e=>e.key==="Enter"&&submit()}
        style={{width:"100%",padding:"11px 14px",borderRadius:9,border:`1.5px solid ${C.border}`,fontSize:14,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}
        onFocus={e=>e.target.style.borderColor=C.green500} onBlur={e=>e.target.style.borderColor=C.border}/>
    </div>
  );
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",backdropFilter:"blur(3px)"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:380,height:"100vh",background:C.white,boxShadow:"-8px 0 40px rgba(0,0,0,0.15)",display:"flex",flexDirection:"column",animation:"slideIn 0.28s cubic-bezier(0.22,1,0.36,1)"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"26px 22px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><Logo size={30}/><span style={{color:"#fff",fontWeight:800,fontSize:17}}>Multa<span style={{color:"#6ee7b7"}}>.AI</span></span></div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          <div style={{display:"flex",background:"rgba(0,0,0,0.15)",borderRadius:9,padding:3}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:"9px",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,borderRadius:7,transition:"all 0.2s",background:mode===m?C.white:"transparent",color:mode===m?C.green700:"rgba(255,255,255,0.8)"}}>
                {m==="login"?"Entrar":"Criar conta"}
              </button>
            ))}
          </div>
        </div>
        <div style={{flex:1,padding:22,overflowY:"auto"}}>
          {mode==="signup"&&inp("Nome completo","text",nome,setNome,"João da Silva")}
          {inp("E-mail","email",email,setEmail,"joao@email.com")}
          {inp("Senha","password",senha,setSenha,"••••••••")}
          {err&&<div style={{color:C.danger,fontSize:13,marginBottom:14,padding:"9px 12px",background:C.dangerSoft,borderRadius:8,border:"1px solid #fca5a5"}}>{err}</div>}
          <button onClick={submit} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:loading?0.7:1}}>
            {loading?"Aguarde...":mode==="login"?"Entrar →":"Criar minha conta →"}
          </button>
          <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:12,lineHeight:1.6}}>🔒 Seus dados são protegidos e não compartilhados</p>
          {mode==="login"&&<div style={{marginTop:18,padding:"11px 13px",background:C.green50,borderRadius:9,border:`1px solid ${C.green100}`,fontSize:12,color:C.textMuted,lineHeight:1.7}}><strong style={{color:C.textMid}}>Acesso advogado:</strong><br/><code>advogado@multa.ai</code> / <code>adv123</code></div>}
        </div>
      </div>
    </div>
  );
}

// ── Pagamento Modal ───────────────────────────────────────────────
const PLANOS_INFO={
  basico:{label:"Revisão do Recurso",preco:"R$ 89,90"},
  consulta:{label:"Revisão + Videoconferência 15min",preco:"R$ 350,00"},
  premium:{label:"Gestão Completa + Protocolo",preco:"R$ 1.500,00"},
};
function PagamentoModal({onClose,onSuccess,plano="basico"}){
  const info=PLANOS_INFO[plano]||PLANOS_INFO.basico;
  const [metodo,setMetodo]=useState("pix");
  const [fase,setFase]=useState("escolha");
  const [cartao,setCartao]=useState({numero:"",nome:"",validade:"",cvv:""});
  const [err,setErr]=useState("");
  const processar=()=>{
    if(metodo==="cartao"){
      if(cartao.numero.replace(/\s/g,"").length<16){setErr("Número inválido.");return;}
      if(!cartao.nome.trim()){setErr("Informe o nome.");return;}
      if(!cartao.validade.match(/\d{2}\/\d{2}/)){setErr("Validade inválida (MM/AA).");return;}
      if(cartao.cvv.length<3){setErr("CVV inválido.");return;}
    }
    setErr("");setFase("processando");
    setTimeout(()=>{setFase("sucesso");setTimeout(onSuccess,2000);},1800);
  };
  const fmtNum=v=>v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const fmtVal=v=>v.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d{0,2})/,"$1/$2");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:18,width:"100%",maxWidth:430,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:600,letterSpacing:"0.08em"}}>{info.label.toUpperCase()}</div>
            <div style={{color:"#fff",fontWeight:800,fontSize:20}}>{info.preco}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{padding:22}}>
          {fase==="escolha"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
              {[{id:"pix",icon:"⚡",label:"PIX",sub:"Imediato"},{id:"cartao",icon:"💳",label:"Cartão",sub:"Crédito/débito"}].map(({id,icon,label,sub})=>(
                <button key={id} onClick={()=>setMetodo(id)} style={{padding:"12px 8px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",textAlign:"center",border:`2px solid ${metodo===id?C.green500:C.border}`,background:metodo===id?C.green50:C.white,transition:"all 0.2s"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{fontWeight:700,color:C.text,fontSize:13}}>{label}</div>
                  <div style={{fontSize:11,color:C.textMuted}}>{sub}</div>
                </button>
              ))}
            </div>
            {metodo==="pix"&&(
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
                    {[42,52,62,42,52,62].map((x,i)=><rect key={i} x={x} y={12+i*8} width="7" height="6" fill={C.green600} rx="1"/>)}
                  </svg>
                </div>
                <div style={{fontFamily:"monospace",fontSize:11,color:C.textMuted,background:C.offWhite,borderRadius:7,padding:"7px 12px",marginBottom:12}}>multa-ai@pagamento.com</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <button onClick={()=>navigator.clipboard.writeText("multa-ai@pagamento.com")} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📋 Copiar</button>
                  <button onClick={processar} style={{padding:"7px 18px",borderRadius:7,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Já paguei →</button>
                </div>
              </div>
            )}
            {metodo==="cartao"&&(
              <div>
                {[{l:"Número",k:"numero",p:"0000 0000 0000 0000",f:fmtNum},{l:"Nome no cartão",k:"nome",p:"JOAO DA SILVA",f:v=>v.toUpperCase()},{l:"Validade",k:"validade",p:"MM/AA",f:fmtVal},{l:"CVV",k:"cvv",p:"123",f:v=>v.replace(/\D/g,"").slice(0,4)}].map(({l,k,p,f})=>(
                  <div key={k} style={{marginBottom:11}}>
                    <label style={{fontSize:11,color:C.textMuted,display:"block",marginBottom:5,fontWeight:600}}>{l}</label>
                    <input value={cartao[k]} onChange={e=>setCartao(prev=>({...prev,[k]:f(e.target.value)}))} placeholder={p}
                      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:13,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                ))}
                {err&&<div style={{color:C.danger,fontSize:12,marginBottom:10,padding:"7px 10px",background:C.dangerSoft,borderRadius:7}}>{err}</div>}
                <button onClick={processar} style={{width:"100%",padding:"12px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Pagar {info.preco} →</button>
              </div>
            )}
            <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:12}}>🔒 Pagamento 100% seguro · SSL · PCI DSS</p>
          </>}
          {fase==="processando"&&<Spinner label="Processando pagamento..."/>}
          {fase==="sucesso"&&(
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:C.green50,border:`2px solid ${C.green400}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px",boxShadow:`0 0 0 10px ${C.glow}`}}>✓</div>
              <div style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:6}}>Pagamento confirmado!</div>
              <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7}}>Um advogado especialista entrará em contato em breve.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Procuração Modal ──────────────────────────────────────────────
function ProcuracaoModal({onClose,onPagar,user}){
  const [form,setForm]=useState({nome:user?.nome||"",cpf:"",rg:"",endereco:"",email:user?.email||"",tel:"",placa:"",modelo:"",auto_num:"",poderes:"representar o(a) outorgante perante os órgãos de trânsito competentes, inclusive JARIs e CETRAN, para fins de interposição, acompanhamento e protocolo de recursos administrativos, podendo assinar documentos e praticar todos os atos necessários ao fiel cumprimento deste mandato.",data:new Date().toLocaleDateString("pt-BR")});
  const [salvo,setSalvo]=useState(false);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const isMobile=useIsMobile();
  const inp=(label,val,key,ph,full=false)=>(
    <div style={{marginBottom:10,gridColumn:full?"1/-1":"auto"}}>
      <label style={{fontSize:11,color:C.textMuted,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
      <input value={val} onChange={e=>f(key,e.target.value)} placeholder={ph}
        style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:13,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit"}}/>
    </div>
  );
  const preview=`PROCURAÇÃO AD JUDICIA ET EXTRA\n\nOUTORGANTE: ${form.nome}, CPF nº ${form.cpf}, RG nº ${form.rg}, residente em ${form.endereco}, e-mail: ${form.email}, tel: ${form.tel}.\n\nOUTORGADO(A): DR. RICARDO SOUZA, OAB/SP 123.456.\n\nVEÍCULO: ${form.modelo} — Placa ${form.placa}.\nAUTO Nº: ${form.auto_num}.\n\nPODERES: ${form.poderes}\n\nDATA: ${form.data}.\n\n_________________________________\n${form.nome} · CPF: ${form.cpf}`;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div style={{background:C.white,borderRadius:18,width:"100%",maxWidth:760,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:600,letterSpacing:"0.08em"}}>PLANO GESTÃO COMPLETA · R$ 1.500,00</div>
            <div style={{color:"#fff",fontWeight:800,fontSize:16}}>📋 Procuração Ad Judicia</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{display:"flex",flex:1,overflow:"hidden",flexDirection:isMobile?"column":"row"}}>
          <div style={{flex:1,padding:20,overflowY:"auto"}}>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:14,lineHeight:1.6,background:C.green50,border:`1px solid ${C.green100}`,borderRadius:8,padding:"10px 13px"}}>
              Preencha os dados para geração da procuração. Após o pagamento o advogado assina digitalmente e inicia o protocolo.
            </div>
            <div style={{fontSize:11,fontWeight:700,color:C.green700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Dados do Outorgante</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
              {inp("Nome completo *",form.nome,"nome","João da Silva",true)}
              {inp("CPF *",form.cpf,"cpf","000.000.000-00")}
              {inp("RG *",form.rg,"rg","00.000.000-0")}
              {inp("Endereço completo *",form.endereco,"endereco","Rua, nº, Bairro, Cidade – UF",true)}
              {inp("E-mail *",form.email,"email","joao@email.com")}
              {inp("Telefone *",form.tel,"tel","(11) 99999-9999")}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:C.green700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,marginTop:10}}>Dados do Veículo e Infração</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
              {inp("Placa",form.placa,"placa","ABC-1234")}
              {inp("Modelo/Marca",form.modelo,"modelo","Honda Civic")}
              {inp("Nº do Auto",form.auto_num,"auto_num","00000000")}
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:11,color:C.textMuted,display:"block",marginBottom:5,fontWeight:600}}>Poderes conferidos</label>
              <textarea value={form.poderes} onChange={e=>f("poderes",e.target.value)} rows={3} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:12,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit",lineHeight:1.6}}/>
            </div>
            {inp("Data",form.data,"data","")}
            {salvo?(
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:C.green50,border:`1px solid ${C.green100}`,borderRadius:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:C.green500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,flexShrink:0}}>✓</div>
                <div style={{fontSize:13,color:C.textMid}}>Dados salvos! Redirecionando para o pagamento...</div>
              </div>
            ):(
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={onClose} style={{padding:"10px 16px",borderRadius:9,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={()=>{setSalvo(true);setTimeout(()=>onPagar(form),1200);}} style={{flex:1,padding:"11px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green800},${C.green600})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Salvar e ir para pagamento →</button>
              </div>
            )}
          </div>
          {!isMobile&&(
            <div style={{width:260,flexShrink:0,borderLeft:`1px solid ${C.border}`,padding:16,overflowY:"auto",background:C.offWhite}}>
              <div style={{fontSize:11,fontWeight:700,color:C.green700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Prévia do documento</div>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:14,fontSize:10,fontFamily:"Georgia,serif",lineHeight:1.9,color:"#1a1a1a",whiteSpace:"pre-wrap"}}>{preview}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Aba Advogado ──────────────────────────────────────────────────
function AbaAdvogado({user}){
  const [planoPago,setPlanoPago]=useState(null);
  const [showPagamento,setShowPagamento]=useState(null);
  const [showProcuracao,setShowProcuracao]=useState(false);
  const isMobile=useIsMobile();
  const contratar=(id)=>{ if(id==="premium") setShowProcuracao(true); else setShowPagamento(id); };
  const aoConfirmar=()=>{ setPlanoPago(showPagamento); setShowPagamento(null); };
  const aoSalvarProc=()=>{ setShowProcuracao(false); setShowPagamento("premium"); };
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:isMobile?"20px 16px":"28px 24px"}}>
      {showPagamento&&<PagamentoModal plano={showPagamento} onClose={()=>setShowPagamento(null)} onSuccess={aoConfirmar}/>}
      {showProcuracao&&<ProcuracaoModal user={user} onClose={()=>setShowProcuracao(false)} onPagar={aoSalvarProc}/>}
      <div style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,borderRadius:16,padding:isMobile?"20px":"28px 32px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        {[320,220,130].map((r,i)=><div key={i} style={{position:"absolute",right:-60+i*20,top:"50%",transform:"translateY(-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.05)",pointerEvents:"none"}}/>)}
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⚖️</div>
            <div>
              <div style={{color:C.green400,fontSize:11,fontWeight:700,letterSpacing:"0.08em",marginBottom:2}}>SERVIÇOS JURÍDICOS ESPECIALIZADOS</div>
              <div style={{color:"#fff",fontWeight:800,fontSize:isMobile?18:22}}>Advogado Especialista em Direito de Trânsito</div>
            </div>
          </div>
          <p style={{color:"rgba(255,255,255,0.65)",fontSize:13,lineHeight:1.7,maxWidth:560}}>Recursos com assinatura de advogado têm taxa de deferimento significativamente maior perante as JARIs e CETRAN. Escolha o nível de suporte ideal para o seu caso.</p>
        </div>
      </div>
      {planoPago&&(
        <div style={{background:C.white,border:`2px solid ${C.green400}`,borderRadius:14,padding:"18px 22px",marginBottom:24,display:"flex",alignItems:"center",gap:14,boxShadow:`0 4px 20px ${C.glow}`}}>
          <div style={{width:46,height:46,borderRadius:"50%",background:C.green50,border:`2px solid ${C.green400}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,boxShadow:`0 0 0 6px ${C.glow}`}}>✓</div>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>{PLANOS.find(p=>p.id===planoPago)?.titulo} — contratado!</div>
            <div style={{fontSize:13,color:C.textMuted,lineHeight:1.6}}>{PLANOS.find(p=>p.id===planoPago)?.confirmacao}</div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:16,marginBottom:20}}>
        {PLANOS.map(plano=>(
          <div key={plano.id} style={{background:C.white,border:`2px solid ${planoPago===plano.id?C.green500:plano.destaque?plano.cor:C.border}`,borderRadius:14,overflow:"hidden",boxShadow:plano.destaque?`0 6px 24px ${C.glowStrong}`:"0 2px 8px rgba(0,0,0,0.04)",display:"flex",flexDirection:"column",transition:"all 0.2s"}}>
            {plano.badge&&<div style={{background:plano.destaque?plano.cor:C.green900,color:"#fff",fontSize:10,fontWeight:800,letterSpacing:"0.1em",textAlign:"center",padding:"5px 0"}}>{plano.badge}</div>}
            <div style={{padding:"20px 18px",flex:1,display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:28,marginBottom:10}}>{plano.icon}</div>
              <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:6,lineHeight:1.3}}>{plano.titulo}</div>
              <div style={{fontWeight:800,fontSize:26,color:plano.cor,marginBottom:16,letterSpacing:"-0.03em",lineHeight:1}}>{plano.preco}</div>
              <div style={{flex:1,marginBottom:18}}>
                {plano.itens.map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:C.green50,border:`1.5px solid ${C.green400}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                      <span style={{color:C.green600,fontSize:9,fontWeight:800}}>✓</span>
                    </div>
                    <span style={{fontSize:12,color:C.textMuted,lineHeight:1.5}}>{item}</span>
                  </div>
                ))}
              </div>
              {planoPago===plano.id?(
                <div style={{padding:"10px",borderRadius:9,background:C.green50,border:`1px solid ${C.green100}`,textAlign:"center",fontSize:13,fontWeight:700,color:C.green700}}>✓ Contratado</div>
              ):(
                <button onClick={()=>contratar(plano.id)} disabled={!!planoPago} style={{width:"100%",padding:"12px 8px",borderRadius:9,border:"none",background:planoPago?C.surface:`linear-gradient(135deg,${plano.cor},${plano.id==="premium"?C.green700:C.green500})`,color:planoPago?C.textLight:"#fff",fontSize:13,fontWeight:700,cursor:planoPago?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:plano.destaque&&!planoPago?`0 4px 14px ${C.glowStrong}`:"none"}}>
                  {plano.id==="premium"?"Preencher procuração →":"Contratar →"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:C.green700,marginBottom:8}}>⚖️ Sobre o Protocolo do Recurso — Plano R$ 1.500,00</div>
        <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7}}>No plano Gestão Completa, o advogado assume integralmente o processo: após videoconferência de 15 minutos, o recurso é revisado, assinado com número OAB e protocolado diretamente junto ao órgão autuador (DETRAN, PRF, CET, etc.) mediante procuração. O cliente acompanha cada etapa por e-mail.</div>
      </div>
      <div style={{padding:"10px 14px",background:C.green50,border:`1px solid ${C.green100}`,borderRadius:9,fontSize:11,color:C.textMuted,lineHeight:1.6}}>
        🔒 Pagamento seguro · SSL · PCI DSS · Todos os advogados são registrados na OAB · Este serviço não garante resultado, mas maximiza as chances de êxito.
      </div>
    </div>
  );
}

// ── Painel Advogado ───────────────────────────────────────────────
function PainelAdvogado({onLogout}){
  const [casos]=useState(()=>DB.getAllCasosRevisao());
  const [sel,setSel]=useState(null);
  const [nota,setNota]=useState("");
  const [concluidos,setConcluidos]=useState({});
  const [pdfModal,setPdfModal]=useState(null);
  const isMobile=useIsMobile();
  return(
    <div style={{minHeight:"100vh",background:C.offWhite}}>
      <header style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><Logo size={30}/><span style={{fontWeight:800,fontSize:16}}>Multa<span style={{color:C.green500}}>.AI</span></span><span style={{background:C.green100,color:C.green700,fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,marginLeft:4}}>PAINEL ADVOGADO</span></div>
        <button onClick={onLogout} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Sair</button>
      </header>
      {pdfModal&&<PDFModal recurso={pdfModal.recurso} dados={pdfModal.dados} userName="Advogado" onClose={()=>setPdfModal(null)}/>}
      <div style={{maxWidth:980,margin:"0 auto",padding:"28px 20px"}}>
        <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Casos pendentes</div>
        <div style={{color:C.textMuted,fontSize:14,marginBottom:24}}>{casos.length} caso{casos.length!==1?"s":""} recebido{casos.length!==1?"s":""}</div>
        {casos.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,color:C.textMuted}}>
            <div style={{fontSize:40,marginBottom:10}}>📭</div>
            <div style={{fontWeight:600}}>Nenhum caso ainda</div>
          </div>
        ):(
          <div style={{display:"flex",gap:20,flexDirection:isMobile?"column":"row"}}>
            <div style={{width:isMobile?"100%":290,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
              {casos.map(c=>(
                <div key={c.id} onClick={()=>{setSel(c);setNota("");}} style={{background:C.white,border:`2px solid ${sel?.id===c.id?C.green500:C.border}`,borderRadius:12,padding:"13px 15px",cursor:"pointer",transition:"all 0.2s",boxShadow:sel?.id===c.id?`0 0 0 3px ${C.glow}`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{fontWeight:700,fontSize:14}}>{c.clienteNome}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:concluidos[c.id]?C.green100:C.goldBg,color:concluidos[c.id]?C.green700:C.gold,border:`1px solid ${concluidos[c.id]?C.green100:C.goldBorder}`}}>{concluidos[c.id]?"✓ Concluído":"⏳ Pendente"}</span>
                  </div>
                  <div style={{fontSize:12,color:C.textMuted,marginBottom:3}}>{c.clienteEmail}</div>
                  <div style={{fontSize:12,color:C.textMid,marginBottom:4}}>{c.dados?.descricao_infracao||"Infração"}</div>
                  <div style={{fontSize:11,color:C.textLight}}>{fmtDate(c.data)}</div>
                </div>
              ))}
            </div>
            {sel?(
              <div style={{flex:1,background:C.white,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{color:"rgba(255,255,255,0.65)",fontSize:11,marginBottom:2}}>CASO</div><div style={{color:"#fff",fontWeight:700,fontSize:15}}>{sel.clienteNome} · {sel.clienteEmail}</div></div>
                  <button onClick={()=>setPdfModal({recurso:sel.recurso,dados:sel.dados})} style={{padding:"6px 12px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📄 Ver recurso</button>
                </div>
                <div style={{padding:18}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                    {Object.entries(sel.dados||{}).filter(([,v])=>v&&v!=="N/A").map(([k,v])=>(
                      <div key={k} style={{background:C.green50,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>{k.replace(/_/g," ")}</div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:"block",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.06em"}}>Feedback ao cliente</label>
                  <textarea value={nota} onChange={e=>setNota(e.target.value)} rows={4} placeholder="Observações ou sugestões..."
                    style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,background:C.offWhite,color:C.text,outline:"none",fontFamily:"inherit",lineHeight:1.6}}/>
                  <div style={{display:"flex",gap:10,marginTop:12}}>
                    <button onClick={()=>setSel(null)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Voltar</button>
                    <button onClick={()=>{setConcluidos(p=>({...p,[sel.id]:true}));setSel(null);}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Marcar como revisado</button>
                  </div>
                </div>
              </div>
            ):(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,minHeight:200,color:C.textMuted,fontSize:14}}>← Selecione um caso</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────
function LandingPage({onOpenAuth}){
  const isMobile=useIsMobile();
  const features=[{icon:"📤",title:"Upload simples",desc:"Envie a foto ou PDF do auto de infração. Funciona com qualquer câmera de celular."},{icon:"🤖",title:"IA analisa tudo",desc:"Extrai dados automaticamente e identifica os melhores argumentos de defesa no CTB."},{icon:"⚖️",title:"Recurso fundamentado",desc:"Texto completo e embasado no CTB e resoluções CONTRAN vigentes."},{icon:"✍️",title:"Suporte de advogado",desc:"Opcional: especialista em direito de trânsito revisa, assina e pode protocolar."}];
  const stats=[{n:"30 dias",label:"Prazo legal para recurso"},{n:"Art. 283",label:"Base legal no CTB"},{n:"JARI",label:"Junta de Recursos de Infrações"},{n:"24h",label:"Retorno do advogado"}];
  return(
    <div style={{color:C.text}}>
      <section style={{background:`linear-gradient(160deg,${C.green900} 0%,${C.green700} 55%,${C.green600} 100%)`,padding:isMobile?"64px 20px 80px":"88px 40px 104px",position:"relative",overflow:"hidden"}}>
        {[480,350,230].map((r,i)=><div key={i} style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.05)",pointerEvents:"none"}}/>)}
        <div style={{maxWidth:740,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.1)",borderRadius:30,padding:"5px 14px",marginBottom:26,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green400,boxShadow:"0 0 0 3px rgba(52,211,153,0.3)"}}/>
            <span style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontWeight:600}}>Baseado no CTB 2025 · Atualizado</span>
          </div>
          <h1 style={{color:"#fff",fontSize:isMobile?"30px":"50px",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.1,marginBottom:18}}>Cada multa tem uma defesa.<br/><span style={{color:C.green400}}>A sua também.</span></h1>
          <p style={{color:"rgba(255,255,255,0.72)",fontSize:isMobile?14:17,lineHeight:1.7,maxWidth:520,margin:"0 auto 34px"}}>Envie o auto de infração, a IA analisa e gera um recurso completo fundamentado no Código de Trânsito Brasileiro — em segundos.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>onOpenAuth("signup")} style={{padding:"14px 30px",borderRadius:11,border:"none",background:C.green400,color:C.green900,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(52,211,153,0.4)"}}>Criar conta grátis →</button>
            <button onClick={()=>onOpenAuth("login")} style={{padding:"14px 26px",borderRadius:11,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.85)",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Já tenho conta</button>
          </div>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:11,marginTop:18}}>Sem cartão de crédito · Primeiro recurso grátis</p>
        </div>
      </section>
      <section style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"22px 32px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"grid",gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:16}}>
          {stats.map(({n,label})=>(
            <div key={n} style={{textAlign:"center"}}><div style={{fontWeight:800,fontSize:isMobile?20:22,color:C.green600,marginBottom:3}}>{n}</div><div style={{fontSize:12,color:C.textMuted,lineHeight:1.5}}>{label}</div></div>
          ))}
        </div>
      </section>
      <section id="como-funciona" style={{background:C.offWhite,padding:isMobile?"48px 20px":"68px 40px"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:44}}><div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.1em",marginBottom:8,textTransform:"uppercase"}}>Como funciona</div><h2 style={{fontSize:isMobile?24:32,fontWeight:800,letterSpacing:"-0.03em"}}>Simples, rápido e fundamentado</h2></div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?1:2},1fr)`,gap:18}}>
            {features.map(({icon,title,desc},i)=>(
              <div key={title} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"22px 20px",display:"flex",gap:16,alignItems:"flex-start",boxShadow:`0 2px 12px ${C.glow}`}}>
                <div style={{width:46,height:46,borderRadius:11,background:C.green50,border:`1px solid ${C.green100}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
                <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}><span style={{fontWeight:800,fontSize:14}}>{title}</span><span style={{width:18,height:18,borderRadius:"50%",background:C.green500,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span></div><div style={{fontSize:13,color:C.textMuted,lineHeight:1.65}}>{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{background:C.white,padding:isMobile?"48px 20px":"68px 40px",borderTop:`1px solid ${C.border}`}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:34}}><div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.1em",marginBottom:8,textTransform:"uppercase"}}>Legislação</div><h2 style={{fontSize:isMobile?22:30,fontWeight:800,letterSpacing:"-0.03em"}}>Conheça seus direitos</h2></div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?1:2},1fr)`,gap:12}}>
            {TIPS.map(({art,tip})=>(<div key={art} style={{background:C.green50,border:`1px solid ${C.green100}`,borderLeft:`3px solid ${C.green500}`,borderRadius:10,padding:"13px 15px"}}><div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.06em",marginBottom:4}}>{art}</div><div style={{fontSize:13,color:C.textMid,lineHeight:1.65}}>{tip}</div></div>))}
          </div>
        </div>
      </section>
      <section style={{background:`linear-gradient(135deg,${C.green900},${C.green800})`,padding:isMobile?"48px 20px":"68px 40px"}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",gap:40,alignItems:"center",flexDirection:isMobile?"column":"row"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:C.green400,letterSpacing:"0.1em",marginBottom:10,textTransform:"uppercase"}}>Planos com advogado</div>
            <h2 style={{color:"#fff",fontSize:isMobile?24:30,fontWeight:800,letterSpacing:"-0.03em",marginBottom:14,lineHeight:1.2}}>Do recurso ao protocolo, temos o plano certo</h2>
            {["✓ R$ 89,90 — Revisão + assinatura OAB","✓ R$ 350,00 — Revisão + videoconferência 15min","✓ R$ 1.500,00 — Gestão completa + protocolo + procuração"].map(t=>(<div key={t} style={{color:"rgba(255,255,255,0.75)",fontSize:13,marginBottom:7}}>{t}</div>))}
          </div>
          <div style={{flexShrink:0,textAlign:"center"}}>
            <div style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:"28px 36px"}}>
              <div style={{color:"rgba(255,255,255,0.45)",fontSize:12,marginBottom:4}}>a partir de</div>
              <div style={{color:C.green400,fontSize:46,fontWeight:800,letterSpacing:"-0.04em",lineHeight:1}}>R$ 89<span style={{fontSize:22}}>,90</span></div>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:11,marginTop:4,marginBottom:22}}>pagamento único</div>
              <button onClick={()=>onOpenAuth("signup")} style={{padding:"12px 26px",borderRadius:10,border:"none",background:C.green400,color:C.green900,fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>Começar agora →</button>
            </div>
          </div>
        </div>
      </section>
      <footer style={{background:C.green900,padding:"24px 32px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}><Logo size={26}/><span style={{color:"rgba(255,255,255,0.7)",fontWeight:700,fontSize:14}}>Multa<span style={{color:C.green400}}>.AI</span></span></div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",lineHeight:1.6,textAlign:isMobile?"center":"right"}}>© 2025 Multa.AI · Recursos administrativos de trânsito<br/>Este serviço não substitui consultoria jurídica profissional.</div>
        </div>
      </footer>
    </div>
  );
}

// ── App Logado ────────────────────────────────────────────────────
function AppLogado({user,setUser,view,setView}){
  const [step,setStep]=useState(1);
  const [file,setFile]=useState(null);
  const [filePreview,setFilePreview]=useState(null);
  const [fileB64,setFileB64]=useState(null);
  const [fileType,setFileType]=useState(null);
  const [recurso,setRecurso]=useState("");
  const [dadosMulta,setDadosMulta]=useState(null);
  const [error,setError]=useState("");
  const [tipIdx,setTipIdx]=useState(0);
  const [copied,setCopied]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [pdfModal,setPdfModal]=useState(null);
  const fileRef=useRef();
  const isMobile=useIsMobile();
  const historico=user.historico||[];

  const salvarHistorico=useCallback((dados,rec)=>{
    const id=Date.now().toString();
    const entry={id,data:new Date().toISOString(),dados,recurso:rec,revisaoSolicitada:false};
    DB.addHistorico(user.email,entry);
    setUser(u=>({...u,historico:[entry,...(u.historico||[])]}));
  },[user.email,setUser]);

  const handleFile=useCallback((f)=>{
    if(!f)return; setError("");
    const isPdf=f.type==="application/pdf"; const isImg=f.type.startsWith("image/");
    if(!isPdf&&!isImg){setError("Envie JPG, PNG ou PDF.");return;}
    setFile(f);setFileType(isPdf?"pdf":"image");
    const reader=new FileReader();
    reader.onload=e=>{const r=e.target.result;setFileB64(r.split(",")[1]);setFilePreview(isImg?r:null);};
    reader.readAsDataURL(f);
  },[]);

  // ── Chama /api/recurso (backend seguro) ──────────────────────
  const gerarRecurso=async()=>{
    if(!fileB64)return; setStep(2); setError("");
    try{
      const res=await fetch("/api/recurso",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({fileB64,fileType}),
      });
      if(!res.ok){const e=await res.json(); throw new Error(e.error||"Erro");}
      const parsed=await res.json();
      setDadosMulta(parsed.dados);setRecurso(parsed.recurso);
      salvarHistorico(parsed.dados,parsed.recurso);setStep(3);
    }catch(e){setError(e.message||"Não foi possível analisar. Verifique se a imagem está legível.");setStep(1);}
  };

  const resetar=()=>{setStep(1);setFile(null);setFileB64(null);setFilePreview(null);setDadosMulta(null);setRecurso("");setError("");};

  return(
    <>
      {pdfModal&&<PDFModal recurso={pdfModal.recurso} dados={pdfModal.dados} userName={user.nome} onClose={()=>setPdfModal(null)}/>}
      {/* Abas */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",overflowX:"auto"}}>
        {[{id:"home",label:"📄 Gerar Recurso"},{id:"advogado",label:"⚖️ Serviços do Advogado"},{id:"historico",label:"📋 Histórico"}].map(({id,label})=>(
          <button key={id} onClick={()=>setView(id)} style={{padding:"14px 20px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:view===id?700:400,color:view===id?C.green700:C.textMuted,whiteSpace:"nowrap",borderBottom:`2px solid ${view===id?C.green500:"transparent"}`,transition:"all 0.2s"}}>{label}</button>
        ))}
      </div>
      {/* Steps */}
      {view==="home"&&<div style={{background:C.offWhite,borderBottom:`1px solid ${C.border}`,padding:`10px ${isMobile?16:28}px`,display:"flex",alignItems:"center",gap:6,overflowX:"auto"}}>
        {["Upload","Análise","Recurso"].map((label,i)=>{const n=i+1,done=step>n,active=step===n;return(<div key={n} style={{display:"flex",alignItems:"center",flexShrink:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:done?C.green500:active?C.green600:C.surface,color:done||active?"#fff":C.textLight,border:`2px solid ${done?C.green500:active?C.green600:C.border}`,boxShadow:active?`0 0 0 3px ${C.glow}`:"none",transition:"all 0.3s"}}>{done?"✓":n}</div><span style={{fontSize:12,fontWeight:active?700:400,color:active?C.text:done?C.textMid:C.textLight}}>{label}</span></div>{i<2&&<div style={{width:20,height:2,margin:"0 6px",background:step>n?C.green400:C.border,borderRadius:2}}/>}</div>);})}
      </div>}
      {/* Aba Advogado */}
      {view==="advogado"&&<AbaAdvogado user={user}/>}
      {/* Aba Histórico */}
      {view==="historico"&&(
        <div style={{maxWidth:800,margin:"0 auto",padding:"28px 20px"}}>
          <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Seus recursos</div>
          <div style={{color:C.textMuted,fontSize:14,marginBottom:20}}>{historico.length} recurso{historico.length!==1?"s":""} gerado{historico.length!==1?"s":""}</div>
          {historico.length===0?(
            <div style={{textAlign:"center",padding:"56px 20px",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:10}}>📄</div><div style={{fontWeight:600,marginBottom:8}}>Nenhum recurso ainda</div>
              <button onClick={()=>setView("home")} style={{padding:"10px 22px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Gerar recurso →</button>
            </div>
          ):historico.map(h=>(
            <div key={h.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"15px 18px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:10}}>
                <div><div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{h.dados?.descricao_infracao||"Infração"}</div><div style={{fontSize:12,color:C.textMuted}}>{fmtDate(h.data)} · Placa: {h.dados?.placa||"—"} · {h.dados?.valor_multa||"—"}</div></div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {h.revisaoSolicitada&&<span style={{fontSize:11,background:C.goldBg,color:C.gold,border:`1px solid ${C.goldBorder}`,borderRadius:20,padding:"2px 10px",fontWeight:600}}>⚖️ Revisão</span>}
                  <button onClick={()=>setPdfModal({recurso:h.recurso,dados:h.dados})} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📄 Ver PDF</button>
                </div>
              </div>
              <div style={{fontSize:12,color:C.textMuted,background:C.offWhite,borderRadius:7,padding:"7px 11px",lineHeight:1.6,maxHeight:52,overflow:"hidden",whiteSpace:"pre-wrap"}}>{h.recurso?.slice(0,220)}...</div>
            </div>
          ))}
        </div>
      )}
      {/* Aba Home */}
      {view==="home"&&(
        <div style={{maxWidth:1060,margin:"0 auto",padding:`24px ${isMobile?16:22}px 60px`,display:"flex",gap:22,flexDirection:isMobile?"column":"row"}}>
          <div style={{flex:1,minWidth:0}}>
            {step===1&&(
              <div style={{animation:"fadeUp 0.35s ease both",background:C.white,borderRadius:16,border:`1px solid ${C.border}`,boxShadow:`0 2px 16px ${C.glow}`,overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,padding:"20px 24px",position:"relative",overflow:"hidden"}}>
                  {[150,100,60].map((r,i)=><div key={i} style={{position:"absolute",right:-24+i*6,top:"50%",transform:"translateY(-50%)",width:r,height:r,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.07)",pointerEvents:"none"}}/>)}
                  <div style={{position:"relative",zIndex:1}}>
                    <div style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:600,letterSpacing:"0.08em",marginBottom:5}}>PASSO 1 DE 3</div>
                    <h2 style={{color:"#fff",fontSize:isMobile?17:20,fontWeight:800,letterSpacing:"-0.03em",marginBottom:5}}>Envie o auto de infração</h2>
                    <p style={{color:"rgba(255,255,255,0.68)",fontSize:12,lineHeight:1.6}}>Foto ou PDF legível · A IA extrai e redige o recurso automaticamente</p>
                  </div>
                </div>
                <div style={{padding:"20px 24px"}}>
                  <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current.click()}
                    style={{border:`2px dashed ${dragging?C.green500:file?C.green400:C.border}`,borderRadius:12,padding:"30px 18px",textAlign:"center",cursor:"pointer",background:dragging?C.green50:file?C.green50:C.offWhite,transition:"all 0.2s",marginBottom:14}}>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
                    {file?(<div>{filePreview&&<img src={filePreview} alt="preview" style={{maxHeight:110,borderRadius:8,marginBottom:8,objectFit:"contain"}}/>}<div style={{color:C.green600,fontWeight:700,marginBottom:3}}>✓ {file.name}</div><div style={{fontSize:11,color:C.textMuted}}>{(file.size/1024).toFixed(0)} KB · Clique para trocar</div></div>):(
                      <div><div style={{fontSize:32,marginBottom:8}}>📄</div><div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Arraste ou clique para enviar</div><div style={{fontSize:12,color:C.textMuted}}>Foto (JPG, PNG) ou PDF · até 10 MB</div></div>
                    )}
                  </div>
                  {error&&<div style={{color:C.danger,fontSize:13,marginBottom:12,padding:"8px 12px",background:C.dangerSoft,borderRadius:8,border:"1px solid #fca5a5"}}>{error}</div>}
                  <button onClick={gerarRecurso} disabled={!file} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:file?`linear-gradient(135deg,${C.green700},${C.green500})`:C.surface,color:file?"#fff":C.textLight,fontSize:14,fontWeight:800,cursor:file?"pointer":"not-allowed",boxShadow:file?`0 4px 16px ${C.glowStrong}`:"none",transition:"all 0.2s",fontFamily:"inherit"}}>
                    {file?"Gerar Recurso com IA →":"Selecione um arquivo para continuar"}
                  </button>
                  <p style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:10,lineHeight:1.6}}>🔒 Dados processados com segurança no servidor · não armazenados</p>
                </div>
              </div>
            )}
            {step===2&&<div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`}}><Spinner label="Analisando com IA..."/></div>}
            {step===3&&dadosMulta&&(
              <div style={{animation:"fadeUp 0.35s ease both"}}>
                <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,borderRadius:16,padding:"14px 20px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div><div style={{color:"rgba(255,255,255,0.65)",fontSize:10,fontWeight:600,letterSpacing:"0.08em",marginBottom:2}}>RECURSO GERADO ✓</div><div style={{color:"#fff",fontWeight:800,fontSize:15}}>Pronto! Revise e use o texto abaixo</div></div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={resetar} style={{padding:"6px 13px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.8)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Novo</button>
                    <button onClick={()=>{navigator.clipboard.writeText(recurso);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{padding:"6px 14px",borderRadius:7,border:"none",background:copied?"#fff":"rgba(255,255,255,0.2)",color:copied?C.green700:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>{copied?"✓ Copiado!":"Copiar"}</button>
                    <button onClick={()=>setPdfModal({recurso,dados:dadosMulta})} style={{padding:"6px 13px",borderRadius:7,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"rgba(255,255,255,0.8)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📄 PDF</button>
                  </div>
                </div>
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.07em",marginBottom:11,textTransform:"uppercase"}}>Dados extraídos</div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?138:162}px,1fr))`,gap:7}}>
                    {Object.entries(dadosMulta).filter(([,v])=>v&&v!=="N/A"&&v!=="—").map(([k,v])=>(<div key={k} style={{background:C.green50,border:`1px solid ${C.green100}`,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{k.replace(/_/g," ")}</div><div style={{fontSize:12,fontWeight:600,color:C.text}}>{v}</div></div>))}
                  </div>
                </div>
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.07em",marginBottom:9,textTransform:"uppercase"}}>Texto do recurso · edite se necessário</div>
                  <textarea value={recurso} onChange={e=>setRecurso(e.target.value)} rows={isMobile?12:15} style={{width:"100%",background:C.offWhite,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:12,lineHeight:1.75,padding:"11px 13px",outline:"none",fontFamily:"inherit"}}/>
                </div>
                <div style={{background:C.white,border:`2px solid ${C.green200}`,borderRadius:13,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:24}}>⚖️</div>
                    <div><div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:2}}>Quer mais segurança?</div><div style={{fontSize:12,color:C.textMuted}}>Um advogado pode revisar, assinar e até protocolar seu recurso.</div></div>
                  </div>
                  <button onClick={()=>setView("advogado")} style={{padding:"10px 20px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",boxShadow:`0 4px 12px ${C.glowStrong}`}}>Ver planos do advogado →</button>
                </div>
                <div style={{marginTop:12,padding:"9px 13px",background:C.green50,border:`1px solid ${C.green100}`,borderRadius:9,fontSize:11,color:C.textMuted,lineHeight:1.6}}>⚠️ <strong style={{color:C.textMid}}>Aviso legal:</strong> O recurso é um auxílio informativo e não substitui consultoria jurídica. Verifique os prazos junto ao órgão autuador.</div>
              </div>
            )}
          </div>
          {!isMobile&&(
            <div style={{width:244,flexShrink:0,display:"flex",flexDirection:"column",gap:13}}>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:17}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.08em",marginBottom:11,textTransform:"uppercase"}}>💡 Saiba seus direitos</div>
                <div style={{background:C.green50,border:`1px solid ${C.green100}`,borderLeft:`3px solid ${C.green500}`,borderRadius:9,padding:"11px 13px",marginBottom:9}}><div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.06em",marginBottom:3}}>{TIPS[tipIdx].art}</div><div style={{fontSize:12,color:C.textMid,lineHeight:1.65}}>{TIPS[tipIdx].tip}</div></div>
                <div style={{display:"flex",gap:7}}><button onClick={()=>setTipIdx(i=>(i-1+TIPS.length)%TIPS.length)} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:C.offWhite,color:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Ant.</button><button onClick={()=>setTipIdx(i=>(i+1)%TIPS.length)} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:C.offWhite,color:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Próx. →</button></div>
                <div style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:5}}>{tipIdx+1} / {TIPS.length}</div>
              </div>
              <div style={{background:`linear-gradient(135deg,${C.green700},${C.green600})`,borderRadius:13,padding:17}}>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:10,fontWeight:600,letterSpacing:"0.08em",marginBottom:7}}>⏱ ATENÇÃO AO PRAZO</div>
                <div style={{color:"#fff",fontWeight:700,fontSize:13,lineHeight:1.6}}>Você tem <span style={{fontSize:19,fontWeight:800}}>30 dias</span> para apresentar o recurso após a notificação.</div>
                <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,marginTop:4}}>Art. 283 do CTB</div>
              </div>
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:17}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green600,letterSpacing:"0.08em",marginBottom:11,textTransform:"uppercase"}}>Planos disponíveis</div>
                {PLANOS.map(p=>(<div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.icon} {p.titulo}</div><div style={{fontSize:12,fontWeight:700,color:p.cor,whiteSpace:"nowrap",marginLeft:8}}>{p.preco}</div></div>))}
                <button onClick={()=>setView("advogado")} style={{width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${C.green200}`,background:C.green50,color:C.green700,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver todos os planos →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function MultaAI(){
  const [user,setUser]=useState(null);
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [view,setView]=useState("home");
  const isMobile=useIsMobile();
  const openAuth=(mode="login")=>{setAuthMode(mode);setAuthOpen(true);};
  const handleLogin=(u)=>{setUser(u);setAuthOpen(false);setView("home");};
  const handleLogout=()=>{setUser(null);setView("home");};
  const isAdv=user?.isAdv===true;
  return(
    <div>
      {authOpen&&<AuthDrawer onClose={()=>setAuthOpen(false)} onLogin={handleLogin} initialMode={authMode}/>}
      {!isAdv&&(
        <header style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:`0 ${isMobile?14:28}px`,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:`0 1px 10px ${C.glow}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>{if(user)setView("home");}}>
            <Logo size={32}/>
            <div><div style={{fontWeight:800,fontSize:isMobile?14:16,letterSpacing:"-0.04em"}}>Multa<span style={{color:C.green500}}>.AI</span></div>{!isMobile&&<div style={{fontSize:9,color:C.textLight,letterSpacing:"0.06em",fontWeight:500}}>RECURSOS ADMINISTRATIVOS DE TRÂNSITO</div>}</div>
          </div>
          <nav style={{display:"flex",alignItems:"center",gap:8}}>
            {!user&&!isMobile&&<button onClick={()=>document.getElementById("como-funciona")?.scrollIntoView({behavior:"smooth"})} style={{background:"transparent",border:"none",color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:"6px 10px"}}>Como funciona</button>}
            {user?(
              <>
                <div style={{display:"flex",alignItems:"center",gap:6,background:C.green50,border:`1px solid ${C.green100}`,borderRadius:20,padding:"4px 11px 4px 4px"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:C.green500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>{user.nome?.charAt(0).toUpperCase()}</div>
                  {!isMobile&&<span style={{fontSize:12,color:C.textMid,fontWeight:600}}>{user.nome?.split(" ")[0]}</span>}
                </div>
                <button onClick={handleLogout} style={{padding:"6px 11px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Sair</button>
              </>
            ):(
              <>
                <button onClick={()=>openAuth("login")} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Entrar</button>
                <button onClick={()=>openAuth("signup")} style={{padding:"7px 14px",borderRadius:7,border:"none",background:`linear-gradient(135deg,${C.green700},${C.green500})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Criar conta</button>
              </>
            )}
          </nav>
        </header>
      )}
      {isAdv?<PainelAdvogado onLogout={handleLogout}/>:user?<AppLogado user={user} setUser={setUser} view={view} setView={setView}/>:<LandingPage onOpenAuth={openAuth}/>}
    </div>
  );
}
