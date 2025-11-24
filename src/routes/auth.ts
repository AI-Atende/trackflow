import express, { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { hashPassword, comparePassword, signJwt } from '../lib/auth.js';

const router = express.Router();

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body as any;
  if (!email || !password || !name) return res.status(400).json({ error: 'name, email and password required' });

  const existing = await prisma.client.findFirst({ where: { email }, select: { id: true } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await hashPassword(password);
  // não usar select com `role` até regenerar o Prisma Client
  const client = await prisma.client.create({ data: { name, email, passwordHash } }) as any;

  const token = signJwt({ clientId: client.id, email: client.email, role: client.role });
  // buscar MetaAdAccount associada (se houver) e incluir no retorno
  const meta = await prisma.metaAdAccount.findFirst({ where: { clientId: client.id } as any, select: { id: true, adAccountId: true, name: true, status: true, tokenExpiresAt: true, accessToken: true } as any });
  return res.json({ client: { id: client.id, name: client.name, email: client.email, role: client.role, metaAdAccount: meta || null }, token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as any;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  // buscar cliente completo e usar cast para acessar role (Prisma Client ainda precisa ser gerado para atualizar tipos)
  const client = await prisma.client.findFirst({ where: { email } }) as any;
  if (!client || !client.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(password, client.passwordHash as string);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signJwt({ clientId: client.id, email: client.email, role: client.role });
  // buscar MetaAdAccount associada (se houver) e incluir no retorno
  const meta = await prisma.metaAdAccount.findFirst({ where: { clientId: client.id } as any, select: { id: true, adAccountId: true, name: true, status: true, tokenExpiresAt: true, accessToken: true } as any });
  return res.json({ client: { id: client.id, name: client.name, email: client.email, role: client.role, metaAdAccount: meta || null }, token });
});

export default router;
