# Multa.AI 🚦

> Recursos administrativos de trânsito com inteligência artificial.

**"Cada multa tem uma defesa. A sua também."**

---

## O que é

Plataforma que permite ao usuário enviar a foto ou PDF de um auto de infração e receber automaticamente um recurso administrativo completo, fundamentado no CTB e resoluções CONTRAN vigentes. Inclui módulo de serviços jurídicos com advogado especialista.

---

## Funcionalidades

- Landing page com apresentação do produto
- Cadastro e login de usuários
- Upload de foto ou PDF do auto de infração
- Análise com IA (Claude da Anthropic) e geração do recurso
- Histórico de recursos gerados
- Prévia e download do recurso em PDF
- 3 planos com advogado especialista:
  - **R$ 89,90** — Revisão + assinatura OAB
  - **R$ 350,00** — Revisão + videoconferência 15min
  - **R$ 1.500,00** — Gestão completa + protocolo + procuração
- Painel do advogado para gerenciar casos
- Totalmente responsivo (mobile e desktop)

---

## Stack

- **Frontend:** Next.js 14 + React 18
- **IA:** Anthropic Claude (claude-sonnet-4)
- **Hospedagem:** Vercel
- **Estilo:** CSS-in-JS (sem dependências externas)

---

## Como rodar localmente

### 1. Pré-requisitos

- Node.js 18+ instalado → [nodejs.org](https://nodejs.org)
- Conta na Anthropic → [console.anthropic.com](https://console.anthropic.com)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Abra o arquivo `.env.local` e cole sua chave:

```
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
```

> ⚠️ **Nunca** commite o `.env.local` no Git. Ele já está no `.gitignore`.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Deploy na Vercel (produção)

### Passo 1 — Subir no GitHub

```bash
git init
git add .
git commit -m "feat: multa.ai v1.0"
```

Crie um repositório em [github.com](https://github.com/new) e conecte:

```bash
git remote add origin https://github.com/SEU_USUARIO/multa-ai.git
git push -u origin main
```

### Passo 2 — Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com sua conta GitHub
2. Clique em **"Add New Project"**
3. Selecione o repositório `multa-ai`
4. Em **"Environment Variables"**, adicione:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-SUA_CHAVE_AQUI`
5. Clique em **"Deploy"**

Em ~2 minutos o site estará no ar com URL tipo `multa-ai.vercel.app`.

### Passo 3 — Domínio próprio (opcional)

1. Compre o domínio em [Registro.br](https://registro.br) ou [Namecheap](https://namecheap.com)
2. No painel da Vercel → **Domains** → adicione seu domínio
3. Configure o DNS conforme indicado pela Vercel

---

## Acesso de demonstração

| Perfil | Email | Senha |
|--------|-------|-------|
| Cliente demo | crie uma conta | — |
| Advogado | advogado@multa.ai | adv123 |

---

## Estrutura do projeto

```
multa-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── recurso/
│   │   │       └── route.js     ← API segura (chave fica aqui)
│   │   ├── globals.css
│   │   ├── layout.jsx
│   │   └── page.jsx
│   └── components/
│       └── MultaAI.jsx          ← Componente principal
├── public/
├── .env.example                 ← Modelo de variáveis
├── .env.local                   ← SUA chave (não commitar!)
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```

---

## Próximos passos recomendados

- [ ] Integrar banco de dados real (Supabase ou PlanetScale)
- [ ] Adicionar autenticação com NextAuth.js
- [ ] Integrar gateway de pagamento (Pagar.me ou Stripe)
- [ ] Sistema de agendamento de videoconferência (Cal.com)
- [ ] Envio de e-mail automático (Resend ou SendGrid)
- [ ] Painel administrativo completo para o advogado

---

## Aviso legal

Este serviço é um auxílio informativo e não substitui consultoria jurídica profissional. Os recursos gerados devem ser revisados antes de protocolar. Verifique os prazos junto ao órgão autuador.

---

© 2025 Multa.AI

