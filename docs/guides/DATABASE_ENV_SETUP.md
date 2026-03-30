# Configuração de Banco de Dados Multi-Ambiente

## Visão Geral

O projeto agora suporta ambientes de desenvolvimento e produção com bancos de dados separados, evitando conflitos entre versões de teste e produção na mesma máquina.

## Configuração

### Variáveis de Ambiente

No arquivo `.env` na raiz do projeto:
- `APP_ENV=dev` - Ativa modo de desenvolvimento (usa `database.dev.db`)
- `APP_ENV=prod` ou não definido - Usa banco de produção (`database.db`)

### Arquivos de Banco de Dados

- **Produção**: `/api/data/database.db`
- **Desenvolvimento**: `/api/data/database.dev.db`
- **Testes**: `/api/data/database.test.db`

## Funcionamento

### Criação Automática do Banco de Desenvolvimento

Quando a aplicação é iniciada com `APP_ENV=dev`:

1. O sistema verifica se `database.dev.db` existe
2. Se não existir e `database.db` existir, faz uma cópia automaticamente
3. Utiliza o banco de desenvolvimento separado

### Benefícios

✅ **Isolamento**: Desenvolvimento e produção não compartilham o mesmo banco
✅ **Segurança**: Testes não afetam dados de produção
✅ **Cópia Automática**: Primeira execução em dev copia dados da produção
✅ **Compatível**: Mantém estrutura existente para ambientes de produção

## Uso

### Ambiente de Desenvolvimento

```bash
# No arquivo .env
APP_ENV=dev

# Iniciar a aplicação
npm run dev
```

### Ambiente de Produção

```bash
# No arquivo .env (remover ou comentar)
# APP_ENV=dev

# Ou explicitamente
APP_ENV=prod

# Iniciar a aplicação
npm start
```

## Implementação Técnica

### Arquivos Modificados

1. **`/api/src/db/index.ts`**
   - Adicionada lógica para detectar `APP_ENV=dev`
   - Copia automaticamente banco de produção para desenvolvimento se necessário
   - Define caminho do banco baseado no ambiente

2. **`/api/src/index.ts`**
   - Carrega variáveis de ambiente do `.env` raiz primeiro
   - Permite sobrescrever com `.env` específico da API

### Código Principal

```typescript
// Verifica se está em ambiente de desenvolvimento
const isDev = process.env.APP_ENV === 'dev'

// Define o caminho do banco baseado no ambiente
let dbPath = process.env.DATABASE_URL || process.env.TEST_DB_PATH

if (!dbPath) {
  if (isTest) {
    dbPath = path.join(__dirname, '../../data/database.test.db')
  } else if (isDev) {
    // Em desenvolvimento, usa um banco separado
    dbPath = path.join(__dirname, '../../data/database.dev.db')

    // Copia do banco de produção se não existir
    const prodDbPath = path.join(__dirname, '../../data/database.db')
    if (!fs.existsSync(dbPath) && fs.existsSync(prodDbPath)) {
      console.log('[DB] Creating development database from production database...')
      fs.copyFileSync(prodDbPath, dbPath)
      console.log('[DB] Development database created successfully!')
    }
  } else {
    dbPath = path.join(__dirname, '../../data/database.db')
  }
}
```

## Manutenção

### Backup do Banco de Desenvolvimento

Para resetar o banco de desenvolvimento:

```bash
cd /root/projects/weave/api/data
rm database.dev.db
# Será recriado automaticamente na próxima execução com APP_ENV=dev
```

### Backup do Banco de Produção

```bash
cd /root/projects/weave/api/data
cp database.db database.backup.$(date +%Y%m%d_%H%M%S).db
```

## Troubleshooting

### O banco de desenvolvimento não está sendo criado

1. Verifique se `APP_ENV=dev` está definido no `.env` raiz
2. Verifique se o banco de produção (`database.db`) existe
3. Verifique permissões de escrita no diretório `api/data/`

### A aplicação ainda usa o banco de produção

1. Verifique se a variável `APP_ENV` está sendo carregada corretamente
2. Reinicie a aplicação após alterar o `.env`
3. Verifique se não há `DATABASE_URL` definido sobrescrevendo a lógica
