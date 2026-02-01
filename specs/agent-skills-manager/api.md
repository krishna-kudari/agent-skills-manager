# API Contracts

## skills.sh API

**Base URL**: `https://skills.sh`

### Search Skills
**Endpoint**: `GET /api/search?q={query}&limit={limit}`

**Query Parameters**:
- `q` (required): Search query string (minimum 2 characters)
- `limit` (optional): Number of results to return (default: 10, recommended: 50)

**Response**:
```typescript
{
  query: string
  searchType: string
  skills: SearchSkill[]
  count: number
  duration_ms: number
}

interface SearchSkill {
  id: string
  name: string
  installs: number
  topSource: string | null  // Format: "owner/repo" (e.g., "anthropics/skills")
}
```

**Notes**:
- Returns empty array if query length < 2
- Uses same endpoint as `npx skills find` CLI

### Fetch Popular Skills
**Endpoint**: `GET /api/skills?limit={limit}&sort={sort}`

**Query Parameters**:
- `limit` (optional): Number of results to return (default: 10, recommended: 50)
- `sort` (optional): Sort order - `"all-time"` | `"weekly"` | `"monthly"` (default: `"all-time"`)

**Response**:
```typescript
{
  skills: SearchSkill[]
  hasMore: boolean
}
```

### Skill Model (Transformed)
After transformation from API response:
```typescript
interface Skill {
  id: string                    // Full ID: "owner/repo/skillId" or "skillId"
  name: string
  description: string           // Empty in search results, populated from details endpoint
  owner: string                 // Parsed from topSource
  repo: string                  // Parsed from topSource
  installCount: number          // From installs field
  installCommand: string        // "npx skills add {source}@{id}" or "npx skills add {id}"
  url: string                   // "https://skills.sh/{source}/{id}" or "https://skills.sh/{id}"
  repositoryUrl?: string        // "https://github.com/{source}" if source exists
  tags: string[]
}
```

### Skill URL Structure
- With source: `https://skills.sh/{owner}/{repo}/{skillId}`
- Without source: `https://skills.sh/{skillId}`

## Internal Extension APIs

### Agent Detection Interface

```typescript
interface AgentDetector {
  detectInstalledAgents(): Promise<AgentType[]>
  getAgentConfig(type: AgentType): AgentConfig
  getAllAgents(): AgentConfig[]
}

interface AgentConfig {
  name: string                   // Internal ID: "cursor", "antigravity"
  displayName: string           // Display name: "Cursor", "Antigravity"
  skillsDir: string              // Project-level: ".cursor/skills"
  globalSkillsDir?: string      // Global: "~/.cursor/skills" or undefined
  detectInstalled: () => Promise<boolean>  // Detection function
}

type AgentType = 
  | 'amp' | 'antigravity' | 'augment' | 'claude-code' | 'openclaw'
  | 'cline' | 'codebuddy' | 'codex' | 'command-code' | 'continue'
  | 'crush' | 'cursor' | 'droid' | 'gemini-cli' | 'github-copilot'
  | 'goose' | 'iflow-cli' | 'junie' | 'kilo' | 'kimi-cli'
  | 'kiro-cli' | 'kode' | 'mcpjam' | 'mistral-vibe' | 'mux'
  | 'neovate' | 'opencode' | 'openhands' | 'pi' | 'qoder'
  | 'qwen-code' | 'replit' | 'roo' | 'trae' | 'trae-cn'
  | 'windsurf' | 'zencoder' | 'openclaude' | 'pochi' | 'adal'
```

### Repository Manager Interface

```typescript
interface RepositoryManager {
  cloneRepository(url: string, ref?: string): Promise<string>  // Returns temp path
  discoverSkills(
    repoPath: string, 
    subpath?: string,
    options?: { includeInternal?: boolean; fullDepth?: boolean }
  ): Promise<Skill[]>
  cleanup(tempDir: string): Promise<void>
}

interface Skill {
  name: string
  description: string
  path: string                    // Absolute path to skill directory
  rawContent?: string            // Raw SKILL.md content for hashing
  metadata?: Record<string, unknown>
}
```

