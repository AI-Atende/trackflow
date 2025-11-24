import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from './auth.js';
import prisma from './prisma.js';

export interface AuthRequest extends Request {
  auth?: { clientId: string; email?: string; role?: string };
  client?: any;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });

  req.auth = { clientId: payload.clientId, email: payload.email, role: payload.role } as any;
  // buscar cliente para garantir que ainda existe e anexar
  const client = await prisma.client.findUnique({ where: { id: payload.clientId } }) as any;
  if (!client) return res.status(401).json({ error: 'Invalid token' });
  req.client = client;

  return next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'Missing auth' });
  if (req.auth.role !== 'ADMIN') return res.status(403).json({ error: 'Admin required' });
  return next();
}
