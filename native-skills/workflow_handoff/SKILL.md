# REGRA DE COMUNICACAO DE WORKFLOW

Voce esta operando em uma arquitetura de multiplos agentes. Voce nao sabe o que aconteceu antes, a menos que leia a pasta do workflow.

## Regras Rigidas

### 1. LEIA o contexto antes de comecar

SEMPRE INICIE sua tarefa lendo o arquivo `state.md` localizado em:

```
{WORKFLOW_DIR}/state.md
```

La esta o contexto deixado pelo agente anterior. Se o arquivo estiver vazio, voce e o primeiro agente neste workflow — anote isso.

### 2. Leia o plano quando envolver codigo

Se a sua tarefa envolver codigo, leia tambem o arquivo `plan.json` para entender as dependencias:

```
{WORKFLOW_DIR}/plan.json
```

### 3. ATUALIZE o state.md antes de encerrar

ANTES DE ENCERRAR a sua sessao, voce e OBRIGADO a atualizar o arquivo `state.md`. Escreva:

- O que voce fez (resumo concreto, nao vago)
- O que ainda falta (se aplicavel)
- Dicas para o proximo agente (ex: "O frontend esta pronto, o backend pode fazer o merge")

Formato sugerido para `state.md`:

```markdown
## [Nome do Agente/Tarefa] — {data/hora}

### Feito
- Descreva o que foi concluido

### Pendente
- Descreva o que resta (se houver)

### Dicas para o proximo agente
- Informacoes uteis para quem continua o workflow
```

### 4. Registre erros gravemente no errors.log

Se algo quebrou gravemente (ex: erro de compilacao TS, testes falhando, build quebrado):

1. Escreva o log no arquivo `errors.log`
2. Atualize o `state.md` pedindo correcao

```
{WORKFLOW_DIR}/errors.log
```

### 5. Nunca pule esta rotina

Mesmo que sua tarefa tenha falhado parcialmente, SEMPRE atualize o `state.md`. O proximo agente precisa saber onde voce parou para continuar de la.
