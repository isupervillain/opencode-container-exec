import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the plugin
import { ContainerExecPlugin } from '../../plugin/index.js';
import { getState, setState } from '../../plugin/internal.js';

// Test directory for isolated tests
const TEST_DIR = join(__dirname, '..', 'test-plugin');
const TEST_STATE_FILE = join(TEST_DIR, 'container-mode.json');

describe('ContainerExecPlugin', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(TEST_STATE_FILE)) {
        unlinkSync(TEST_STATE_FILE);
      }
      if (existsSync(join(TEST_DIR, 'container-mode.json.tmp'))) {
        unlinkSync(join(TEST_DIR, 'container-mode.json.tmp'));
      }
      if (existsSync(TEST_DIR)) {
        rmdirSync(TEST_DIR);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Plugin Structure', () => {
    it('should export ContainerExecPlugin function', () => {
      assert.strictEqual(typeof ContainerExecPlugin, 'function');
    });
    
    it('should return object with tool property', async () => {
      // Mock dependencies
      const mockContext = {
        project: {},
        client: {},
        $: () => ({ text: () => Promise.resolve('') }),
        directory: '/test',
        worktree: {}
      };
      
      const plugin = await ContainerExecPlugin(mockContext);
      assert.ok(plugin.tool);
      assert.ok(plugin.tool.bash);
      assert.ok(plugin.tool.container);
    });
    
    it('should have bash tool with execute method', async () => {
      const mockContext = {
        project: {},
        client: {},
        $: () => ({ text: () => Promise.resolve('') }),
        directory: '/test',
        worktree: {}
      };
      
      const plugin = await ContainerExecPlugin(mockContext);
      assert.strictEqual(typeof plugin.tool.bash.execute, 'function');
    });
    
    it('should have container tool with execute method', async () => {
      const mockContext = {
        project: {},
        client: {},
        $: () => ({ text: () => Promise.resolve('') }),
        directory: '/test',
        worktree: {}
      };
      
      const plugin = await ContainerExecPlugin(mockContext);
      assert.strictEqual(typeof plugin.tool.container.execute, 'function');
    });

    it('runtime entry should only export plugin functions', async () => {
      const runtimeEntry = await import('../../plugin/index.js');

      assert.deepStrictEqual(
        Object.keys(runtimeEntry).sort(),
        ['ContainerExecPlugin', 'default']
      );

      const helperExports = [
        'getState',
        'setState',
        'validateContainerId',
        'validateContainerName',
        'validateCommand',
        'validateSelection',
        'validateWindowsPath',
        'findContainer',
        'getWindowsPath',
        'getContainerInfo',
        'listContainers',
        'isContainerHealthy',
        'checkDependencies',
        'runCommand'
      ];

      for (const helperName of helperExports) {
        assert.ok(!(helperName in runtimeEntry), `${helperName} should not be exported from runtime entry`);
      }
    });

    it('default export should be the same plugin function', async () => {
      const runtimeEntry = await import('../../plugin/index.js');
      assert.strictEqual(typeof runtimeEntry.default, 'function');
      assert.strictEqual(runtimeEntry.default, runtimeEntry.ContainerExecPlugin);
    });
  });

  describe('Exported Functions', () => {
    it('should export getState function', () => {
      assert.strictEqual(typeof getState, 'function');
    });
    
    it('should export setState function', () => {
      assert.strictEqual(typeof setState, 'function');
    });
    
    it('should export validation functions', async () => {
      const { 
        validateContainerId,
        validateContainerName,
        validateCommand,
        validateSelection,
        validateWindowsPath
      } = await import('../../plugin/internal.js');
      
      assert.strictEqual(typeof validateContainerId, 'function');
      assert.strictEqual(typeof validateContainerName, 'function');
      assert.strictEqual(typeof validateCommand, 'function');
      assert.strictEqual(typeof validateSelection, 'function');
      assert.strictEqual(typeof validateWindowsPath, 'function');
    });
    
    it('should export container utility functions', async () => {
      const {
        findContainer,
        getWindowsPath,
        getContainerInfo,
        listContainers,
        isContainerHealthy,
        checkDependencies,
        runCommand
      } = await import('../../plugin/internal.js');
      
      assert.strictEqual(typeof findContainer, 'function');
      assert.strictEqual(typeof getWindowsPath, 'function');
      assert.strictEqual(typeof getContainerInfo, 'function');
      assert.strictEqual(typeof listContainers, 'function');
      assert.strictEqual(typeof isContainerHealthy, 'function');
      assert.strictEqual(typeof checkDependencies, 'function');
      assert.strictEqual(typeof runCommand, 'function');
    });
  });

  describe('Command Validation', () => {
    it('should validate command input', async () => {
      const { validateCommand } = await import('../../plugin/internal.js');
      
      assert.ok(validateCommand('echo "test"'));
      assert.ok(validateCommand('ls -la'));
      assert.ok(validateCommand('pwd'));
      
      assert.ok(!validateCommand('a'.repeat(10001))); // Too long
      assert.ok(!validateCommand(123)); // Not a string
      assert.ok(!validateCommand(null));
      assert.ok(!validateCommand(undefined));
    });
  });

  describe('Container action dependency gating', () => {
    it('should allow off action when dependencies are missing', async () => {
      const originalPath = process.env.PATH;
      try {
        process.env.PATH = '';

        const mockContext = {
          project: {},
          client: {},
          $: () => ({ text: () => Promise.resolve('') }),
          directory: '/test',
          worktree: {}
        };

        const plugin = await ContainerExecPlugin(mockContext);
        const result = await plugin.tool.container.execute({ action: 'off' });
        assert.ok(result.includes('Devcontainer mode OFF'));
      } finally {
        process.env.PATH = originalPath;
      }
    });

    it('should block on action when dependencies are missing', async () => {
      const originalPath = process.env.PATH;
      try {
        process.env.PATH = '';

        const mockContext = {
          project: {},
          client: {},
          $: () => ({ text: () => Promise.resolve('') }),
          directory: '/test',
          worktree: {}
        };

        const plugin = await ContainerExecPlugin(mockContext);
        const result = await plugin.tool.container.execute({ action: 'on' });
        assert.ok(result.includes('Missing required dependencies'));
      } finally {
        process.env.PATH = originalPath;
      }
    });
  });

  // Note: Testing the actual bash and container tool execution would require
  // mocking the $ template tag and other dependencies. This would be better
  // suited for integration tests or with a proper mocking framework.
});
