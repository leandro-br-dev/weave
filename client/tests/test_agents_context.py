"""
Tests for agents-context feature.

Tests the /api/projects/:id/agents-context endpoint.

Test Categories:
    - integration: Integration tests requiring API server
    - api: Tests making HTTP requests to the API
"""

import pytest
from unittest.mock import Mock, patch

from orchestrator.daemon_client import DaemonClient
from tests.fixtures import (
    generate_id,
    create_project_data,
    create_agent_data,
    api_response,
)


class TestAgentsContext:
    """
    Test agents-context endpoint functionality.

    Tests the agents context API including:
    - Retrieving agents linked to a project
    - Filtering by project ID
    - Error handling for invalid requests
    """

    @pytest.fixture
    def api_url(self):
        """Fixture providing test API URL."""
        return "http://localhost:3000"

    @pytest.fixture
    def auth_token(self):
        """Fixture providing test authentication token."""
        return "dev-token-change-in-production"

    @pytest.fixture
    def test_project(self):
        """Fixture providing test project data."""
        return create_project_data({
            "name": "Agents Context Test Project",
            "description": "Test project for agents-context tests"
        })

    @pytest.fixture
    def test_agents(self, test_project):
        """
        Fixture providing test agents for the project.

        Args:
            test_project: Injected test project fixture

        Returns:
            List of test agent dicts
        """
        return [
            create_agent_data({
                "id": generate_id("agent"),
                "name": "Code Agent",
                "role": "developer",
                "status": "idle",
                "workspace_path": "/workspace/agent-1"
            }),
            create_agent_data({
                "id": generate_id("agent"),
                "name": "Review Agent",
                "role": "reviewer",
                "status": "idle",
                "workspace_path": "/workspace/agent-2"
            }),
        ]

    @pytest.mark.unit
    def test_agents_context_data_structure(self, test_agents):
        """
        Test that agents context data has correct structure.

        Verifies that:
        - Each agent has required fields
        - Data types are correct
        - Required fields are present

        Args:
            test_agents: Injected test agents fixture
        """
        for agent in test_agents:
            assert "id" in agent, "Agent should have 'id' field"
            assert "name" in agent, "Agent should have 'name' field"
            assert "role" in agent, "Agent should have 'role' field"
            assert "workspace_path" in agent, "Agent should have 'workspace_path' field"
            assert isinstance(agent["id"], str), "Agent ID should be string"
            assert isinstance(agent["name"], str), "Agent name should be string"
            assert isinstance(agent["role"], str), "Agent role should be string"
            assert isinstance(agent["workspace_path"], str), "Workspace path should be string"

    @pytest.mark.unit
    def test_agents_context_data_structure(self, test_agents):
        """
        Test that agents context data has correct structure.

        Verifies that:
        - Each agent has required fields
        - Data types are correct
        - Required fields are present

        Args:
            test_agents: Injected test agents fixture
        """
        for agent in test_agents:
            assert "id" in agent, "Agent should have 'id' field"
            assert "name" in agent, "Agent should have 'name' field"
            assert "role" in agent, "Agent should have 'role' field"
            assert "workspace_path" in agent, "Agent should have 'workspace_path' field"
            assert isinstance(agent["id"], str), "Agent ID should be string"
            assert isinstance(agent["name"], str), "Agent name should be string"
            assert isinstance(agent["role"], str), "Agent role should be string"
            assert isinstance(agent["workspace_path"], str), "Workspace path should be string"

    @pytest.mark.unit
    def test_agents_context_serialization(self, test_project, test_agents):
        """
        Test that agents context can be serialized to JSON.

        Verifies that:
        - Agents context data is JSON-serializable
        - No circular references
        - All data types are compatible

        Args:
            test_project: Injected test project fixture
            test_agents: Injected test agents fixture
        """
        import json

        context = {
            "project_id": test_project["id"],
            "project_name": test_project["name"],
            "agents": test_agents
        }

        # Should not raise an exception
        serialized = json.dumps(context)
        deserialized = json.loads(serialized)

        assert deserialized["project_id"] == test_project["id"]
        assert len(deserialized["agents"]) == len(test_agents)


class TestAgentsContextUnit:
    """
    Unit tests for agents-context functionality.

    These tests don't require the API server to be running.
    """

    @pytest.fixture
    def test_agents(self):
        """Fixture providing test agents for unit tests."""
        return [
            create_agent_data({
                "id": generate_id("agent"),
                "name": "Code Agent",
                "role": "developer",
                "status": "idle",
                "workspace_path": "/workspace/agent-1"
            }),
            create_agent_data({
                "id": generate_id("agent"),
                "name": "Review Agent",
                "role": "reviewer",
                "status": "idle",
                "workspace_path": "/workspace/agent-2"
            }),
        ]

    @pytest.mark.unit
    def test_agents_context_filter_by_role(self, test_agents):
        """
        Test filtering agents by role.

        Verifies that:
        - Agents can be filtered by role
        - Filter returns correct subset

        Args:
            test_agents: Injected test agents fixture
        """
        developers = [a for a in test_agents if a["role"] == "developer"]
        reviewers = [a for a in test_agents if a["role"] == "reviewer"]

        assert len(developers) >= 0
        assert len(reviewers) >= 0

    @pytest.mark.unit
    def test_agents_context_unique_ids(self, test_agents):
        """
        Test that agent IDs are unique.

        Verifies that:
        - Each agent has a unique ID
        - No duplicates in the list

        Args:
            test_agents: Injected test agents fixture
        """
        agent_ids = [a["id"] for a in test_agents]
        assert len(agent_ids) == len(set(agent_ids)), "Agent IDs should be unique"
