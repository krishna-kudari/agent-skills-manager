# Notes

## Open Questions

1. ~~**skills.sh API Stability**: Does skills.sh expose a stable API? What is the actual endpoint structure?~~ ✅ **RESOLVED**: Endpoints confirmed - `/api/search` and `/api/skills` (see api.md)
2. ~~**Skill Versioning**: How to detect if a GitHub-sourced skill has updates?~~ ✅ **RESOLVED**: skills.sh has NO versioning. Updates are content-based (hash comparison) or git-based (commit comparison).
3. ~~**Agent Detection**: How to reliably detect all ~40+ agents?~~ ✅ **RESOLVED**: Each agent has a `detectInstalled()` function that checks agent-specific directories/config files. 42 agents total, each with specific detection logic.
4. ~~**Skill Discovery**: How are skills structured within GitHub repositories?~~ ✅ **RESOLVED**: Skills are discovered by scanning for `SKILL.md` files in: root directory, `skills/` directory, `skills/.curated/`, `skills/.experimental/`, `skills/.system/`, and agent-specific directories.
5. ~~**Symlink Permissions**: Do all agents support symlinks?~~ ✅ **RESOLVED**: Symlinks are attempted, but fallback to copy if creation fails (Windows without Developer Mode, permissions, etc.). This is handled gracefully.
6. ~~**Repository Cleanup**: How long to keep temp clones?~~ ✅ **RESOLVED**: Temp clones are cleaned up immediately after installation completes (in finally block).

## Assumptions

- skills.sh provides a browsable catalog of skills
- **skills.sh does NOT provide versioning** (no semantic versions, release history, update endpoints)
- Updates must be content-based (hash comparison) or git-based (commit comparison)
- Skills from skills.sh may point to GitHub repositories
- GitHub repositories can be cloned to discover skills
- **Canonical installation path**: `.agents/skills/{skill-name}` (project) or `~/.agents/skills/{skill-name}` (global)
- **Agent detection**: Each agent has specific detection logic (42 agents total)
- **Some agents don't support global installation** (e.g., `replit` is project-only)
- Agents support symlinks (or fallback to copy automatically)
- Agent directories are discoverable using agent-specific detection functions
- Local registry can be stored in Raycast extension storage
- **Lock file**: `~/.agents/.skill-lock.json` tracks global installations for update checking
- Git is available for repository operations
- Content hashing (SHA-256) is deterministic and reliable for change detection
- **Skill name sanitization**: Converts to kebab-case, prevents path traversal, limits to 255 chars

## Trade-offs

### Caching vs Freshness
- Cache skills list for offline access and speed
- Trade-off: May show stale data until refresh
- Decision: Cache with TTL, allow manual refresh

### Atomic Updates vs Simplicity
- Atomic updates with rollback add complexity
- Trade-off: More code but safer operations
- Decision: Implement atomic updates for data integrity

### Multi-agent Awareness vs Performance
- Resolving state across all agents on every browse adds latency
- Trade-off: Accuracy vs speed
- Decision: Lazy load state, cache per session

### Symlink vs Copy Installation
- Symlinks enable shared skill location, easier updates
- Copy method more compatible but duplicates files
- Decision: Default to symlink, fallback to copy on failure

### Repository Cloning vs Direct Install
- Cloning repos allows skill discovery and updates
- Trade-off: Requires git, temp storage, cleanup
- Decision: Clone to temp location, discover skills, clean up after install

### Content-Based Updates vs Version-Based
- skills.sh has no versioning, so updates must be content-based
- Hash comparison (SHA-256) is deterministic and works immediately
- Trade-off: No human-readable version numbers, but honest and accurate
- Decision: Use hash-based detection, UI shows "Update (changes detected)" not "Update to vX.Y"
- Future-proof: If skills.sh adds versioning later, can upgrade without breaking users

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking agent configs | Validate symlinks, backup before changes |
| Skill format changes | Standard skill structure, validate on discovery |
| Repository access failures | Handle git errors gracefully, show clear messages |
| Symlink failures | Fallback to copy method |
| Agent detection misses | Maintain registry, allow manual agent configuration |
| Temp clone cleanup failures | Track temp locations, cleanup on extension close |
| API unavailability | Offline mode with cached data |
| Hash collision (extremely rare) | Use SHA-256, accept risk as negligible |
| Fake version numbers | **MUST NOT** fake versions - use honest "changes detected" language |
| User confusion about updates | Clear UI: "Update (changes detected)" not "Update to vX.Y" |

## Implementation Considerations

- Use Raycast's built-in storage for local registry
- **Replicate official CLI agent detection logic** (42 agents with specific detection functions)
- Use Node.js `fs` and `child_process` for git operations
- Handle symlink creation with proper error handling (fallback to copy on failure)
- Cache agent detection results (agents don't change frequently)
- **Clean up temp clones immediately after installation** (in finally block)
- **Implement content hashing (SHA-256) for update detection**
- **Store content hashes in lock file** (`~/.agents/.skill-lock.json`) for global installs
- **Compute hashes efficiently** (cache where possible)
- **Never display fake version numbers**
- **Support skill name sanitization** (kebab-case, path traversal prevention)
- **Handle installation scope** (project vs global) correctly
- **Pre-select last used agents** from lock file for better UX
- **Check for overwrites** before installation (parallel checks)
- Add telemetry for install success/failure rates (skip for private repos)
- Consider rate limiting for skills.sh API calls
- Support both GitHub HTTPS and SSH URLs
- Handle private repositories (may require authentication)
- **Match official CLI UX exactly** for familiarity and consistency

## Critical Implementation Rules

**DO**:
- ✅ Use hash-based content comparison for updates
- ✅ Show "Update (changes detected)" in UI
- ✅ Store content hashes in registry
- ✅ Backup before updates
- ✅ Be honest about unversioned skills

**DON'T**:
- ❌ Fake version numbers
- ❌ Guess semantic versions
- ❌ Assume "latest = higher version"
- ❌ Silent overwrites without warning
- ❌ Display "Update to vX.Y" when no version exists
