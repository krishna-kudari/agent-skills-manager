# Design

## Architecture Overview

Raycast extension that replicates the `npx skills` CLI experience:
- Browse skills from skills.sh or install from GitHub repositories
- Clone repositories to discover skills
- Detect available agents (~40+)
- Multi-agent installation via symlinks
- Unified installation path: `~/.agents/skills/{skill-name}`

## Data Model

### Skill
```typescript
{
  id: string                    // Full ID: "owner/repo/skillId" or "skillId"
  name: string
  description: string
  source: "skills.sh" | "github"
  repositoryUrl?: string        // GitHub repo URL if from GitHub
  installCommand: string         // "npx skills add {source}@{id}"
}
```

### InstalledSkill
```typescript
{
  skillId: string
  skillName: string
  sourceRepository: string       // GitHub repo URL or skills.sh source
  installPath: string            // "~/.agents/skills/{skill-name}"
  agents: string[]               // Agent IDs where installed
  installationMethod: "symlink" | "copy"
  installedAt: timestamp
  contentHash: string           // SHA-256 hash of skill content at install time
  gitCommitHash?: string         // Git commit hash if from GitHub repo
}
```

### Agent Configuration
```typescript
{
  name: string                   // Internal ID: "cursor", "antigravity", "amp"
  displayName: string            // Display name: "Cursor", "Antigravity", "Amp"
  skillsDir: string              // Project-level: ".cursor/skills", ".agent/skills"
  globalSkillsDir?: string       // Global: "~/.cursor/skills" or undefined if not supported
  detectInstalled: () => Promise<boolean>  // Detection function
}
```

## Agent Detection System

**Detection Logic**:
- Each agent has a `detectInstalled()` async function
- Checks for agent-specific directories/config files:
  - Cursor: `~/.cursor` exists
  - Antigravity: `.agent` in cwd OR `~/.gemini/antigravity` exists
  - Amp: `~/.config/amp` exists
  - Codex: `~/.codex` OR `/etc/codex` exists
  - And specific logic for each of 42 agents
- `detectInstalledAgents()` runs all detection functions in parallel
- Returns array of `AgentType[]` for installed agents

**Agent Registry**:
- Maintained in `agents.ts` with all 42 agent definitions
- Each agent has specific paths and detection logic
- Some agents support global installation, others don't (e.g., `replit` is project-only)

## Installation System

**Canonical Skills Directory**:
- Project: `{cwd}/.agents/skills/{skill-name}`
- Global: `~/.agents/skills/{skill-name}` (or `~/.config/agents/skills/{skill-name}` on some systems)

**Installation Methods**:

1. **Symlink (Recommended)**:
   - Copy skill files to canonical location
   - Create symlinks from agent directories to canonical location
   - Example (Global):
     - Canonical: `~/.agents/skills/vercel-react-best-practices/`
     - Symlink: `~/.cursor/skills/vercel-react-best-practices` → `~/.agents/skills/vercel-react-best-practices`
   - Falls back to copy if symlink creation fails (Windows, permissions, etc.)
   - Single source of truth, easier updates

2. **Copy**:
   - Copy skill files directly to each agent's directory
   - No canonical location
   - Independent copies for each agent

**Installation Scope**:
- **Project**: Installed in current working directory (committed with project)
- **Global**: Installed in home directory (available across all projects)
- Some agents don't support global installation (e.g., `replit`)

**Skill Name Sanitization**:
- Convert to kebab-case
- Remove special characters, prevent path traversal
- Limit to 255 characters
- Fallback to "unnamed-skill" if empty

## Data Flow

### Browse Skills from skills.sh
1. Fetch from skills.sh API (`/api/search` or `/api/skills`)
2. Cache locally for offline access
3. Resolve install state per agent
4. Display with indicators showing installed agents