### Installation Manager Interface

```typescript
interface InstallationManager {
  installSkillForAgent(
    skill: Skill,
    agentType: AgentType,
    options: {
      global?: boolean
      cwd?: string
      mode?: InstallMode
    }
  ): Promise<InstallResult>
  
  installRemoteSkillForAgent(
    skill: RemoteSkill,
    agentType: AgentType,
    options: {
      global?: boolean
      cwd?: string
      mode?: InstallMode
    }
  ): Promise<InstallResult>
  
  isSkillInstalled(
    skillName: string,
    agentType: AgentType,
    options: { global?: boolean; cwd?: string }
  ): Promise<boolean>
  
  getCanonicalPath(
    skillName: string,
    options: { global?: boolean; cwd?: string }
  ): string
  
  getInstallPath(
    skillName: string,
    agentType: AgentType,
    options: { global?: boolean; cwd?: string }
  ): string
}

type InstallMode = "symlink" | "copy"

interface InstallResult {
  success: boolean
  path: string                    // Agent-specific path
  canonicalPath?: string          // Canonical path (if symlink mode)
  mode: InstallMode
  symlinkFailed?: boolean         // True if symlink failed and fell back to copy
  error?: string
}

interface RemoteSkill {
  name: string
  description: string
  content: string                 // Full SKILL.md content
  installName: string             // Directory name for installation
  sourceUrl: string
  providerId: string              // "github", "mintlify", "well-known"
  sourceIdentifier: string        // e.g., "vercel-labs/agent-skills"
  metadata?: Record<string, unknown>
}
```

### Update Detection Interface

```typescript
interface UpdateDetector {
  checkForUpdates(skillName: string): Promise<UpdateStatus>
  computeContentHash(content: string): Promise<string>
  compareHashes(localHash: string, remoteHash: string): boolean
}

interface UpdateStatus {
  skillName: string
  hasUpdate: boolean
  updateType: "content" | "git" | "none"
  localHash: string
  remoteHash: string
  gitCommitDiff?: string  // If git-backed
}
```

### Skill Registry Interface

```typescript
interface SkillRegistry {
  listInstalledSkills(options?: {
    global?: boolean
    cwd?: string
    agentFilter?: AgentType[]
  }): Promise<InstalledSkill[]>
  
  addSkillToLock(
    skillName: string,
    metadata: {
      source: string
      sourceType: string
      sourceUrl: string
      skillPath?: string
      skillFolderHash: string
    }
  ): Promise<void>
  
  getLastSelectedAgents(): Promise<string[] | undefined>
  saveSelectedAgents(agents: string[]): Promise<void>
}

interface InstalledSkill {
  name: string
  description: string
  path: string                    // Canonical path
  canonicalPath: string          // Same as path (for compatibility)
  scope: "project" | "global"
  agents: AgentType[]            // Agents that have this skill installed
}
```

## Request/Response Schemas

### Install Skill Request
```typescript
{
  skill: Skill | string        // Skill object or GitHub repo URL
  skillName?: string           // Required if repo URL provided
  agents: string[]             // Agent IDs (multi-select)
  method: "symlink" | "copy"   // Installation method
  scope: "global"              // Installation scope
}
```

### Update Skill Request
```typescript
{
  skillName: string            // Installed skill name
  updateMethod?: "content" | "git" | "reinstall"  // Default: auto-detect
}
```

### Check Update Status Request
```typescript
{
  skillName: string            // Installed skill name
}
```

### Check Update Status Response
```typescript
{
  skillName: string
  status: "not_installed" | "up_to_date" | "update_available"
  localHash: string
  remoteHash: string
  hasChanges: boolean
  updateMethod: "content" | "git" | "reinstall"
}
```

### Delete Skill Request
```typescript
{
  skillName: string
  agents?: string[]            // If undefined, delete from all agents
}
```

### GitHub Repo Install Request
```typescript
{
  repoUrl: string              // e.g., "https://github.com/vercel-labs/agent-skills"
  skillName: string            // Skill name within repo
  agents: string[]
  method: "symlink" | "copy"
}
```
