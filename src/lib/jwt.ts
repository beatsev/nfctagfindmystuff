import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface MagicLinkPayload {
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Create a session JWT token
 * @param payload - User session data
 * @param secret - JWT secret from env
 * @param durationHours - Session duration in hours
 */
export async function createSessionToken(
  payload: SessionPayload,
  secret: string,
  durationHours: number
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${durationHours}h`)
    .sign(secretKey);
}

/**
 * Verify and decode a session JWT token
 * @param token - JWT token string
 * @param secret - JWT secret from env
 */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jwtVerify(token, secretKey);
    return payload as SessionPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Create a magic link token (short-lived)
 * @param email - User email
 * @param secret - Magic link secret from env
 * @param expiryMinutes - Token expiry in minutes
 */
export async function createMagicLinkToken(
  email: string,
  secret: string,
  expiryMinutes: number
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(secretKey);
}

/**
 * Verify and decode a magic link token
 * @param token - Magic link token string
 * @param secret - Magic link secret from env
 */
export async function verifyMagicLinkToken(
  token: string,
  secret: string
): Promise<MagicLinkPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jwtVerify(token, secretKey);
    return payload as MagicLinkPayload;
  } catch (error) {
    console.error('Magic link verification failed:', error);
    return null;
  }
}
