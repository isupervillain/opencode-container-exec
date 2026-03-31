import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';

// Mock the child_process module
const originalExecSync = execSync;

// Import functions we need to test
import { 
  findContainer,
  validateContainerId,
  validateContainerName,
  validateSelection,
  isContainerHealthy,
  checkDependencies,
  getContainerInfo
} from '../../plugin/internal.js';

describe('Container Operations', () => {
  describe('validateContainerId()', () => {
    it('should accept valid short container IDs', () => {
      assert.ok(validateContainerId('abc123def456'));
      assert.ok(validateContainerId('1234567890ab'));
      assert.ok(validateContainerId('ABC123DEF456')); // Case insensitive
    });
    
    it('should accept valid long container IDs', () => {
      assert.ok(validateContainerId('abc123def456789012345678901234567890123456789012345678901234'));
    });
    
    it('should reject invalid container IDs', () => {
      assert.ok(!validateContainerId('short')); // Too short
      assert.ok(!validateContainerId('abc123def45678901234567890123456789012345678901234567890123456789')); // Too long (>64)
      assert.ok(!validateContainerId('abc123def45g')); // Contains 'g'
      assert.ok(!validateContainerId('abc123-def456')); // Contains hyphen
      assert.ok(!validateContainerId(''));
      assert.ok(!validateContainerId(null));
      assert.ok(!validateContainerId(undefined));
      assert.ok(!validateContainerId(123));
    });
  });
  
  describe('validateContainerName()', () => {
    it('should accept valid container names', () => {
      assert.ok(validateContainerName('test-container'));
      assert.ok(validateContainerName('test_container'));
      assert.ok(validateContainerName('test.container'));
      assert.ok(validateContainerName('container123'));
      assert.ok(validateContainerName('Container'));
      assert.ok(validateContainerName('container-123_test'));
    });
    
    it('should reject invalid container names', () => {
      assert.ok(!validateContainerName('test container')); // Contains space
      assert.ok(!validateContainerName('test$container')); // Contains $
      assert.ok(!validateContainerName('test;container')); // Contains ;
      assert.ok(!validateContainerName('test&container')); // Contains &
      assert.ok(!validateContainerName('test|container')); // Contains |
      assert.ok(!validateContainerName('test`container`')); // Contains backticks
      assert.ok(!validateContainerName('test$(container)')); // Contains $()
      assert.ok(!validateContainerName('test@container')); // Contains @
      assert.ok(!validateContainerName('test#container')); // Contains #
      assert.ok(!validateContainerName('test%container')); // Contains %
      assert.ok(!validateContainerName('')); // Empty string
      assert.ok(!validateContainerName('a'.repeat(256))); // Too long
      assert.ok(!validateContainerName(null));
      assert.ok(!validateContainerName(undefined));
      assert.ok(!validateContainerName(123));
    });
    
    it('should require alphanumeric first character', () => {
      assert.ok(!validateContainerName('-container')); // Starts with hyphen
      assert.ok(!validateContainerName('_container')); // Starts with underscore
      assert.ok(!validateContainerName('.container')); // Starts with period
    });
  });
  
  describe('validateSelection()', () => {
    it('should accept empty selection', () => {
      assert.ok(validateSelection(''));
      assert.ok(validateSelection(null));
      assert.ok(validateSelection(undefined));
    });
    
    it('should accept numeric selections', () => {
      assert.ok(validateSelection('1'));
      assert.ok(validateSelection('123'));
      assert.ok(validateSelection('999'));
    });
    
    it('should accept container ID selections', () => {
      assert.ok(validateSelection('abc123def456'));
      assert.ok(validateSelection('1234567890ab'));
    });
    
    it('should accept container name selections', () => {
      assert.ok(validateSelection('test-container'));
      assert.ok(validateSelection('test_container'));
    });
    
    it('should reject invalid selections', () => {
      assert.ok(!validateSelection('test container')); // Space
      assert.ok(!validateSelection('test;container')); // Semicolon
      assert.ok(!validateSelection('test&container')); // Ampersand
      assert.ok(!validateSelection('a'.repeat(256))); // Too long
    });
  });
  
  describe('isContainerHealthy()', () => {
    it('should return false for invalid container ID', () => {
      assert.ok(!isContainerHealthy('invalid'));
      assert.ok(!isContainerHealthy(''));
      assert.ok(!isContainerHealthy(null));
    });
    
    // Note: We can't easily mock execSync in this test environment
    // These tests would need a proper mocking framework
    it('should check container status', async () => {
      // This test would need mocking of execSync
      // For now, we'll test the validation logic
      assert.ok(!isContainerHealthy('abc123def456'));
    });
  });
  
  describe('checkDependencies()', () => {
    it('should check for required dependencies', () => {
      // This test would need mocking of execSync
      // For now, we'll test that it returns an array
      const result = checkDependencies();
      assert.ok(Array.isArray(result));
    });
  });
  
  describe('getContainerInfo()', () => {
    it('should return default info for invalid container ID', () => {
      const info = getContainerInfo('invalid');
      assert.deepEqual(info, { name: 'unknown', image: 'unknown' });
    });
    
    it('should return default info for empty container ID', () => {
      const info = getContainerInfo('');
      assert.deepEqual(info, { name: 'unknown', image: 'unknown' });
    });
    
    // Note: Testing with actual container would require mocking
  });
  
  describe('findContainer()', () => {
    it('should return error for invalid selection format', () => {
      const result = findContainer('test container', '/test/dir');
      assert.ok(result.error);
      assert.ok(result.error.includes('Invalid selection'));
    });
    
    it('should return error for selection with special characters', () => {
      const result = findContainer('test;container', '/test/dir');
      assert.ok(result.error);
      assert.ok(result.error.includes('Invalid selection'));
    });
    
    // Note: Testing actual container finding would require mocking execSync
    // and docker commands
  });
});
