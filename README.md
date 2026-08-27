# Faz Já

**Marketplace funcional de serviços locais** onde clientes pesquisam profissionais por problema, serviço ou categoria, e profissionais podem criar um perfil e disponibilizar os seus serviços.

🔗 **Demo:** https://vilapt.github.io/Site/fazja/

## Problema

Encontrar um profissional local costuma obrigar o utilizador a procurar em vários canais, pedir contactos e comparar respostas sem um fluxo simples. O Faz Já foi criado para reduzir esse percurso a:

**precisar → encontrar → escolher → pedir → acompanhar**

## Estado do projeto

O Faz Já está atualmente em **beta funcional / protótipo de validação**. A aplicação já utiliza autenticação e dados reais através do Supabase, mas ainda não é apresentada como produto comercial terminado.

## Funcionalidades implementadas

- Pesquisa por texto, categoria, serviço e localidade
- Catálogo de categorias e serviços
- Perfis profissionais com múltiplas competências
- Disponibilidade e preço indicativo
- Registo e login com confirmação de email
- Conta cliente que pode evoluir para profissional
- Área pessoal responsiva
- Pedidos guardados e respetivos estados
- Cancelamento de pedidos ativos
- Trial profissional de 60 dias
- Controlo de visibilidade baseado no estado do trial/subscrição
- Registo de pesquisas para analisar procura e pesquisas sem resultados
- Interface mobile-first com ícones SVG próprios

## Stack

### Frontend
- HTML5
- CSS3
- JavaScript ES6+ (Vanilla)

### Backend / dados
- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security (RLS)
- Triggers e funções PostgreSQL

### Deploy e workflow
- GitHub
- GitHub Pages
- Desenvolvimento iterativo assistido por IA, com validação técnica e testes manuais dos fluxos

## Arquitetura

```text
Browser
  │
  ├── UI / DOM / JavaScript
  │
  └── Supabase JS Client
          │
          ├── Auth
          ├── PostgreSQL API
          └── RLS
                 │
                 ├── profiles
                 ├── professional_profiles
                 ├── professional_skills
                 ├── service_requests
                 └── search_events
```

Mais detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Segurança e decisões técnicas

- O browser utiliza apenas a **publishable key** do Supabase.
- Chaves administrativas / service-role não são expostas no frontend.
- Tabelas sensíveis utilizam **Row Level Security**.
- Clientes apenas podem consultar ou alterar os próprios pedidos.
- Profissionais apenas podem alterar os próprios dados e competências.
- O estado de verificação profissional não pode ser alterado diretamente pelo browser.
- O trial profissional é registado separadamente do perfil, evitando reinícios simples através da recriação do perfil.

## Alguns problemas técnicos resolvidos

### Redirect de confirmação incorreto
Os primeiros emails de confirmação regressavam a `localhost:3000`. A configuração de Auth e o `emailRedirectTo` foram corrigidos para o URL público.

### Loop de renderização
Um `MutationObserver` utilizado durante uma primeira abordagem aos ícones podia provocar um ciclo de alterações no DOM. A solução foi substituída por renderização determinística dos SVGs.

### Limite de emails
Durante os testes foi identificado um `HTTP 429` causado pelo SMTP de desenvolvimento do Supabase. A aplicação passou a apresentar uma mensagem amigável e a próxima fase prevê SMTP dedicado.

### Evolução cliente → profissional
O modelo de conta foi ajustado para permitir que o mesmo utilizador comece como cliente e ative posteriormente o modo profissional, sem duplicar contas.

## Estrutura

```text
.
├── index.html
├── styles.css
├── app.js
├── account.css
├── account.js
├── auth-ui.js
├── docs/
│   ├── ARCHITECTURE.md
│   └── PROJECT_STATE.md
└── README.md
```

## Próxima fase

O principal desenvolvimento em curso é fechar o ciclo completo do marketplace:

**pedido → profissional → aceitação → execução → conclusão → histórico → avaliação**

Depois disso:
- SMTP de produção
- notificações
- portefólio fotográfico
- avaliações verificadas
- painel de administração
- pagamentos recorrentes
- migração futura para TypeScript / Next.js se o produto justificar

## O que este projeto demonstra

Este projeto foi utilizado para praticar e consolidar conceitos de desenvolvimento web real, incluindo autenticação, modelação relacional, autorização, RLS, estados de negócio, debugging, deploy e evolução incremental de produto.

O objetivo do repositório não é apenas mostrar uma interface, mas documentar as decisões e os problemas técnicos encontrados durante a construção.