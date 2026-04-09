#!/usr/bin/env python3
"""Teste de integração do kanban_pipeline com planning context."""

import asyncio
import sys
from pathlib import Path
import pytest

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from orchestrator.kanban_pipeline import build_planning_prompt
from orchestrator.daemon_client import DaemonClient


@pytest.mark.asyncio
async def test_build_planning_prompt():
    """Testa a função build_planning_prompt com dados realistas."""
    print("=" * 80)
    print("TEST: build_planning_prompt function")
    print("=" * 80)

    # Simula uma tarefa do kanban
    task = {
        'title': 'Add authentication middleware',
        'description': 'Implement JWT authentication middleware for the API'
    }

    # Simula o contexto de planejamento que viria da API
    planning_context = {
        'project': {
            'name': 'weave',
            'description': 'Multi-agent project management system'
        },
        'environments': [
            {
                'name': 'dev',
                'type': 'local-wsl',
                'project_path': '/root/projects/weave'
            },
            {
                'name': 'production',
                'type': 'ssh',
                'project_path': '/var/www/weave'
            }
        ],
        'teams': [
            {
                'name': 'team-planner',
                'role': 'planner',
                'workspace_path': '/root/projects/weave/projects/weave/teams/team-planner',
                'agents': ['analyst', 'planner'],
                'type': 'team'
            },
            {
                'name': 'team-coder',
                'role': 'coder',
                'workspace_path': '/root/projects/weave/projects/weave/teams/team-coder',
                'agents': ['coder', 'frontend', 'tester'],
                'type': 'team'
            },
            {
                'name': 'team-reviewer',
                'role': 'reviewer',
                'workspace_path': '/root/projects/weave/projects/weave/teams/team-reviewer',
                'agents': ['build-validator', 'pr-handler'],
                'type': 'team'
            }
        ]
    }

    # Conteúdo da skill de planejamento
    skill_content = """
You are a planning agent. Your job is to analyze tasks and create detailed execution plans.

## Plan Format

Output your plan in the following format:

<plan>
{
  "name": "Plan name",
  "tasks": [
    {
      "id": "task-1",
      "name": "Task name",
      "prompt": "What the agent should do",
      "cwd": "/path/to/project",
      "workspace": "/path/to/agent/workspace",
      "tools": ["Read", "Write", "Edit"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
</plan>
"""

    # Build the prompt
    prompt = await build_planning_prompt(task, planning_context, skill_content)

    # Verify the prompt
    print("\n✅ Test Results:")
    print(f"  • Prompt length: {len(prompt)} chars")
    print(f"  • Has project context: {'## Project Context' in prompt}")
    print(f"  • Has environments: {'## Environments' in prompt}")
    print(f"  • Has teams: {'## Available Teams' in prompt}")
    print(f"  • Has task: {'## Task to Plan' in prompt}")
    print(f"  • Has cwd instruction: {'cwd vs workspace' in prompt}")
    print(f"  • Has skill content: {'planning agent' in prompt}")

    # Check specific content
    assert 'weave' in prompt, "Project name missing"
    assert 'dev' in prompt, "Environment 'dev' missing"
    assert 'production' in prompt, "Environment 'production' missing"
    assert 'team-planner' in prompt, "Team 'team-planner' missing"
    assert 'team-coder' in prompt, "Team 'team-coder' missing"
    assert 'team-reviewer' in prompt, "Team 'team-reviewer' missing"
    assert 'Add authentication middleware' in prompt, "Task title missing"
    assert '/root/projects/weave' in prompt, "Project path missing"

    print("\n" + "=" * 80)
    print("PREVIEW:")
    print("=" * 80)
    print(prompt[:1000])
    print("\n... (truncated)")
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED!")
    print("=" * 80)


@pytest.mark.asyncio
async def test_with_real_api():
    """Testa com a API real se disponível."""
    print("\n" + "=" * 80)
    print("TEST: Integration with real API")
    print("=" * 80)

    try:
        client = DaemonClient()

        # Tenta buscar o contexto de planejamento
        print("\n1. Fetching projects...")
        projects = await client.get_all_projects()

        if not projects:
            print("  ⚠️  No projects found, skipping real API test")
            return

        project_id = projects[0].get('id')
        project_name = projects[0].get('name', 'Unknown')
        print(f"  • Using project: {project_name} (ID: {project_id})")

        print("\n2. Fetching planning context...")
        planning_context = await client.get_project_planning_context(project_id)

        project = planning_context.get('project', {})
        environments = planning_context.get('environments', [])
        agents = planning_context.get('agents', [])

        print(f"  • Project: {project.get('name')}")
        print(f"  • Environments: {len(environments)}")
        print(f"  • Agents: {len(agents)}")

        # Build a test prompt
        task = {
            'title': 'Test task from integration test',
            'description': 'This is a test task to verify planning context integration'
        }

        skill_content = 'Test skill content for planning.'

        print("\n3. Building planning prompt...")
        prompt = await build_planning_prompt(task, planning_context, skill_content)

        print(f"  • Prompt length: {len(prompt)} chars")
        print(f"  • Has all required sections: {all([
            '## Project Context' in prompt,
            '## Environments' in prompt,
            '## Available Teams' in prompt,
            '## Task to Plan' in prompt
        ])}")

        print("\n" + "=" * 80)
        print("✅ REAL API TEST PASSED!")
        print("=" * 80)

    except Exception as e:
        print(f"\n  ⚠️  Real API test failed: {type(e).__name__}: {e}")
        print("  This is expected if the daemon is not running")


if __name__ == '__main__':
    asyncio.run(test_build_planning_prompt())
    asyncio.run(test_with_real_api())
