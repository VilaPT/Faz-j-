# Arquitetura do Faz Já

## Visão geral

O Faz Já é um protótipo funcional de marketplace de serviços locais. A aplicação atual privilegia simplicidade de validação: frontend em HTML/CSS/JavaScript e backend gerido pelo Supabase.

```text
[Browser]
   │
   ├── index.html / styles.css
   ├── app.js
   ├── account.js
   └── auth-ui.js
   │
   ▼
[Supabase JS Client]
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
Responsável atualmente por:
- carregamento de categorias e serviços
- pesquisa
- autenticação principal
- criação/edição de perfil profissional
- criação de pedidos
- trial profissional

Uma das próximas melhorias técnicas é dividir este ficheiro em módulos menores, reduzindo acoplamento e tornando testes mais simples.

### `account.js`
Responsável pela área pessoal:
- perfil do utilizador
- pedidos
- área profissional
- cancelamento de pedidos ativos

### `auth-ui.js`
Camada pequena de experiência de autenticação:
- tradução de erros frequentes
- prevenção de múltiplos submits enquanto um pedido está em curso

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

Esta decisão reduz o impacto de alguém manipular JavaScript ou fazer pedidos diretamente à API.

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

No browser apenas deve existir a chave pública/publishable do Supabase. Uma chave administrativa ou service-role contorna RLS e, por isso, nunca pode ser distribuída no frontend.

Operações privilegiadas futuras, como confirmação de pagamentos ou verificação administrativa, deverão acontecer num ambiente servidor/Edge Function protegido.

## Decisões conscientes do protótipo

A versão atual usa JavaScript vanilla em vez de introduzir framework apenas por aparência de complexidade. Isso permitiu validar rapidamente comportamento, dados e UX.

Para uma fase comercial, a migração considerada é:
- TypeScript
- Next.js
- componentes reutilizáveis
- testes automatizados
- deploy dedicado
- SMTP próprio
- pagamentos via webhook

A migração deve acontecer quando trouxer benefícios concretos de manutenção, segurança ou produto, não apenas para trocar a stack.