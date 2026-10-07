// Authentifizierung: Passwort-Hashing (scrypt aus node:crypto, keine native
// Abhaengigkeit) und JSON-Web-Tokens fuer die zustandslose Session.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'stars-mvp-dev-secret-change-me';
const TOKEN_TTL = '7d';

// scrypt-Hash im Format  salt:hash  (beides Hex).
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// Express-Middleware: prueft Bearer-Token und setzt req.user.
export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Nicht authentifiziert' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
  // Nur freigegebene Konten duerfen die Plattform nutzen; der Status wird bei
  // jeder Anfrage geprueft, damit eine Sperre sofort wirkt.
  const row = db.prepare('SELECT status FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(401).json({ error: 'Konto nicht gefunden' });
  if (row.status !== 'active') return res.status(403).json({ error: statusMessage(row.status), code: row.status });
  next();
}

// Rollenbasierte Zugriffskontrolle (z.B. nur Admin fuer bestimmte Endpunkte).
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
  };
}

export function statusMessage(status) {
  return status === 'pending'
    ? 'Dein Konto wartet noch auf die Freigabe durch stars.'
    : 'Dein Konto wurde nicht freigegeben. Bitte wende dich an stars.';
}
