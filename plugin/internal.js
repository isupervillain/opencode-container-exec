import { readFileSync, existsSync, mkdirSync, renameSync, openSync, writeSync, closeSync, chmodSync, lstatSync, realpathSync, mkdtempSync, rmSync, statSync } from "fs"
import { join, dirname, resolve, relative, isAbsolute } from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function getConfigDir() {
  return process.env.OPENCODE_CONFIG_DIR || join(process.env.HOME || "~", ".config/opencode")
}

function getStateFile() {
  return process.env.OPENCODE_CONTAINER_STATE_FILE || join(getConfigDir(), "container-mode.json")
}

function getTrustedConfigBase() {
  return resolve(process.env.HOME || "", ".config", "opencode")
}

function isPathWithin(basePath, targetPath) {
  const rel = relative(basePath, targetPath)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

function resolveTrustedStateFile() {
  const trustedBase = getTrustedConfigBase()
  const fallback = join(trustedBase, "container-mode.json")
  const requested = resolve(getStateFile())

  // Keep testability without allowing untrusted env-driven path redirects in production.
  if (process.env.NODE_ENV === "test") {
    return requested
  }

  if (!isPathWithin(trustedBase, requested)) {
    logSecurityEvent("untrusted_state_file_path", { requested, fallback })
    return fallback
  }

  return requested
}

function isSafeStateFile(pathToStateFile) {
  if (!existsSync(pathToStateFile)) return true

  const st = lstatSync(pathToStateFile)
  if (st.isSymbolicLink() || !st.isFile()) {
    return false
  }

  const mode = st.mode & 0o777
  return mode === 0o600
}

// Security logging (minimal, could be extended)
function logSecurityEvent(event, details) {
  // For now, just console.error in development
  // In production, this should write to a secure log file
  if (process.env.NODE_ENV === "development") {
    console.error(`[SECURITY] ${event}:`, details)
  }
}

// Auto-install command files on plugin load
async function installCommands(client) {
  try {
    if (!client?.path?.get) return

    const paths = await client.path.get()
    const configDir = paths.data?.config
    if (!configDir || typeof configDir !== "string") return

    // Restrict writes to user config root using canonical boundary checks
    const expectedBase = resolve(process.env.HOME || "", ".config", "opencode")
    if (!existsSync(expectedBase)) {
      mkdirSync(expectedBase, { recursive: true, mode: 0o700 })
    }

    // Reject symlinked config root paths
    if (existsSync(configDir)) {
      const configStat = lstatSync(configDir)
      if (configStat.isSymbolicLink()) return
    }

    const canonicalBase = realpathSync(expectedBase)
    const canonicalConfig = existsSync(configDir) ? realpathSync(configDir) : resolve(configDir)
    const rel = relative(canonicalBase, canonicalConfig)
    if (rel.startsWith("..")) return

    // Reject symlinked path segments under the trusted base (prevents symlink ancestor escapes)
    const relSegments = relative(canonicalBase, resolve(configDir)).split("/").filter(Boolean)
    let walk = canonicalBase
    for (const seg of relSegments) {
      walk = join(walk, seg)
      if (existsSync(walk)) {
        const st = lstatSync(walk)
        if (st.isSymbolicLink()) return
      }
    }

    // OpenCode docs use `commands/`, while some plugins historically used `command/`.
    // Install into both for maximum compatibility across versions.
    const commandDirs = [join(configDir, "commands"), join(configDir, "command")]

    const sourceFile = join(__dirname, "command", "container.md")
    if (!existsSync(sourceFile)) return

    for (const commandDir of commandDirs) {
      mkdirSync(commandDir, { recursive: true, mode: 0o700 })

      // Do not follow symlinked command directories
      const dirStat = lstatSync(commandDir)
      if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) continue

      const canonicalCommandDir = realpathSync(commandDir)
      const relCommand = relative(canonicalBase, canonicalCommandDir)
      if (relCommand.startsWith("..")) continue

      const destFile = join(commandDir, "container.md")

      // Avoid overwriting user-customized command file
      if (!existsSync(destFile)) {
        // Write using temp file + atomic rename
        const tempFile = `${destFile}.${process.pid}.${Date.now()}.tmp`
        const source = readFileSync(sourceFile, "utf8")
        const fd = openSync(tempFile, "wx", 0o600)
        writeSync(fd, source)
        closeSync(fd)
        chmodSync(tempFile, 0o600)
        renameSync(tempFile, destFile)
      } else {
        // Existing symlinked destination is unsafe; skip writing
        const existingStat = lstatSync(destFile)
        if (existingStat.isSymbolicLink()) continue
      }
    }
  } catch (error) {
    logSecurityEvent("command_install_failed", {
      error: error?.message?.substring(0, 200) || "unknown"
    })
    // This maintains backward compatibility with manual setup
  }
}

