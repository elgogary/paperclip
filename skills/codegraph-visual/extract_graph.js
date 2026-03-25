#!/usr/bin/env node
/**
 * Extract combined code graph from Codegraph SQLite DB.
 *
 * Usage:
 *   NODE_PATH=~/.npm-global/lib/node_modules/@colbymchenry/codegraph/node_modules \
 *     node extract_graph.js <path-to-codegraph.db> [--app-root <name>] [--exclude <pattern>]
 *
 * Options:
 *   --app-root <name>   Root directory name to strip from module paths (e.g. "accubuild_core")
 *   --exclude <pattern> Glob pattern to exclude (repeatable, default: .tmp/%, .bk/%)
 *
 * Output: JSON to stdout with { nodes, links, stats }
 */

const Database = require('better-sqlite3');

// Parse args
const args = process.argv.slice(2);
const dbPath = args.find(a => !a.startsWith('--'));
if (!dbPath) { console.error('Usage: extract_graph.js <codegraph.db> [--app-root <name>]'); process.exit(1); }

let appRoot = null;
let moduleDepth = 1; // how deep into directory tree to derive module name
const excludePatterns = ['.tmp/%', '.bk/%'];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--app-root' && args[i + 1]) appRoot = args[++i];
  if (args[i] === '--exclude' && args[i + 1]) excludePatterns.push(args[++i]);
  if (args[i] === '--depth' && args[i + 1]) moduleDepth = parseInt(args[++i], 10);
}

const db = new Database(dbPath, { readonly: true });

// Build exclude WHERE clause with parameterized queries
const excludeWhere = excludePatterns.map(() => `file_path NOT LIKE ?`).join(' AND ');

const allNodes = db.prepare(`SELECT id, kind, name, file_path, language, start_line, end_line, signature, docstring FROM nodes WHERE ${excludeWhere}`).all(...excludePatterns);
const allEdges = db.prepare('SELECT source, target, kind FROM edges').all();

// Build lookup maps for O(1) access
const nodeById = new Map(allNodes.map(n => [n.id, n]));

// ── Module resolver ────────────────────────────────────────────────────
function getModule(filePath) {
  const parts = filePath.split('/');
  let start = 0;
  if (appRoot && parts[0] === appRoot) start = 1;
  // For depth=2, use parts[start] + '/' + parts[start+1] as module name
  // e.g. lipton_erp/datalake_utils instead of just lipton_erp
  const modParts = parts.slice(start, start + moduleDepth);
  if (modParts.length === 0) return 'root';
  return modParts.join('/');
}

// ── Group nodes by module ──────────────────────────────────────────────
const nodeModuleMap = {};
const moduleMap = {};

allNodes.forEach(n => {
  const mod = getModule(n.file_path);
  nodeModuleMap[n.id] = mod;
  if (!moduleMap[mod]) moduleMap[mod] = { classes: [], functions: [], methods: [], files: [], imports: [] };
  const bucket = { class: 'classes', function: 'functions', method: 'methods', file: 'files', import: 'imports' }[n.kind];
  if (bucket) moduleMap[mod][bucket].push(n);
});

// ── Build graph nodes ──────────────────────────────────────────────────
const graphNodes = [];
const nodeIdSet = new Set();

// Module nodes
Object.keys(moduleMap).forEach(m => {
  const info = moduleMap[m];
  const id = 'mod:' + m;
  graphNodes.push({
    id, name: m, kind: 'module', fullName: m,
    size: info.files.length,
    classes: info.classes.length,
    functions: info.functions.length + info.methods.length,
    imports: info.imports.length,
    topClasses: info.classes.slice(0, 8).map(c => c.name),
    topFunctions: info.functions.slice(0, 5).map(f => f.name),
  });
  nodeIdSet.add(id);
});

// Class nodes (L2)
Object.keys(moduleMap).forEach(m => {
  moduleMap[m].classes.forEach(c => {
    graphNodes.push({
      id: c.id, name: c.name, kind: 'class', module: m, level: 2,
      size: Math.max(5, c.end_line - c.start_line),
      file: c.file_path, signature: c.signature || '',
    });
    nodeIdSet.add(c.id);
  });
});

// Function + method nodes (L3)
Object.keys(moduleMap).forEach(m => {
  const allFns = [...moduleMap[m].functions, ...moduleMap[m].methods];
  allFns.forEach(f => {
    graphNodes.push({
      id: f.id, name: f.name, kind: f.kind, module: m, level: 3,
      size: Math.max(2, (f.end_line || 0) - (f.start_line || 0)),
      file: f.file_path, signature: f.signature || '',
    });
    nodeIdSet.add(f.id);
  });
});

// ── Build links ────────────────────────────────────────────────────────
const graphLinks = [];

// Contains links (module → class, L2)
Object.keys(moduleMap).forEach(m => {
  moduleMap[m].classes.forEach(c => {
    graphLinks.push({ source: 'mod:' + m, target: c.id, type: 'contains', level: 2 });
  });
});

