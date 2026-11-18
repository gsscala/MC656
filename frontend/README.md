# Frontend do sistema de votação eletrônica auditável

Aplicação React + TypeScript + Vite que consome a API REST do diretório `backend/` via proxy configurado em `vite.config.ts` (`/api` para `http://localhost:3001`).

## Funcionalidades implementadas em `src/App.tsx`

- Seleção de eleições entre os três cenários institucionais (`centro-academico`, `assembleia-condominio` e `orcamento-municipal`) e criação de novas eleições.
- Cabine de votação com indicação da estratégia de validação ativa, seleção de status do eleitor (`active` ou `blocked`), peso do voto e exibição do hash SHA-256 do recibo gerado.
- Painel de apuração ponderada com total nominal, soma ponderada, percentual por opção, taxa de participação e indicador de quórum.
- Aba de auditoria com verificador individual de recibo (`GET /api/elections/:id/receipts/:hash`) e visualização do `TurnoutCounterObserver` e do `AuditLogObserver`.

## Comandos disponíveis

```bash
npm ci        # Instalar dependências
npm run dev   # Iniciar servidor de desenvolvimento em http://localhost:5173
npm run lint  # Executar ESLint
npm run build # Verificar tipos (tsc -b) e gerar bundle em dist/
npm test      # Executar suíte Jest + React Testing Library com cobertura
```
