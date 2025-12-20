/**
 * Hash an IP address using SHA-256 for privacy
 * @param ip - The IP address to hash
 * @returns Promise<string> - The hashed IP address as a hex string
 */
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
