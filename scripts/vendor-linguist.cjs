// Vendors linguist-js and its production dependency closure into
// dist/node_modules.
//
// Why not bundle it with ncc like everything else: linguist-js loads its data
// files (ext/languages.yml, vendor.yml, heuristics.yml, ...) at runtime via
// paths derived from import.meta.url, which do not survive webpack/ncc
// bundling (the resolved path escapes the bundle directory). The package is
// therefore kept external (`ncc build -e linguist-js`) and node resolves it
// from dist/node_modules when the action runs — with its ext/ data intact, so
// detection stays fully offline.
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'dist', 'node_modules');

/** Resolve a package directory the way node does: nearest node_modules, walking up. */
function findPkgDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Collect the production dependency closure of linguist-js (name -> source dir). */
function collectClosure() {
  const rootPkgDir = findPkgDir('linguist-js', repoRoot);
  if (!rootPkgDir) throw new Error('linguist-js is not installed — run npm install first');
  const closure = new Map(); // name -> source dir
  const queue = [rootPkgDir];
  const visited = new Set();
  while (queue.length) {
    const pkgDir = queue.shift();
    if (visited.has(pkgDir)) continue;
    visited.add(pkgDir);
    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const existing = closure.get(pkgJson.name);
    if (existing && existing !== pkgDir) {
      throw new Error(`Conflicting versions of ${pkgJson.name} in the linguist-js closure: ${existing} vs ${pkgDir}`);
    }
    closure.set(pkgJson.name, pkgDir);
    for (const dep of Object.keys(pkgJson.dependencies || {})) {
      const depDir = findPkgDir(dep, pkgDir);
      if (!depDir) throw new Error(`Cannot resolve ${dep} (dependency of ${pkgJson.name})`);
      queue.push(depDir);
    }
  }
  return closure;
}

const closure = collectClosure();
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const copiedRoots = [];
for (const [name, srcDir] of closure) {
  // Packages nested inside an already-copied package (e.g. linguist-js's own
  // node_modules/binary-extensions) travel with their parent copy.
  if (copiedRoots.some(root => srcDir.startsWith(root + path.sep))) continue;
  fs.cpSync(srcDir, path.join(outDir, name), { recursive: true });
  copiedRoots.push(srcDir);
}
console.log(`Vendored into dist/node_modules: ${[...closure.keys()].join(', ')}`);