// Input validation functions
function validateContainerId(id) {
  // Docker container IDs are 64-character hex strings, short IDs are 12+ chars
  return /^[a-f0-9]{12,64}$/i.test(id)
}

function validateContainerName(name) {
  // Docker container names: alphanumeric, underscore, period, hyphen
  // Must start with alphanumeric, max 255 chars
  return typeof name === 'string' && 
         /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name) && 
         name.length <= 255
}

function validateCommand(command) {
  // Basic command validation
  if (typeof command !== 'string') return false
  if (command.length > 10000) return false // Reasonable limit
  // Add more validation as needed
  return true
}

function validateSelection(selection) {
  if (!selection) return true // Empty selection is allowed (auto-detect)
  if (typeof selection !== 'string') return false
  if (selection.length > 255) return false
  
  // Allow numbers, container IDs, or container names
  if (/^\d+$/.test(selection)) return true // Number
  if (/^[a-f0-9]{12,64}$/i.test(selection)) return true // Container ID
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(selection)) return true // Container name
  
  return false
}

function validateWindowsPath(path) {
  // Validate path doesn't contain dangerous characters
  if (typeof path !== 'string') return false
  if (path.length > 4096) return false // Reasonable path length limit
  // Allow backslashes, colons, alphanumeric, dots, slashes, underscores, hyphens, spaces
  return /^[a-zA-Z0-9_\-./\\: ]+$/.test(path)
}

// State management with secure file operations
function getState() {
  try {
    const STATE_FILE = resolveTrustedStateFile()
    if (!existsSync(STATE_FILE)) {
      return { enabled: false, containerId: null, containerName: null, containerImage: null, directory: null }
    }

    if (!isSafeStateFile(STATE_FILE)) {
      logSecurityEvent('unsafe_state_file_rejected', { path: STATE_FILE })
      return { enabled: false, containerId: null, containerName: null, containerImage: null, directory: null }
    }

    // Re-check mode with stat to ensure no broadened permissions are trusted.
    const fileMode = statSync(STATE_FILE).mode & 0o777
    if (fileMode !== 0o600) {
      logSecurityEvent('insecure_state_file_permissions', { path: STATE_FILE, mode: fileMode.toString(8) })
      return { enabled: false, containerId: null, containerName: null, containerImage: null, directory: null }
    }
    
    const content = readFileSync(STATE_FILE, "utf8")
    const parsed = JSON.parse(content)
    
    // Validate state structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid state structure')
    }
    
    // Ensure all required fields exist with correct types
    const validatedState = {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
      containerId: typeof parsed.containerId === 'string' || parsed.containerId === null ? parsed.containerId : null,
      containerName: typeof parsed.containerName === 'string' || parsed.containerName === null ? parsed.containerName : null,
      containerImage: typeof parsed.containerImage === 'string' || parsed.containerImage === null ? parsed.containerImage : null,
      directory: typeof parsed.directory === 'string' || parsed.directory === null ? parsed.directory : null
    }
    
    // Validate container ID if present
    if (validatedState.containerId && !validateContainerId(validatedState.containerId)) {
      logSecurityEvent('invalid_container_id_in_state', { containerId: validatedState.containerId })
      validatedState.containerId = null
    }
    
    // Validate container name if present
    if (validatedState.containerName && !validateContainerName(validatedState.containerName)) {
      logSecurityEvent('invalid_container_name_in_state', { containerName: validatedState.containerName })
      validatedState.containerName = null
    }
    
    return validatedState
  } catch (error) {
    logSecurityEvent('state_file_read_error', { error: error.message })
    // Return default state on any error
    return { enabled: false, containerId: null, containerName: null, containerImage: null, directory: null }
  }
}

