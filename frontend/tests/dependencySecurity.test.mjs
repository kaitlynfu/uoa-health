import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash, generateKeyPairSync, verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {preparePatch, hardenDependencies} from '../scripts/harden-dependencies.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const packages = name => Object.keys(lock.packages)
  .filter(path => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))
  .map(path => require(`${root}${path}`));

test('all installed dependency copies are hardened; reapplying is idempotent', () => {
  hardenDependencies(true);
  hardenDependencies(false);
  hardenDependencies(true);
});

test('installer rejects missing patches, unexpected content and partial patches', () => {
  const original = 'before\nuntouched\n';
  const spec = {path: 'fixture', hash: createHash('sha256').update(original).digest('hex'),
    changes: [{before: 'before', after: 'after'}]};
  assert.equal(preparePatch(original, spec), 'after\nuntouched\n');
  assert.equal(preparePatch('after\nuntouched\n', spec, true), 'after\nuntouched\n');
  assert.throws(() => preparePatch(original, spec, true), /backport missing/);
  assert.throws(() => preparePatch('after\nmodified\n', spec, true), /checksum mismatch/);
  assert.throws(() => preparePatch('neither\nuntouched\n', spec), /Unexpected patch context/);
  assert.equal(preparePatch(original.replaceAll('\n', '\r\n'), spec), 'after\nuntouched\n');
  const twoChanges = {...spec, changes: [...spec.changes, {before: 'untouched', after: 'also patched'}]};
  assert.throws(() => preparePatch('after\nuntouched\n', twoChanges), /Unexpected patch context/);
});

const nativeKeys = generateKeyPairSync('rsa', {modulusLength: 2048, publicExponent: 3});
const privatePem = nativeKeys.privateKey.export({type: 'pkcs1', format: 'pem'});
const publicPem = nativeKeys.publicKey.export({type: 'spki', format: 'pem'});

for (const [copy, forge] of packages('node-forge').entries()) {
  const privateKey = forge.pki.privateKeyFromPem(privatePem);
  const publicKey = forge.pki.publicKeyFromPem(publicPem);
  const a = forge.asn1;
  const seq = children => a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, children);
  const oid = a.create(a.Class.UNIVERSAL, a.Type.OID, false, a.oidToDer(forge.oids.sha256).getBytes());
  const nil = a.create(a.Class.UNIVERSAL, a.Type.NULL, false, '');
  const garbage = a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, 'unconsumed bytes');
  const digest = forge.md.sha256.create().update('test message').digest().getBytes();
  const encodedSignature = children => privateKey.sign(a.toDer(seq([
    seq(children), a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, digest),
  ])).getBytes(), 'NONE');

  test(`forge copy ${copy}: reject nested DigestAlgorithm garbage with and without NULL`, () => {
    for (const children of [[oid, nil, garbage], [oid, garbage], [oid, nil, nil]]) {
      const signature = encodedSignature(children);
      assert.throws(() => publicKey.verify(digest, signature), /DigestInfo/);
      assert.equal(verify('sha256', Buffer.from('test message'), nativeKeys.publicKey, Buffer.from(signature, 'binary')), false);
    }
  });

  test(`forge copy ${copy}: keep valid DigestAlgorithm encodings and reject wrong digests`, () => {
    for (const children of [[oid], [oid, nil]]) {
      const signature = encodedSignature(children);
      assert.equal(publicKey.verify(digest, signature), true);
      assert.equal(publicKey.verify(forge.md.sha256.create().update('changed').digest().getBytes(), signature), false);
      // Forge supports the optional-NULL encoding; OpenSSL requires NULL here.
      if (children.length === 2) assert.equal(verify('sha256', Buffer.from('test message'), nativeKeys.publicKey, Buffer.from(signature, 'binary')), true);
    }
  });

  test(`forge copy ${copy}: normal RSA signatures remain compatible with platform crypto`, () => {
    for (const algorithm of ['sha1', 'sha256', 'sha384', 'sha512']) {
      const md = forge.md[algorithm].create().update('normal build input');
      const signature = privateKey.sign(md);
      assert.equal(publicKey.verify(md.digest().getBytes(), signature), true);
      assert.equal(verify(algorithm, Buffer.from('normal build input'), nativeKeys.publicKey, Buffer.from(signature, 'binary')), true);
    }
  });
}

