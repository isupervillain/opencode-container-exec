# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed plugin runtime entrypoint exports: `plugin/index.js` now exports only plugin function entrypoints, with helper utilities moved to `plugin/internal.js`.
- This prevents plugin load failures like `TypeError` related to `plugin.auth` caused by non-plugin exports on the runtime entrypoint.

### Planned
- Support for non-WSL environments
- Container privilege level detection
- Configuration options for timeouts
- Support for multiple simultaneous containers
- Performance optimizations for container listing

## [1.2.0] - 2026-03-28

### Fixed
- Fixed `scripts/toggle.sh` runtime bug caused by `local` used outside function scope.
- Fixed path handling so directories with spaces do not break auto-detection flows.
- Fixed container list/status parsing to preserve full Docker status text.
- Fixed dependency gating to allow `off` and `status` recovery flows when Docker/devcontainer are unavailable.
- Fixed multi-match container resolution for auto-detect and name selection.

### Security
- Hardened auto-install command behavior to avoid overwriting user-customized command files.
- Added command install path validation and symlink checks for safer writes.

### Changed
- Added deterministic lint checks (`node --check` and `bash -n`) and `prepublishOnly` gates.
- Added unit coverage for command auto-install behavior.
- Added `CODE_OF_CONDUCT.md` and aligned packaging metadata.

## [1.0.0] - 2026-03-27

### Added
- Initial release of opencode-container-exec plugin
- Support for routing bash commands to Docker devcontainers from WSL
- Auto-detection of running devcontainers via `devcontainer.local_folder` label
- Container selection by number, ID, or name
- Visual indicator `[🐳 container-name]` prefix in bash output
- WSL path conversion to Windows format
- Direct execution with `!` prefix
- Slash command support (`/container on|off|status|list`)
- State persistence in `~/.config/opencode/container-mode.json`
- Toggle shell script for CLI usage

### Security
- Fixed critical command injection vulnerabilities in container selection
- Added input validation for container IDs, names, and commands
- Implemented secure state file permissions (0o600)
- Added atomic file operations for state writes
- Added dependency checking for docker and devcontainer CLIs
- Added container health checks before command execution
- Added comprehensive input sanitization
- Added security logging for suspicious activities

### Changed
- Improved error handling with proper user feedback
- Enhanced state file validation and corruption recovery
- Updated package.json with proper metadata and keywords
- Added comprehensive test suite
- Added documentation for prerequisites and troubleshooting

### Fixed
- Silent error handling now provides meaningful feedback
- Race conditions in state file access
- JSON parsing errors in corrupted state files
- Path conversion validation
- Container selection edge cases

## [1.1.0] - 2026-03-27

### Added
- Automatic command installation on plugin load
- Plugin now auto-installs `/container` slash command to OpenCode config directory
- No manual command setup required for new installations

### Changed
- Simplified installation instructions in README.md
- Plugin now accepts `client` parameter for OpenCode API access
- Commands are installed non-blocking on plugin load
- Command auto-install now targets both `commands/` and legacy `command/` config directories for compatibility

### Fixed
- Removed manual command setup requirement
- Improved user experience with zero-configuration command installation
