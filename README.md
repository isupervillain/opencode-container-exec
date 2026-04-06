# opencode-container-exec

OpenCode plugin for WSL devcontainer integration - run commands inside devcontainers from WSL.

## Why?

When using VSCode Dev Containers from WSL, you need to reinstall OpenCode in every new container. This plugin lets you run OpenCode from WSL and route commands to the container automatically.

## Features

- **Auto-detect** running devcontainers via `devcontainer.local_folder` label
- **Container selection** by number, ID, or name when multiple containers running
- **Visual indicator** `[🐳 container-name]` prefix in bash output
- **WSL path conversion** automatically converts Linux paths to Windows format
- **Direct execution** use `!` prefix for instant execution without LLM
- **Security hardened** with input validation and command injection prevention
- **Container health checks** ensures containers are running before command execution
- **Dependency checking** validates required CLIs are installed

## Prerequisites

### System Requirements

- **Operating System**: Windows 10/11 with WSL (Windows Subsystem for Linux)
- **WSL Distribution**: Ubuntu (default) or other distributions (configurable)
- **Docker**: Docker Desktop with WSL 2 backend
- **Node.js**: Version 18.0.0 or higher

### Required Software

1. **WSL 2**: [Installation guide](https://docs.microsoft.com/en-us/windows/wsl/install)
2. **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop)
   - Enable WSL 2 integration in Docker Desktop settings
3. **devcontainer CLI**: Install globally
   ```bash
   npm install -g @devcontainers/cli
   ```
4. **jq** (required for `scripts/toggle.sh`)
   ```bash
   sudo apt-get update && sudo apt-get install -y jq
   ```
