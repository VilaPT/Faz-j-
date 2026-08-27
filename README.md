# Faz Já

**Marketplace funcional de serviços locais** onde clientes pesquisam profissionais por problema, serviço ou categoria, e profissionais podem criar um perfil e disponibilizar os seus serviços.

🔗 **Demo atual:** https://vilapt.github.io/Site/fazja/

## Problema

Encontrar um profissional local costuma obrigar o utilizador a procurar em vários canais, pedir contactos e comparar respostas sem um fluxo simples. O Faz Já foi criado para reduzir esse percurso a:

**precisar → encontrar → escolher → pedir → acompanhar**

## Estado do projeto

O Faz Já está em **beta funcional / protótipo de validação**. A aplicação já utiliza autenticação, base de dados e regras de autorização reais através do Supabase, mas ainda não é apresentada como produto comercial terminado.

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
- JavaScript ES Modules
- DOM API

### Backend / dados
- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security (RLS)
- Triggers e funções PostgreSQL

### Qualidade / workflow
- Git e GitHub
- Pull Requests
- GitHub Actions
- Node.js test runner (`node --test`)
- Verificação automática de sintaxe dos módulos

## Arquitetura frontend

```text
index.html
   │
   ├── app.js                  # arranque / orquestração
   ├── account.js              # área pessoal
   │
   └── js/
       ├── config.js           # configuração pública
       ├── supabase.js         # cliente Supabase partilhado
       ├── utils.js            # funções puras
       ├── auth.js             # autenticação e sessão
       ├── search.js           # pesquisa, categorias e analytics
       ├── requests.js         # pedidos de cliente
       ├── memberships.js      # trial / subscrição
       └── professionals.js    # perfil profissional
```

Todos os módulos que precisam de dados reutilizam a mesma instância do Supabase em `js/supabase.js`.

Mais detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Segurança e decisões técnicas

- O browser utiliza apenas a **publishable key** do Supabase.
- Chaves administrativas / service-role não são expostas no frontend.
- Tabelas sensíveis utilizam **Row Level Security**.
- Clientes apenas podem consultar ou alterar os próprios pedidos.
- Profissionais apenas podem alterar os próprios dados e competências.
- O estado de verificação profissional não pode ser alterado diretamente pelo browser.
- O trial profissional é registado separadamente do perfil, evitando reinícios simples através da recriação do perfil.
- Conteúdo introduzido por utilizadores é escapado antes de ser inserido em HTML gerado pela aplicação.

## Testes e CI

Os testes usam apenas ferramentas nativas do Node para manter o projeto leve.

```bash
npm run check
npm test
```

`npm run check` valida a sintaxe dos módulos JavaScript e `npm test` executa os testes unitários. O GitHub Actions executa ambos automaticamente em alterações relevantes e Pull Requests para `main`.

Os primeiros testes cobrem:
- normalização de texto usada na pesquisa
- escape de HTML
- cálculo de dias restantes do trial

## Alguns problemas técnicos resolvidos

### Redirect de confirmação incorreto
Os primeiros emails de confirmação regressavam a `localhost:3000`. A configuração de Auth e o `emailRedirectTo` foram corrigidos para o URL público.

### Loop de renderização
Uma primeira abordagem aos ícones podia provocar um ciclo de alterações no DOM. A solução foi substituída por renderização determinística dos SVGs.

### Limite de emails
Durante os testes foi identificado um `HTTP 429` causado pelo SMTP de desenvolvimento do Supabase. A aplicação passou a apresentar uma mensagem amigável e a próxima fase prevê SMTP dedicado.

### Evolução cliente → profissional
O modelo de conta foi ajustado para permitir que o mesmo utilizador comece como cliente e ative posteriormente o modo profissional, sem duplicar contas.

### Refatoração do frontend
A primeira versão concentrava autenticação, pesquisa, pedidos, perfis e trial num único `app.js`. A aplicação foi refatorada para módulos ES com responsabilidades explícitas e um cliente Supabase partilhado.

## Estrutura do repositório

```text
.
├── .github/workflows/test.yml
├── index.html
├── styles.css
├── account.css
├── app.js
├── account.js
├── js/
│   ├── auth.js
│   ├── config.js
│   ├── memberships.js
│   ├── professionals.js
│   ├── requests.js
│   ├── search.js
│   ├── supabase.js
│   └── utils.js
├── tests/
│   └── utils.test.js
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROJECT_STATE.md
│   └── REFACTOR_PLAN.md
├── package.json
└── README.md
```

## Próxima fase funcional

O principal desenvolvimento ainda em falta é fechar o ciclo completo do marketplace:

**pedido → profissional → aceitação → execução → conclusão → histórico → avaliação**

Depois disso:
- SMTP de produção
- notificações
- portefólio fotográfico
- avaliações verificadas
- painel de administração
- pagamentos recorrentes
- eventual migração para TypeScript / Next.js quando trouxer benefício real ao produto

## O que este projeto demonstra

O Faz Já foi utilizado para consolidar conceitos de desenvolvimento web aplicados a um produto real: autenticação, modelação relacional, autorização, RLS, estados de negócio, modularização, debugging, testes, CI e evolução incremental de produto.

O objetivo do repositório não é apenas mostrar uma interface, mas também tornar visíveis as decisões técnicas e a evolução da arquitetura.