# Temporary dependency security backports — 10 October 2026

The frontend installs targeted fixes for the two currently unpatched upstream
advisories. This is a local mitigation, **not a maintainer-published release**.
Keep the original package versions and audit warnings; do not invent a fixed
version, suppress an advisory or claim the audit is clean.

## node-forge 1.4.0

- Advisory: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- Backport: the exact `lib/rsa.js` validation change proposed in upstream
  [PR 1152](https://github.com/digitalbazaar/forge/pull/1152), pinned to
  [ceba34402e329f0365134f23fe19898756527d65](https://github.com/digitalbazaar/forge/commit/ceba34402e329f0365134f23fe19898756527d65).
  That PR is still open and unmerged, not approved by the maintainers.
- Rejects extra children inside the nested DigestAlgorithm structure before
  comparing a PKCS#1 v1.5 signature's digest. No RSA algorithm, padding scheme,
  key generation or other cryptographic primitive was rewritten.
- Regression tests use a low-exponent RSA key and malformed encodings with and
  without NULL parameters. Valid signatures are checked against Node's platform
  crypto. Expo certificate/CSR generation, validation and manifest signing are
  also tested, including rejection of malformed certificate/CSR signatures.

## braces 3.0.3

- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Follows the depth-limit workaround recommended in upstream
  [issue 70](https://github.com/micromatch/braces/issues/70).
- Caps actual parser container nesting at 100, including parentheses and mixed
  containers. Escaped, quoted and bracket-literal braces remain literals.
- An iterative preflight caps container depth for caller-supplied ASTs before
  compile/expand/stringify recursion, rejects child cycles and limits traversal
  to 100,000 nodes. Normal parent/prev references are not traversed.
- Tests exercise 4,000-level inputs, direct AST bypasses, the depth boundary,
  ordinary brace/range expansion, escapes and Metro's glob consumer.

## Installation and release gate

`frontend/scripts/harden-dependencies.mjs` runs automatically in `postinstall`.
It validates package versions and SHA-256 checksums of the original files,
patches every matching lockfile-installed copy and accepts an already-patched
file only if reversing the exact patch restores the pinned checksum. Every
target is validated before any write. It makes no network requests and refuses
targets outside this checkout's node_modules. It does not patch other worktrees.

From `frontend`, run `npm ci`, then `npm run test:dependencies`. The latter checks
that the backports are actually present before running the regression suite.
Both PR checks and mobile publication run this gate; an install with lifecycle
scripts disabled fails verification rather than silently publishing unpatched
tooling. No new dependency or native module is introduced.

Changing either package version/content intentionally stops installation until
the backport is reviewed. When a maintainer release fixes the advisory, replace
the backport with that compatible release, update the install/check script and
retain the regression tests. Do not leave stale patches or bypass the gate.

## Limits

These safeguards address the two specified failure modes; they are not an
independent cryptographic audit or a guarantee against unrelated vulnerabilities.
The npm audit database still flags the original versions (17 propagated high
entries, zero critical on 9 October); source patching does not change that
database. Build inputs should still be trusted and Metro should not be exposed
to untrusted networks. This work does not deploy a backend, publish an OTA update,
merge a branch or validate a native iPhone build.

## Verification record

10 October: a clean online `npm ci` applied all six file changes automatically.
All 11 dependency security/compatibility tests, 79 existing frontend checks and
TypeScript passed. The disposable two-account social integration test and
iOS/Android/web JavaScript exports also passed. The install still reported
17 high audit entries, consistent with the original-version caveat above.