function setState(state) {
  let tempDir = null
  try {
    const STATE_FILE = resolveTrustedStateFile()
    const dir = dirname(STATE_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
    }

    const dirStats = lstatSync(dir)
    if (dirStats.isSymbolicLink() || !dirStats.isDirectory()) {
      throw new Error('Unsafe config directory path')
    }

    if (process.env.NODE_ENV !== 'test') {
      const trustedBase = getTrustedConfigBase()
      const canonicalDir = realpathSync(dir)
      if (!isPathWithin(trustedBase, canonicalDir)) {
        throw new Error('State file directory is outside trusted config boundary')
      }
    }
    
    // Validate state before writing
    if (typeof state !== 'object' || state === null) {
      throw new Error('Invalid state object')
    }
    
    // Ensure all fields are valid
    const validatedState = {
      enabled: typeof state.enabled === 'boolean' ? state.enabled : false,
      containerId: typeof state.containerId === 'string' || state.containerId === null ? state.containerId : null,
      containerName: typeof state.containerName === 'string' || state.containerName === null ? state.containerName : null,
      containerImage: typeof state.containerImage === 'string' || state.containerImage === null ? state.containerImage : null,
      directory: typeof state.directory === 'string' || state.directory === null ? state.directory : null
    }
    
    // Write to temporary file in a unique temp directory, then atomic rename.
    tempDir = mkdtempSync(join(dir, '.container-mode-'))
    chmodSync(tempDir, 0o700)
    const tempFile = join(tempDir, 'state.json')
    const fd = openSync(tempFile, 'wx', 0o600)
    writeSync(fd, JSON.stringify(validatedState, null, 2))
    closeSync(fd)
    
    // Set restrictive permissions
    chmodSync(tempFile, 0o600)
    
    if (existsSync(STATE_FILE)) {
      const existing = lstatSync(STATE_FILE)
      if (existing.isSymbolicLink() || !existing.isFile()) {
        throw new Error('Unsafe existing state file path')
      }
    }

    // Atomic rename
    renameSync(tempFile, STATE_FILE)
  } catch (error) {
    logSecurityEvent('state_file_write_error', { error: error.message })
    throw error
  } finally {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

// Helper to run shell commands with better error handling
function runCommand(cmd, options = {}) {
  try {
    // Validate command length
    if (cmd.length > 10000) {
      logSecurityEvent('command_too_long', { length: cmd.length })
      return ""
    }
    
    return execSync(cmd, { 
      encoding: "utf8", 
      timeout: options.timeout || 30000,
      stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr
    }).trim()
  } catch (error) {
    // Log error but don't expose sensitive information
    logSecurityEvent('command_execution_failed', {
      command: cmd.substring(0, 100), // Log first 100 chars only
      error: error.message.substring(0, 200),
      timestamp: new Date().toISOString()
    })
    return ""
  }
}

// Check if required dependencies are installed
function checkDependencies() {
  const missing = []
  
  try {
    execSync('docker --version', { encoding: 'utf8', stdio: 'pipe' })
  } catch (error) {
    missing.push('docker')
  }
  
  try {
    execSync('devcontainer --version', { encoding: 'utf8', stdio: 'pipe' })
  } catch (error) {
    missing.push('devcontainer')
  }
  
  return missing
}

// Convert WSL path to Windows format with validation
function getWindowsPath(dir) {
  // Validate directory path
  if (typeof dir !== 'string' || !dir.startsWith('/')) {
    logSecurityEvent('invalid_directory_path', { dir })
    return null
  }
  
  const distro = process.env.WSL_DISTRO_NAME || "Ubuntu"
  
  // Validate distro name
  if (!/^[a-zA-Z0-9_-]+$/.test(distro)) {
    logSecurityEvent('invalid_distro_name', { distro })
    return null
  }
  
  const winPath = `\\\\wsl.localhost\\${distro}${dir}`.replace(/\//g, "\\")
  
  // Validate the resulting path
  if (!validateWindowsPath(winPath)) {
    logSecurityEvent('invalid_windows_path', { winPath })
    return null
  }
  
  return winPath
}

// Check if container is still running and healthy
function isContainerHealthy(containerId) {
  if (!validateContainerId(containerId)) {
    return false
  }
  
  const status = runCommand(`docker inspect --format '{{.State.Status}}' ${containerId}`)
  return status === 'running'
}

// Find container by various selection methods with input validation
function findContainer(selection, currentDir) {
  // Validate selection input
  if (!validateSelection(selection)) {
    logSecurityEvent('invalid_selection_input', { selection })
    return { error: `Invalid selection: ${selection}` }
  }
  
  const containers = runCommand('docker ps --filter "label=devcontainer.local_folder" --format "{{.ID}}"')
    .split("\n")
    .filter(id => id.trim())
  
  if (containers.length === 0) {
    return { error: "No running devcontainers found. Make sure VSCode has opened a directory in a devcontainer." }
  }
  
  // If no selection, try auto-detect from current directory
  if (!selection) {
    const winPath = getWindowsPath(currentDir)
    if (!winPath) {
      return { error: "Invalid directory path for auto-detection" }
    }
    
    const autoContainer = runCommand(`docker ps -q --filter "label=devcontainer.local_folder=${winPath}"`)
      .split("\n")
      .map(id => id.trim())
      .filter(Boolean)

    if (autoContainer.length === 1) {
      return { containerId: autoContainer[0] }
    }
    if (autoContainer.length > 1) {
      return { error: "Multiple matching containers found for current directory. Use 'list' and select by number." }
    }
    return { error: "No devcontainer found for current directory. Use 'list' to see available containers." }
  }
  
  // Check if selection is a number
  if (/^\d+$/.test(selection)) {
    const index = parseInt(selection) - 1
    if (index >= 0 && index < containers.length) {
      return { containerId: containers[index] }
    }
    return { error: `Invalid selection: ${selection}. Use 'list' to see available containers.` }
  }
  
  // Check if selection is a container ID (12+ hex chars)
  if (/^[a-f0-9]{12,64}$/i.test(selection)) {
    const exists = runCommand(`docker ps -q --filter "id=${selection}"`)
      .split("\n")
      .map(id => id.trim())
      .filter(Boolean)
    if (exists.length > 0) {
      return { containerId: selection }
    }
    return { error: `Container not found: ${selection}` }
  }
  
  // Check if selection is a container name (validated)
  if (validateContainerName(selection)) {
    const nameContainer = runCommand(`docker ps -q --filter "name=${selection}"`)
      .split("\n")
      .map(id => id.trim())
      .filter(Boolean)

    if (nameContainer.length === 1) {
      return { containerId: nameContainer[0] }
    }
    if (nameContainer.length > 1) {
      return { error: `Multiple containers matched name: ${selection}. Use list and select by number.` }
    }
  }
  
  return { error: `Invalid selection: ${selection}` }
}

// Get container info with validation
function getContainerInfo(containerId) {
  if (!validateContainerId(containerId)) {
    logSecurityEvent('invalid_container_id_for_info', { containerId })
    return { name: "unknown", image: "unknown" }
  }
  
  const name = runCommand(`docker inspect --format '{{.Name}}' ${containerId}`).replace(/^\//, "")
  const image = runCommand(`docker inspect --format '{{.Config.Image}}' ${containerId}`)
  
  return { 
    name: name || "unknown", 
    image: image || "unknown" 
  }
}

// List all running devcontainers
function listContainers() {
  const output = runCommand('docker ps --filter "label=devcontainer.local_folder" --format "{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}"')
  if (!output) {
    return "No running devcontainers found."
  }
  
  const state = getState()
  let result = "Running devcontainers:\n\n"
  result += "#   CONTAINER ID   NAME                  IMAGE                         STATUS\n"
  result += "--------------------------------------------------------------------------------\n"
  
  output.split("\n").forEach((line, index) => {
    if (line.trim()) {
      const [id, name, image, status] = line.split("\t")
      const marker = state.containerId === id && state.enabled ? " *" : ""
      result += `${index + 1}   ${id.substring(0, 12)}   ${(name || "unknown").substring(0, 20).padEnd(20)} ${(image || "unknown").substring(0, 28).padEnd(28)} ${status}${marker}\n`
    }
  })
  
  result += "\n* = currently selected\n"
  return result
}

export {
  getConfigDir,
  getStateFile,
  logSecurityEvent,
  installCommands,
  validateContainerId,
  validateContainerName,
  validateCommand,
  validateSelection,
  validateWindowsPath,
  getState,
  setState,
  runCommand,
  checkDependencies,
  getWindowsPath,
  isContainerHealthy,
  findContainer,
  getContainerInfo,
  listContainers,
}
