# Agent Skills Manager

A Raycast extension for managing agent skills across multiple AI coding assistants (Cursor, Continue, Cline, and 40+ others).

## Features

- **Browse Skills**: Search and browse skills from the skills.sh catalog
- **Install Skills**: Install skills from skills.sh or GitHub repositories
- **Multi-Agent Support**: Install skills to multiple agents simultaneously
- **Manage Installed Skills**: View, update, and delete installed skills
- **Update Detection**: Git-based update detection using commit hash comparison
- **Flexible Installation**: Choose between symlink or copy installation modes
- **Scope Management**: Install skills globally or per-project

## Installation

### From Raycast Store
1. Open Raycast
2. Search for "Agent Skills Manager"
3. Click "Install"

### Manual Installation
1. Clone this repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Open Raycast → Extensions → Import Extension
5. Select this directory

## Usage

### Browse Skills
- Search for skills from the skills.sh catalog
- View install counts and descriptions
- See install status (Installed / Update Available / Not Installed)
- Click to install or update skills

### Install from GitHub
- Use the "Browse Skills" command
- Enter a GitHub repository URL when prompted
- Extension will discover skills in the repository
- Select agents and installation mode (symlink or copy)
- Choose scope (global or project)

### Installed Skills
- View all installed skills across all agents
- See which agents have each skill installed
- Check for updates (Git commit hash comparison)
- Reinstall skills to update to latest version
- Delete skills from specific agents or all agents

## Supported Agents

This extension supports 40+ AI coding assistants including:
- Cursor
- Continue
- Cline
- GitHub Copilot
- And many more...

See `src/agents.ts` for the complete list.

## How Update Detection Works

The extension uses Git commit hash comparison to detect updates:
1. When a skill is installed, the current Git commit hash is stored
2. On update check, the extension compares the stored hash with the latest commit hash from the remote repository
3. If hashes differ, an update is available

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run type-check

# Development mode (with hot reload)
npm run dev
```

## Architecture

- `src/agents.ts`: Agent detection and configuration
- `src/skills-api.ts`: skills.sh API client
- `src/repository-manager.ts`: GitHub cloning and skill discovery
- `src/installer.ts`: Skill installation (symlink/copy)
- `src/skill-registry.ts`: Lock file management
- `src/update-detector.ts`: Git-based update detection
- `src/commands/`: Raycast command implementations
  - `browse-skills.tsx`: Browse and search skills
  - `list-installed.tsx`: Manage installed skills
  - `install-flow.tsx`: Installation wizard

## Requirements

- macOS or Windows (Raycast for Windows is in beta)
- Node.js 18+ (for development)
- Git (for cloning repositories)

## Platform Support

This extension supports both macOS and Windows:
- **macOS**: Full support
- **Windows**: Full support (Raycast for Windows beta)

Note: Some agent-specific paths may differ between platforms, but the extension handles platform differences automatically.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
