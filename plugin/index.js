import { tool } from "@opencode-ai/plugin"
import {
  installCommands,
  checkDependencies,
  getState,
  setState,
  isContainerHealthy,
  validateCommand,
  logSecurityEvent,
  listContainers,
  validateSelection,
  findContainer,
  getContainerInfo,
} from "./internal.js"

// Main plugin export
export const ContainerExecPlugin = async ({ project, client, $, directory, worktree }) => {
  // Install commands on load (non-blocking)
  setTimeout(() => installCommands({ client, directory }), 0)
  
  // Check dependencies on plugin load
  const missingDeps = checkDependencies()
  if (missingDeps.length > 0) {
    console.error(`Warning: Missing dependencies: ${missingDeps.join(', ')}`)
    console.error('Plugin functionality may be limited')
  }
  
  return {
    // Custom tools
    tool: {
      // Override bash tool to route commands to container
      bash: tool({
        description: () => {
          const state = getState()
          if (state.enabled && state.containerId) {
            // Check container health
            if (!isContainerHealthy(state.containerId)) {
              return "⚠️ Container is not running. Use 'container on' to select a new container."
            }
            
            const containerInfo = state.containerName || state.containerId.substring(0, 12)
            return `Execute shell commands in devcontainer [🐳 ${containerInfo}]`
          }
          return "Execute shell commands locally on WSL"
        },
        args: {
          command: tool.schema.string().describe("Shell command to execute"),
          timeout: tool.schema.number().optional().describe("Timeout in milliseconds"),
        },
        async execute(args) {
          const state = getState()
          
          // Validate command input
          if (!validateCommand(args.command)) {
            return "❌ Invalid command: Command is too long or contains invalid characters"
          }
          
          if (state.enabled && state.containerId) {
            const missingDeps = checkDependencies()
            if (missingDeps.length > 0) {
              return `❌ Missing required dependencies for container execution: ${missingDeps.join(', ')}\nRun 'container off' to switch back to local execution.`
            }

            // Check container health before executing
            if (!isContainerHealthy(state.containerId)) {
              return "❌ Container is not running. Please select a new container with 'container on'."
            }
            
            const containerInfo = state.containerName || state.containerId.substring(0, 12)
            
            // Use devcontainer exec with proper argument handling
            // The $ template tag should handle argument escaping
            try {
              const result = await $`devcontainer exec --container-id ${state.containerId} bash -c ${args.command}`.text()
              return `[🐳 ${containerInfo}] ${result}`
            } catch (error) {
              logSecurityEvent("container_command_failed", { error: error?.message?.substring(0, 200) || "unknown" })
              return `❌ Failed to execute command in container: ${error?.message || "unknown error"}`
            }
          } else {
            try {
              const result = await $`bash -c ${args.command}`.text()
              return result
            } catch (error) {
              logSecurityEvent("local_command_failed", { error: error?.message?.substring(0, 200) || "unknown" })
              return `❌ Failed to execute local command: ${error?.message || "unknown error"}`
            }
          }
        },
      }),
      
      // Container toggle tool
      container: tool({
        description: "Toggle devcontainer mode on/off for running commands inside a container",
        args: {
          action: tool.schema.enum(["on", "off", "status", "list"]).describe("Action: on, off, status, or list"),
          selection: tool.schema.string().optional().describe("Container selection: number, ID, or name"),
        },
        async execute(args) {
          // Allow recovery/status paths even if dependencies are missing
          const missingDeps = checkDependencies()
          const requiresDeps = args.action === "on" || args.action === "list"
          if (requiresDeps && missingDeps.length > 0) {
            return `❌ Missing required dependencies: ${missingDeps.join(', ')}\nPlease install Docker and devcontainer CLI before using this action.`
          }

          const state = getState()
          
          if (args.action === "status") {
            if (state.enabled && state.containerId) {
              // Check container health
              const healthy = isContainerHealthy(state.containerId)
              const healthStatus = healthy ? "✅ Running" : "⚠️ Not running"
              
              return `✅ Devcontainer mode: ON\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐳 Container: ${state.containerName || state.containerId}\n📦 Image: ${state.containerImage || "unknown"}\n📁 Directory: ${state.directory || "unknown"}\n🔄 Status: ${healthStatus}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAll bash commands are running inside this container.\nUse 'off' to disable container mode.`
            } else {
              return `ℹ️  Devcontainer mode: OFF\n\nCommands are running locally on WSL.\nUse 'on' to enable container mode.`
            }
          }
          
          if (args.action === "list") {
            return listContainers()
          }
          
          if (args.action === "on") {
            // Validate selection input
            if (args.selection && !validateSelection(args.selection)) {
              return "❌ Invalid selection format. Use a number, container ID, or container name."
            }
            
            const result = findContainer(args.selection, directory)
            if (result.error) {
              return `❌ ${result.error}`
            }
            
            // Check container health
            if (!isContainerHealthy(result.containerId)) {
              return "❌ Selected container is not running. Please choose a different container."
            }
            
            const info = getContainerInfo(result.containerId)
            setState({
              enabled: true,
              containerId: result.containerId,
              containerName: info.name,
              containerImage: info.image,
              directory: directory
            })
            
            return `✅ Devcontainer mode ON\nContainer: ${result.containerId} (${info.name})\nImage: ${info.image}\nAll bash commands will now run inside the devcontainer.`
          }
          
          if (args.action === "off") {
            setState({
              enabled: false,
              containerId: null,
              containerName: null,
              containerImage: null,
              directory: null
            })
            
            return "✅ Devcontainer mode OFF\nCommands will run locally on WSL."
          }
          
          return "Invalid action. Use 'on', 'off', 'status', or 'list'."
        },
      }),
    },
  }
}

export default ContainerExecPlugin
