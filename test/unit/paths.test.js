import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Import functions we need to test
import { 
  getWindowsPath,
  validateWindowsPath
} from '../../plugin/internal.js';

describe('Path Operations', () => {
  describe('validateWindowsPath()', () => {
    it('should accept valid Windows paths', () => {
      assert.ok(validateWindowsPath('C:\\Users\\test\\file.txt'));
      assert.ok(validateWindowsPath('\\\\server\\share\\file.txt'));
      assert.ok(validateWindowsPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\project'));
      assert.ok(validateWindowsPath('D:\\Projects\\my-project_123'));
    });
    
    it('should reject invalid Windows paths', () => {
      assert.ok(!validateWindowsPath('')); // Empty
      assert.ok(validateWindowsPath('path with spaces'));
      assert.ok(!validateWindowsPath('path;with;semicolons'));
      assert.ok(!validateWindowsPath('path&with&ampersands'));
      assert.ok(!validateWindowsPath('path|with|pipes'));
      assert.ok(!validateWindowsPath('path`with`backticks'));
      assert.ok(!validateWindowsPath('path$(with)command'));
      assert.ok(!validateWindowsPath('a'.repeat(4097))); // Too long
      assert.ok(!validateWindowsPath(null));
      assert.ok(!validateWindowsPath(undefined));
      assert.ok(!validateWindowsPath(123));
    });
  });
  
  describe('getWindowsPath()', () => {
    // Save original environment
    const originalEnv = process.env.WSL_DISTRO_NAME;
    const originalWslDistro = process.env.WSL_DISTRO;
    
    afterEach(() => {
      // Restore environment
      if (originalEnv) {
        process.env.WSL_DISTRO_NAME = originalEnv;
      } else {
        delete process.env.WSL_DISTRO_NAME;
      }

      if (originalWslDistro) {
        process.env.WSL_DISTRO = originalWslDistro;
      } else {
        delete process.env.WSL_DISTRO;
      }
    });
    
    it('should convert WSL path to Windows format with default distro', () => {
      delete process.env.WSL_DISTRO_NAME;
      const result = getWindowsPath('/home/user/project');
      assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project');
    });
    
    it('should convert WSL path to Windows format with custom distro', () => {
      process.env.WSL_DISTRO_NAME = 'Debian';
      const result = getWindowsPath('/home/user/project');
      assert.strictEqual(result, '\\\\wsl.localhost\\Debian\\home\\user\\project');
    });

    it('should accept distro names with dots', () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu-24.04';
      const result = getWindowsPath('/home/user/project');
      assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu-24.04\\home\\user\\project');
    });

    it('should use WSL_DISTRO when WSL_DISTRO_NAME is not set', () => {
      delete process.env.WSL_DISTRO_NAME;
      process.env.WSL_DISTRO = 'Debian';
      const result = getWindowsPath('/home/user/project');
      assert.strictEqual(result, '\\\\wsl.localhost\\Debian\\home\\user\\project');
    });
    
    it('should handle nested paths', () => {
      delete process.env.WSL_DISTRO_NAME;
      const result = getWindowsPath('/home/user/projects/my-app/src');
      assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\projects\\my-app\\src');
    });
    
    it('should reject invalid directory paths', () => {
      assert.strictEqual(getWindowsPath('relative/path'), null); // Not absolute
      assert.strictEqual(getWindowsPath(''), null); // Empty
      assert.strictEqual(getWindowsPath(null), null);
      assert.strictEqual(getWindowsPath(undefined), null);
      assert.strictEqual(getWindowsPath(123), null);
    });
    
    it('should reject invalid distro names', () => {
      process.env.WSL_DISTRO_NAME = 'Invalid Distro';
      assert.strictEqual(getWindowsPath('/home/user/project'), null);
      
      process.env.WSL_DISTRO_NAME = 'Invalid$Distro';
      assert.strictEqual(getWindowsPath('/home/user/project'), null);
      
      process.env.WSL_DISTRO_NAME = 'Invalid;Distro';
      assert.strictEqual(getWindowsPath('/home/user/project'), null);
    });
    
    it('should handle root directory', () => {
      delete process.env.WSL_DISTRO_NAME;
      const result = getWindowsPath('/');
      assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\');
    });
    
    it('should handle paths with special characters', () => {
      delete process.env.WSL_DISTRO_NAME;
      const result = getWindowsPath('/home/user/project-with-dash');
      assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project-with-dash');
      
      const result2 = getWindowsPath('/home/user/project_with_underscore');
      assert.strictEqual(result2, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project_with_underscore');
      
      const result3 = getWindowsPath('/home/user/project.with.dot');
      assert.strictEqual(result3, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project.with.dot');

      const result4 = getWindowsPath('/home/user/project with spaces');
      assert.strictEqual(result4, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project with spaces');
    });
  });
});
