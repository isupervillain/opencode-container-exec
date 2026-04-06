#!/bin/bash
# opencode-container-exec toggle script
# Usage: toggle.sh [on|off|status|list] [container]

set -euo pipefail

CONFIG_DIR="$HOME/.config/opencode"
STATE_FILE="$CONFIG_DIR/container-mode.json"

# Security logging
log_security() {
    local event="$1"
    local details="$2"
    # In production, this should write to a secure log file
    if [[ "${NODE_ENV:-}" == "development" ]]; then
        echo "[SECURITY] $event: $details" >&2
    fi
}

# Input validation functions
validate_container_id() {
    local id="$1"
    # Docker container IDs are 64-character hex strings, short IDs are 12+ chars
    if [[ "$id" =~ ^[a-f0-9]{12,64}$ ]]; then
        return 0
    fi
    return 1
}

validate_container_name() {
    local name="$1"
    # Docker container names: alphanumeric, underscore, period, hyphen
    # Must start with alphanumeric, max 255 chars
    if [[ "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] && [[ ${#name} -le 255 ]]; then
        return 0
    fi
    return 1
}

validate_selection() {
    local selection="$1"
    
    # Empty selection is allowed (auto-detect)
    if [[ -z "$selection" ]]; then
        return 0
    fi
    
    # Check length
    if [[ ${#selection} -gt 255 ]]; then
        log_security "selection_too_long" "length=${#selection}"
        return 1
    fi
    
    # Allow numbers
    if [[ "$selection" =~ ^[0-9]+$ ]]; then
        return 0
    fi
    
    # Allow container IDs
    if validate_container_id "$selection"; then
        return 0
    fi
    
    # Allow container names
    if validate_container_name "$selection"; then
        return 0
    fi
    
    return 1
}

validate_windows_path() {
    local path="$1"
    # Validate path doesn't contain dangerous characters
    if [[ ${#path} -gt 4096 ]]; then
        log_security "path_too_long" "length=${#path}"
        return 1
    fi
    
    # Deny dangerous shell metacharacters. Allow everything else (including spaces/backslashes).
    if [[ "$path" =~ [\;\&\|\`\<\>] ]] || [[ "$path" =~ \$\( ]]; then
        return 1
    fi

    return 0
}

# Check if required dependencies are installed
check_dependencies() {
    local missing=()
    local required=("$@")
    local cmd

    for cmd in "${required[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "❌ Missing required dependencies: ${missing[*]}"
        echo "Please install the missing dependencies before using this script."
        return 1
    fi
    
    return 0
}

# Secure state file writing with atomic operations
write_state_file() {
    local state="$1"
    
    # Create config dir with restrictive permissions
    mkdir -p "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"
    
    # Refuse symlinked config/state paths
    if [[ -L "$CONFIG_DIR" ]]; then
        log_security "unsafe_config_dir_symlink" "path=$CONFIG_DIR"
        echo "❌ Unsafe config directory path"
        return 1
    fi
    if [[ -e "$STATE_FILE" && -L "$STATE_FILE" ]]; then
        log_security "unsafe_state_file_symlink" "path=$STATE_FILE"
        echo "❌ Unsafe state file path"
        return 1
    fi

    # Write to temporary file first using a secure random path
    local temp_file
    temp_file=$(mktemp "$CONFIG_DIR/container-mode.XXXXXX")
    printf '%s' "$state" > "$temp_file"
    
    # Set restrictive permissions
    chmod 600 "$temp_file"
    
    # Atomic rename
    mv "$temp_file" "$STATE_FILE"
}

# Convert WSL path to Windows WSL path format with validation
get_windows_path() {
    local dir="$1"
    
    # Validate directory path
    if [[ -z "$dir" ]] || [[ ! "$dir" =~ ^/ ]]; then
        log_security "invalid_directory_path" "dir=$dir"
        return 1
    fi
    
    local win_path=""

    local env_distro="${WSL_DISTRO_NAME:-${WSL_DISTRO:-}}"

    # Prefer explicit distro environment when provided.
    if [[ -z "$env_distro" ]] && command -v wslpath &> /dev/null; then
        win_path=$(wslpath -w "$dir" 2>/dev/null || true)
    fi

    if [[ -z "$win_path" ]]; then
        local distro="${env_distro:-Ubuntu}"

        # Allow common distro naming including dots (e.g. Ubuntu-24.04)
        if [[ ! "$distro" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
            log_security "invalid_distro_name" "distro=$distro"
            return 1
        fi

        win_path=$(printf '\\\\wsl.localhost\\%s%s' "$distro" "$dir" | sed 's|/|\\|g')
    fi
    
    # Validate the resulting path
    if ! validate_windows_path "$win_path"; then
        log_security "invalid_windows_path" "win_path=$win_path"
        return 1
    fi
    
    echo "$win_path"
    return 0
}

get_auto_detect_paths() {
    local base_path="$1"
    printf '%s\n' "$base_path"

    if [[ "$base_path" == \\\\wsl.localhost\\* ]]; then
        printf '%s\n' "${base_path/\\\\wsl.localhost\\/\\\\wsl$\\}"
    elif [[ "$base_path" == \\\\wsl$\\* ]]; then
        printf '%s\n' "${base_path/\\\\wsl$\\/\\\\wsl.localhost\\}"
    fi
}

# Create config dir if not exists with proper permissions
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

# Get current directory
DIR=$(pwd)

# Read current state
if [ -f "$STATE_FILE" ]; then
    if [[ -L "$STATE_FILE" ]]; then
        log_security "unsafe_state_file_symlink_read" "path=$STATE_FILE"
        echo "⚠️  State file path is unsafe, resetting to default"
        ENABLED="false"
        CURRENT_CONTAINER=""
    elif ! command -v jq &> /dev/null; then
        ENABLED="false"
        CURRENT_CONTAINER=""
    # Validate JSON before parsing
    elif ! jq empty "$STATE_FILE" 2>/dev/null; then
        log_security "corrupted_state_file" "file=$STATE_FILE"
        echo "⚠️  State file is corrupted, resetting to default"
        ENABLED="false"
        CURRENT_CONTAINER=""
    else
        ENABLED=$(jq -r '.enabled // false' "$STATE_FILE")
        CURRENT_CONTAINER=$(jq -r '.containerId // ""' "$STATE_FILE")
    fi
else
    ENABLED="false"
    CURRENT_CONTAINER=""
fi

# Parse action
ACTION="${1:-status}"
CONTAINER_ARG="${2:-}"

# Validate action
if [[ ! "$ACTION" =~ ^(on|off|status|list)$ ]]; then
    echo "❌ Invalid action: $ACTION"
    echo "Valid actions: on, off, status, list"
    exit 1
fi

show_containers() {
    echo "Running devcontainers:"
    echo ""
    printf "%-4s %-12s %-50s %-20s\n" "#" "CONTAINER ID" "IMAGE" "STATUS"
    echo "------------------------------------------------------------------------------------------------------------------------"
    
    local docker_output
    if ! docker_output=$(docker ps --filter "label=devcontainer.local_folder" --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}" 2>&1); then
        echo "❌ Failed to list containers: $docker_output"
        return 1
    fi

    local index=1
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            # Parse tab-separated fields safely (status can contain spaces)
            IFS=$'\t' read -r CONTAINER_ID _NAME IMAGE STATUS <<< "$line"
            
            # Check if this is the current container
            local marker=""
            if [ "$CONTAINER_ID" = "$CURRENT_CONTAINER" ] && [ "$ENABLED" = "true" ]; then
                marker=" *"
            fi
            
            printf "%-4s %-12s %-50s %-20s%s\n" "$index" "$CONTAINER_ID" "$IMAGE" "$STATUS" "$marker"
            index=$((index + 1))
        fi
    done <<< "$docker_output"
    
    echo ""
    echo "* = currently selected"
    echo ""
    echo "Usage:"
    echo "  $0 on                    # Auto-detect from current directory"
    echo "  $0 on <number>           # Select by number"
    echo "  $0 on <container_id>     # Select by container ID"
    echo "  $0 on <name>             # Select by container name"
    echo "  $0 off                   # Disable container mode"
    echo "  $0 status                # Show current state"
}

select_container() {
    local selection="$1"
    
    # Validate selection input
    if ! validate_selection "$selection"; then
        log_security "invalid_selection_input" "selection=$selection"
        echo "❌ Invalid selection format"
        return 1
    fi
    
    # Get list of containers
    local containers=()
    local container_output
    if ! container_output=$(docker ps --filter "label=devcontainer.local_folder" --format "{{.ID}}" 2>&1); then
        echo "❌ Failed to query containers: $container_output"
        return 1
    fi

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            containers+=("$line")
        fi
    done <<< "$container_output"
    
    if [ ${#containers[@]} -eq 0 ]; then
        echo "❌ No running devcontainers found."
        echo ""
        echo "Make sure VSCode has opened a directory in a devcontainer."
        return 1
    fi
    
    # If no selection, try to auto-detect from current directory
    if [ -z "$selection" ]; then
        local win_path
        win_path=$(get_windows_path "$DIR") || {
            echo "❌ Invalid directory path for auto-detection"
            return 1
        }
        
        local auto_containers=()
        local candidate
        while IFS= read -r candidate; do
            local auto_container_lines
            # Use proper quoting to prevent injection
            if ! auto_container_lines=$(docker ps -q --filter "label=devcontainer.local_folder=$candidate" 2>&1); then
                echo "❌ Failed to auto-detect container: $auto_container_lines"
                return 1
            fi

            local id
            while IFS= read -r id; do
                if [[ -n "$id" ]]; then
                    local is_duplicate=false
                    local existing_id
                    for existing_id in "${auto_containers[@]}"; do
                        if [[ "$existing_id" == "$id" ]]; then
                            is_duplicate=true
                            break
                        fi
                    done

                    if [[ "$is_duplicate" == false ]]; then
                        auto_containers+=("$id")
                    fi
                fi
            done <<< "$auto_container_lines"
        done < <(get_auto_detect_paths "$win_path")

        if [ ${#auto_containers[@]} -eq 1 ]; then
            # Validate the returned container ID
            if validate_container_id "${auto_containers[0]}"; then
                echo "${auto_containers[0]}"
                return 0
            else
                log_security "invalid_container_id_returned" "id=${auto_containers[0]}"
                echo "❌ Invalid container ID returned"
                return 1
            fi
        elif [ ${#auto_containers[@]} -gt 1 ]; then
            echo "❌ Multiple matching containers found for current directory."
            echo "Use '$0 list' and then '$0 on <number>' to select one."
            return 1
        else
            echo "❌ No devcontainer found for current directory."
            echo ""
            show_containers
            return 1
        fi
    fi
    
    # Check if selection is a number
    if [[ "$selection" =~ ^[0-9]+$ ]]; then
        local index=$((selection - 1))
        if [ $index -ge 0 ] && [ $index -lt ${#containers[@]} ]; then
            echo "${containers[$index]}"
            return 0
        else
            echo "❌ Invalid selection: $selection"
            return 1
        fi
    fi
    
    # Check if selection is a container ID (12+ hex chars)
    if validate_container_id "$selection"; then
        # Verify it exists using proper quoting
        if docker ps -q --filter "id=$selection" | grep -q "$selection"; then
            echo "$selection"
            return 0
        else
            echo "❌ Container not found: $selection"
            return 1
        fi
    fi
    
    # Check if selection is a container name
    if validate_container_name "$selection"; then
        local name_container_lines
        # Use proper quoting to prevent injection
        if ! name_container_lines=$(docker ps -q --filter "name=$selection" 2>&1); then
            echo "❌ Failed to look up container by name: $name_container_lines"
            return 1
        fi
        local name_containers=()
        while IFS= read -r id; do
            [ -n "$id" ] && name_containers+=("$id")
        done <<< "$name_container_lines"

        if [ ${#name_containers[@]} -eq 1 ]; then
            # Validate the returned container ID
            if validate_container_id "${name_containers[0]}"; then
                echo "${name_containers[0]}"
                return 0
            else
                log_security "invalid_container_id_returned" "id=${name_containers[0]}"
                echo "❌ Invalid container ID returned"
                return 1
            fi
        elif [ ${#name_containers[@]} -gt 1 ]; then
            echo "❌ Multiple containers matched name: $selection"
            return 1
        fi
    fi
    
    echo "❌ Invalid selection: $selection"
    return 1
}

# Check dependencies based on action
if [[ "$ACTION" == "on" ]]; then
    if ! check_dependencies docker devcontainer jq; then
        exit 1
    fi
elif [[ "$ACTION" == "list" ]]; then
    if ! check_dependencies docker; then
        exit 1
    fi
fi

case "$ACTION" in
    on)
        if ! CONTAINER_ID=$(select_container "$CONTAINER_ARG" 2>&1); then
            [ -n "$CONTAINER_ID" ] && echo "$CONTAINER_ID" >&2
            exit 1
        fi
        
        # Validate container ID before using
        if ! validate_container_id "$CONTAINER_ID"; then
            log_security "invalid_container_id_selected" "id=$CONTAINER_ID"
            echo "❌ Invalid container ID"
            exit 1
        fi
        
        # Check container is still running
        if ! docker ps -q --filter "id=$CONTAINER_ID" | grep -q "$CONTAINER_ID"; then
            echo "❌ Container is not running"
            exit 1
        fi
        
        # Get container info with proper quoting
        CONTAINER_NAME=$(docker inspect --format '{{.Name}}' "$CONTAINER_ID" | sed 's|^/||')
        CONTAINER_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_ID")
        
        # Validate container name
        if [[ -n "$CONTAINER_NAME" ]] && ! validate_container_name "$CONTAINER_NAME"; then
            log_security "invalid_container_name" "name=$CONTAINER_NAME"
            CONTAINER_NAME="unknown"
        fi
        
        # Save state with proper JSON escaping
        state_json=""
        state_json=$(jq -n \
            --arg enabled "true" \
            --arg containerId "$CONTAINER_ID" \
            --arg containerName "$CONTAINER_NAME" \
            --arg containerImage "$CONTAINER_IMAGE" \
            --arg directory "$DIR" \
            '{enabled: ($enabled == "true"), containerId: $containerId, containerName: $containerName, containerImage: $containerImage, directory: $directory}')
        
        write_state_file "$state_json"
        
        echo "✅ Devcontainer mode ON"
        echo "Container: $CONTAINER_ID ($CONTAINER_NAME)"
        echo "Image: $CONTAINER_IMAGE"
        echo "All bash commands will now run inside the devcontainer."
        ;;
        
    off)
        # Clear state
        off_state='{"enabled":false,"containerId":null,"containerName":null,"containerImage":null,"directory":null}'
        
        write_state_file "$off_state"
        
        echo "✅ Devcontainer mode OFF"
        echo "Commands will run locally on WSL."
        ;;
        
    status)
        if [ "$ENABLED" = "true" ]; then
            # Validate container ID in state
            if [[ -n "$CURRENT_CONTAINER" ]] && ! validate_container_id "$CURRENT_CONTAINER"; then
                log_security "invalid_container_id_in_state" "id=$CURRENT_CONTAINER"
                echo "⚠️  Invalid container ID in state file"
                echo "Devcontainer mode: OFF (state corrupted)"
            else
                # Check container health
                if docker ps -q --filter "id=$CURRENT_CONTAINER" | grep -q "$CURRENT_CONTAINER"; then
                    CONTAINER_NAME=$(jq -r '.containerName // "unknown"' "$STATE_FILE")
                    CONTAINER_IMAGE=$(jq -r '.containerImage // "unknown"' "$STATE_FILE")
                    DIRECTORY=$(jq -r '.directory // "unknown"' "$STATE_FILE")
                    echo "Devcontainer mode: ON"
                    echo "Container: $CURRENT_CONTAINER ($CONTAINER_NAME)"
                    echo "Image: $CONTAINER_IMAGE"
                    echo "Directory: $DIRECTORY"
                    echo "Status: ✅ Running"
                else
                    echo "⚠️  Devcontainer mode: ON"
                    echo "Container: $CURRENT_CONTAINER"
                    echo "Status: ⚠️  Not running"
                fi
            fi
        else
            echo "Devcontainer mode: OFF"
        fi
        echo ""
        if command -v docker &> /dev/null; then
            show_containers
        else
            echo "docker not found in PATH; skipping container list."
        fi
        ;;
        
    list)
        show_containers
        ;;
        
    *)
        echo "Usage: $0 [on|off|status|list] [container]"
        echo ""
        echo "Commands:"
        echo "  on [container]    Enable container mode (auto-detect or specify container)"
        echo "  off               Disable container mode"
        echo "  status            Show current state and available containers"
        echo "  list              List all running devcontainers"
        echo ""
        echo "Container can be:"
        echo "  - Number (from list)"
        echo "  - Container ID"
        echo "  - Container name"
        exit 1
        ;;
esac