for (const [copy, braces] of packages('braces').entries()) {
  test(`braces copy ${copy}: reject deeply nested braces, parentheses and mixed containers`, () => {
    for (const [open, close] of [['{', '}'], ['(', ')'], ['{(', ')}']]) {
      const count = open.length === 1 ? 4000 : 2000;
      const pattern = open.repeat(count) + 'a,b' + close.repeat(count);
      for (const operation of ['parse', 'compile', 'expand', 'stringify']) {
        assert.throws(() => braces[operation](pattern), /maximum depth/);
      }
      assert.throws(() => braces(pattern), /maximum depth/);
    }
  });

  test(`braces copy ${copy}: direct AST inputs cannot bypass depth limits`, () => {
    let ast = {type: 'text', value: 'x'};
    for (let depth = 0; depth < 4000; depth++) ast = {type: 'paren', nodes: [ast]};
    const root = {type: 'root', nodes: [ast]};
    const cyclic = {type: 'root', nodes: []};
    cyclic.nodes.push(cyclic);
    for (const operation of ['compile', 'expand', 'stringify']) {
      assert.throws(() => braces[operation](root), /maximum depth/);
      assert.throws(() => braces[operation](cyclic), /child cycle/);
    }
  });

  test(`braces copy ${copy}: normal patterns, escapes, ranges and depth boundary still work`, () => {
    assert.deepEqual(braces.expand('src/{screens,services}/*.{ts,tsx}'), [
      'src/screens/*.ts', 'src/screens/*.tsx', 'src/services/*.ts', 'src/services/*.tsx',
    ]);
    assert.deepEqual(braces.expand('item-{1..3}'), ['item-1', 'item-2', 'item-3']);
    assert.equal(braces.compile('src/{a,b}'), 'src/(a|b)');
    for (const literal of ['\\{'.repeat(150), '"' + '{'.repeat(150) + '"', '[' + '{'.repeat(150) + ']']) {
      assert.doesNotThrow(() => braces.compile(literal));
    }
    assert.doesNotThrow(() => braces.compile('{'.repeat(100) + 'a,b' + '}'.repeat(100)));
    assert.throws(() => braces.parse('{'.repeat(101) + 'x' + '}'.repeat(101)), /maximum depth/);
    assert.doesNotThrow(() => braces.compile('{a,b}'.repeat(200)));
  });
}

test('Metro glob consumers retain ordinary brace matching', () => {
  const micromatch = require('micromatch');
  assert.deepEqual(micromatch(['src/App.tsx', 'src/api.ts', 'notes.txt'], 'src/*.{ts,tsx}'), ['src/App.tsx', 'src/api.ts']);
  assert.deepEqual(micromatch.braces('src/{screens,services}'), ['src/(screens|services)']);
});

test('Expo certificate, CSR and manifest signing remain functional', () => {
  const expo = require('@expo/code-signing-certificates');
  const keys = expo.convertKeyPairPEMToKeyPair({privateKeyPEM: privatePem.toString(), publicKeyPEM: publicPem.toString()});
  const now = Date.now();
  const generated = expo.generateSelfSignedCodeSigningCertificate({keyPair: keys,
    validityNotBefore: new Date(now - 60000), validityNotAfter: new Date(now + 86400000), commonName: 'test only'});
  const certificate = expo.convertCertificatePEMToCertificate(expo.convertCertificateToCertificatePEM(generated));
  assert.doesNotThrow(() => expo.validateSelfSignedCertificate(certificate, keys));
  const payload = Buffer.from('test manifest');
  const signature = expo.signBufferRSASHA256AndVerify(keys.privateKey, certificate, payload);
  assert.equal(verify('sha256', payload, nativeKeys.publicKey, Buffer.from(signature, 'base64')), true);
  const csr = expo.convertCSRPEMToCSR(expo.convertCSRToCSRPEM(expo.generateCSR(keys, 'test development request')));
  assert.equal(csr.verify(), true);
  const dev = expo.generateDevelopmentCertificateFromCSR(keys.privateKey, certificate, csr, 'test-project', 'test-scope');
  assert.equal(certificate.verify(dev), true);
});

test('Expo rejects certificates and CSRs with malformed nested signature encodings', () => {
  const expo = require('@expo/code-signing-certificates');
  const forge = require('node-forge');
  const a = forge.asn1;
  const seq = children => a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, children);
  const keys = expo.convertKeyPairPEMToKeyPair({privateKeyPEM: privatePem.toString(), publicKeyPEM: publicPem.toString()});
  const malformedSignature = digest => keys.privateKey.sign(a.toDer(seq([
    seq([
      a.create(a.Class.UNIVERSAL, a.Type.OID, false, a.oidToDer(forge.oids.sha256).getBytes()),
      a.create(a.Class.UNIVERSAL, a.Type.NULL, false, ''),
      a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, 'unconsumed bytes'),
    ]),
    a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, digest),
  ])).getBytes(), 'NONE');
  const generated = expo.generateSelfSignedCodeSigningCertificate({keyPair: keys,
    validityNotBefore: new Date(Date.now() - 60000), validityNotAfter: new Date(Date.now() + 86400000), commonName: 'test only'});
  const certificate = expo.convertCertificatePEMToCertificate(expo.convertCertificateToCertificatePEM(generated));
  certificate.signature = malformedSignature(certificate.md.digest().getBytes());
  assert.throws(() => expo.validateSelfSignedCertificate(certificate, keys), /DigestInfo/);
  const csr = expo.convertCSRPEMToCSR(expo.convertCSRToCSRPEM(expo.generateCSR(keys, 'test only')));
  csr.signature = malformedSignature(csr.md.digest().getBytes());
  assert.throws(() => expo.generateDevelopmentCertificateFromCSR(keys.privateKey, generated, csr, 'test-project', 'test-scope'), /DigestInfo/);
});
