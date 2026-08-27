# Plano de refatoração JavaScript

Objetivo: reduzir o acoplamento do `app.js` sem alterar o comportamento funcional do Faz Já.

## Princípio

A refatoração é incremental e feita numa branch separada. O `main` permanece estável até cada etapa ser validada.

## Estrutura atual

```text
js/
├── config.js
├── supabase.js
├── utils.js
├── auth.js
├── search.js
├── requests.js
├── professionals.js
└── memberships.js

app.js
account.js
```

## Progresso

- [x] Extrair configuração pública e criação do cliente Supabase.
- [x] Extrair funções utilitárias sem dependências de interface.
- [x] Separar autenticação e sessão.
- [x] Separar pesquisa, categorias e analytics.
- [x] Separar pedidos de cliente.
- [x] Separar perfil profissional e membership/trial.
- [x] Transformar `app.js` num ponto de arranque/orquestração.
- [x] Atualizar `account.js` para reutilizar o mesmo cliente Supabase.
- [x] Adicionar primeiros testes unitários às funções puras.
- [x] Executar testes automaticamente em GitHub Actions.
- [ ] Validar manualmente todos os fluxos antes de merge para `main`.

## Responsabilidades por módulo

### `js/config.js`
Configuração pública do frontend, incluindo URL do projeto Supabase, publishable key e URL pública da aplicação.

### `js/supabase.js`
Cria a única instância do cliente Supabase utilizada pelos módulos da aplicação.

### `js/utils.js`
Funções puras e reutilizáveis, como normalização de texto, escape de HTML, ID anónimo de pesquisa e cálculo de dias.

### `js/auth.js`
Responsável por sessão, login, logout, criação de conta, confirmação por redirect e recuperação da intenção original do utilizador após autenticação.

### `js/search.js`
Responsável por categorias, catálogo de serviços, interpretação básica da pesquisa, pesquisa de profissionais e registo de `search_events`.

### `js/requests.js`
Responsável por abrir e guardar pedidos de cliente, utilizando o contexto atual da pesquisa.

### `js/memberships.js`
Responsável pelo estado do trial/subscrição profissional e pela apresentação desse estado na interface.

### `js/professionals.js`
Responsável por criação e edição do perfil profissional e respetivas competências.

### `app.js`
Ponto de arranque e orquestração. Liga os módulos, mantém a interface global de sessão e trata apenas responsabilidades transversais simples.

### `account.js`
Área pessoal do utilizador. Reutiliza o mesmo cliente Supabase e módulos partilhados em vez de criar uma segunda ligação independente.

## Testes automáticos

O projeto usa o test runner nativo do Node (`node --test`) para evitar dependências desnecessárias.

Testes iniciais cobrem:
- normalização de texto
- escape de HTML
- cálculo de dias do trial

O workflow `.github/workflows/test.yml` executa `npm test` em pushes relevantes e Pull Requests para `main`.

## Critérios de aceitação antes do merge

- Registo de cliente funciona.
- Registo profissional funciona.
- Confirmação de email regressa ao URL correto.
- Login e logout funcionam.
- Pesquisa e categorias continuam funcionais.
- Analytics de pesquisa continuam a ser gravados.
- Guardar e retirar pedidos funciona.
- Cliente continua a poder tornar-se profissional.
- Criar e editar perfil profissional funciona.
- Trial de 60 dias continua a ser controlado no backend.
- Área de conta continua funcional em desktop e mobile.
- Nenhuma chave privilegiada é introduzida no frontend.
- Testes automáticos passam.
- O `main` só recebe a refatoração depois desta validação.
