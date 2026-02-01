# Implementation Summary

## Overview

This Raycast extension implements a unified interface for managing agent skills across 42+ supported AI coding assistants. It replicates the functionality of the `npx skills` CLI in a keyboard-first Raycast interface.

## Core Components

### 1. Agent Detection (`src/agents.ts`)
- Supports 42 agents (Cursor, Antigravity, Amp, Claude Code, etc.)
- Each agent has detection logic, project/global skill directories
- `detectInstalledAgents()` runs parallel detection
- Matches official CLI agent definitions exactly

### 2. Skills.sh API Client (`src/skills-api.ts`)
- `searchSkills()` - Search skills with query
- `fetchPopularSkills()` - Get popular skills (all-time/weekly/monthly)
- Transforms API responses to internal Skill format
- Handles owner/repo parsing from topSource field

### 3. Repository Manager (`src/repository-manager.ts`)
- `cloneRepository()` - Clone GitHub repos to temp directories
- `discoverSkills()` - Scan for SKILL.md files in common locations
- `cleanupTempDir()` - Safe cleanup with path validation
- Handles git clone errors (timeout, auth, etc.)

### 4. Installation Manager (`src/installer.ts`)
- `installSkillForAgent()` - Install skill to specific agent
- Supports symlink (recommended) and copy modes
- Symlink falls back to copy on failure (Windows, permissions)
- Path sanitization prevents directory traversal
- Canonical location: `~/.agents/skills/{skill-name}` or `./.agents/skills/{skill-name}`

### 5. Skill Registry (`src/skill-registry.ts`)
- Lock file management (`~/.agents/.skill-lock.json`)
- Tracks installed skills, source URLs, content hashes
- `listInstalledSkills()` - Scan canonical locations and detect agent installations
- Uses multiple strategies to match skills across agents (name matching, SKILL.md content)

### 6. Update Detection (`src/update-detector.ts`)
- Content-based update detection using SHA-256 hashing
- `computeInstalledSkillHash()` - Hash local skill content
- `computeRemoteSkillHash()` - Hash remote skill content
- `checkForUpdates()` - Compare hashes to detect changes
- No fake version numbers - honest "Update (changes detected)" messaging

## Raycast Commands

### Browse Skills (`src/commands/browse-skills.tsx`)
- Main entry point for browsing skills.sh catalog
- Search with 2+ character minimum
- Shows install status indicators (Install / Installed / Update available)
- Displays install counts and agent information
- Actions: Install, Update, Open in Browser

### List Installed (`src/commands/list-installed.tsx`)
- View all installed skills (project + global)
- Shows scope (project/global) and installed agents
- Actions: Reinstall, Delete from all agents, Delete from specific agent

### Install Skill (`src/commands/install-skill.ts`)
- Core installation logic
- Detects installed agents
- Pre-selects detected agents + last used agents
- Confirms installation with agent list
- Installs to multiple agents in parallel
- Updates lock file with content hash
- Saves selected agents for next time

## Key Features

### Multi-Agent Installation
- Install one skill to multiple agents simultaneously
- Symlink mode: single canonical location, symlinks to agent directories
- Copy mode: independent copies for each agent
- Automatic fallback from symlink to copy on failure

### Content-Based Updates
- No version numbers (skills.sh has no versioning)
- SHA-256 hash comparison detects content changes
- "Update (changes detected)" not "Update to vX.Y"
- Preserves agent targets and installation method

### Agent Detection
- 42 agents with specific detection logic
- Checks for agent-specific directories/config files
- Parallel detection for performance
- Some agents don't support global installation (e.g., Replit)

### Skill Discovery
- Scans for SKILL.md files in:
  - Root directory
  - `skills/` directory
  - `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
  - Agent-specific directories
- Handles internal skills (filtered by default)

## Installation Paths

### Canonical Location
- Project: `{cwd}/.agents/skills/{skill-name}`
- Global: `~/.agents/skills/{skill-name}` (or `~/.config/agents/skills/{skill-name}`)

### Agent-Specific Locations
- Project: `{cwd}/{agent.skillsDir}/{skill-name}`
- Global: `{agent.globalSkillsDir}/{skill-name}`

### Symlink Mode
- Files copied to canonical location
- Symlinks created from agent directories to canonical location
- Single source of truth, easier updates

## Error Handling

- Git clone errors (timeout, auth) with helpful messages
- Path validation prevents directory traversal
- Symlink failures fall back to copy automatically
- Graceful handling of missing directories/files
- Clear error messages in Raycast toasts

## Future Enhancements

- Multi-select UI for agent selection
- Multi-select UI for skill selection from repos
- Project vs Global scope selection UI
- Symlink vs Copy mode selection UI
- Update detection UI improvements
- Better handling of skill name mismatches
- Telemetry integration (optional)

## Dependencies

- `@raycast/api` - Raycast extension framework
- `simple-git` - Git operations
- `gray-matter` - Frontmatter parsing
- `xdg-basedir` - XDG config directory support

## Building

```bash
npm install
npm run build
npm run dev  # For Raycast development
```

## Notes

- Matches official CLI behavior exactly
- No fake version numbers - honest about unversioned skills
- Content-based updates only (no semantic versioning)
- Lock file format v3 (skillFolderHash support)
- Temp clones cleaned up immediately after installation
