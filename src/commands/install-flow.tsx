import React, { useState, useEffect } from 'react';
import { Detail, ActionPanel, Action, Icon, showToast, Toast, List, popToRoot } from '@raycast/api';
import { homedir } from 'os';
import { detectInstalledAgents, getAllAgents, getAgentConfig } from '../agents';
import { cloneRepository, discoverSkills, cleanupTempDir, GitCloneError, getLatestCommitHash } from '../repository-manager';
import { installSkillForAgent, sanitizeName, getCanonicalPath } from '../installer';
import { addSkillToLock, getLastSelectedAgents, saveSelectedAgents } from '../skill-registry';
import type { AgentType, InstallMode } from '../types';
import type { DiscoveredSkill } from '../repository-manager';

const SKILLS_LOGO =`
███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
███████╗█████╔╝ ██║██║     ██║     ███████╗
╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
███████║██║  ██╗██║███████╗███████╗███████║
╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝`;

interface RepositoryMetadata {
  owner?: string;
  repo?: string;
  description?: string;
  skills: DiscoveredSkill[];
}

interface InstallFlowState {
  step: 'metadata' | 'skill-selection' | 'agent-selection' | 'scope-selection' | 'method-selection' | 'summary' | 'installing';
  sourceUrl: string;
  skillName?: string;
  repositoryMetadata?: RepositoryMetadata;
  discoveredSkills: DiscoveredSkill[];
  selectedSkills: DiscoveredSkill[];
  selectedAgents: AgentType[];
  scope: 'global' | 'project';
  method: InstallMode;
  tempDir?: string;
  isInstalling: boolean;
}

