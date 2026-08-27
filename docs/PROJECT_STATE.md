# Faz Já — Estado do Projeto

Atualizado em 2026-08-27.

Este documento é o ponto de referência técnico e funcional do projeto Faz Já. Não deve conter passwords, service-role keys, credenciais SMTP, dados pessoais de utilizadores nem outros segredos.

## 1. Conceito

Faz Já é um marketplace/diretório de profissionais locais. O utilizador descreve o problema ou navega por categorias e serviços, encontra profissionais adequados e pode guardar/pedir um serviço.

Objetivo de produto: problema → encontrar → escolher → pedir/contactar → serviço concluído.

Posicionamento: simples, direto e sem sistema de créditos por lead.

## 2. Marca e comunicação

Nome público: **Faz Já**.

Slogan principal: **Precisas. Encontras. Está feito.**

Paleta visual principal:
- azul petróleo `#0b555d`
- tons escuros próximos de `#083f46`
- fundos suaves em teal muito claro e branco

Identidade visual:
- cartões arredondados
- interface limpa e espaçada
- ícones SVG lineares próprios para categorias
- evitar emojis como ícones principais

Nunca usar “FazPerto” publicamente, salvo para referências técnicas antigas/backup.

## 3. Modelo de negócio

Clientes/utilizadores: gratuitos.

Profissionais:
- 60 dias gratuitos após criação do primeiro perfil profissional
- depois, plano mensal fixo
- preço de referência discutido: **14,99 €/mês**, ainda não ativado em cobrança
- sem comissão por trabalho
- sem créditos por contacto

Pagamentos ainda **não estão ativos**.

A ativação futura deve exigir ação explícita do profissional. Não deve haver cobrança surpresa.

## 4. Frontend atual

Hospedagem atual: GitHub Pages.

URL pública estável:

`https://vilapt.github.io/Site/fazja/`

Repositório de execução atual: `VilaPT/Site`.

Repositório de portefólio: `VilaPT/Faz-j-`.

O repositório de portefólio contém apenas o Faz Já e serve para apresentação técnica e evolução organizada do projeto.

## 5. Navegação e conta

No telemóvel existe uma barra inferior com:
- Início
- Pedidos
- Profissional
- Conta

Área de Conta:
- ver nome
- editar nome
- ver email
- editar telefone
- ver tipo de conta
- ver pedidos efetuados
- aceder/criar perfil profissional

Uma conta pode começar como cliente e depois tornar-se profissional sem criar uma segunda conta.

## 6. Categorias e serviços

Categorias principais:
1. Casa
2. Automóvel
3. Tecnologia
4. Limpeza e apoio
5. Beleza e bem-estar
6. Educação
7. Eventos
8. Animais
9. Negócios e profissionais
10. Transportes

Existem dezenas de serviços/skills associados às categorias.

Os ícones de categoria são SVGs desenhados pela aplicação, não emojis da base de dados.

## 7. Pesquisa

O utilizador pode:
- escrever um problema em linguagem natural
- indicar localidade
- escolher categoria
- escolher serviço específico

O frontend tenta resolver o texto para um serviço conhecido e procura profissionais associados a esse serviço.

As pesquisas são registadas para análise de procura, incluindo pesquisas sem resultados.

## 8. Backend

Backend atual: Supabase.

Projeto Supabase: **FazJá**.

Região: Europa.

Stack atual:
- Supabase Auth
- PostgreSQL
- Row Level Security (RLS)
- triggers de criação de perfil
- tabelas de profissionais, skills, pedidos e analytics

Chaves secretas nunca devem ser colocadas neste documento ou no frontend.

O frontend usa apenas a chave publishable/cliente adequada.

## 9. Tabelas principais

### `profiles`
Perfil base de cada utilizador autenticado.

Campos relevantes:
- id
- account_type
- display_name
- phone
- timestamps

### `service_categories`
Categorias públicas de serviços.

### `skills`
Serviços concretos associados a categorias.

### `professional_profiles`
Perfil público/profissional.

Inclui:
- nome público
- título
- bio
- cidade
- raio de serviço
- preço indicativo
- disponibilidade
- visibilidade pública
- estado de verificação

### `professional_skills`
Relação muitos-para-muitos entre profissional e serviços.

### `professional_availability`
Disponibilidade semanal futura/estruturada do profissional.

### `service_requests`
Pedidos de serviço de clientes.

Estados atuais:
- open
- matched
- accepted
- completed
- cancelled

Atualmente o pedido guarda o cliente, mas **ainda não guarda de forma completa o profissional responsável**. Este é um dos próximos desenvolvimentos obrigatórios.

### `search_events`
Analytics de pesquisa e procura sem resultados.

## 10. Segurança

RLS está ativo nas tabelas sensíveis.

Regras importantes:
- cliente só vê/altera os próprios pedidos
- utilizador só altera o próprio perfil
- profissional só altera o próprio perfil/skills/disponibilidade
- estado de verificação profissional não deve ser alterável diretamente pelo browser
- dados privados não devem ser públicos

O acesso público a profissionais deve depender de:
- `is_public`
- direito profissional ativo/trial válido

