"""
Plan loader and validator.
Reads a JSON plan file and returns a structured Plan object.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Task:
    id: str
    name: str
    prompt: str
    cwd: str
    tools: list[str] = field(default_factory=lambda: ["Read", "Write", "Edit", "Bash", "Glob"])
    permission_mode: str = "acceptEdits"
    depends_on: list[str] = field(default_factory=list)
    max_turns: int | None = None
    system_prompt: str | None = None
    env: dict[str, str] = field(default_factory=dict)

    # Agent identity
    agent_file: str | None = None  # Path to a .md file — injected as system_prompt (like CLAUDE.md)
    workspace: str | None = None  # Path to agent-coder dir with settings.local.json (e.g., /root/projects/agent-client-working/projects/weave/agent-coder)
    env_context: str | None = None  # Environment context string for prompt injection (e.g., "Dev Environment (local-wsl)\nProject path: /root/project1")
    # Skills and sub-agents: place files in <cwd>/.claude/skills/ and <cwd>/.claude/agents/
    # The SDK picks them up natively — no orchestrator involvement needed.

    def __post_init__(self):
        """Generate an ID if missing (defensive fallback for legacy data)."""
        if not self.id:
            import uuid
            self.id = f'task-{uuid.uuid4().hex[:8]}'

    @classmethod
    def from_dict(cls, data: dict) -> 'Task':
        """Create a Task from a dictionary with backward compatibility for workspace_path."""
        return cls(
            id=data.get('id', ''),
            name=data.get('name', ''),
            prompt=data.get('prompt', ''),
            cwd=data.get('cwd', ''),
            # Accept both 'workspace' (new standard) and 'workspace_path' (old) for compatibility
            workspace=data.get('workspace') or data.get('workspace_path', ''),
            tools=data.get('tools', []),
            permission_mode=data.get('permission_mode', 'acceptEdits'),
            depends_on=data.get('depends_on', []),
            max_turns=data.get('max_turns', None),
            system_prompt=data.get('system_prompt', None),
            env=data.get('env', {}),
            agent_file=data.get('agent_file', None),
            env_context=data.get('env_context', None),
        )


@dataclass
class Plan:
    id: str  # Plan ID from API
    name: str
    tasks: list[Task]
    workflow_path: str | None = None  # Path to workflow directory with state.md, plan.json, errors.log

    def get_task(self, task_id: str) -> Task | None:
        return next((t for t in self.tasks if t.id == task_id), None)

    def execution_order(self) -> list[list[Task]]:
        """
        Returns tasks grouped in execution waves.
        Tasks in the same wave can run in parallel (no dependency between them).
        Tasks in wave N depend only on tasks in waves < N.
        """
        resolved: set[str] = set()
        waves: list[list[Task]] = []

        remaining = list(self.tasks)

        while remaining:
            wave = [t for t in remaining if all(dep in resolved for dep in t.depends_on)]
            if not wave:
                unresolved = [t.id for t in remaining]
                raise ValueError(f"Circular dependency or missing task in: {unresolved}")
            waves.append(wave)
            for t in wave:
                resolved.add(t.id)
            remaining = [t for t in remaining if t not in wave]

        return waves


def load_plan(path: str | Path, plan_id: str = "local") -> Plan:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Plan not found: {path}")

    with open(path) as f:
        data = json.load(f)

    tasks = [Task.from_dict(t) for t in data["tasks"]]
    return Plan(id=plan_id, name=data["name"], tasks=tasks)