// Child-process entry used by linguist.integration.test.ts.
//
// linguist-js is an ESM-only package: jest's CommonJS runtime cannot
// require() it, so the integration tests exercise the REAL detection code by
// spawning plain node (which supports require/import of ESM) with ts-node.
//
// argv[2] = directory to analyse
// argv[3] = optional JSON array of gitignore-style exclude patterns
//           (the linguist_exclude_folders input, already parsed)
import { detectLocalLanguages } from '../../src/linguist';

const excludePatterns: string[] = process.argv[3] ? JSON.parse(process.argv[3]) : [];

detectLocalLanguages(process.argv[2], excludePatterns)
  .then(result => {
    process.stdout.write(JSON.stringify(result));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