## 11. Trial e subscrição

Tabela de plano profissional:
- plano standard
- trial de 60 dias
- billing ainda desativado

Membership profissional:
- criada quando o primeiro perfil profissional é criado
- trial não deve poder ser reiniciado apagando/recriando o perfil

Estados previstos:
- trial
- active
- past_due
- cancelled
- expired

Durante trial válido ou subscrição ativa, o perfil pode aparecer nas pesquisas.

Depois de expirar, o perfil é preservado mas deixa de aparecer publicamente.

## 12. Pedidos guardados

O utilizador pode guardar pedidos.

Na Área de Conta, pedidos ativos podem ser retirados.

A ação “Retirar pedido” não apaga o histórico: muda o estado para `cancelled`.

Só pedidos em estados iniciais, como `open` ou `matched`, devem poder ser retirados pelo cliente.

## 13. Autenticação

Fluxo esperado:
1. Criar conta
2. Receber email de confirmação
3. Confirmar email
4. Regressar ao Faz Já
5. Entrar/continuar sessão

Redirect público correto:

`https://vilapt.github.io/Site/fazja/`

Foi corrigido um problema antigo em que os emails redirecionavam para `localhost:3000`.

## 14. SMTP e emails

Estado atual: o projeto ainda depende do SMTP de teste do Supabase.

Foi detetado erro:

`429: email rate limit exceeded`

Isto acontece porque o SMTP incluído pelo Supabase é limitado e não é adequado a produção.

A interface já traduz este erro para português e bloqueia múltiplos cliques seguidos no botão de registo.

Antes de lançamento público deve ser configurado SMTP próprio, por exemplo:
- Brevo
- Resend
- Postmark
- SendGrid

Não guardar credenciais SMTP no repositório.

## 15. Problemas já encontrados e resolvidos

### Loop de renderização de ícones
Um `MutationObserver` entrou em ciclo ao substituir ícones e podia deixar a app presa em “A carregar”. Foi removido/substituído por renderização segura.

### Dependência de `/fazperto/`
O `/fazja/` carregava o projeto antigo por baixo. Foi migrado para ficheiros próprios independentes.

### Redirect para localhost
Links de confirmação de email iam para `localhost:3000`. Foi corrigido para o URL público do Faz Já.

### Falta de área de conta
Foi adicionada navegação e Área de Conta.

### Cliente sem caminho para virar profissional
Foi exposto caminho para “Tornar-me profissional”.

### Pedidos sem opção de retirar
Foi adicionada ação de retirar/cancelar pedido.

### Mensagens de Auth em inglês
Foi adicionada uma camada de mensagens amigáveis em português para erros frequentes.

## 16. Estado de lançamento

O projeto está numa **beta funcional**, não num produto comercial totalmente pronto.

Não é aconselhável fazer ainda um lançamento público grande.

Estratégia sugerida:
- beta controlada
- testar com contas reais
- recrutar primeiros profissionais
- concentrar oferta inicialmente numa zona geográfica e categorias fortes
- validar fluxo completo antes de publicidade significativa

## 17. Bloqueadores prioritários antes do lançamento público

1. Configurar SMTP próprio de produção.
2. Implementar fluxo completo de trabalho:
   - cliente faz pedido
   - profissionais elegíveis recebem/veem pedido
   - profissional aceita
   - pedido fica associado ao profissional
   - em curso
   - concluído
   - histórico para cliente e profissional
3. Implementar notificações adequadas.
4. Adicionar portefólio/fotos dos profissionais.
5. Implementar verificação/administração de profissionais.
6. Implementar avaliações apenas após trabalho concluído.
7. Rever Termos e Política de Privacidade para lançamento comercial.
8. Definir operador legal/contacto de privacidade.
9. Ativar proteção CAPTCHA/rate limiting adequada.
10. Preparar billing/pagamentos apenas quando a fase comercial justificar.
11. Avaliar domínio próprio e migração futura para stack de produção mais robusta.

## 18. Próximo grande desenvolvimento

O próximo desenvolvimento funcional recomendado é:

**Pedido → profissional → aceitação → execução → conclusão → histórico.**

Isto transforma o Faz Já de diretório/pesquisa numa plataforma transacional real.

## 19. Roadmap técnico futuro

Arquitetura futura sugerida para produto comercial:
- Next.js
- TypeScript
- Supabase
- domínio próprio
- deploy dedicado
- SMTP próprio
- pagamentos via provider com webhook
- storage otimizado para fotos
- painel admin
- analytics e moderação

A versão atual em HTML/CSS/JavaScript serve para validar produto e experiência antes dessa migração.

## 20. Princípios de desenvolvimento

- não quebrar fluxos já funcionais ao alterar design
- fazer mudanças incrementais e reversíveis
- manter backup até validação
- nunca expor secret/service-role keys no browser
- não inventar dados ou estados que a base ainda não suporta
- privilegiar experiência mobile
- manter copy pública natural, sem linguagem interna de MVP/IA
- cada funcionalidade nova deve ser explicável tecnicamente para aprendizagem e portefólio
