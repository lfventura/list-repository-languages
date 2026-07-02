import * as process from 'process';
import * as cp from 'child_process';
import * as path from 'path';
import { test } from '@jest/globals';

// Live-environment integration smoke test: it execs the compiled action, which
// makes a real authenticated GitHub /languages API call — it can't run headless
// (needs a valid token, network, and a real owner/repo). The action's logic is
// covered deterministically by mapping.test.ts (octokit + core mocked).
test.skip('test run', () => {
  process.env['INPUT_GITHUB_TOKEN'] = process.env.GITHUB_TOKEN;
  const np = process.execPath;
  const ip = path.join(__dirname, '..', 'dist', 'index.js');
  const options: cp.ExecFileSyncOptions = {
    env: process.env,
  };
  console.log(cp.execFileSync(np, [ip], options).toString());
});
