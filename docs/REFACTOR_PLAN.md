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

## Etapas

1. Extrair configuração pública e criação do cliente Supabase.
2. Extrair funções utilitárias sem dependências de interface.
3. Separar autenticação e sessão.
4. Separar pesquisa, categorias e analytics.
5. Separar pedidos de cliente.
6. Separar perfil profissional e membership/trial.
7. Transformar `app.js` num ponto de arranque/orquestração.
8. Atualizar `account.js` para reutilizar o mesmo cliente Supabase.
9. Adicionar testes unitários às funções puras.
10. Validar manualmente todos os fluxos antes de merge para `main`.

## Critérios de aceitação

- Sem regressões no registo/login.
- Pesquisa e categorias continuam funcionais.
- Guardar e retirar pedidos funciona.
- Cliente continua a poder tornar-se profissional.
- Trial de 60 dias continua a ser controlado no backend.
- Nenhuma chave privilegiada é introduzida no frontend.
- O `main` só recebe a refatoração depois de validação.
