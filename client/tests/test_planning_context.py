#!/usr/bin/env python3
"""
Test script to verify the planning-context endpoint and DaemonClient method.
"""

import sys
import asyncio
import pytest

# Add the client to the path
sys.path.insert(0, '/root/projects/weave')

from client.orchestrator.daemon_client import DaemonClient

@pytest.mark.asyncio
async def test_planning_context():
    """Test the get_project_planning_context method."""

    # Initialize the client
    client = DaemonClient(
        server_url="http://localhost:3000",
        token="dev-token-change-in-production"
    )

    # Test with a real project ID
    project_id = "3b48bfd7-bdd7-4dad-831e-6f98716765f2"

    print(f"Testing get_project_planning_context for project: {project_id}")
    print("=" * 80)

    try:
        context = await client.get_project_planning_context(project_id)

        if not context:
            print("❌ FAILED: No context returned")
            return False

        print("✅ SUCCESS: Context retrieved successfully!")
        print()

        # Print project info
        if "project" in context:
            print("📋 PROJECT:")
            project = context["project"]
            print(f"  - ID: {project.get('id')}")
            print(f"  - Name: {project.get('name')}")
            print(f"  - Description: {project.get('description')}")
            print(f"  - Settings: {project.get('settings')}")
            print()

        # Print environments
        if "environments" in context:
            print("🌍 ENVIRONMENTS:")
            for env in context["environments"]:
                print(f"  - {env.get('name')} ({env.get('type')})")
                print(f"    Path: {env.get('project_path')}")
                print(f"    Workspace: {env.get('team_workspace')}")
            print()

        # Print agents
        if "agents" in context:
            print("🤖 AGENTS:")
            for agent in context["agents"]:
                print(f"  - {agent.get('name')} (role: {agent.get('role')})")
                print(f"    Workspace: {agent.get('workspace_path')}")
            print()

        print("=" * 80)
        print("✅ All tests passed!")
        return True

    except Exception as e:
        print(f"❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        client.close()

if __name__ == "__main__":
    success = asyncio.run(test_planning_context())
    sys.exit(0 if success else 1)
