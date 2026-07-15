// Child-process entry used by linguist.integration.test.ts.
//
// linguist-js is an ESM-only package: jest's CommonJS runtime cannot
// require() it, so the integration tests exercise the REAL detection code by
// spawning plain node (which supports require/import of ESM) with ts-node.
import { detectLocalLanguages } from '../../src/linguist';

detectLocalLanguages(process.argv[2])
  .then(result => {
    process.stdout.write(JSON.stringify(result));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
