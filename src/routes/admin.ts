import express, { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireAdmin } from '../lib/authorization.js';

const router = express.Router();

// List all clients
router.get('/clients', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } as any });

  // para robustez (e evitar dependência do nome da relação no client gerado),
  // buscamos explicitamente a MetaAdAccount por clientId e anexamos ao resultado
  const clientsWithMeta = await Promise.all(
    clients.map(async (c: any) => {
      const meta = await prisma.metaAdAccount.findFirst({ where: { clientId: c.id } as any, select: { id: true, adAccountId: true, name: true, status: true, tokenExpiresAt: true, accessToken: true } as any });
      return { ...c, metaAdAccount: meta || null };
    })
  );

  return res.json({ clients: clientsWithMeta });
});

// Get client by id
router.get('/clients/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'id required' });
  // buscar o client (campos básicos)
  const client = await prisma.client.findUnique({ where: { id: id as string }, select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true } as any });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // buscar metaAdAccount separadamente para evitar dependência de tipos do prisma client
  const meta = await prisma.metaAdAccount.findFirst({ where: { clientId: id as string } as any, select: { id: true, adAccountId: true, name: true, status: true, tokenExpiresAt: true, accessToken: true } as any });

  return res.json({ client: { ...client, metaAdAccount: meta || null } });
});

// Create client
router.post('/clients', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as any;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });

  const exists = await prisma.client.findFirst({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email already in use' });

  // Criar sem passwordHash; se precisar de password, pode-se criar endpoint separado para set de senha.
  const client = await prisma.client.create({ data: { name, email, role: role || 'MEMBER' } as any });
  return res.status(201).json({ client });
});

// Update client
router.patch('/clients/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'id required' });
  const { name, email, role } = req.body as any;
  try {
    const updated = await prisma.client.update({ where: { id: id as string }, data: { name, email, role } as any });
    return res.json({ client: updated });
  } catch (err: any) {
    return res.status(404).json({ error: 'Client not found' });
  }
});

// Delete client
router.delete('/clients/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    await prisma.client.delete({ where: { id: id as string } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(404).json({ error: 'Client not found' });
  }
});

// Add MetaAdAccount
router.post('/clients/:id/meta-accounts', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const clientId = req.params.id;
  const { adAccountId, name, accessToken, tokenExpiresAt, status } = req.body as any;
  if (!adAccountId || !accessToken || !status) return res.status(400).json({ error: 'adAccountId, accessToken and status required' });

  // cada client só pode ter uma metaAdAccount
  const clientIdStr = String(clientId || '');
  const existing = await prisma.metaAdAccount.findFirst({ where: { clientId: clientIdStr } as any });
  if (existing) return res.status(409).json({ error: 'Client already has a MetaAdAccount' });

  try {
  const created = await prisma.metaAdAccount.create({ data: { clientId, adAccountId, name, accessToken, tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null, status } as any });
  // retornar também accessToken conforme solicitado
  return res.status(201).json({ metaAdAccount: created });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not create MetaAdAccount' });
  }
});

// Update MetaAdAccount
router.patch('/clients/:id/meta-accounts/:aid', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const clientId = req.params.id;
  const aid = req.params.aid;
  const { name, accessToken, tokenExpiresAt, status } = req.body as any;
  try {
  const updated = await prisma.metaAdAccount.update({ where: { id: aid as string }, data: { name, accessToken, tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined, status } as any });
  return res.json({ metaAdAccount: updated });
  } catch (err: any) {
    return res.status(404).json({ error: 'MetaAdAccount not found' });
  }
});

// Delete MetaAdAccount
router.delete('/clients/:id/meta-accounts/:aid', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const aid = req.params.aid;
  try {
    await prisma.metaAdAccount.delete({ where: { id: aid as string } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(404).json({ error: 'MetaAdAccount not found' });
  }
});

export default router;