### Install from GitHub Repo
1. User provides GitHub repo URL (e.g., `vercel-labs/agent-skills` or full URL)
2. Parse source (may include ref, subpath, skill filter: `owner/repo@skill-name`)
3. Clone repository to temp location (with optional ref/branch)
4. Discover skills by scanning for `SKILL.md` files:
   - Root directory
   - `skills/` directory
   - `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
   - Agent-specific directories
5. If multiple skills: user multi-selects skills to install
6. Detect installed agents using `detectInstalledAgents()`
7. Agent selection:
   - If no agents detected: show all agents for selection
   - If 1 agent: auto-select (show which agent)
   - If multiple: show detected agents pre-selected, allow changes
   - Multi-select with fuzzy search (pre-selects last used agents from lock file)
8. Choose installation scope (Project/Global) - only if agent supports global
9. Choose installation method (Symlink/Copy)
10. Check for overwrites (parallel check for each skill+agent combination)
11. Show installation summary:
    - Canonical path: `~/.agents/skills/{skill-name}` or `./.agents/skills/{skill-name}`
    - Symlink targets: Agent names (if symlink mode)
    - Overwrite warnings: Which agents will have skills replaced
12. User confirms
13. Install skill:
    - Symlink mode: Copy to canonical location, create symlinks to agent directories
    - Copy mode: Copy directly to each agent directory
    - Handle symlink failures (fallback to copy)
14. Track in lock file (for global installs only)
15. Clean up temp clone
16. Show success summary with installed paths and symlink status

### Install Flow (from skills.sh)
1. User selects skill from skills.sh
2. Resolve skill source (may need to fetch from GitHub)
3. Follow GitHub install flow (steps 2-14 above)

### Update Flow (Content-Based)

**Update Detection**:
1. Compute hash of installed skill content: `localHash = sha256(localSkillContent)`
2. Fetch remote skill content
3. Compute hash of remote skill content: `remoteHash = sha256(remoteSkillContent)`
4. If `remoteHash !== localHash` → update available

**Update Execution**:
1. Detect installed skill and source repository
2. Backup current installation
3. Fetch latest content from source:
   - For GitHub repos: `git fetch` and `git pull` (if git-backed)
   - For skills.sh: fetch latest skill definition
4. Compute new content hash
5. Reinstall skill content to `~/.agents/skills/{skill-name}`:
   - Overwrite existing files
   - Preserve symlink targets (agents)
   - Preserve installation method
6. Validate installation
7. Update registry with new content hash
8. Rollback on failure (restore backup)

### Delete Flow
1. Detect skill installation and all agent targets
2. Show which agents will be affected
3. Warn if shared across multiple agents
4. User confirms deletion
5. Remove symlinks from agent directories
6. If no agents remain, remove `~/.agents/skills/{skill-name}` directory
7. Update registry

## State Management

Local registry tracks:
- Installed skills per agent
- Source repositories
- Installation methods (symlink/copy)
- Install timestamps
- Content hashes (SHA-256) for change detection
- Git commit hashes (if applicable)

Used for:
- Fast state resolution
- Offline indicator display
- Update detection (hash comparison)
- Multi-agent awareness

## Update Detection Strategy

**Content-Based (Primary)**:
- Compute SHA-256 hash of installed skill content
- Compute SHA-256 hash of remote skill content
- Compare: `if (remoteHash !== localHash) → UPDATE_AVAILABLE`
- Deterministic and works immediately
- No dependency on skills.sh versioning

**Git-Based (For GitHub Repos)**:
- Store commit hash at install time
- On update check: `git fetch` and compare commits
- `git diff` to see changes
- `git pull` to update
- Only works for Git-backed skills

**UI States**:
- `NOT_INSTALLED` → 🟢 Install
- `INSTALLED_SAME_HASH` → ⚪ Installed
- `INSTALLED_DIFFERENT_HASH` → 🔵 Update (changes detected)

## Repository Management

- Clone GitHub repos to temp locations
- Discover skills by scanning repository structure
- Support pulling updates for installed skills
- Clean up temp clones after installation

## Error Handling

- Schema validation before writes
- Config backups before modifications
- Atomic operations with rollback
- Clear, actionable error messages
- Graceful degradation on API failures

## Extensibility

New agents detected automatically by:
1. Scanning common agent directories
2. Checking for agent-specific config files
3. Supporting custom agent paths via configuration

Agent registry can be extended with:
- Custom agent definitions
- Custom install paths
- Agent-specific skill formats (if needed)
