# API Admin — Gerenciamento de Clientes e MetaAdAccounts

Este documento descreve as rotas administrativas que permitem a um usuário com role `ADMIN` gerenciar clientes (`Client`) e suas `MetaAdAccount`s. As rotas foram implementadas em `src/routes/admin.ts` e expostas em `/api/admin`.

Resumo rápido
- Todas as rotas exigem autenticação e autorização: `requireAuth` + `requireAdmin`.
- O token JWT deve ser enviado no header `Authorization: Bearer <token>`.

Conteúdo
- Endpoints
- Payloads
- Exemplos (curl / fetch)
- Notas sobre segurança e boas práticas

---

## Autenticação e autorização

- Header: `Authorization: Bearer <token>` onde `<token>` é o JWT retornado no login.
- Middleware usado:
  - `requireAuth` — valida o token e carrega `req.auth` / `req.client`.
  - `requireAdmin` — garante `req.auth.role === 'ADMIN'`.

---

## Endpoints

Base: /api/admin

1) GET /clients
- Descrição: lista todos os clientes (id, name, email, role, createdAt)
- Permissões: ADMIN
- Resposta 200: `{ clients: [ { id, name, email, role, createdAt } ] }`

2) GET /clients/:id
- Descrição: retorna detalhes de um cliente, incluindo `metaAdAccounts`
- Permissões: ADMIN
- Resposta 200: `{ client: { id, name, email, role, createdAt, updatedAt, metaAdAccounts: [...] } }`
- 404 quando não encontrado

3) POST /clients
- Descrição: cria um novo cliente (básico). Não faz hash automático de senha — se quiser criar com senha, prefira usar um endpoint separado que faça hash.
- Permissões: ADMIN
- Body (JSON): `{ "name": "Nome", "email": "email@example.com", "role": "MEMBER" }`
- 201: `{ client: { id, name, email, role } }`
- 400: parâmetros inválidos
- 409: email já em uso

4) PATCH /clients/:id
- Descrição: atualiza campos do cliente
- Permissões: ADMIN
- Body (JSON): `{ "name"?: string, "email"?: string, "role"?: "MEMBER" | "ADMIN" }`
- 200: `{ client: { ... } }`
- 404: cliente não encontrado

5) DELETE /clients/:id
- Descrição: remove cliente
- Permissões: ADMIN
- 200: `{ ok: true }`
- 404: cliente não encontrado

6) POST /clients/:id/meta-accounts
- Descrição: adiciona uma MetaAdAccount ao cliente
- Permissões: ADMIN
- Body (JSON): `{ "adAccountId": "act_...", "name"?: string, "accessToken": "...", "tokenExpiresAt"?: "ISO date", "status": "active" }`
- 201: `{ metaAdAccount: { ... } }`
- 400: parâmetros faltando

7) PATCH /clients/:id/meta-accounts/:aid
- Descrição: atualiza MetaAdAccount por id
- Permissões: ADMIN
- Body (JSON): `{ "name"?: string, "accessToken"?: string, "tokenExpiresAt"?: "ISO date", "status"?: string }`
- 200: `{ metaAdAccount: { ... } }`
- 404: não encontrado

8) DELETE /clients/:id/meta-accounts/:aid
- Descrição: remove MetaAdAccount por id
- Permissões: ADMIN
- 200: `{ ok: true }`
- 404: não encontrado

---

## Exemplos

Exemplo: listar clientes

```bash
curl -H "Authorization: Bearer $TOKEN" https://SEU_HOST/api/admin/clients
```

Exemplo: criar cliente

```bash
curl -X POST https://SEU_HOST/api/admin/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente X","email":"cli@ex.com","role":"MEMBER"}'
```

Exemplo: adicionar MetaAdAccount

```bash
curl -X POST https://SEU_HOST/api/admin/clients/<clientId>/meta-accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"adAccountId":"act_123","name":"Conta 1","accessToken":"abc","status":"active"}'
```

Exemplo fetch (JS)

```js
async function createClient(token, payload) {
  const res = await fetch('/api/admin/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload),
  });
  return res.json();
}
```

---

## Validação e boas práticas

- Valide sempre os payloads (recomendo Zod/Joi). Evite inserir valores inesperados para `role`.
- Não exponha `passwordHash` nas respostas.
- Ao criar/atualizar senha, sempre fazer hash (`bcrypt`) antes de salvar.
- Audite operações administrativas e registre eventos críticos (criação/remoção de admins, deleção de clientes).
- Restrinja o acesso a rotas admin via redes, VPNs ou um painel adicional se necessário.

---

## Integração com o seed

- O seed `prisma/seed.ts` cria um usuário admin padrão (variáveis de ambiente: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`).
- Após rodar o seed, use o login para obter um JWT e usar nas chamadas admin.

---

## Observações finais

- Após aplicar o schema novo do Prisma (campo `role`), rode `npx prisma generate`.
- Se quiser que eu adicione validação automática com Zod nas rotas admin ou hashing de senha automático nos endpoints de criação/atualização, eu implemento em seguida.
