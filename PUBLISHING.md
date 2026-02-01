# Publishing Checklist

## Pre-Publishing Requirements

### ✅ Code Quality
- [x] TypeScript compiles without errors (`npm run type-check`)
- [x] Build succeeds (`npm run build`)
- [x] All commands have proper entry points
- [x] No console errors or warnings

### ✅ Documentation
- [x] README.md with clear setup instructions
- [x] CHANGELOG.md with version history
- [x] Code comments where necessary

### ✅ Configuration
- [x] `package.json` has all required fields:
  - [x] name, title, version, description
  - [x] icon, author, license
  - [x] platforms, categories, keywords
  - [x] commands configuration
- [x] Icons present in `assets/` directory
- [x] TypeScript configuration correct

### ✅ Functionality
- [x] All commands work correctly
- [x] Browse Skills command functional
- [x] Installed Skills command functional
- [x] Update detection working (Git-based)
- [x] Installation flow works
- [x] Error handling in place

## Publishing Steps

1. **Test Locally**
   ```bash
   npm run build
   npm run dev
   ```
   Test all commands in Raycast development mode.

2. **Create Pull Request**
   - Fork/clone the [Raycast Extensions repository](https://github.com/raycast/extensions)
   - Copy this extension to the repository
   - Create a PR with:
     - Clear description of the extension
     - Screenshots/GIFs demonstrating functionality
     - Link to any related issues

3. **PR Requirements**
   - Extension must provide unique value
   - Must work properly
   - Must include clear documentation
   - Must respect user data privacy
   - Must follow Raycast's Terms of Service

4. **Review Process**
   - Raycast reviews in first-in, first-out order
   - Initial contact within one week
   - Respond promptly to reviewer comments
   - PRs marked stale after 14 days of inactivity

## Post-Publishing

- Monitor issues and feature requests
- Maintain the extension
- Update as needed for Raycast API changes
- Track metrics in Developer Hub

## Notes

- Extension uses Git commit hash comparison for update detection
- Supports 40+ AI coding assistants
- Requires Git to be installed for cloning repositories
- Works on macOS only
