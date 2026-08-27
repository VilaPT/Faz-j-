# Plano de refatoração JavaScript

Objetivo: reduzir o acoplamento do `app.js` sem alterar o comportamento funcional do Faz Já.

## Princípio

A refatoração será incremental e feita numa branch separada. O `main` permanece estável até cada etapa ser validada.

## Estrutura alvo

```text
js/
├── config.js
├── supabase.js
├── utils.js
├── auth.js
├── search.js
├── requests.js
├── professionals.js
├── memberships.js
└── app.js
```

## Progresso

- [x] Extrair configuração pública e criação do cliente Supabase.
- [x] Extrair funções utilitárias sem dependências de interface.
- [x] Separar autenticação e sessão.
- [ ] Separar pesquisa, categorias e analytics.
- [ ] Separar pedidos de cliente.
- [ ] Separar perfil profissional e membership/trial.
- [ ] Transformar `app.js` num ponto de arranque/orquestração.
- [ ] Atualizar `account.js` para reutilizar o mesmo cliente Supabase.
- [ ] Adicionar testes unitários às funções puras.
- [ ] Validar manualmente todos os fluxos antes de merge para `main`.

## O que mudou na etapa de autenticação

A autenticação deixou de estar implementada diretamente no `app.js`.

O módulo `js/auth.js` passou a ser responsável por:
- obter e manter a sessão atual
- login e logout
- criação de conta
- redirect de confirmação de email
- mensagens amigáveis para erros frequentes
- prevenção de múltiplos submits
- retomar a intenção original do utilizador após autenticação

O antigo `auth-ui.js` e o monkeypatch inline de `signUp` no HTML foram removidos porque essas responsabilidades passaram a ter um único dono.

## Critérios de aceitação

- Sem regressões no registo/login.
- Pesquisa e categorias continuam funcionais.
- Guardar e retirar pedidos funciona.
- Cliente continua a poder tornar-se profissional.
- Trial de 60 dias continua a ser controlado no backend.
- Nenhuma chave privilegiada é introduzida no frontend.
- O `main` só recebe a refatoração depois de validação.
