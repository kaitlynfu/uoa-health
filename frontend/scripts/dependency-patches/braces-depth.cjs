'use strict';

// Iterative preflight: do not let callers bypass the parser limit with an AST.
// Parent/prev references are deliberately not traversed (they normally cycle).
module.exports = function assertBoundedAst(ast) {
  const pending = [{node: ast, depth: 0, leaving: false}];
  const ancestors = new WeakSet();
  let visited = 0;
  while (pending.length) {
    const {node, depth, leaving} = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (leaving) {
      ancestors.delete(node);
      continue;
    }
    if (++visited > 100000) throw new RangeError('Brace AST exceeds node limit');
    if (ancestors.has(node)) throw new RangeError('Brace AST contains a child cycle');
    if (!Array.isArray(node.nodes)) continue;
    if (depth > 100) throw new RangeError('Brace nesting exceeds maximum depth (100)');
    ancestors.add(node);
    pending.push({node, depth, leaving: true});
    for (let i = node.nodes.length - 1; i >= 0; i--) {
      pending.push({node: node.nodes[i], depth: depth + 1, leaving: false});
    }
  }
};
