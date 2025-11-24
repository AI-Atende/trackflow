# Trackflow Backend (Meta integration)

Setup rápido:

1. Copie `.env.example` para `.env` e preencha variáveis.
2. Instale dependências: `npm install`.
	- Recomendo também instalar tipos durante o desenvolvimento: `npm install -D @types/node @types/express`.
3. Gere o cliente Prisma: `npx prisma generate`.
4. Rode migração dev (SQLite): `npx prisma migrate dev --name init`.
5. Rode em modo dev: `npm run dev`.

Endpoints principais (esperam header `x-client-id` com o id do cliente):

- GET /api/meta/:adAccountId/campaigns
- GET /api/meta/:adAccountId/adsets
- GET /api/meta/:adAccountId/ads
- GET /api/meta/:adAccountId/insights?level=campaign&since=YYYY-MM-DD&until=YYYY-MM-DD
- GET /api/meta/oauth/start
- GET /api/meta/oauth/callback?code=...

Observações:
- Este é um esqueleto inicial. Autenticação real deve ser integrada (JWT/next-auth/etc.).
- Sistema usa Prisma com SQLite por conveniência.
- Observação: se você estiver usando Prisma v5+, mantenha `DATABASE_URL` no `.env`. Algumas mensagens do Prisma podem sugerir config adicional; para dev local SQLite, seguir o passo `npx prisma migrate dev` funciona bem.
