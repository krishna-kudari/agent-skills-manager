# Changelog

All notable changes to this extension will be documented in this file.

## [1.0.0] - 2026-02-01

### Added
- Browse and search skills from skills.sh catalog
- Install skills from GitHub repositories
- Multi-agent support (40+ AI coding assistants)
- Git-based update detection using commit hash comparison
- Manage installed skills (view, update, delete)
- Flexible installation modes (symlink or copy)
- Scope management (global or project-level)
- Automatic skill discovery in repositories
- Update available indicators

### Features
- **Browse Skills**: Search and install skills from the skills.sh catalog
- **Installed Skills**: View and manage all installed skills across agents
- **Update Detection**: Automatically detect when skill updates are available
- **Multi-Agent Installation**: Install skills to multiple agents simultaneously
- **Installation Modes**: Choose between symlink (default) or copy installation
- **Scope Control**: Install skills globally or per-project

### Technical Details
- Uses Git commit hash comparison for accurate update detection
- Supports 40+ AI coding assistants including Cursor, Continue, Cline, GitHub Copilot, and more
- Lock file management for tracking installed skills
- Automatic agent detection
