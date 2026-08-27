# Fluxo de pedido, chat e serviço

Este documento descreve o fluxo funcional decidido para o Faz Já.

## Princípio de privacidade

- Apenas perfis profissionais são pesquisáveis e visíveis publicamente.
- Contas de utilizador/cliente não têm perfil público pesquisável.
- O telefone e a morada do cliente são dados privados da conta.
- Esses dados só são partilhados com o profissional específico a quem o cliente envia um pedido.
- Um profissional não consegue consultar dados privados de clientes que fizeram pedidos a outros profissionais.
- O chat, as propostas e o histórico do pedido só podem ser consultados pelos dois participantes desse pedido.

## Início do pedido

1. O utilizador encontra um perfil profissional.
2. Carrega em **Pedir serviço**.
3. Para um pedido dirigido, a conta do cliente tem de ter telefone e morada preenchidos.
4. O pedido é associado ao profissional escolhido.
5. O sistema cria uma conversa privada ligada ao pedido.
6. A conversa abre automaticamente para o cliente e aparece em **Pedidos recebidos** para o profissional.

A morada é copiada para o pedido como destino do serviço. Assim, alterações posteriores à morada da conta não mudam silenciosamente o destino de um pedido já criado.

## Chat

O chat é a fonte central do serviço.

Ambos podem:
- enviar mensagens;
- ver mensagens do outro participante;
- ver acontecimentos do sistema no histórico.

Exemplos de acontecimentos do sistema:
- Pedido enviado ao profissional.
- O profissional enviou uma proposta de 45,00 €.
- O utilizador aceitou a proposta.
- O utilizador recusou a proposta.
- O utilizador desistiu do serviço.
- O profissional desistiu do pedido.
- O profissional marcou o serviço como concluído.

As alterações são propagadas através do Supabase Realtime quando a conversa está aberta.

## Proposta

O profissional dispõe de **Enviar proposta** no chat.

Uma proposta contém:
- valor em euros;
- condições/notas opcionais;
- estado.

Estados da proposta:
- `pending`
- `accepted`
- `rejected`
- `withdrawn`

Só pode existir uma proposta pendente por pedido de cada vez.

## Ações do utilizador

Além de **Enviar mensagem**, o utilizador tem:
- **Aceitar proposta**
- **Recusar proposta**
- **Desistir do serviço**

Aceitar e recusar ficam indisponíveis quando não existe uma proposta pendente.

Ao aceitar a proposta, o pedido passa para `accepted`.

Ao recusar, a conversa continua aberta e o profissional pode enviar uma nova proposta.

Ao desistir, o pedido é encerrado e a ação fica registada no histórico.

## Ações do profissional

Antes da aceitação:
- **Enviar mensagem**
- **Enviar proposta**
- **Desistir do pedido**

Depois de uma proposta ser aceite:
- **Enviar mensagem**
- **Ir até**
- **Pedido concluído**
- **Desistir do pedido**

## Waze

O botão **Ir até** só é apresentado ao profissional depois de o serviço estar aceite.

O botão gera uma navegação Waze para a morada privada copiada para o pedido.

A morada nunca é apresentada num perfil público.

## Contactos

O profissional recebe o telefone do cliente quando recebe aquele pedido dirigido.

O cliente pode aceder ao contacto do profissional dentro da relação criada pelo pedido.

O nome de conta do cliente não é usado como identidade pública no chat. Para o profissional, a outra parte é apresentada como **Cliente**.

## Estados do pedido

Estados utilizados atualmente:
- `open`
- `matched`
- `accepted`
- `in_progress`
- `completed`
- `declined`
- `cancelled`

No fluxo atual, `open`/`matched` representam conversa/negociação antes da aceitação formal da proposta.

## Tabelas relacionadas

- `profiles`: identidade privada, telefone e morada da conta.
- `professional_profiles`: dados públicos dos profissionais.
- `service_requests`: pedido, participantes e snapshot privado do destino/contacto.
- `service_messages`: mensagens e acontecimentos do sistema.
- `service_proposals`: propostas formais.

## Segurança

`service_messages` e `service_proposals` têm RLS.

A leitura é permitida apenas quando `auth.uid()` corresponde ao cliente ou ao profissional do respetivo `service_request`.

Mensagens normais só podem ser inseridas pelo utilizador autenticado como ele próprio. Acontecimentos de sistema e transições sensíveis são criados por funções de backend, não por texto confiado ao browser.

## Notificações

Na aplicação existe contador de pedidos novos para profissionais e atualização periódica da caixa de entrada.

Dentro do chat, mensagens, propostas e alterações de estado utilizam Realtime.

Notificações externas com a app fechada, por email ou push, continuam a ser uma fase posterior e dependem da configuração do serviço de email/notificações de produção.
