# Requirements

## Problem Statement

Developers use AI agents, IDEs, CLIs, and desktop tools with skills/plugins/configs in different formats and locations. Managing these skills is fragmented, manual, error-prone, and tool-specific.

## Solution

Raycast extension providing unified keyboard-first interface to discover, install, track, update, and delete agent skills across supported tools.

## Goals

- Single interface to discover + manage agent skills
- Zero-context switching (Raycast native UX)
- Safe installs with clear visibility
- Support multiple clients with different formats

## Non-Goals

- Executing skills
- Authoring skills
- Hosting skills (source of truth remains skills.sh)

## Target Users

AI-first developers and power users of IDEs (Cursor, VS Code), AI agents (Claude Code, local agents), CLI-based AI tools, and Raycast.

## Supported Agents

The CLI supports 40+ agents (exact count: 42). Each agent has:
- **Internal ID**: e.g., `cursor`, `antigravity`, `amp`, `claude-code`
- **Display Name**: e.g., "Cursor", "Antigravity", "Amp", "Claude Code"
- **Project Skills Directory**: e.g., `.cursor/skills`, `.agent/skills`, `.agents/skills`
- **Global Skills Directory**: e.g., `~/.cursor/skills`, `~/.gemini/antigravity/global_skills` (some agents don't support global)
- **Detection Function**: Checks for agent-specific directories/config files

**Common Agents**:
- Cursor: `.cursor/skills` (project), `~/.cursor/skills` (global)
- Antigravity: `.agent/skills` (project), `~/.gemini/antigravity/global_skills` (global)
- Amp: `.agents/skills` (project), `~/.config/agents/skills` (global)
- Claude Code: `.claude/skills` (project), `~/.claude/skills` (global)
- And 38+ more...

**Installation Path Structure**:
- **Canonical Location** (symlink mode):
  - Project: `{cwd}/.agents/skills/{skill-name}`
  - Global: `~/.agents/skills/{skill-name}` (or `~/.config/agents/skills/{skill-name}` on some systems)
- **Agent-Specific Location**:
  - Project: `{cwd}/{agent.skillsDir}/{skill-name}`
  - Global: `{agent.globalSkillsDir}/{skill-name}`

**Installation Scope**:
- **Project**: Installed in current working directory (committed with project)
- **Global**: Installed in home directory (available across all projects)
- Some agents (e.g., `replit`) only support project-level installation

**Installation Methods**:
- **Symlink (Recommended)**:
  - Copy skill files to canonical location
  - Create symlinks from agent directories to canonical location
  - Single source of truth, easier updates
  - Falls back to copy if symlink creation fails (e.g., Windows without Developer Mode)
- **Copy**: Copies files directly to each agent directory (independent copies)

## Functional Requirements

### FR-1: Browse Skills from skills.sh

**Description**: User can browse the global skills catalog from https://skills.sh/ or install from GitHub repositories.

**Requirements**:
- Fetch skills list from skills.sh API
- Display: skill name, description, author, install count
- Search & filter support
- Support installing from GitHub repo URLs (e.g., `https://github.com/vercel-labs/agent-skills`)
- When GitHub repo provided: clone repo and discover skills within

**Acceptance Criteria**:
- Skills list loads within acceptable latency
- Skills are searchable by name
- GitHub repo cloning works reliably
- Skills discovery from cloned repos works
- Errors handled gracefully

### FR-2: Install Skill into Supported Agents

**Description**: User can select a skill and install it into one or more agents (multi-select), matching the official CLI experience.

**Requirements**:
- User provides source (GitHub repo, local path, or skills.sh URL)
- Parse source to determine type (GitHub, local, direct URL, well-known)
- If remote: clone repository to temp location
- Discover skills by scanning for `SKILL.md` files in:
  - Root directory
  - `skills/` directory
  - `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
  - Agent-specific directories
- If multiple skills found: multi-select interface to choose skills
- Detect installed agents using agent-specific detection functions
- Agent selection:
  - If no agents detected: show all agents for selection
  - If 1 agent detected: auto-select (with option to change)
  - If multiple detected: show detected agents pre-selected, allow changes
  - Multi-select with fuzzy search (pre-selects last used agents)
- Choose installation scope:
  - Project: Install in current directory
  - Global: Install in home directory (if agent supports it)
  - Prompt only if not specified and agent supports global
- Choose installation method:
  - Symlink (Recommended): Single source of truth, easy updates
  - Copy: Independent copies for each agent
- Check for overwrites (show which agents will have skills overwritten)
- Show installation summary before confirmation:
  - Canonical path (if symlink): `~/.agents/skills/{skill-name}` or `./.agents/skills/{skill-name}`
  - Symlink targets: Agent names
  - Overwrite warnings: Which agents will have existing skills replaced
- User confirms installation
- Install skill:
  - Symlink mode: Copy to canonical location, create symlinks to agent directories
  - Copy mode: Copy directly to each agent directory
  - Handle symlink failures gracefully (fallback to copy)
- Track installation in lock file (for global installs only)
- Show success summary with installed paths and symlink status

**Acceptance Criteria**:
- Skill installed to selected agents via symlink or copy
- Installation summary accurately reflects targets and paths
- Multi-agent installation works correctly
- Symlink failures fall back to copy automatically
- Overwrite detection works correctly
- Repository cloning and cleanup works for GitHub sources
- Lock file tracking works for global installs
- Agent detection uses same logic as official CLI

### FR-3: Browse Installed Skills

**Description**: User can view all skills installed locally across agents, matching the official CLI's `skills list` command.

**Requirements**:
- Scan canonical locations for installed skills:
  - Project: `{cwd}/.agents/skills/`
  - Global: `~/.agents/skills/` (or `~/.config/agents/skills/`)
- For each skill directory found:
  - Check for `SKILL.md` file
  - Parse skill metadata (name, description)
  - Detect which agents have this skill installed:
    - Check agent-specific directories for symlink or directory
    - Use multiple strategies: exact name match, sanitized name match, SKILL.md content match
  - Determine installation scope (project vs global)
- Show: skill name, description, canonical path, scope, agent(s) installed to
- Group by agent or skill (user preference)
- Filter by scope (project/global/all)
- Filter by agent

**Acceptance Criteria**:
- Installed skills list is accurate
- Detects skills in both project and global locations
- Correctly identifies which agents have each skill
- Handles name mismatches (e.g., "git-review" vs "Git Review Before Commit")
- Fast local scan
- No false positives

### FR-4: Delete Installed Skills

**Description**: User can remove an installed skill from specific agents or all agents.

**Requirements**:
- User selects skill → delete
- Option to delete from one agent or all agents
- Show which agents will be affected
- Confirmation dialog
- Remove symlink or copied files
- Clean up if no agents remain

**Acceptance Criteria**:
- Skill symlinks/files fully removed from selected agents
- Agent configs remain valid
- User warned if skill is shared across multiple agents

### FR-5: Update Installed Skills (Content-Based)

**Description**: User can update installed skills by detecting content changes and reinstalling.

**Important**: skills.sh does NOT provide versioning (no semantic versions, release history, or update endpoints). Updates are content-based, not version-based.

**Update Models Supported**:

1. **Content-Based Update (Hash/Diff) - Primary Method**:
   - Compare installed skill content hash vs remote skill content hash
   - If `hash(remoteSkill) !== hash(installedSkill)` → update available
   - Update = reinstall latest definition from source
   - UX: "Update skill (changes detected)" NOT "Update to vX.Y"

2. **Reinstall-as-Update (Idempotent)**:
   - Installing an already-installed skill acts as update
   - Overwrites existing installation
   - UX: Show "Reinstall" if skill is installed
   - Tooltip: "Replaces local copy with latest from source"

3. **Source-Linked Update (Git-backed)**:
   - For GitHub-sourced skills: store commit hash at install time
   - Update = pull latest commit and compare
   - `git fetch`, `git diff`, `git pull`
   - Only works for Git-backed skills

**Requirements**:
- Compute content hash (SHA-256) for installed skills
- Compute content hash for remote skills
- Compare hashes to detect changes
- Backup current installation before update
- Reinstall skill content (preserve agent targets)
- Atomic update with rollback on failure
- Preserve installation targets (agents) and method (symlink/copy)

**Acceptance Criteria**:
- Hash comparison accurately detects content changes
- Updated skill reflects latest content from source
- No partial installs
- Installation targets and method preserved
- User notified on success/failure
- No fake version numbers displayed

### FR-6: Install / Update Indicator (State Awareness)

**Description**: While browsing skills, user sees clear install state indicators based on content comparison.

**Indicators**:
- 🟢 **Install** → Skill not installed
- 🔵 **Update (changes detected)** → Installed but content hash differs from remote
- ⚪ **Installed** → Installed and content hash matches remote (no changes)
- Show which agents have skill installed

**Requirements**:
- Compute and compare content hashes (SHA-256)
- Real-time state resolution
- Agent-specific awareness
- Multi-agent install awareness
- Detect if symlink target is valid
- Cache hashes for performance

**Acceptance Criteria**:
- Indicator always reflects actual content state (not fake versions)
- Shows installed agents for each skill
- Hash comparison is accurate and deterministic
- No stale or incorrect status
- UI wording: "Update (changes detected)" NOT "Update to vX.Y"

## User Flows

### Flow A: Browse & Install from skills.sh
1. Open Raycast → "Browse Skills"
2. Search/browse skills from skills.sh
3. Select skill
4. See indicator (Install / Update / Installed) and installed agents
5. Choose target agents (multi-select)
6. Choose installation method (Symlink/Copy)
7. Review installation summary
8. Confirm and install

### Flow A2: Install from GitHub Repo
1. Open Raycast → "Install from GitHub"
2. Enter GitHub repo URL (e.g., `https://github.com/vercel-labs/agent-skills`)
3. Extension clones repo and discovers skills
4. Select skill(s) to install
5. Choose target agents (multi-select)
6. Choose installation method (Symlink/Copy)
7. Review installation summary
8. Confirm and install

### Flow B: Update Skill (Content-Based)
1. Browse installed skills or browse from source
2. See "Update (changes detected)" indicator (if content hash differs)
3. Press Update
4. Extension:
   - Backs up current installation
   - Fetches latest content from source
   - Compares content hash
   - Reinstalls skill content
   - Preserves agent targets and installation method
5. Skill updated (content replaced, not version upgraded)

### Flow C: Manage Installed Skills
1. Open "Installed Skills"
2. Select skill
3. Update or Delete

## Non-Functional Requirements

- ⚡ Fast (<200ms UI interactions)
- 🔒 No arbitrary file writes
- 🧠 Clear error handling
- 🧩 Extensible client adapter system
- 📴 Offline access to installed skills
- 🔐 Honest about limitations: skills.sh has no versioning

## Important Constraints

**skills.sh Versioning Reality**:
- ❌ No semantic versions
- ❌ No release history
- ❌ No update endpoints
- ❌ No "latest vs installed" comparison

**What This Means**:
- Updates are content-based (hash comparison), not version-based
- "Update" = reinstall latest content, not "upgrade to vX.Y"
- UI must be honest: "Update (changes detected)" not "Update to v1.2.3"
- Must NOT fake versions or guess semantic versions

## Public Documentation Statement

**For PRD / README**:

> "Skills on skills.sh are unversioned. Updates are detected by comparing the remote skill definition with the locally installed copy using content hashing (SHA-256). When content differs, an update is available. This is content replacement, not version upgrade."

## MVP Scope

**Included**:
- Browse skills.sh
- Install from GitHub repos
- Multi-agent selection
- Symlink installation method
- Install / Update / Delete
- Install state indicators
- Agent detection (~40+ agents)

**Excluded (V2)**:
- Skill authoring
- Auto-updates
- AI recommendations

## Success Metrics

- Time to install skill < 5 seconds
- Zero config corruption reports
- High repeat usage (daily/weekly)
- Raycast store adoption
