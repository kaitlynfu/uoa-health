// Temporary, reproducible backports. No package version or audit result is hidden.
// node-forge: exact validation change from upstream PR 1152, commit
// ceba34402e329f0365134f23fe19898756527d65 (still unmerged on 10 October 2026).
// braces: depth cap recommended in upstream issue 70, extended to parentheses
// and externally supplied ASTs so recursive walkers cannot bypass it.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, realpathSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve, relative, isAbsolute} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const normalize = text => text.replace(/\r\n/g, '\n');
const digest = text => createHash('sha256').update(normalize(text)).digest('hex');
const checking = process.argv.includes('--check');
const limit = "      if (stack.length > 100) {\n        throw new RangeError('Brace nesting exceeds maximum depth (100)');\n      }\n";
const specs = {
  'node-forge': {
    version: '1.4.0',
    files: [{
      path: 'lib/rsa.js',
      hash: 'fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50',
      changes: [{
        before: '          // validate DigestInfo structure and element count\n',
        after: '          // validate DigestInfo structure and element counts (outer DigestInfo\n' +
          '          // and nested DigestAlgorithm). asn1.validate ignores extra children,\n' +
          '          // so length must be checked explicitly at each nesting level to\n' +
          '          // prevent low-exponent PKCS#1 v1.5 signature forgery (CVE-2026-85393).\n',
      }, {
        before: '            obj.value.length !== 2) {',
        after: '            obj.value.length !== 2 ||\n' +
          '            obj.value[0].value.length !==\n' +
          "              (('parameters' in capture) ? 2 : 1)) {",
      }],
    }],
  },
  braces: {
    version: '3.0.3',
    files: [{
      path: 'lib/parse.js',
      hash: 'e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310',
      changes: [{
        before: "    if (value === CHAR_LEFT_PARENTHESES) {\n",
        after: "    if (value === CHAR_LEFT_PARENTHESES) {\n" + limit,
      }, {
        before: "    if (value === CHAR_LEFT_CURLY_BRACE) {\n",
        after: "    if (value === CHAR_LEFT_CURLY_BRACE) {\n" + limit,
      }],
    }, ...[
      ['compile', 'dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f'],
      ['expand', '41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7'],
      ['stringify', '379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a'],
    ].map(([name, hash]) => ({
      path: `lib/${name}.js`, hash,
      changes: [{
        before: "'use strict';\n",
        after: "'use strict';\n\nconst assertBoundedAst = require('./team43-depth');\n",
      }, {
        before: name === 'stringify' ? 'module.exports = (ast, options = {}) => {\n' : `const ${name} = (ast, options = {}) => {\n`,
        after: (name === 'stringify' ? 'module.exports = (ast, options = {}) => {\n' : `const ${name} = (ast, options = {}) => {\n`) + '  assertBoundedAst(ast);\n',
      }],
    }))],
  },
};

function replaceOnce(text, before, after, label) {
  if (text.split(before).length !== 2) throw new Error(`Unexpected patch context: ${label}`);
  return text.replace(before, after);
}

// Exported for tests; only exact originals or exact complete backports accepted.
export function preparePatch(text, spec, checkOnly = false) {
  text = normalize(text);
  if (digest(text) === spec.hash) {
    if (checkOnly) throw new Error(`Security backport missing: ${spec.path}. Run npm ci with scripts enabled.`);
    return spec.changes.reduce((value, change) => replaceOnce(value, change.before, change.after, spec.path), text);
  }
  const original = [...spec.changes].reverse().reduce((value, change) => replaceOnce(value, change.after, change.before, spec.path), text);
  if (digest(original) !== spec.hash) throw new Error(`Dependency checksum mismatch: ${spec.path}`);
  return text;
}

export function hardenDependencies(checkOnly = checking) {
  const modules = realpathSync(resolve(root, 'node_modules'));
  const relativeModules = relative(root, modules);
  if (isAbsolute(relativeModules) || relativeModules.startsWith('..')) throw new Error('Refusing to modify node_modules outside this frontend checkout');
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const plans = [];
  const found = new Set();
  for (const [location, entry] of Object.entries(lock.packages)) {
    const match = location.match(/^node_modules\/(?:.*\/node_modules\/)?(node-forge|braces)$/);
    if (!match) continue;
    const name = match[1];
    const spec = specs[name];
    if (entry.version !== spec.version) throw new Error(`Review security backport before updating ${name} ${entry.version}`);
    const packageRoot = realpathSync(resolve(root, location));
    const inside = relative(modules, packageRoot);
    if (isAbsolute(inside) || inside.startsWith('..')) throw new Error(`Dependency outside node_modules: ${location}`);
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
    if (pkg.name !== name || pkg.version !== spec.version) throw new Error(`Installed dependency differs from lockfile: ${location}`);
    found.add(name);
    for (const file of spec.files) {
      const target = realpathSync(resolve(packageRoot, file.path));
      const within = relative(packageRoot, target);
      if (isAbsolute(within) || within.startsWith('..')) throw new Error(`Unsafe patch target: ${target}`);
      const text = readFileSync(target, 'utf8');
      const patched = preparePatch(text, file, checkOnly);
      if (normalize(text) !== patched) plans.push([target, patched]);
    }
    if (name === 'braces') {
      const helper = normalize(readFileSync(resolve(root, 'scripts/dependency-patches/braces-depth.cjs'), 'utf8'));
      const target = resolve(packageRoot, 'lib/team43-depth.js');
      if (existsSync(target)) {
        if (realpathSync(target) !== target || normalize(readFileSync(target, 'utf8')) !== helper) throw new Error('Brace depth helper differs from reviewed source');
      } else if (checkOnly) {
        throw new Error('Brace depth helper missing. Run npm ci with scripts enabled.');
      } else {
        plans.push([target, helper]);
      }
    }
  }
  if (found.size !== Object.keys(specs).length) throw new Error('Security backport targets changed; review dependency graph');
  // Validate every target before modifying any file. There is no network access.
  for (const [target, text] of plans) writeFileSync(target, text);
  console.log(checkOnly ? 'Dependency security backports verified.' : `Dependency security backports applied (${plans.length} files changed).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) hardenDependencies();