5. **OpenCode CLI**: Install from [opencode.ai](https://opencode.ai)

### Verification

Verify your setup:

```bash
# Check WSL
wsl --list --verbose

# Check Docker
docker --version
docker ps

# Check devcontainer CLI
devcontainer --version

# Check Node.js
node --version
```

## Installation

### From npm (recommended)

```bash
npm install -g @isupervillain/opencode-container-exec
```

Add to your `~/.config/opencode/opencode.json` or project `opencode.json`:

```json
{
  "plugin": ["@isupervillain/opencode-container-exec"]
}
```

### Local installation

1. Clone this repository
2. Copy the `plugin` directory to `~/.config/opencode/plugins/` or `.opencode/plugins/`
3. Copy `scripts/toggle.sh` to a location in your PATH

**Note**: The `/container` slash command is automatically installed when the plugin loads (global OpenCode config). No manual setup required.

If you don't see `/container` immediately, restart OpenCode once so the command file can be discovered.
If auto-install fails in your environment, you can still manually copy `plugin/command/container.md` to `~/.config/opencode/commands/container.md`.

### Plugin runtime entrypoint contract

For OpenCode runtime loading, keep `plugin/index.js` limited to plugin export(s) only (for this project: `ContainerExecPlugin` and default export).
Move helper/utility exports to `plugin/internal.js`.

## Usage

### Direct execution (instant, no LLM)

```bash
# Enable container mode (auto-detect)
!path/to/scripts/toggle.sh on

# Disable container mode
!path/to/scripts/toggle.sh off

# Show current status
!path/to/scripts/toggle.sh status

# List all running devcontainers
!path/to/scripts/toggle.sh list

# Select container by number
!path/to/scripts/toggle.sh on 1

# Select container by ID
!path/to/scripts/toggle.sh on fa6c0c798c6c

# Select container by name
!path/to/scripts/toggle.sh on flamboyant_robinson
```

### Via slash command (LLM processed)

```bash
/container on
/container off
/container status
/container list
/container on 1
```

### Visual indicator

When container mode is ON, bash commands show:

```
[🐳 flamboyant_robinson] /home/vscode
[🐳 flamboyant_robinson] Python 3.12.11
```

When container mode is OFF:

```
/home/your-user/projects/your-repo
Python 3.12.11
```

## API Reference

### Tools

#### `bash`

Execute shell commands. Routes to devcontainer when container mode is enabled.

**Description**: 
- When container mode is ON: `Execute shell commands in devcontainer [🐳 container-name]`
- When container mode is OFF: `Execute shell commands locally on WSL`

**Arguments**:
- `command` (string, required): Shell command to execute
- `timeout` (number, optional): Timeout in milliseconds

**Returns**: Command output with container indicator prefix when applicable.

#### `container`

Toggle devcontainer mode on/off for running commands inside a container.

**Description**: `Toggle devcontainer mode on/off for running commands inside a container`

**Arguments**:
- `action` (enum, required): Action to perform
  - `on`: Enable container mode
  - `off`: Disable container mode
  - `status`: Show current status
  - `list`: List all running devcontainers
- `selection` (string, optional): Container selection (number, ID, or name)

**Returns**: Status message and container information.

### Shell Script API

The `toggle.sh` script provides the same functionality via command line:

```bash
toggle.sh [action] [container]
```

**Actions**:
- `on [container]`: Enable container mode (auto-detect or specify container)
- `off`: Disable container mode
- `status`: Show current state and available containers
- `list`: List all running devcontainers

**Container Selection**:
- Number: Select by position in list (e.g., `1`)
- Container ID: Select by Docker container ID (e.g., `fa6c0c798c6c`)
- Container name: Select by Docker container name (e.g., `flamboyant_robinson`)

## How it works

1. The plugin detects running devcontainers by checking the `devcontainer.local_folder` Docker label
2. It converts WSL paths to Windows format (prefers `wslpath -w`, falls back to `\\wsl.localhost\<distro>\...`)
3. When enabled, bash commands are routed through `devcontainer exec --container-id`
4. State is persisted in `~/.config/opencode/container-mode.json`

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WSL_DISTRO_NAME` | WSL distribution name | `Ubuntu` | No |
| `WSL_DISTRO` | Alternate WSL distribution variable (fallback) | _unset_ | No |
| `HOME` | User home directory | `~` | No |
| `NODE_ENV` | Node environment | `production` | No |

### State File

The plugin stores state in `~/.config/opencode/container-mode.json`:

```json
{
  "enabled": true,
  "containerId": "fa6c0c798c6c",
  "containerName": "flamboyant_robinson",
  "containerImage": "mcr.microsoft.com/devcontainers/python:2-3.12-bullseye",
  "directory": "/home/your-user/projects/your-repo"
}
```

**Security**: State file is created with restrictive permissions (0o600).

### Configuration Options

Currently, the plugin uses automatic configuration. Future versions will support:

- Timeout configuration
- Container selection preferences
- Path conversion options
- Security settings

## Troubleshooting

### Common Issues

#### 1. No devcontainers found

**Symptoms**: "No running devcontainers found" error

**Solutions**:
1. Ensure VSCode has opened a directory in a devcontainer
2. Check if container is running: `docker ps`
3. Verify container has `devcontainer.local_folder` label:
   ```bash
   docker inspect --format '{{json .Config.Labels}}' <container_id> | grep devcontainer.local_folder
   ```

#### 2. Commands not running in container

**Symptoms**: Commands execute locally instead of in container

**Solutions**:
1. Check container mode status:
   ```bash
   !path/to/scripts/toggle.sh status
   ```
2. Verify container is still running:
   ```bash
   docker ps | grep <container_name>
   ```
3. Re-enable container mode:
   ```bash
   !path/to/scripts/toggle.sh on
   ```

#### 3. Path conversion issues

**Symptoms**: Container not found for current directory

**Solutions**:
1. Check if using correct WSL distribution:
   ```bash
   echo $WSL_DISTRO_NAME
   ```
2. Set distribution name if not Ubuntu (dot/hyphen names are supported, e.g. `Ubuntu-24.04`):
   ```bash
   export WSL_DISTRO_NAME="Ubuntu-24.04"
   ```
3. Verify path conversion:
   ```bash
   wslpath -w "$(pwd)"
   ```

#### 4. Permission errors

**Symptoms**: "Permission denied" or state file errors

**Solutions**:
1. Check state file permissions:
   ```bash
   ls -la ~/.config/opencode/container-mode.json
   ```
2. Fix permissions if needed:
   ```bash
   chmod 600 ~/.config/opencode/container-mode.json
   ```
3. Check config directory permissions:
   ```bash
   ls -ld ~/.config/opencode
   chmod 700 ~/.config/opencode
   ```

#### 5. Docker connection issues

**Symptoms**: "Cannot connect to Docker daemon" error

**Solutions**:
1. Ensure Docker Desktop is running
2. Check WSL integration in Docker Desktop settings
3. Verify Docker socket permissions:
   ```bash
   ls -la /var/run/docker.sock
   ```
4. Restart Docker Desktop

#### 6. devcontainer CLI not found

**Symptoms**: "devcontainer: command not found" error

**Solutions**:
1. Install devcontainer CLI:
   ```bash
   npm install -g @devcontainers/cli
   ```
2. Verify installation:
   ```bash
   devcontainer --version
   ```
3. Check PATH includes npm global bin:
   ```bash
   echo $PATH | grep "$(npm config get prefix)/bin"
   ```

#### 7. Plugin load crash: `TypeError` related to `plugin.auth`

**Symptoms**: OpenCode fails to load the plugin with a `TypeError` mentioning `plugin.auth`.

**Cause**: `plugin/index.js` exports non-plugin helper symbols, so runtime plugin detection receives unexpected exports.

**Resolution**:
1. Ensure `plugin/index.js` exports only plugin function entrypoints.
2. Move helper utilities to `plugin/internal.js`.
3. Upgrade to a release that includes this entrypoint/internal split.

### Debug Mode

Enable debug logging for troubleshooting:

```bash
export NODE_ENV=development
```

This will output security events and debugging information to stderr.

### Log Files

The plugin logs security events in development mode. For production issues:

1. Check system logs: `journalctl -u docker`
2. Check Docker logs: `docker logs <container_id>`
3. Check OpenCode logs: `~/.config/opencode/logs/`

## Security

### Security Features

- **Input validation**: All inputs validated against strict patterns
- **Command injection prevention**: Proper escaping of shell arguments
- **Secure file permissions**: State files created with 0o600 permissions
- **Atomic file operations**: Prevents state file corruption
- **Container health checks**: Verifies containers are running before execution
- **Dependency validation**: Checks required CLIs are installed
- **Security logging**: Logs suspicious activities in development mode

### Security Best Practices

1. **Keep dependencies updated**: Regularly update Docker, devcontainer CLI, and Node.js
2. **Use strong container names**: Avoid special characters in container names
3. **Monitor logs**: Check security logs for suspicious activities
4. **Validate inputs**: Don't trust user inputs; validate all container selections
5. **Use restrictive permissions**: Ensure config directory has 0o700 permissions

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly by opening a private [GitHub Security Advisory](https://github.com/isupervillain/opencode-container-exec/security/advisaries/new).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repository
git clone https://github.com/isupervillain/opencode-container-exec.git
cd opencode-container-exec

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test test/unit/state.test.js

# Run tests with watch mode
npm run test:watch
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT © isupervillain

## Support

- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/isupervillain/opencode-container-exec/issues)
- **Discussions**: [GitHub Discussions](https://github.com/isupervillain/opencode-container-exec/discussions)
- **Security**: Report via [GitHub Security Advisory](https://github.com/isupervillain/opencode-container-exec/security)
