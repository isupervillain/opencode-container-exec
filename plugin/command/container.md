---
description: Toggle devcontainer mode on/off for running commands inside a container
---

# Container Command

Toggle devcontainer mode on/off for running commands inside a container.

## Usage

```
/container on [selection]
/container off
/container status
/container list
```

## Actions

- **on**: Enable container mode. Optionally specify a container by number, ID, or name.
- **off**: Disable container mode. Commands will run locally on WSL.
- **status**: Show current container mode status and selected container.
- **list**: List all running devcontainers.

## Examples

```
/container on                    # Auto-detect container from current directory
/container on 1                  # Select container by number
/container on fa6c0c798c6c       # Select container by ID
/container on flamboyant_robinson # Select container by name
/container off                   # Disable container mode
/container status                # Show current status
/container list                  # List all running containers
```

## Notes

- Requires Docker and devcontainer CLI to be installed
- Only works on WSL (Windows Subsystem for Linux)
- Container must have `devcontainer.local_folder` label
- Commands are routed through `devcontainer exec` when container mode is enabled

Use the container tool with the appropriate action and selection arguments.
