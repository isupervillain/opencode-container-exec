import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync, statSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the module we're testing
import { getState, setState } from '../../plugin/internal.js';

// Test directory for isolated tests
const TEST_DIR = join(__dirname, '..', 'test-state');
const TEST_STATE_FILE = join(TEST_DIR, 'container-mode.json');
const ORIGINAL_CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR;
const ORIGINAL_STATE_FILE = process.env.OPENCODE_CONTAINER_STATE_FILE;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('State Management', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    process.env.OPENCODE_CONFIG_DIR = TEST_DIR;
    delete process.env.OPENCODE_CONTAINER_STATE_FILE;
    process.env.NODE_ENV = 'test';
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

    if (ORIGINAL_CONFIG_DIR === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = ORIGINAL_CONFIG_DIR;
    }

    if (ORIGINAL_STATE_FILE === undefined) {
      delete process.env.OPENCODE_CONTAINER_STATE_FILE;
    } else {
      process.env.OPENCODE_CONTAINER_STATE_FILE = ORIGINAL_STATE_FILE;
    }

    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  describe('getState()', () => {
    it('should return default state when file does not exist', () => {
      // Ensure file doesn't exist
      if (existsSync(TEST_STATE_FILE)) {
        unlinkSync(TEST_STATE_FILE);
      }
      
      const state = getState();
      assert.deepEqual(state, {
        enabled: false,
        containerId: null,
        containerName: null,
        containerImage: null,
        directory: null
      });
    });

    it('should return saved state when file exists', () => {
      const savedState = {
        enabled: true,
        containerId: 'abc123def456',
        containerName: 'test',
        containerImage: 'test:latest',
        directory: '/test'
      };
      
      writeFileSync(TEST_STATE_FILE, JSON.stringify(savedState));
      chmodSync(TEST_STATE_FILE, 0o600);
      const state = getState();
      assert.deepEqual(state, savedState);
    });

    it('should handle corrupted JSON gracefully', () => {
      writeFileSync(TEST_STATE_FILE, '{invalid json}');
      chmodSync(TEST_STATE_FILE, 0o600);
      
      // Should return default state
      const state = getState();
      assert.deepEqual(state, {
        enabled: false,
        containerId: null,
        containerName: null,
        containerImage: null,
        directory: null
      });
    });

    it('should handle missing required fields', () => {
      const partialState = {
        enabled: true,
        containerId: 'abc123'
        // Missing other fields
      };
      
      writeFileSync(TEST_STATE_FILE, JSON.stringify(partialState));
      chmodSync(TEST_STATE_FILE, 0o600);
      const state = getState();
      
      // Should have all required fields
      assert.ok(state.hasOwnProperty('enabled'));
      assert.ok(state.hasOwnProperty('containerId'));
      assert.ok(state.hasOwnProperty('containerName'));
      assert.ok(state.hasOwnProperty('containerImage'));
      assert.ok(state.hasOwnProperty('directory'));
    });
    
    it('should validate container ID in state', () => {
      const invalidState = {
        enabled: true,
        containerId: 'invalid-id', // Not a hex string
        containerName: 'test',
        containerImage: 'test:latest',
        directory: '/test'
      };
      
      writeFileSync(TEST_STATE_FILE, JSON.stringify(invalidState));
      chmodSync(TEST_STATE_FILE, 0o600);
      const state = getState();
      
      // Should reject invalid container ID
      assert.strictEqual(state.containerId, null);
    });
    
    it('should validate container name in state', () => {
      const invalidState = {
        enabled: true,
        containerId: 'abc123def456',
        containerName: 'invalid name with spaces', // Invalid characters
        containerImage: 'test:latest',
        directory: '/test'
      };
      
      writeFileSync(TEST_STATE_FILE, JSON.stringify(invalidState));
      chmodSync(TEST_STATE_FILE, 0o600);
      const state = getState();
      
      // Should reject invalid container name
      assert.strictEqual(state.containerName, null);
    });

    it('should reject untrusted OPENCODE_CONTAINER_STATE_FILE path outside trusted config in non-test mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalHome = process.env.HOME;
      const originalStateFile = process.env.OPENCODE_CONTAINER_STATE_FILE;

      try {
        process.env.NODE_ENV = 'production';
        process.env.HOME = TEST_DIR;

        const outsideState = join(dirname(TEST_DIR), 'outside-state.json');
        writeFileSync(outsideState, JSON.stringify({ enabled: true, containerId: 'abcdefabcdef' }));
        chmodSync(outsideState, 0o600);
        process.env.OPENCODE_CONTAINER_STATE_FILE = outsideState;

        const state = getState();
        assert.deepEqual(state, {
          enabled: false,
          containerId: null,
          containerName: null,
          containerImage: null,
          directory: null
        });

        unlinkSync(outsideState);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalHome === undefined) delete process.env.HOME;
        else process.env.HOME = originalHome;
        if (originalStateFile === undefined) delete process.env.OPENCODE_CONTAINER_STATE_FILE;
        else process.env.OPENCODE_CONTAINER_STATE_FILE = originalStateFile;
      }
    });
  });

  describe('setState()', () => {
    it('should create state file with correct permissions', () => {
      const testState = {
        enabled: true,
        containerId: 'abc123def456',
        containerName: 'test',
        containerImage: 'test:latest',
        directory: '/test'
      };
      
      setState(testState);
      
      // Check file exists
      assert.ok(existsSync(TEST_STATE_FILE));
      
      // Check permissions (should be 0o600 on Unix systems)
      const stats = statSync(TEST_STATE_FILE);
      const permissions = stats.mode & 0o777;
      assert.equal(permissions, 0o600);
    });

    it('should write valid JSON', () => {
      const testState = {
        enabled: false,
        containerId: null,
        containerName: null,
        containerImage: null,
        directory: null
      };
      
      setState(testState);
      
      const content = readFileSync(TEST_STATE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      assert.deepEqual(parsed, testState);
    });

    it('should overwrite existing state', () => {
      const firstState = {
        enabled: true,
        containerId: 'abc123def456',
        containerName: 'first',
        containerImage: 'first:latest',
        directory: '/first'
      };
      
      const secondState = {
        enabled: false,
        containerId: null,
        containerName: null,
        containerImage: null,
        directory: null
      };
      
      setState(firstState);
      setState(secondState);
      
      const content = readFileSync(TEST_STATE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      assert.deepEqual(parsed, secondState);
    });

    it('should create config directory if it does not exist', () => {
      // Remove test directory
      if (existsSync(TEST_DIR)) {
        rmdirSync(TEST_DIR);
      }
      
      const testState = {
        enabled: true,
        containerId: 'abc123def456',
        containerName: 'test',
        containerImage: 'test:latest',
        directory: '/test'
      };
      
      // This should create the directory
      setState(testState);
      
      assert.ok(existsSync(TEST_DIR));
      assert.ok(existsSync(TEST_STATE_FILE));
      
      // Check directory permissions
      const dirStats = statSync(TEST_DIR);
      const dirPermissions = dirStats.mode & 0o777;
      assert.equal(dirPermissions, 0o700);
    });
    
    it('should validate state before writing', () => {
      const invalidState = {
        enabled: "true", // Should be boolean
        containerId: 123, // Should be string or null
        containerName: {},
        containerImage: [],
        directory: '/test'
      };
      
      setState(invalidState);
      
      const content = readFileSync(TEST_STATE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      
      // Should have correct types
      assert.strictEqual(typeof parsed.enabled, 'boolean');
      assert.strictEqual(parsed.containerId, null);
      assert.strictEqual(parsed.containerName, null);
      assert.strictEqual(parsed.containerImage, null);
    });
    
    it('should use atomic write operations', () => {
      const testState = {
        enabled: true,
        containerId: 'abc123def456',
        containerName: 'test',
        containerImage: 'test:latest',
        directory: '/test'
      };
      
      setState(testState);
      
      // Should not leave temporary files
      assert.ok(!existsSync(join(TEST_DIR, 'container-mode.json.tmp')));
    });
  });
});
