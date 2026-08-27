# Arquitetura do Faz Já

## Visão geral

O Faz Já é um protótipo funcional de marketplace de serviços locais. A aplicação atual usa HTML/CSS/JavaScript no frontend e Supabase como backend gerido.

```text
[Browser]
   │
   ├── index.html / styles.css / account.css
   ├── app.js
   ├── account.js
   │
   └── js/
       ├── config.js
       ├── supabase.js
       ├── utils.js
       ├── auth.js
       ├── search.js
       ├── requests.js
       ├── memberships.js
       └── professionals.js
   │
   ▼
[Supabase JS Client partilhado]
   │
   ├── Auth
   ├── PostgREST API
   └── RLS
   │
   ▼
[PostgreSQL]
   ├── profiles
   ├── service_categories
   ├── skills
   ├── professional_profiles
   ├── professional_skills
   ├── professional_availability
   ├── professional_memberships
   ├── service_requests
   └── search_events
```

## Separação de responsabilidades

### `app.js`
É o ponto de arranque/orquestração. Liga os módulos, inicializa a aplicação e trata apenas responsabilidades globais simples, como estado visual da sessão, modais globais e conteúdo legal.

### `account.js`
Responsável pela área pessoal:
- perfil do utilizador
- pedidos efetuados
- cancelamento de pedidos ativos
- resumo da área profissional
- navegação mobile da conta

Reutiliza a mesma instância Supabase usada pelo resto da aplicação.

### `js/config.js`
Contém apenas configuração pública necessária ao browser, como URL do projeto Supabase, publishable key e URL pública da aplicação.

### `js/supabase.js`
Cria uma única instância do cliente Supabase e exporta-a para os restantes módulos. Isto evita clientes duplicados e centraliza a configuração de sessão.

### `js/utils.js`
Funções puras e reutilizáveis:
- normalização de texto
- escape de HTML
- ID anónimo de sessão de pesquisa
- cálculo de dias

Estas funções são as primeiras a ter testes unitários.

### `js/auth.js`
Responsável por:
- obter e manter a sessão
- login
- logout
- criação de conta
- `emailRedirectTo`
- mensagens de erro de autenticação
- prevenção de múltiplos submits
- retomar a intenção original após autenticação

### `js/search.js`
Responsável por:
- carregar categorias e serviços
- renderizar categorias e skills
- interpretar texto da pesquisa para uma skill conhecida
- pesquisar profissionais elegíveis
- renderizar resultados
- registar `search_events`

### `js/requests.js`
Responsável por:
- abrir o formulário de pedido
- garantir autenticação antes de guardar
- reutilizar o contexto da pesquisa
- inserir pedidos em `service_requests`

### `js/memberships.js`
Responsável pelo estado do plano profissional:
- carregar plano
- carregar membership
- calcular `trial`, `active` ou `expired`
- calcular dias restantes
- apresentar estado do plano na interface

### `js/professionals.js`
Responsável por:
- ativar modo profissional
- carregar perfil profissional
- carregar competências selecionadas
- criar/editar perfil
- atualizar `professional_skills`
- atualizar interface depois de alteração do trial/membership

## Modelo de identidade

A autenticação é gerida por Supabase Auth. Cada utilizador autenticado tem um registo em `profiles`.

O mesmo utilizador pode atuar como:
- cliente
- profissional
- cliente + profissional

Isto evita duplicação de identidades quando um cliente decide começar a prestar serviços.

## Modelo profissional

O perfil profissional é separado do perfil base. As competências são modeladas numa relação muitos-para-muitos através de `professional_skills`.

```text
profiles
   │ 1
   │
   │ 0..1
professional_profiles
   │
   │ 1..N
professional_skills
   │
   │ N..1
skills
```

## Autorização com RLS

A aplicação não confia apenas na interface para proteger dados. As políticas de Row Level Security no PostgreSQL restringem operações pelo utilizador autenticado.

Exemplos:
- cliente só pode gerir os próprios pedidos
- utilizador só pode alterar o próprio perfil
- profissional só pode alterar as próprias competências
- estado de verificação não é uma propriedade confiada ao browser

Isto reduz o impacto de alguém manipular JavaScript ou fazer pedidos diretamente à API.

## Trial profissional

O direito de aparecer publicamente é separado do próprio perfil através de uma membership.

Estados previstos:
- `trial`
- `active`
- `past_due`
- `cancelled`
- `expired`

O primeiro perfil profissional inicia um trial de 60 dias. O registo da membership não é apagado quando o profissional edita o perfil, impedindo que o trial seja reiniciado simplesmente apagando e recriando dados visíveis.

## Pedidos

Estados atuais:

```text
open → matched → accepted → completed
  └──────────────→ cancelled
```

A implementação atual já permite criação e cancelamento nos estados iniciais. A principal evolução pendente é associar o pedido ao profissional responsável e fechar o fluxo transacional completo.

## Segurança de chaves

No browser apenas existe a publishable key do Supabase. Uma chave administrativa ou service-role contorna RLS e, por isso, nunca deve ser distribuída no frontend.

Operações privilegiadas futuras, como confirmação de pagamentos ou verificação administrativa, deverão acontecer num ambiente servidor/Edge Function protegido.

## Qualidade e CI

O projeto usa:
- `node --check` para validação sintática dos módulos
- `node --test` para testes unitários
- GitHub Actions para executar ambos automaticamente em pushes relevantes e Pull Requests

Os testes iniciais cobrem funções puras de `utils.js`.

## Decisões conscientes do protótipo

A versão atual usa JavaScript vanilla com ES Modules em vez de introduzir um framework apenas para aumentar a aparência de complexidade. A modularização reduz acoplamento e torna a migração futura mais simples.

Para uma fase comercial, a evolução considerada é:
- TypeScript
- Next.js
- componentes reutilizáveis
- cobertura de testes mais ampla
- deploy dedicado
- SMTP próprio
- pagamentos via webhook

Essa migração deve acontecer quando trouxer benefícios concretos de manutenção, segurança ou produto.