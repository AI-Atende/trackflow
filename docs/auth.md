# Autenticação (Login & Cadastro)

Este documento descreve as rotas de autenticação disponíveis em `src/routes/auth.ts`.

Base: / (as rotas são montadas diretamente no roteador exportado)

## Visão geral

Existem duas rotas principais:

- POST /register — cria um novo cliente (cadastro)
- POST /login — autentica um cliente e retorna um token JWT

- Token JWT expira em 7 dias (`expiresIn: '7d'`)

---
Descrição: cria um novo usuário (client) com name, email e password. Retorna o client criado (id, name, email) e um token JWT.

Request
- Content-Type: application/json
- Body (JSON):
  ```json
  {
    "name": "Nome do usuário",
    "email": "usuario@example.com",
    "password": "sua-senha"
  }
  ```

Respostas
- 200 OK
  - Corpo (JSON):
    ```json
    {
      "token": "<jwt-token>"
    }
    ```
- 400 Bad Request
  - Quando já existe um cliente com o mesmo email.
  - Exemplo: `{ "error": "Email already in use" }`
- A senha é armazenada como `passwordHash` usando bcrypt com SALT_ROUNDS = 10.
- O endpoint cria o registro via `prisma.client.create({ data: { name, email, passwordHash } })`.
Exemplo curl

  -d '{"name":"João","email":"joao@example.com","password":"senha123"}'

---


Request
- Content-Type: application/json
    "email": "usuario@example.com",
    "password": "sua-senha"
  }
  ```

  - Corpo (JSON):
    ```json
    {
      "client": { "id": 1, "name": "Nome do usuário", "email": "usuario@example.com" },
      "token": "<jwt-token>"
    }
    ```
  - Exemplo: `{ "error": "email and password required" }`
- 401 Unauthorized
  - Quando o email não existe ou a senha está incorreta.
  - Exemplo: `{ "error": "Invalid credentials" }`

Notas de implementação
- Busca o cliente por email: `prisma.client.findFirst({ where: { email } })`.
- Verifica `client.passwordHash` e compara com a senha enviada usando `comparePassword(password, client.passwordHash)` (bcrypt.compare).
- Em sucesso, gera um JWT com `signJwt({ clientId: client.id, email: client.email })`.

Exemplo curl

```bash
curl -X POST https://SEU_HOST/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@example.com","password":"senha123"}'
```

---

## Exemplo de uso em JavaScript (fetch)

```js
}

async function login(email, password) {
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

// Exemplo (alternativa mais segura): receber o token em um cookie httpOnly
async function loginWithCookie(email, password) {
  // supondo que o servidor defina um cookie httpOnly na rota /login
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include', // envia/recebe cookies
  });
```

---
- Sempre defina `JWT_SECRET` em produção; não use o valor padrão `dev-secret`.
- Considere usar HTTPS em todas as chamadas (TLS) para proteger credenciais.
- Valide e saneie entradas de usuário (e-mail válido, tamanho mínimo de senha).
- Considere políticas de senha fortes e rate limiting em endpoints de autenticação para evitar brute-force.
- Se necessário, implemente refresh tokens e revogação de tokens.
- Armazene o token JWT no cliente com cuidado (HTTP-only cookies são preferíveis para mitigar XSS). Se usar localStorage/sessionStorage, esteja ciente do risco de XSS.

### Boas práticas de uso do token

- Usar cookie httpOnly com SameSite=strict/strict-ish quando possível. Isso ajuda a proteger contra XSS e CSRF.
- Para APIs públicas, enviar o token no header `Authorization: Bearer <token>` em cada requisição autenticada.
- Ao usar cookies, combine com proteção CSRF (double submit cookie ou token anti-CSRF).

### Validação de entrada (exemplo com Zod)

Recomenda-se validar os payloads antes de executar lógica de negócio. Exemplo mínimo com Zod:

```ts
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

// uso no express
// const body = registerSchema.parse(req.body);
```

---

## Esquemas (Resumido)

Register request:
- name: string
- email: string
- password: string

Login request:
- email: string
- password: string

Success response (register/login):
- client: { id: number, name: string, email: string }
- token: string (JWT)

Errors:
- 400: parâmetros ausentes
- 401: credenciais inválidas
- 409: email já em uso

---

## Arquivos relevantes

- `src/routes/auth.ts` - implementa as rotas `POST /register` e `POST /login`.
- `src/lib/auth.ts` - funções `hashPassword`, `comparePassword`, `signJwt`, `verifyJwt`.
- `src/lib/prisma.ts` - instância do Prisma Client (usado por `routes/auth.ts`).


## Próximos passos recomendados

- Incluir exemplos de testes automatizados para endpoints de autenticação.
- Implementar validação mais robusta (Joi/Zod) antes de criar/validar usuários.
- Adicionar testes de integração que cobrem fluxo de registro/login e tokens JWT.
