import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync, symlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT = join(__dirname, '..', '..', 'scripts', 'toggle.sh');

function which(cmd) {
  const out = spawnSync('/bin/bash', ['-lc', `command -v ${cmd}`], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`Required command not found: ${cmd}`);
  return out.stdout.trim();
}

function makeMinimalPathBin(root) {
  const bin = join(root, 'bin');
  rmSync(bin, { recursive: true, force: true });
  mkdirSync(bin, { recursive: true });

  const required = ['mkdir', 'chmod', 'mv', 'pwd', 'cat', 'mktemp'];
  for (const cmd of required) {
    symlinkSync(which(cmd), join(bin, cmd));
  }
  return bin;
}

describe('toggle.sh action gating', () => {
  it('off works without docker/devcontainer/jq in PATH', () => {
    const home = mkdtempSync(join(tmpdir(), 'ocex-home-'));
    const fakeBin = makeMinimalPathBin(home);
    const result = spawnSync('/bin/bash', [SCRIPT, 'off'], {
      env: { ...process.env, HOME: home, PATH: fakeBin },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(result.stdout.includes('Devcontainer mode OFF'));

    const stateFile = join(home, '.config', 'opencode', 'container-mode.json');
    assert.ok(existsSync(stateFile));
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    assert.equal(state.enabled, false);

    rmSync(home, { recursive: true, force: true });
  });

  it('list fails when docker is missing', () => {
    const home = mkdtempSync(join(tmpdir(), 'ocex-home-'));
    const fakeBin = makeMinimalPathBin(home);
    const result = spawnSync('/bin/bash', [SCRIPT, 'list'], {
      env: { ...process.env, HOME: home, PATH: fakeBin },
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0);
    assert.ok((result.stdout + result.stderr).includes('Missing required dependencies'));

    rmSync(home, { recursive: true, force: true });
  });

  it('rejects invalid action', () => {
    const home = mkdtempSync(join(tmpdir(), 'ocex-home-'));
    const fakeBin = makeMinimalPathBin(home);
    const result = spawnSync('/bin/bash', [SCRIPT, 'bad-action'], {
      env: { ...process.env, HOME: home, PATH: fakeBin },
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0);
    assert.ok((result.stdout + result.stderr).includes('Invalid action'));

    rmSync(home, { recursive: true, force: true });
  });
});
