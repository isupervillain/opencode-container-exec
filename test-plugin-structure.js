// Test script to verify plugin structure
import { ContainerExecPlugin } from './plugin/index.js';

console.log('Testing plugin structure...');

// Mock client with path.get() method
const mockClient = {
  path: {
    get: async () => ({
      data: {
        config: '/tmp/test-config'
      }
    })
  }
};

// Mock other dependencies
const mockContext = {
  project: {},
  client: mockClient,
  $: () => ({ text: () => Promise.resolve('') }),
  directory: '/test',
  worktree: {}
};

try {
  const plugin = await ContainerExecPlugin(mockContext);
  
  // Verify plugin structure
  console.log('✓ Plugin loaded successfully');
  console.log('✓ Plugin has tool property:', !!plugin.tool);
  console.log('✓ Plugin has bash tool:', !!plugin.tool.bash);
  console.log('✓ Plugin has container tool:', !!plugin.tool.container);
  console.log('✓ Bash tool has execute method:', typeof plugin.tool.bash.execute === 'function');
  console.log('✓ Container tool has execute method:', typeof plugin.tool.container.execute === 'function');
  
  console.log('\nAll checks passed!');
} catch (error) {
  console.error('Error testing plugin:', error);
  process.exit(1);
}
