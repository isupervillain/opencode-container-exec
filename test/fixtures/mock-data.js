/**
 * Mock data for unit tests
 */

// Mock state data
export const mockStateEnabled = {
  enabled: true,
  containerId: "abc123def456",
  containerName: "test-container",
  containerImage: "mcr.microsoft.com/devcontainers/python:2-3.12-bullseye",
  directory: "/home/user/project"
};

export const mockStateDisabled = {
  enabled: false,
  containerId: null,
  containerName: null,
  containerImage: null,
  directory: null
};

// Mock container list output from docker ps
export const mockContainerList = `abc123def456	test-container	mcr.microsoft.com/devcontainers/python:2-3.12-bullseye	Up 2 hours
def456ghi789	another-container	mcr.microsoft.com/devcontainers/node:20-bullseye	Up 1 hour`;

// Mock container info
export const mockContainerInfo = {
  name: "test-container",
  image: "mcr.microsoft.com/devcontainers/python:2-3.12-bullseye"
};

// Mock Windows path conversion
export const mockPathConversion = {
  wslPath: "/home/user/project",
  windowsPath: "\\\\wsl.localhost\\Ubuntu\\home\\user\\project",
  distro: "Ubuntu"
};

// Mock error responses
export const mockErrors = {
  noContainers: "No running devcontainers found. Make sure VSCode has opened a directory in a devcontainer.",
  invalidSelection: "Invalid selection: invalid. Use 'list' to see available containers.",
  containerNotFound: "Container not found: nonexistent123"
};

// Mock container selection scenarios
export const mockSelections = {
  byNumber: "1",
  byContainerId: "abc123def456",
  byContainerName: "test-container",
  invalid: "invalid-selection"
};

// Mock environment variables
export const mockEnv = {
  WSL_DISTRO_NAME: "Ubuntu",
  HOME: "/home/user"
};

// Mock file system state
export const mockFileSystem = {
  stateFileExists: true,
  stateFileMissing: false,
  stateFileCorrupted: "{invalid json}",
  configDir: "/home/user/.config/opencode"
};
