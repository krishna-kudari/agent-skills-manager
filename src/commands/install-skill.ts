import { showToast, Toast, confirmAlert, Alert, popToRoot } from '@raycast/api';
import { detectInstalledAgents, getAllAgents, getAgentConfig } from '../agents';
import { cloneRepository, discoverSkills, cleanupTempDir, getLatestCommitHash } from '../repository-manager';
import { installSkillForAgent, sanitizeName } from '../installer';
import { addSkillToLock, getLastSelectedAgents, saveSelectedAgents } from '../skill-registry';
import type { Skill, AgentType, InstallMode } from '../types';
import { parseSource } from './source-parser';
import { InstallFlow } from './install-flow';

export async function installSkill(skill: Skill | string, isUpdate = false): Promise<void> {
  let tempDir: string | null = null;

  try {
    let sourceUrl: string;
    let skillName: string | undefined;
    let discoveredSkills: Array<{ name: string; description: string; path: string; rawContent: string }>;

    if (typeof skill === 'string') {
      // GitHub repo URL
      sourceUrl = skill;
      tempDir = await cloneRepository(sourceUrl);
      discoveredSkills = await discoverSkills(tempDir);
      
      if (discoveredSkills.length === 0) {
        throw new Error('No skills found in repository');
      }
      
      if (discoveredSkills.length === 1) {
        skillName = discoveredSkills[0].name;
      } else {
        // For now, use first skill - in full implementation would show multi-select
        skillName = discoveredSkills[0].name;
      }
    } else {
      // Skill from skills.sh
      if (!skill.repositoryUrl) {
        throw new Error('Skill does not have a repository URL');
      }
      sourceUrl = skill.repositoryUrl;
      skillName = skill.name;
      
      // Clone and discover to get full skill content
      tempDir = await cloneRepository(sourceUrl);
      discoveredSkills = await discoverSkills(tempDir);
      const found = discoveredSkills.find(s => s.name === skillName);
      if (!found) {
        throw new Error(`Skill "${skillName}" not found in repository`);
      }
    }

    if (!skillName) {
      throw new Error('Skill name is required');
    }

    // Detect installed agents
    const detectedAgents = await detectInstalledAgents();
    const allAgents = getAllAgents();
    const lastSelected = await getLastSelectedAgents();

    // Select agents
    let selectedAgents: AgentType[];
    if (detectedAgents.length === 0) {
      // No agents detected - show all agents (user would select in UI)
      selectedAgents = allAgents.map(a => a.name as AgentType);
    } else if (detectedAgents.length === 1) {
      selectedAgents = detectedAgents;
    } else {
      // Multiple agents detected - use detected + last selected
      const combined = new Set([
        ...detectedAgents,
        ...(lastSelected || []).filter(a => allAgents.some(ag => ag.name === a)),
      ]);
      selectedAgents = Array.from(combined) as AgentType[];
    }

    // For MVP, default to global scope and symlink mode
    const scope = 'global';
    const mode: InstallMode = 'symlink';

    // Confirm installation
    const agentNames = selectedAgents.map(a => getAgentConfig(a).displayName).join(', ');
    const confirmed = await confirmAlert({
      title: isUpdate ? 'Update Skill' : 'Install Skill',
      message: `Install "${skillName}" to ${selectedAgents.length} agent(s): ${agentNames}?`,
      primaryAction: {
        title: isUpdate ? 'Update' : 'Install',
      },
    });

    if (!confirmed) {
      return;
    }

    // Clone repository again for installation (or reuse if already cloned)
    if (!tempDir) {
      tempDir = await cloneRepository(sourceUrl);
    }

    try {
      if (!discoveredSkills || discoveredSkills.length === 0) {
        discoveredSkills = await discoverSkills(tempDir);
      }
      
      const skillToInstall = discoveredSkills.find(s => s.name === skillName);
      
      if (!skillToInstall) {
        throw new Error(`Skill "${skillName}" not found`);
      }

      // Install to each agent
      const results = await Promise.all(
        selectedAgents.map(async (agentType) => {
          const result = await installSkillForAgent(skillToInstall, agentType, {
            global: scope === 'global',
            mode,
          });
          return { agentType, result };
        })
      );

      const failed = results.filter(r => !r.result.success);
      if (failed.length > 0) {
        const failedAgents = failed.map(f => getAgentConfig(f.agentType).displayName).join(', ');
        throw new Error(`Failed to install to: ${failedAgents}`);
      }

      // Save to lock file
      const sanitizedName = sanitizeName(skillName);
      const gitCommitHash = await getLatestCommitHash(tempDir);
      if (!gitCommitHash) {
        throw new Error('Failed to get commit hash from repository');
      }
      await addSkillToLock(sanitizedName, {
        source: typeof skill === 'object' && skill.repositoryUrl ? skill.repositoryUrl : sourceUrl,
        sourceType: 'github',
        sourceUrl: typeof skill === 'object' && skill.repositoryUrl ? skill.repositoryUrl : sourceUrl,
        gitCommitHash,
      });

      // Save selected agents
      await saveSelectedAgents(selectedAgents);

      await showToast({
        style: Toast.Style.Success,
        title: isUpdate ? 'Skill updated' : 'Skill installed',
        message: `Installed to ${selectedAgents.length} agent(s)`,
      });
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: isUpdate ? 'Update failed' : 'Installation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
