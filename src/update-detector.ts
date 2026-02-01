import { readFile } from 'fs/promises';
import { join } from 'path';
import { computeContentHash } from './skill-registry';
import { getCanonicalPath } from './installer';
import type { SkillInstallState } from './types';
import { discoverSkills } from './repository-manager';
import { cloneRepository, cleanupTempDir } from './repository-manager';
import type { DiscoveredSkill } from './repository-manager';

export interface UpdateStatus {
  skillName: string;
  hasUpdate: boolean;
  updateType: 'content' | 'git' | 'none';
  localHash: string;
  remoteHash: string;
  gitCommitDiff?: string;
}

/**
 * Compute content hash for an installed skill
 */
export async function computeInstalledSkillHash(
  skillName: string,
  options: { global?: boolean; cwd?: string }
): Promise<string | null> {
  try {
    const canonicalPath = getCanonicalPath(skillName, options);
    const skillMdPath = join(canonicalPath, 'SKILL.md');
    const content = await readFile(skillMdPath, 'utf-8');
    return computeContentHash(content);
  } catch {
    return null;
  }
}

/**
 * Compute content hash for a remote skill
 */
export async function computeRemoteSkillHash(
  sourceUrl: string,
  skillPath?: string
): Promise<string | null> {
  let tempDir: string | null = null;

  try {
    // Clone repository
    tempDir = await cloneRepository(sourceUrl);
    
    // Discover skills
    const skills = await discoverSkills(tempDir, skillPath);
    
    if (skills.length === 0) {
      return null;
    }

    // Use first skill's content hash
    const skill = skills[0];
    return computeContentHash(skill.rawContent);
  } catch {
    return null;
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir).catch(() => {});
    }
  }
}

/**
 * Check if a skill has updates available
 */
export async function checkForUpdates(
  skillName: string,
  sourceUrl: string,
  skillPath?: string,
  options?: { global?: boolean; cwd?: string }
): Promise<UpdateStatus> {
  const localHash = await computeInstalledSkillHash(skillName, options || {});
  const remoteHash = await computeRemoteSkillHash(sourceUrl, skillPath);

  if (!localHash || !remoteHash) {
    return {
      skillName,
      hasUpdate: false,
      updateType: 'none',
      localHash: localHash || '',
      remoteHash: remoteHash || '',
    };
  }

  const hasUpdate = localHash !== remoteHash;

  return {
    skillName,
    hasUpdate,
    updateType: hasUpdate ? 'content' : 'none',
    localHash,
    remoteHash,
  };
}

/**
 * Get install state for a skill
 */
export async function getSkillInstallState(
  skillName: string,
  sourceUrl: string,
  skillPath?: string,
  options?: { global?: boolean; cwd?: string }
): Promise<SkillInstallState> {
  const localHash = await computeInstalledSkillHash(skillName, options || {});
  
  if (!localHash) {
    return {
      status: 'not_installed',
      installedAgents: [],
    };
  }

  const remoteHash = await computeRemoteSkillHash(sourceUrl, skillPath);
  
  if (!remoteHash || localHash === remoteHash) {
    return {
      status: 'installed',
      installedAgents: [], // Will be populated by caller
      localHash,
      remoteHash: remoteHash || undefined,
    };
  }

  return {
    status: 'update_available',
    installedAgents: [], // Will be populated by caller
    localHash,
    remoteHash,
  };
}
