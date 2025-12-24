# Plano de Melhorias - App de Delivery

## Análise Atual

O app de delivery (`Cardapio.jsx`) possui um fluxo funcional, mas há oportunidades de melhoria em:
- UX/UI
- Validações
- Cálculos (desconto PIX)
- Integração com sistema de bairros
- Validação de valor mínimo

## Melhorias Propostas

### 1. **Aplicar Desconto PIX Corretamente**
- ✅ Exibir badge "-5%" no botão PIX
- ❌ Desconto não está sendo aplicado no cálculo do total
- **Ação**: Aplicar desconto de 5% quando forma de pagamento for PIX

### 2. **Validação de Bairro Atendido**
- ✅ Lista de bairros carregada do banco
- ❌ Não valida se o bairro está na lista antes de permitir finalizar
- **Ação**: Validar bairro e mostrar mensagem clara se não atendido

### 3. **Valor Mínimo de Pedido**
- ❌ Não há verificação de valor mínimo
- **Ação**: Implementar verificação de valor mínimo (ex: R$ 20,00)

### 4. **Melhorar Campo de Ponto de Referência**
- ✅ Campo "complemento" existe
- ⚠️ Pode ser mais claro para o usuário
- **Ação**: Melhorar label e placeholder

### 5. **Validação de Telefone**
- ✅ Campo existe
- ❌ Não valida formato (ex: (27) 99999-9999)
- **Ação**: Adicionar máscara e validação de formato

### 6. **Feedback Visual Melhorado**
- ✅ Alertas básicos existem
- ⚠️ Pode ser mais profissional
- **Ação**: Implementar toast notifications ou modais de confirmação mais elegantes

### 7. **Integração com Sistema de Notificações**
- ✅ Pedido é criado no banco
- ❌ Não utiliza sistema de notificações automáticas
- **Ação**: Garantir que notificações automáticas sejam disparadas

### 8. **Melhorar Cálculo de Taxa de Entrega**
- ✅ Taxa é calculada baseada no bairro
- ⚠️ Pode ser mais claro para o usuário quando a taxa muda
- **Ação**: Mostrar taxa claramente antes de finalizar

### 9. **Tratamento de Erros**
- ⚠️ Erros genéricos
- **Ação**: Mensagens de erro mais específicas e úteis

### 10. **Otimização de Performance**
- ⚠️ Múltiplas queries ao banco
- **Ação**: Otimizar carregamento de dados

## Prioridades

**Alta Prioridade:**
1. Aplicar desconto PIX
2. Validação de bairro atendido
3. Valor mínimo de pedido
4. Validação de telefone

**Média Prioridade:**
5. Melhorar feedback visual
6. Tratamento de erros
7. Campo de ponto de referência

**Baixa Prioridade:**
8. Otimização de performance
9. Integração com notificações (já existe no backend)

