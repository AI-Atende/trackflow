import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signJwt(payload: object) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyJwt(token: string) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  try {
    return jwt.verify(token, secret) as any;
  } catch (err) {
    return null;
  }
}
