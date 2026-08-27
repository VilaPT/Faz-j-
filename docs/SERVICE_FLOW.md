# Fluxo de pedido, chat, conclusão e avaliação

Este documento descreve o fluxo funcional decidido para o Faz Já.

## Privacidade
- Apenas perfis profissionais são pesquisáveis e visíveis publicamente.
- Contas de utilizador/cliente não têm perfil público pesquisável.
- Telefone e morada são dados privados da conta.
- Num pedido dirigido, esses dados são copiados para o pedido e ficam acessíveis apenas ao profissional escolhido.
- Chat, propostas e histórico só podem ser consultados pelos dois participantes.

## Início do pedido
1. O utilizador encontra um profissional.
2. Carrega em **Pedir serviço**.
3. Para pedidos dirigidos, telefone e morada têm de estar preenchidos.
4. O backend cria o pedido já associado ao profissional.
5. É criada uma conversa privada.
6. O profissional recebe uma notificação persistente de novo pedido.

Pedidos apenas guardados, sem profissional escolhido, continuam separados deste fluxo.

## Chat
Ambos podem enviar mensagens e ver eventos do sistema. As conversas usam Supabase Realtime enquanto estão abertas.

Eventos de sistema incluem criação do pedido, propostas, decisão da proposta, desistências, trabalho terminado, confirmação final e avaliação.

## Proposta
O profissional pode **Enviar proposta** com valor e condições.

O cliente pode:
- **Aceitar proposta**
- **Recusar proposta**
- **Desistir do serviço**

O profissional pode:
- enviar mensagens
- enviar proposta
- desistir do pedido

## Após aceitação
Depois de o cliente aceitar uma proposta, o profissional passa a ter:
- **Ir até**, que abre o Waze com a morada privada do pedido
- **Trabalho terminado**
- **Desistir do pedido**

O profissional não consegue concluir definitivamente o serviço sozinho.

## Conclusão em duas fases
1. O profissional carrega em **Trabalho terminado**.
2. O pedido passa para `awaiting_client_confirmation`.
3. O cliente recebe uma notificação persistente: **Confirma a conclusão do serviço**.
4. Em **Pedidos**, o cliente vê o pedido destacado e abre a conversa.
5. O cliente escolhe uma avaliação global de 1 a 5 estrelas e pode escrever um comentário opcional.
6. **Confirmar conclusão e avaliar** é uma única operação atómica no backend.
7. Só nesse momento o pedido passa para `completed`.

Assim, um profissional não pode fabricar serviços concluídos nem avaliações.

## Avaliações e visibilidade
Cada pedido concluído pode gerar apenas uma avaliação.

A avaliação é dada exclusivamente pelo cliente associado ao pedido e apenas depois de o profissional indicar que terminou o trabalho.

`professional_profiles` mantém dois campos calculados pelo backend:
- `rating_average`
- `rating_count`

O profissional não tem permissão para editar estes campos.

Na pesquisa, profissionais são ordenados por:
1. disponibilidade atual
2. média das avaliações
3. número de avaliações

Os cartões mostram a média e o número de avaliações quando existirem.

## Notificações
`service_notifications` guarda notificações persistentes por utilizador.

Exemplos:
- novo pedido recebido
- proposta enviada
- proposta aceite/recusada
- trabalho terminado a aguardar confirmação
- serviço confirmado pelo cliente

Há badges em **Pedidos** e **Profissional** e atualização por Realtime. Se a app estiver fechada, a notificação fica por ler e aparece quando o utilizador voltar.

Push/email com a app totalmente fechada é uma fase posterior e requer infraestrutura externa de notificações/SMTP.

## Estados principais
- `open`
- `matched`
- `accepted`
- `in_progress`
- `awaiting_client_confirmation`
- `completed`
- `declined`
- `cancelled`

## Segurança
- `service_messages`, `service_proposals`, `service_notifications` e `professional_reviews` usam RLS.
- Transições sensíveis são feitas por funções `SECURITY DEFINER` validadas no backend.
- Pedidos dirigidos são criados por `create_targeted_service_request`, que valida profissional, utilizador, telefone e morada.
- `client_confirm_and_review` confirma o serviço e cria a avaliação numa única transação.
- A média profissional é recalculada pelo backend e não pode ser alterada pelo browser.