// Contains links (class → method, module → function, L3)
allEdges.filter(e => e.kind === 'contains').forEach(e => {
  if (nodeIdSet.has(e.source) && nodeIdSet.has(e.target)) {
    // Only add if not already covered by module→class
    const srcNode = nodeById.get(e.source);
    const tgtNode = nodeById.get(e.target);
    if (srcNode && tgtNode && (tgtNode.kind === 'function' || tgtNode.kind === 'method')) {
      graphLinks.push({ source: e.source, target: e.target, type: 'contains', level: 3 });
    }
  }
});

// Build child-to-class mapping (needed for fn_call filtering and class-ref edges)
const childToClass = {};
const classIdSet = new Set();
allNodes.forEach(n => { if (n.kind === 'class') classIdSet.add(n.id); });
allEdges.forEach(e => { if (classIdSet.has(e.source)) childToClass[e.target] = e.source; });

// Function call edges (L3) — direct function-to-function calls
const fnCallEdges = {};
allEdges.filter(e => e.kind === 'calls').forEach(e => {
  if (nodeIdSet.has(e.source) && nodeIdSet.has(e.target)) {
    const srcMod = nodeModuleMap[e.source];
    const tgtMod = nodeModuleMap[e.target];
    // Only cross-module or cross-class calls (skip internal)
    if (srcMod !== tgtMod || childToClass[e.source] !== childToClass[e.target]) {
      const key = e.source + '|' + e.target;
      fnCallEdges[key] = (fnCallEdges[key] || 0) + 1;
    }
  }
});

Object.entries(fnCallEdges).forEach(([key, weight]) => {
  const [src, tgt] = key.split('|');
  graphLinks.push({ source: src, target: tgt, type: 'fn_call', weight, level: 3 });
});

// Cross-module edges from Codegraph index (Layer 1)
const crossModule = {};
allEdges.forEach(e => {
  const sm = nodeModuleMap[e.source], tm = nodeModuleMap[e.target];
  if (sm && tm && sm !== tm) {
    const key = sm + '|' + tm;
    if (!crossModule[key]) crossModule[key] = { weight: 0, kinds: {}, examples: [] };
    crossModule[key].weight++;
    crossModule[key].kinds[e.kind] = (crossModule[key].kinds[e.kind] || 0) + 1;
    if (crossModule[key].examples.length < 3) {
      const srcNode = nodeById.get(e.source);
      const tgtNode = nodeById.get(e.target);
      if (srcNode && tgtNode) crossModule[key].examples.push(srcNode.name + ' → ' + tgtNode.name);
    }
  }
});

Object.entries(crossModule).forEach(([key, data]) => {
  const [src, tgt] = key.split('|');
  if (nodeIdSet.has('mod:' + src) && nodeIdSet.has('mod:' + tgt)) {
    const kindStr = Object.entries(data.kinds).map(([k, v]) => k + ':' + v).join(', ');
    graphLinks.push({
      source: 'mod:' + src, target: 'mod:' + tgt,
      type: 'depends', weight: data.weight,
      layers: ['codegraph'],
      description: 'Index: ' + kindStr + (data.examples.length ? ' (e.g. ' + data.examples.join(', ') + ')' : ''),
    });
  }
});

// Class-to-class edges via method chain tracing
const classToClass = {};
allEdges.filter(e => e.kind === 'calls').forEach(e => {
  const classA = childToClass[e.source];
  const classB = childToClass[e.target];
  if (classA && classB && classA !== classB && nodeIdSet.has(classA) && nodeIdSet.has(classB)) {
    const key = classA + '|' + classB;
    classToClass[key] = (classToClass[key] || 0) + 1;
  }
});

Object.entries(classToClass).forEach(([key, weight]) => {
  const [src, tgt] = key.split('|');
  graphLinks.push({ source: src, target: tgt, type: 'class_ref', weight });
});

// ── Stats ──────────────────────────────────────────────────────────────
const stats = {
  totalFiles: allNodes.filter(n => n.kind === 'file').length,
  totalClasses: allNodes.filter(n => n.kind === 'class').length,
  totalFunctions: allNodes.filter(n => n.kind === 'function').length + allNodes.filter(n => n.kind === 'method').length,
  totalEdgesInDB: allEdges.length,
  crossModuleEdges: Object.keys(crossModule).length,
  classRefEdges: Object.keys(classToClass).length,
  layers: { codegraph: Object.keys(crossModule).length, class_ref: Object.keys(classToClass).length, hooks: 0, doctype_link: 0, js_call: 0 },
  modules: Object.keys(moduleMap).map(m => ({
    name: m, files: moduleMap[m].files.length,
    classes: moduleMap[m].classes.length,
    functions: moduleMap[m].functions.length + moduleMap[m].methods.length,
  })).filter(m => m.files > 0).sort((a, b) => b.files - a.files),
};

console.log(JSON.stringify({ nodes: graphNodes, links: graphLinks, stats }, null, 2));
db.close();