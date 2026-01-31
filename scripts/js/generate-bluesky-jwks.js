#!/usr/bin/env node

/**
 * Generate JWKS key pair for Bluesky OAuth
 *
 * This script generates an ECDSA P-256 key pair in JWK format
 * for use with Bluesky OAuth client authentication.
 *
 * Usage:
 *   node scripts/generate-bluesky-jwks.js
 *
 * Output:
 *   Prints the private JWK as a single-line JSON string to stdout
 */

const crypto = require('crypto');

// Generate ECDSA P-256 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert to JWK format
const publicJwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
const privateJwk = crypto.createPrivateKey(privateKey).export({ format: 'jwk' });

// Generate a stable key ID based on the public key
const publicKeyHash = crypto.createHash('sha256')
  .update(JSON.stringify(publicJwk))
  .digest('hex')
  .substring(0, 16);

// Add key ID and algorithm to JWKs
privateJwk.kid = publicKeyHash;
privateJwk.alg = 'ES256';
privateJwk.use = 'sig';

publicJwk.kid = publicKeyHash;
publicJwk.alg = 'ES256';
publicJwk.use = 'sig';

// Output private JWK as single-line JSON (for environment variable)
console.log(JSON.stringify(privateJwk));