export function InstallFlow({ sourceUrl, skillName, onComplete }: { sourceUrl: string; skillName?: string; onComplete?: () => void }) {
  const [state, setState] = useState<InstallFlowState>({
    step: 'metadata',
    sourceUrl,
    skillName,
    discoveredSkills: [],
    selectedSkills: [],
    selectedAgents: [],
    scope: 'global',
    method: 'symlink',
    isInstalling: false,
  });

  useEffect(() => {
    loadRepositoryMetadata();
  }, []);

  async function loadRepositoryMetadata() {
    try {
      // Parse GitHub URL to get owner/repo
      const match = sourceUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
      const owner = match?.[1];
      const repo = match?.[2]?.replace('.git', '');

      // Clone repository
      const tempDir = await cloneRepository(sourceUrl);
      setState(prev => ({ ...prev, tempDir }));

      // Discover skills
      const discovered = await discoverSkills(tempDir);

      if (discovered.length === 0) {
        throw new Error('No skills found in repository');
      }

      // If skillName provided, filter to that skill
      let skillsToShow = discovered;
      if (skillName) {
        const found = discovered.find(s =>
          s.name.toLowerCase() === skillName.toLowerCase() ||
          sanitizeName(s.name) === sanitizeName(skillName)
        );
        if (found) {
          skillsToShow = [found];
        }
      }

      // Fetch repository description from GitHub API if possible
      let description: string | undefined;
      if (owner && repo) {
        try {
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
          if (response.ok) {
            const data = await response.json();
            description = data.description || undefined;
          }
        } catch {
          // Ignore API errors
        }
      }

      setState(prev => ({
        ...prev,
        repositoryMetadata: {
          owner,
          repo,
          description,
          skills: skillsToShow,
        },
        discoveredSkills: discovered,
        selectedSkills: skillsToShow.length === 1 ? skillsToShow : [],
      }));
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Failed to load repository',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  function handleContinueToAgentSelection() {
    if (state.selectedSkills.length === 0 && state.discoveredSkills.length > 1) {
      // Need to select skills first
      setState(prev => ({ ...prev, step: 'skill-selection' }));
    } else {
      // Auto-select if single skill or already selected
      if (state.selectedSkills.length === 0 && state.discoveredSkills.length === 1) {
        setState(prev => ({ ...prev, selectedSkills: state.discoveredSkills }));
      }
      setState(prev => ({ ...prev, step: 'agent-selection' }));
    }
  }

  function handleSkillSelection(selected: DiscoveredSkill[]) {
    setState(prev => ({
      ...prev,
      selectedSkills: selected,
      step: 'agent-selection',
    }));
  }

  function handleAgentSelection(agents: AgentType[]) {
    setState(prev => ({
      ...prev,
      selectedAgents: agents,
      step: 'scope-selection',
    }));
  }

  function handleScopeSelection(scope: 'global' | 'project') {
    setState(prev => ({
      ...prev,
      scope,
      step: 'method-selection',
    }));
  }

  function handleMethodSelection(method: InstallMode) {
    setState(prev => ({
      ...prev,
      method,
      step: 'summary',
    }));
  }

  function showInstallationSummary() {
    // Summary is shown in renderContent when step === 'summary'
  }

  async function handleInstallation() {
    const { selectedSkills, selectedAgents, scope, method, tempDir } = state;

    if (!tempDir) {
      showToast({ style: Toast.Style.Failure, title: 'Error', message: 'Temporary directory not found' });
      return;
    }

    if (selectedAgents.length === 0) {
      showToast({ style: Toast.Style.Failure, title: 'Error', message: 'Please select at least one agent' });
      return;
    }

    setState(prev => ({ ...prev, isInstalling: true, step: 'installing' }));

    try {
      const skill = selectedSkills[0]; // Handle single skill for now
      const results = await Promise.all(
        selectedAgents.map(async (agentType) => {
          const result = await installSkillForAgent(skill, agentType, {
            global: scope === 'global',
            mode: method,
          });
          return { agentType, result };
        })
      );

      const failed = results.filter(r => !r.result.success);
      if (failed.length > 0) {
        throw new Error(`Failed to install to ${failed.length} agent(s)`);
      }

      // Save to lock file
      const sanitizedName = sanitizeName(skill.name);
      const gitCommitHash = await getLatestCommitHash(tempDir);
      if (!gitCommitHash) {
        throw new Error('Failed to get commit hash from repository');
      }
      await addSkillToLock(sanitizedName, {
        source: sourceUrl,
        sourceType: 'github',
        sourceUrl: sourceUrl,
        gitCommitHash,
      });

      // Save selected agents
      await saveSelectedAgents(selectedAgents);

      showToast({
        style: Toast.Style.Success,
        title: 'Skill installed',
        message: `Installed to ${selectedAgents.length} agent(s)`,
      });

      // Reset installation state before calling onComplete
      setState(prev => ({ ...prev, isInstalling: false, step: 'summary' }));

      if (onComplete) {
        onComplete();
      }

      // Navigate back to root (which will show browse skills)
      popToRoot();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Installation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      // Reset installation state on error too
      setState(prev => ({ ...prev, isInstalling: false, step: 'summary' }));
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }
  }

  function renderContent() {
    const { step, repositoryMetadata, discoveredSkills, selectedSkills, selectedAgents, scope, method } = state;

    // Step: Repository metadata
    if (step === 'metadata' && repositoryMetadata) {
      const { owner, repo, description, skills } = repositoryMetadata;
      const repoDisplay = owner && repo ? `${owner}/${repo}` : sourceUrl;
      const repoUrl = owner && repo
        ? `https://github.com/${owner}/${repo}`
        : sourceUrl.replace(/\.git$/, '');

      // Build skills.sh URLs - format: https://skills.sh/{owner}/{repo} or search by skill name
      const skillsShUrl = owner && repo
        ? `https://skills.sh/${owner}/${repo}`
        : `https://skills.sh/?q=${encodeURIComponent(skills[0]?.name || '')}`;

      const markdown = [
        '```text',
        SKILLS_LOGO,
        '```',
        '',
        '---',
        '',
        '## Repository',
        '',
        `${repoDisplay}`,
        '',
        description ? `> ${description}` : '',
        '',
        `[View on GitHub →](${repoUrl})`,
        '',
        `[View on skills.sh →](${skillsShUrl})`,
        '',
        '---',
        '',
        `## Skills Found: ${skills.length}`,
        '',
        skills.map((skill, idx) => {

          const skillLines = [
            `### ${idx + 1}. ${skill.name}`,
            '',
            skill.description || '*No description available*',
            ''
          ];
          return skillLines.join('\n');
        }).join('\n\n---\n\n'),
        '',
        '---',
        '',
      ].filter(Boolean).join('\n');

      return (
        <Detail
          markdown={markdown}
          actions={
            <ActionPanel>
              <Action
                title="Continue to Installation"
                icon={Icon.ArrowRight}
                onAction={handleContinueToAgentSelection}
              />
              <Action.OpenInBrowser
                title="Open Repository on GitHub"
                url={repoUrl}
                icon={Icon.Globe}
              />
              <Action.OpenInBrowser
                title="View on skills.sh"
                url={skillsShUrl}
                icon={Icon.MagnifyingGlass}
              />
            </ActionPanel>
          }
        />
      );
    }

    // Step: Skill selection (if multiple skills)
    if (step === 'skill-selection') {
      return (
        <List>
          <List.Section title="Select skills to install">
            {discoveredSkills.map((skill) => {
              const isSelected = selectedSkills.some(s => s.path === skill.path);
              return (
                <List.Item
                  key={skill.path}
                  title={skill.name}
                  subtitle={skill.description}
                  accessories={isSelected ? [{ icon: Icon.CheckCircle, text: 'Selected' }] : []}
                  actions={
                    <ActionPanel>
                      <Action
                        title={isSelected ? 'Deselect' : 'Select'}
                        icon={isSelected ? Icon.Circle : Icon.CheckCircle}
                        onAction={() => {
                          const newSkills = isSelected
                            ? selectedSkills.filter(s => s.path !== skill.path)
                            : [...selectedSkills, skill];
                          setState(prev => ({ ...prev, selectedSkills: newSkills }));
                        }}
                      />
                      {selectedSkills.length > 0 && (
                        <Action
                          title="Continue"
                          icon={Icon.ArrowRight}
                          onAction={() => handleSkillSelection(selectedSkills)}
                        />
                      )}
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        </List>
      );
    }

    // Step: Agent selection
    if (step === 'agent-selection') {
      const allAgents = getAllAgents();
      const allSelected = allAgents.length > 0 && selectedAgents.length === allAgents.length;

      return (
        <List
          searchBarPlaceholder="Search agents... (space to toggle)"
          filtering
        >
          <List.Section
            title={`Select agents (${selectedAgents.length} selected)`}
            subtitle={allSelected ? 'All agents selected' : undefined}
          >
            <List.Item
              title={allSelected ? 'Deselect All' : 'Select All'}
              icon={allSelected ? Icon.Circle : Icon.CheckCircle}
              actions={
                <ActionPanel>
                  <Action
                    title={allSelected ? 'Deselect All' : 'Select All'}
                    icon={allSelected ? Icon.Circle : Icon.CheckCircle}
                    onAction={() => {
                      if (allSelected) {
                        setState(prev => ({ ...prev, selectedAgents: [] }));
                      } else {
                        setState(prev => ({ ...prev, selectedAgents: allAgents.map(a => a.name as AgentType) }));
                      }
                    }}
                  />
                </ActionPanel>
              }
            />
            {allAgents.map((agent) => {
              const isSelected = selectedAgents.includes(agent.name as AgentType);
              return (
                <List.Item
                  key={agent.name}
                  title={agent.displayName}
                  subtitle={agent.skillsDir}
                  accessories={isSelected ? [{ icon: Icon.CheckCircle, text: 'Selected' }] : []}
                  actions={
                    <ActionPanel>
                      <Action
                        title={isSelected ? 'Deselect' : 'Select'}
                        icon={isSelected ? Icon.Circle : Icon.CheckCircle}
                        onAction={() => {
                          const newAgents = isSelected
                            ? selectedAgents.filter(a => a !== agent.name)
                            : [...selectedAgents, agent.name as AgentType];
                          setState(prev => ({ ...prev, selectedAgents: newAgents }));
                        }}
                      />
                      {selectedAgents.length > 0 && (
                        <Action
                          title="Continue"
                          icon={Icon.ArrowRight}
                          shortcut={{ modifiers: ['cmd'], key: 'enter' }}
                          onAction={() => handleAgentSelection(selectedAgents)}
                        />
                      )}
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        </List>
      );
    }

    // Step: Scope selection
    if (step === 'scope-selection') {
      return (
        <List>
          <List.Section title="Installation scope">
            <List.Item
              title="Global"
              subtitle="Install in home directory (available across all projects)"
              accessories={scope === 'global' ? [{ icon: Icon.CheckCircle }] : []}
              actions={
                <ActionPanel>
                  <Action title="Select Global" onAction={() => handleScopeSelection('global')} />
                </ActionPanel>
              }
            />
            <List.Item
              title="Project"
              subtitle="Install in current directory (committed with project)"
              accessories={scope === 'project' ? [{ icon: Icon.CheckCircle }] : []}
              actions={
                <ActionPanel>
                  <Action title="Select Project" onAction={() => handleScopeSelection('project')} />
                </ActionPanel>
              }
            />
          </List.Section>
        </List>
      );
    }

    // Step: Method selection
    if (step === 'method-selection') {
      return (
        <List>
          <List.Section title="Installation method">
            <List.Item
              title="Symlink (Recommended)"
              subtitle="Single source of truth, easier updates"
              accessories={method === 'symlink' ? [{ icon: Icon.CheckCircle }] : []}
              actions={
                <ActionPanel>
                  <Action title="Select Symlink" onAction={() => handleMethodSelection('symlink')} />
                </ActionPanel>
              }
            />
            <List.Item
              title="Copy"
              subtitle="Independent copies for each agent"
              accessories={method === 'copy' ? [{ icon: Icon.CheckCircle }] : []}
              actions={
                <ActionPanel>
                  <Action title="Select Copy" onAction={() => handleMethodSelection('copy')} />
                </ActionPanel>
              }
            />
          </List.Section>
        </List>
      );
    }

    // Step: Summary
    if (step === 'summary') {
      const skill = selectedSkills[0];
      const canonicalPath = getCanonicalPath(sanitizeName(skill.name), { global: scope === 'global' });
      const home = homedir();
      const displayPath = canonicalPath.startsWith(home)
        ? `~${canonicalPath.slice(home.length)}`
        : canonicalPath;

      const markdown = [
        '## Installation Summary',
        '',
        `**Skill:** ${skill.name}`,
        `**Path:** \`${displayPath}\``,
        `**Method:** ${method === 'symlink' ? 'Symlink' : 'Copy'}`,
        `**Scope:** ${scope === 'global' ? 'Global' : 'Project'}`,
        `**Agents:** ${selectedAgents.map(a => getAgentConfig(a).displayName).join(', ')}`,
        '',
        method === 'symlink'
          ? `Symlink will be created from agent directories to: \`${displayPath}\``
          : `Files will be copied to each agent directory`,
      ].join('\n');

      return (
        <Detail
          markdown={markdown}
          actions={
            <ActionPanel>
              <Action
                title="Install"
                icon={Icon.Check}
                onAction={handleInstallation}
              />
            </ActionPanel>
          }
        />
      );
    }

    // Step: Installing
    if (step === 'installing' && state.isInstalling) {
      const installingMarkdown = [
        '```text',
        SKILLS_LOGO,
        '```',
        '',
        '## Installing...',
        '',
        'Please wait while the skill is being installed.',
      ].join('\n');

      return (
        <Detail
          markdown={installingMarkdown}
          isLoading={true}
        />
      );
    }

    // Loading state
    const loadingMarkdown = [
      '```text',
      SKILLS_LOGO,
      '```',
      '',
      '## Loading repository...',
      '',
      'Please wait while we fetch the repository information.',
    ].join('\n');

    return (
      <Detail
        markdown={loadingMarkdown}
        isLoading={true}
      />
    );
  }

  return renderContent();
}
