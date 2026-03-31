import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { installCommands } from '../../plugin/internal.js';

const TEST_ROOT = '/tmp/opencode-container-exec-test';
const CONFIG_DIR = join(TEST_ROOT, 'home', '.config', 'opencode');

describe('Command auto-install', () => {
  it('installs command file into commands and command directories', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(CONFIG_DIR, { recursive: true });

    const originalHome = process.env.HOME;
    process.env.HOME = join(TEST_ROOT, 'home');

    const client = {
      path: {
        get: async () => ({ data: { config: CONFIG_DIR } })
      }
    };

    await installCommands(client);

    assert.ok(existsSync(join(CONFIG_DIR, 'commands', 'container.md')));
    assert.ok(existsSync(join(CONFIG_DIR, 'command', 'container.md')));

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it('does not overwrite existing command file', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(join(CONFIG_DIR, 'commands'), { recursive: true });

    const existingPath = join(CONFIG_DIR, 'commands', 'container.md');
    writeFileSync(existingPath, 'custom-content', 'utf8');

    const originalHome = process.env.HOME;
    process.env.HOME = join(TEST_ROOT, 'home');

    const client = {
      path: {
        get: async () => ({ data: { config: CONFIG_DIR } })
      }
    };

    await installCommands(client);

    const content = readFileSync(existingPath, 'utf8');
    assert.equal(content, 'custom-content');

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it('refuses to install outside ~/.config/opencode boundary', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    const outsideDir = join(TEST_ROOT, 'outside-config');
    mkdirSync(outsideDir, { recursive: true });

    const originalHome = process.env.HOME;
    process.env.HOME = join(TEST_ROOT, 'home');

    const client = {
      path: {
        get: async () => ({ data: { config: outsideDir } })
      }
    };

    await installCommands(client);

    assert.equal(existsSync(join(outsideDir, 'commands', 'container.md')), false);
    assert.equal(existsSync(join(outsideDir, 'command', 'container.md')), false);

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });
});
