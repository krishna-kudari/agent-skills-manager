# Agent Skills Manager - Raycast Extension

A Raycast extension for managing agent skills across multiple AI coding assistants.

## Features

- **Browse Skills**: Search and browse skills from skills.sh
- **Install Skills**: Install skills from skills.sh or GitHub repositories
- **Multi-Agent Support**: Install skills to multiple agents simultaneously
- **Manage Installed Skills**: View, update, and delete installed skills
- **Update Detection**: Content-based update detection using hash comparison

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Open Raycast and import the extension

## Usage

### Browse Skills
- Search for skills from the skills.sh catalog
- View install counts and descriptions
- See install status for each skill

### Install from GitHub
- Enter a GitHub repository URL
- Extension will discover skills in the repository
- Select agents and install

### Installed Skills
- View all installed skills
- See which agents have each skill installed
- Update or delete skills

## Development

```bash
# Build
npm run build

# Type check
npm run type-check

# Development mode
npm run dev
```

## Architecture

- `src/agents.ts`: Agent detection and configuration
- `src/skills-api.ts`: skills.sh API client
- `src/repository-manager.ts`: GitHub cloning and skill discovery
- `src/installer.ts`: Skill installation (symlink/copy)
- `src/skill-registry.ts`: Lock file management
- `src/update-detector.ts`: Content-based update detection
- `src/commands/`: Raycast command implementations
