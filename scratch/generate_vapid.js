import crypto from 'crypto';

// VAPID keys are prime256v1 (secp256r1) EC keys
function generateVAPIDKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der'
    }
  });

  // Extract the raw coordinates for uncompressed public key (65 bytes)
  // DER format public key contains the 65-byte uncompressed public key at the end
  const rawPubKey = publicKey.slice(-65);
  // PKCS8 private key DER contains the 32-byte private key value starting at index 36 (for EC prime256v1)
  // Let's extract the raw private key (32 bytes)
  const rawPrivKey = privateKey.slice(-32);

  // Encode to URL-safe base64
  const base64UrlEncode = (buf) => {
    return buf.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  console.log('=== CHAVES VAPID GERADAS COM SUCESSO ===');
  console.log('VITE_VAPID_PUBLIC_KEY =', base64UrlEncode(rawPubKey));
  console.log('VAPID_PRIVATE_KEY =', base64UrlEncode(rawPrivKey));
}

generateVAPIDKeys();
