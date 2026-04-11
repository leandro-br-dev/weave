"""
Runner: executes tasks from a Plan using the Claude Agent SDK.

Supports:
- Sequential and parallel task execution (via dependency waves)
- Per-task cwd, tools, system_prompt, env
- Automatic permission approval (permission_mode=acceptEdits)
- ANTHROPIC_BASE_URL passthrough (custom API endpoint support)
- Context passing between dependent tasks
- Live streaming output to terminal

Notes:
- Uses anyio (not asyncio) to avoid cancel scope conflicts with the SDK
- Parallel tasks within a wave run sequentially (SDK anyio limitation)
- cwd is injected into the prompt so Claude respects the working directory
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

import anyio

from collections.abc import AsyncIterable

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    PermissionResultAllow,
    ResultMessage,
    SystemMessage,
    TaskNotificationMessage,
    TaskProgressMessage,
    TaskStartedMessage,
    TextBlock,
    ToolPermissionContext,
    ToolUseBlock,
    query,
)

from orchestrator import logger
from orchestrator.attachments import build_prompt_with_attachments
from orchestrator.plan import Plan, Task

# Cache for workflow context strings (project_path -> context string).
# Generated once per plan execution and reused across all tasks.
_workflow_context_cache: dict[str, str] = {}

# Tools that should always be auto-approved when running in agent mode.
# ExitPlanMode and EnterPlanMode are Claude Code internal tools that request
# user confirmation — but in daemon/agent mode there is no user to confirm.
# Without auto-approval, the CLI hangs waiting for a response on stdin.
AUTO_APPROVE_TOOLS = frozenset({
    'ExitPlanMode',
    'EnterPlanMode',
})


def _make_can_use_tool_callback(
    permission_mode: str | None,
) -> callable:
    """
    Create a can_use_tool callback for the Claude Agent SDK.

    When the Claude CLI needs user permission to use a tool (e.g. ExitPlanMode),
    it sends a 'can_use_tool' control request. In daemon/agent mode there is no
    interactive user, so we auto-approve:

    - permission_mode='acceptEdits': auto-approve everything (Quick Actions)
    - Auto-approve control tools (ExitPlanMode, EnterPlanMode) unconditionally
    - Otherwise: deny (to be safe)

    Args:
        permission_mode: The task's permission mode ('acceptEdits', etc.)

    Returns:
        An async callable compatible with ClaudeAgentOptions.can_use_tool
    """
    async def can_use_tool(
        tool_name: str,
        tool_input: dict,
        context: ToolPermissionContext,
    ) -> PermissionResultAllow:
        if permission_mode == 'acceptEdits' or tool_name in AUTO_APPROVE_TOOLS:
            logger.info(f"[permission] Auto-approved tool '{tool_name}' (mode={permission_mode})")
            return PermissionResultAllow()
        else:
            logger.warning(f"[permission] Denied tool '{tool_name}' — no interactive user in daemon mode")
            from claude_agent_sdk import PermissionResultDeny
            return PermissionResultDeny(message=f"Tool '{tool_name}' requires user approval")

    return can_use_tool


async def _string_to_async_iterable(text: str) -> AsyncIterable[dict]:
    """
    Convert a string prompt to an AsyncIterable of SDK message dicts.

    The Claude Agent SDK requires an AsyncIterable prompt when can_use_tool
    is set. This helper wraps a single user message in an async generator.
    """
    yield {
        "type": "user",
        "session_id": "",
        "message": {"role": "user", "content": text},
        "parent_tool_use_id": None,
    }


# Structured output patterns for quick actions
STRUCTURED_PATTERNS = [
    ('plan', r'<plan>\s*({.*?})\s*</plan>'),
    ('review', r'<review>\s*({.*?})\s*</review>'),
    ('diagnosis', r'<diagnosis>\s*({.*?})\s*</diagnosis>'),
]


def agent_name_from_workspace(workspace: str | None) -> str:
    """Extract agent name from workspace path (last non-empty segment)."""
    if not workspace:
        return 'unknown-agent'
    # Last non-empty segment of the path
    return workspace.rstrip('/').split('/')[-1]


def _read_file(path: str, label: str = 'file') -> str | None:
    """Read file contents, returning None on error."""
    try:
        return Path(path).read_text(encoding='utf-8')
    except Exception as e:
        logger.warning(f'Could not read {label} at {path}: {e}')
        return None


def _build_handoff_section(workflow_path: str | None) -> str | None:
    """
    Build the workflow handoff section for multi-agent communication.

    Loads the SKILL.md from native-skills/workflow_handoff/ and substitutes
    the [WORKFLOW_DIR] placeholder with the actual workflow directory path.

    Args:
        workflow_path: Absolute path to the workflow directory

    Returns:
        Formatted handoff section string, or None if no workflow_path
    """
    if not workflow_path:
        return None

    # Load the handoff skill template
    skill_path = Path(__file__).resolve().parent.parent.parent / 'native-skills' / 'workflow_handoff' / 'SKILL.md'
    if not skill_path.exists():
        logger.warning(f'Workflow handoff skill not found at {skill_path}')
        return None

    try:
        content = skill_path.read_text(encoding='utf-8')
    except Exception as e:
        logger.warning(f'Could not read workflow handoff skill: {e}')
        return None

    # Substitute the placeholder with the actual path
    content = content.replace('[WORKFLOW_DIR]', workflow_path)

    logger.info(f"[Handoff] Skill loaded, placeholder replaced with: {workflow_path}")

    return content


def prepare_agent_docs_dir(workspace: str | None, plan_id: str, task_id: str) -> str:
    """
    Return the documentation directory path for agent documentation.

    Documentation is now stored in the workflow directory (alongside plan.json,
    state.md, errors.log) rather than in a legacy .agent-docs subdirectory
    inside the workspace.  The caller should pass workflow_path directly when
    available.

    This function is kept for backward compatibility.  When *workspace* is
    provided and contains 'workflows' in the path, it is assumed to already be
    the workflow directory and is returned as-is.  Otherwise an empty string is
    returned — callers should prefer passing ``docs_dir=workflow_path`` to
    :func:`build_prompt` instead.

    Args:
        workspace: Path to the agent's workspace (or workflow directory)
        plan_id: ID of the plan being executed
        task_id: ID of the task being executed

    Returns:
        Path to the documentation directory, or empty string if unavailable
    """
    if not workspace:
        return ''

    # If the path already looks like a workflow directory, return it directly
    if 'workflows' in workspace:
        return workspace

    return ''
    os.makedirs(docs_dir, exist_ok=True)
    return docs_dir


def _natural_sort_key(s: str) -> list[int | str]:
    """Generate a sort key that sorts numeric prefixes naturally (001 before 010)."""
    parts: list[int | str] = []
    for part in re.split(r'(\d+)', s):
        if part.isdigit():
            parts.append(int(part))
        else:
            parts.append(part)
    return parts


def list_agent_docs(docs_dir: str) -> str:
    """
    Scan and list workflow documentation files with their paths.

    Args:
        docs_dir: Path to the workflow directory (plan.json, state.md, errors.log, etc.)

    Returns:
        Formatted string listing all files sorted by name (natural sort for
        numeric prefixes), or empty string if directory doesn't exist or is empty.
    """
    dir_path = Path(docs_dir)
    if not dir_path.exists() or not dir_path.is_dir():
        return ''

    files = [f.name for f in dir_path.iterdir() if f.is_file()]
    if not files:
        return ''

    files.sort(key=_natural_sort_key)

    lines = [
        '## Workflow Directory',
        '',
        f'Path: {docs_dir}/',
        '',
        'Existing files:',
    ]
    for f in files:
        lines.append(f'- {f}')
    lines.append(f'')
    lines.append(f'Total: {len(files)} files')

    return '\n'.join(lines)


def extract_structured_output(full_text: str) -> dict | None:
    """
    Extract the last structured output block found in the agent output.

    Searches for JSON blocks wrapped in <plan>, <review>, <diagnosis> tags.
    These are used by quick actions to produce structured results for frontend approval.

    Uses the LAST occurrence of each pattern type to avoid capturing template examples
    from skill definitions (e.g., planner skill contains an example <plan> block before
    the actual generated plan).

    Args:
        full_text: Complete output text from the agent execution

    Returns:
        dict with 'type' (plan|review|diagnosis) and 'content' (parsed JSON),
        or None if no structured output found
    """
    for output_type, pattern in STRUCTURED_PATTERNS:
        # Find all matches and use the last one (not the first)
        matches = list(re.finditer(pattern, full_text, re.DOTALL))
        if matches:
            # Use the last match — the real generated plan, not template examples
            last_match = matches[-1]
            raw_content = last_match.group(1).strip()
            if not raw_content:
                continue

            # JSON-parsed content
            try:
                content = json.loads(raw_content)
                return {'type': output_type, 'content': content}
            except json.JSONDecodeError:
                # Pattern matched but JSON is invalid - continue to next pattern
                continue
    return None


# Improvement output files produced by quick-action workflows.
# The agent writes these JSON files to the workflow directory and validates
# them with weave-validate before finishing.  We read them here so the
# structured_output is available for the frontend.
_IMPROVEMENT_FILES = [
    ('agent',    'agent-improvement.json'),
    ('team',     'team-improvement.json'),
]


def load_improvement_from_workflow(workflow_path: str | None) -> dict | None:
    """
    Try to read an improvement JSON file from the workflow directory.

    Used as a fallback when the agent did not emit structured XML tags
    but was expected to write a JSON file (agent / team improvement flows).

    Args:
        workflow_path: Absolute path to the workflow directory

    Returns:
        dict with 'type' and 'content', or None if nothing found / invalid
    """
    if not workflow_path:
        return None

    wf_dir = Path(workflow_path)
    if not wf_dir.is_dir():
        return None

    for output_type, filename in _IMPROVEMENT_FILES:
        filepath = wf_dir / filename
        if not filepath.exists():
            continue

        raw = _read_file(str(filepath), label=f'improvement file ({filename})')
        if not raw:
            continue

        try:
            content = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"[workflow] {filename} exists but is not valid JSON — skipping")
            continue

        if not isinstance(content, dict) or not content:
            logger.warning(f"[workflow] {filename} parsed but is empty/non-object — skipping")
            continue

        logger.info(f"[workflow] Loaded improvement from {filename}: keys={list(content.keys())}")
        return {'type': output_type, 'content': content}

    return None


def extract_review_from_output(text: str) -> dict | None:
    """
    Extract JSON review from <review>...</review> tags.

    This function extracts structured review output from agent text.
    Reviews are used by reviewer agents to provide structured feedback.

    Args:
        text: Agent output text that may contain <review> tags

    Returns:
        Parsed review dict with result_status, result_notes, issues, next_steps
        or None if no valid review found
    """
    parts = text.split('<review>')
    for i in range(1, len(parts)):
        closing = parts[i].find('</review>')
        if closing == -1:
            continue
        raw = parts[i][:closing].strip()
        try:
            parsed = json.loads(raw)
            if parsed.get('result_status') in ('success', 'partial', 'needs_rework'):
                return parsed
        except (json.JSONDecodeError, KeyError):
            continue
    return None


def _check_deny_rules(tool_name: str, tool_input: dict, deny_rules: list[str]) -> tuple[bool, str]:
    """
    Check if a tool operation matches any deny rule.

    Args:
        tool_name: Name of the tool being used
        tool_input: Input parameters for the tool
        deny_rules: List of deny rules from settings.local.json

    Returns:
        Tuple of (needs_approval, matched_rule)
    """
    for rule in deny_rules:
        # Exact match: "Bash" or "Write"
        if rule == tool_name:
            return True, rule

        # Pattern match: "Bash(rm -rf *)" or "Write(/etc/*)"
        if rule.startswith(f"{tool_name}("):
            # Extract pattern between parentheses
            pattern = rule[len(tool_name) + 1:-1]

            # Check if pattern matches input
            input_str = str(tool_input)

            # Simple wildcard matching
            if "*" in pattern:
                # Convert glob pattern to simple substring check
                base_pattern = pattern.replace("*", "").strip()
                if base_pattern and base_pattern in input_str:
                    return True, rule
            elif pattern in input_str:
                return True, rule

    return False, ""


def _load_deny_rules(workspace: str | None, cwd: str) -> list[str]:
    """
    Load deny rules from workspace/.claude/settings.local.json.

    Args:
        workspace: Agent workspace (team) directory — the ONLY source for settings.
                   Do NOT fall back to cwd; cwd is the project source directory,
                   not a team workspace. See _apply_workspace_env for rationale.
        cwd: Task working directory (unused — kept for API compatibility).

    Returns:
        List of deny rules (empty list if no rules found or no workspace set)
    """
    if not workspace:
        return []

    settings_path = Path(workspace) / ".claude" / "settings.local.json"

    if not settings_path.exists():
        return []

    try:
        data = json.loads(settings_path.read_text(encoding="utf-8"))
        return data.get("permissions", {}).get("deny", [])
    except Exception as e:
        logger.warn(f"Could not load deny rules from {settings_path}: {e}")
        return []


# Directory for storing context notes between tasks
CONTEXT_DIR = Path('/tmp/agent-client-context')


@dataclass
class TaskResult:
    task_id: str
    success: bool
    output: str = ""          # Captured ResultMessage.result — passed as context to dependents
    error: str | None = None
    sdk_session_id: str | None = None  # Claude Code SDK session ID from this task


def _init_context_dir(plan_name: str) -> Path:
    """
    Create and return the context directory for a plan.

    Args:
        plan_name: Name of the plan (used to create a unique subdirectory)

    Returns:
        Path to the context directory
    """
    ctx_dir = CONTEXT_DIR / plan_name.replace(' ', '_')
    ctx_dir.mkdir(parents=True, exist_ok=True)
    return ctx_dir


def _save_task_note(ctx_dir: Path, task: Task, result_text: str) -> None:
    """
    Save a task result as a markdown note in the context directory.

    Args:
        ctx_dir: Context directory for this plan
        task: The task that was executed
        result_text: The output/result from the task
    """
    note_path = ctx_dir / f'{task.id}.md'
    note = f"""# Task: {task.name} (ID: {task.id})
## Status: success

## Summary
{result_text[:2000] if result_text else 'No output'}
"""
    note_path.write_text(note)


def _load_dependency_context(task: Task, ctx_dir: Path) -> str:
    """
    Load context notes from all dependency tasks.

    Args:
        task: The task whose dependencies should be loaded
        ctx_dir: Context directory for this plan

    Returns:
        Formatted context string with all dependency notes
    """
    if not task.depends_on:
        return ""

    context_sections = []
    for dep_id in task.depends_on:
        note_path = ctx_dir / f'{dep_id}.md'
        if note_path.exists():
            context_sections.append(note_path.read_text())

    if not context_sections:
        return ""

    context_block = '\n---\n'.join(context_sections)
    return f"""## Context from previous tasks

{context_block}

---

"""


def _apply_workspace_env(workspace: str | None, cwd: str) -> None:
    """
    Read env vars from workspace/.claude/settings.local.json and apply them to os.environ.

    The Claude Agent SDK resolves authentication BEFORE loading project settings,
    so env vars declared in settings.local.json arrive too late to affect auth.
    We apply them here, before the SDK is even instantiated.

    workspace (team workspace dir) is the ONLY source of settings.local.json:
    - workspace = where CLAUDE.md and .claude/settings.local.json live
                 (e.g., ~/.local/share/weave/projects/weave/teams/team-coder)
    - cwd = where the agent works (e.g., /tmp, /root/projects/test_web)

    IMPORTANT: Do NOT add a fallback to cwd/.claude/settings.local.json.
    The cwd is the project source directory, NOT a team workspace. A settings
    file there would only exist by accident and would mask configuration errors.
    If the workspace settings file is missing, the team workspace needs to be
    created/fixed via the /agents page — silently falling back hides the real problem.

    Shell environment always wins: we only set a var if it is not already set.
    """
    if not workspace:
        logger.warn(
            f"⚠ No workspace specified — cannot locate settings.local.json\n"
            f"  → Agent will use default OAuth auth (may expire)\n"
            f"  → Ensure the plan task has a 'workspace' pointing to the team directory"
        )
        return

    settings_path = Path(workspace) / ".claude" / "settings.local.json"

    if not settings_path.exists():
        logger.warn(
            f"⚠ No settings.local.json found at {settings_path}\n"
            f"  → Agent will use default OAuth auth (may expire)\n"
            f"  → Create workspace via /agents page with proper ANTHROPIC_BASE_URL"
        )
        return

    try:
        data = json.loads(settings_path.read_text(encoding="utf-8"))
        env_vars: dict[str, str] = data.get("env", {})
        for key, value in env_vars.items():
            if key not in os.environ:
                os.environ[key] = str(value)
                logger.info(f"  env from settings.local.json ({workspace}): {key}={value}")
    except Exception as e:
        logger.warn(f"Could not read {settings_path}: {e}")


def generate_and_cache_context(project_path: str) -> str:
    """
    Generate a workflow context string (directory tree + git info) for a project,
    caching the result so it is only generated once per plan execution.

    Uses the ``project_context`` module when available, otherwise returns empty
    string (graceful fallback).

    Args:
        project_path: Absolute path to the project directory

    Returns:
        Cached or newly-generated workflow context markdown string
    """
    if project_path in _workflow_context_cache:
        return _workflow_context_cache[project_path]

    if not project_path or not Path(project_path).exists():
        _workflow_context_cache[project_path] = ''
        return ''

    try:
        from orchestrator.project_context import generate_workflow_context
        _workflow_context_cache[project_path] = generate_workflow_context(project_path)
    except Exception as e:
        logger.warning(f'Failed to generate workflow context: {e}')
        _workflow_context_cache[project_path] = ''

    return _workflow_context_cache[project_path]


def build_system_prompt(task: Task, plan_id: str | None = None, workflow_path: str | None = None) -> str | None:
    """
    Build the system prompt for a task.
    Priority: agent_file > system_prompt field.
    If both exist, agent_file wins (it's the authoritative identity file).

    Args:
        task: Task to build system prompt for
        plan_id: Optional plan ID for documentation directory injection
        workflow_path: Optional path to workflow directory (preferred over .agent-docs)

    Returns:
        System prompt string, or None if no prompt is configured
    """
    if task.agent_file:
        content = _read_file(task.agent_file, "agent_file")
        if content:
            base_prompt = content
        else:
            base_prompt = task.system_prompt
    else:
        base_prompt = task.system_prompt

    # If no base prompt, return None
    if not base_prompt:
        return None

    # If a workflow_path is available, inject documentation guidelines there
    # (preferred over legacy .agent-docs)
    docs_dir = workflow_path or ''
    if task.workspace and plan_id and not docs_dir:
        # Legacy fallback — should no longer be reached
        docs_dir = os.path.join(task.workspace, '.agent-docs', plan_id)

    if docs_dir:
        # Ensure directory exists
        os.makedirs(docs_dir, exist_ok=True)
        # Count existing files to determine next numeric prefix
        existing_files = []
        docs_path = Path(docs_dir)
        if docs_path.exists() and docs_path.is_dir():
            existing_files = [f.name for f in docs_path.iterdir() if f.is_file()]
        next_num = len(existing_files) + 1
        # Build sanitized task name for completion doc
        sanitized_task_name = re.sub(r'[^a-zA-Z0-9]+', '-', task.name.lower()).strip('-')

        docs_section = f"""

## Documentation Workflow

Your documentation directory for this workflow:
- **Path**: `{docs_dir}/`

### Rules:
1. **Naming**: All docs must use numeric prefix with 3 digits: `001-`, `002-`, `003-`, etc.
2. **Before starting**: Read the LAST (highest-numbered) document in this directory to understand what was done previously.
3. **During work**: Write findings, decisions, and context to numbered files in this directory.
4. **At completion**: ALWAYS write a final document named `{next_num:03d}-{sanitized_task_name}-completion.md` explaining what was accomplished, what changed, and any important notes for the next agent.
5. **File format**: Use kebab-case after the numeric prefix: `001-context-analysis.md`, `002-implementation.md`

### NEVER:
- Create .md files in the target project root
- Create README.md, REPORT.md, SUMMARY.md, TEST_*.md unless explicitly requested
- Write documentation outside this directory
"""
        return base_prompt + docs_section

    return base_prompt


def build_prompt(task: Task, context: dict[str, TaskResult], ctx_dir: Path | None = None, workflow_context: str = '', docs_dir: str | None = None, attachment_ids: list[str] | None = None, api_base_url: str | None = None, token: str | None = None, workflow_path: str | None = None) -> str:
    """
    Build the final prompt for a task, injecting:
    0. Workflow handoff rules (if workflow_path provided)
    1. Docs inventory (if docs_dir provided)
    2. Project context (directory structure + git info) — if workflow_context provided
    3. Environment context (if available from selected environment)
    4. Working directory (so Claude doesn't create files in /tmp)
    5. Context from upstream tasks (from saved notes if ctx_dir provided, otherwise from memory)
    6. Attachment content (if attachment_ids provided with api_base_url and token)
    7. The task prompt itself

    Skills and sub-agents are NOT injected here.
    They live natively in the project under:
      <cwd>/.claude/skills/<skill-name>/SKILL.md   — discovered via frontmatter, loaded on demand
      <cwd>/.claude/agents/<agent-name>.md          — invoked by the parent agent via Task tool

    The SDK uses the same agent loop as Claude Code CLI and picks these up automatically
    when cwd is set correctly. Only the frontmatter (name + description) is loaded at
    startup. Full content is read only when Claude decides to invoke a skill.

    Args:
        task: Task to build prompt for
        context: Results from previous tasks (used as fallback if no ctx_dir)
        ctx_dir: Context directory with saved dependency notes (takes precedence)
        workflow_context: Optional pre-generated project context string (directory tree + git info)
        docs_dir: Optional path to workflow directory for docs inventory
        attachment_ids: Optional list of attachment UUIDs to include in the prompt
        api_base_url: Optional API base URL for fetching attachment content
        token: Optional auth token for fetching attachment content
        workflow_path: Optional path to workflow directory (state.md, plan.json, errors.log)

    Returns:
        The formatted prompt string
    """
    parts: list[str] = []

    # 0. Inject workflow handoff rules (multi-agent communication protocol)
    handoff_section = _build_handoff_section(workflow_path)
    if handoff_section:
        parts.append(handoff_section)
        parts.append('')
        logger.debug(f"[{task.id}] Workflow handoff injected: path={workflow_path}, section_len={len(handoff_section)}")
    else:
        logger.debug(f"[{task.id}] No workflow handoff: workflow_path={workflow_path}")

    # 1. Inject docs inventory at the very beginning
    if docs_dir:
        docs_inventory = list_agent_docs(docs_dir)
        if docs_inventory:
            parts.append(docs_inventory)
            parts.append('')

    # 1. Inject project context (directory structure + git info)
    if workflow_context:
        parts.append(workflow_context)
        parts.append('')

    # 2. Inject environment context if available (from selected environment in the form)
    if task.env_context:
        parts.append(f"[Environment: {task.env_context}]")
        parts.append("")

    # 3. Inject cwd explicitly — critical: without this Claude ignores the cwd option
    parts.append(f"Working directory: {task.cwd}")
    parts.append(f"All files must be created inside {task.cwd}. Do not use /tmp or any other path.\n")

    # 4. Context from upstream tasks
    # Prefer saved notes from disk if available (richer context), otherwise fall back to memory
    if ctx_dir:
        dependency_context = _load_dependency_context(task, ctx_dir)
        if dependency_context:
            parts.append(dependency_context)
    else:
        # Fallback to in-memory context (backward compatibility)
        upstream = [context[dep] for dep in task.depends_on if dep in context]
        if upstream:
            parts.append("## Context from previous tasks")
            for r in upstream:
                parts.append(f"### [{r.task_id}]\n{r.output}\n")
            parts.append("")

    # 5. Attachment content (if provided)
    # Text file contents are inlined; images and binary files are noted.
    task_prompt = task.prompt
    if attachment_ids and api_base_url and token:
        try:
            task_prompt = build_prompt_with_attachments(
                text_prompt=task.prompt,
                attachment_ids=attachment_ids,
                api_base_url=api_base_url,
                token=token,
            )
            logger.info(f"[{task.id}] Built prompt with {len(attachment_ids)} attachment(s)")
        except Exception as e:
            logger.warning(f"[{task.id}] Failed to build prompt with attachments: {e}")

    # 6. Task instructions
    parts.append("## Your task")
    parts.append(task_prompt)

    return "\n".join(parts)


async def build_agent_context(
    task: Task,
    client: Any | None,
    plan_id: str | None,
) -> str:
    """
    Build agent context for planner agents.

    If the task's workspace is a planner agent, fetch the list of available
    agents for the project and format it for injection into the prompt.

    Args:
        task: The task being executed
        client: Optional DaemonClient instance
        plan_id: Optional plan ID (needed to fetch project_id)

    Returns:
        Formatted agents context string, or empty string if not applicable
    """
    if not client or not plan_id:
        return ""

    # Check if this task uses a planner agent
    # We check both the workspace path and use a simple heuristic
    workspace = task.workspace or ""
    is_planner = "planner" in workspace.lower()

    if not is_planner:
        return ""

    # Get project_id from the plan
    try:
        # We need to fetch plan details to get project_id
        # This requires the client to have a get_plan method or similar
        # For now, we'll check if there's a way to get it from task metadata
        if hasattr(task, 'project_id') and task.project_id:
            project_id = task.project_id
        else:
            # Try to get plan details from client
            # Note: This requires the client to expose a get_plan method
            # If it doesn't exist, we'll return empty string
            if not hasattr(client, 'get_plan'):
                logger.debug("Cannot fetch project_id: client doesn't have get_plan method")
                return ""

            plan_resp = client.get_plan(plan_id)
            if plan_resp.error or not plan_resp.data:
                logger.debug(f"Cannot fetch project_id: {plan_resp.error}")
                return ""

            project_id = plan_resp.data.get("project_id")
            if not project_id:
                return ""

        # Fetch agents context for the project
        agents_context = await client.get_project_agents_context(project_id)
        return agents_context

    except Exception as e:
        logger.warning(f"Failed to build agent context: {e}")
        return ""


async def should_skip_task(task_id: str, plan_id: str, client: Any) -> bool:
    """
    Check if a task has already been completed successfully.

    Args:
        task_id: ID of the task to check
        plan_id: ID of the plan
        client: DaemonClient instance for fetching logs

    Returns:
        True if the task was already completed successfully, False otherwise
    """
    try:
        logs_response = await client.get_plan_logs(plan_id)
        if logs_response.error:
            logger.warn(f"Failed to fetch logs for resume check: {logs_response.error}")
            return False

        logs = logs_response.data or []

        # Check for successful task completion indicators:
        # 1. Logs with level='success' for this task_id
        # 2. Logs with message starting with 'Task completed' or '✔ finished' for this task_id
        for log in logs:
            if log.get('task_id') != task_id:
                continue

            level = log.get('level')
            message = log.get('message', '')

            if level == 'success':
                return True
            if message.startswith('Task completed') or message.startswith('✔ finished'):
                return True

        return False
    except Exception as e:
        logger.warn(f"Error checking if task should be skipped: {e}")
        return False


async def run_task(
    task: Task,
    context: dict[str, TaskResult],
    ctx_dir: Path | None = None,
    log_callback: callable[[str, str, str], None] | None = None,
    client: Any | None = None,  # DaemonClient instance
    plan_id: str | None = None,  # Plan ID for approval requests
    project_path: str | None = None,  # Project path for workflow context generation
    attachment_ids: list[str] | None = None,  # Attachment UUIDs for the task
    api_base_url: str | None = None,  # API base URL for fetching attachments
    token: str | None = None,  # Auth token for fetching attachments
    workflow_path: str | None = None,  # Path to workflow directory (state.md, plan.json, errors.log)
    sdk_session_id: str | None = None,  # Claude Code SDK session ID for resume
) -> TaskResult:
    """
    Run a single task and stream output to terminal.

    Args:
        task: Task to execute
        context: Results from previous tasks
        ctx_dir: Context directory for saving/loading dependency notes
        log_callback: Optional callback(task_id, level, message) for log collection
        client: Optional DaemonClient for approval requests
        plan_id: Optional plan ID for approval requests
        project_path: Optional project path for generating workflow context

    Returns:
        TaskResult with success status and output
    """
    # Skip already completed tasks when resuming
    if client and plan_id and await should_skip_task(task.id, plan_id, client):
        logger.info(f"↻ Skipping already completed task: {task.id} ({task.name})")
        if log_callback:
            log_callback(task.id, "info", f"↻ Skipping already completed task: {task.name}")

        # Load the task's output from context note if available
        if ctx_dir:
            note_path = ctx_dir / f'{task.id}.md'
            if note_path.exists():
                note_content = note_path.read_text()
                # Extract the summary section from the note
                lines = note_content.split('\n')
                summary_lines = []
                in_summary = False
                for line in lines:
                    if line.startswith('## Summary'):
                        in_summary = True
                        continue
                    if in_summary:
                        summary_lines.append(line)

                output = '\n'.join(summary_lines).strip()
                return TaskResult(task_id=task.id, success=True, output=output)

        # If no saved context, still mark as success (task was completed before)
        return TaskResult(task_id=task.id, success=True, output="")

    logger.task_start(task.id, task.name, task.cwd)

    # Log agent name for better traceability
    agent_name = agent_name_from_workspace(task.workspace)
    logger.info(f'[{task.id}] Agent: {agent_name} | cwd: {task.cwd}')

    # Prepare agent documentation directory
    # Use workflow_path when available (preferred over legacy .agent-docs)
    docs_dir = ''
    if workflow_path:
        docs_dir = workflow_path
        if docs_dir:
            logger.info(f'[{task.id}] Workflow docs dir: {docs_dir}')
    elif plan_id and task.workspace:
        legacy_dir = prepare_agent_docs_dir(task.workspace, plan_id, task.id)
        if legacy_dir:
            docs_dir = legacy_dir
            logger.info(f'[{task.id}] Agent docs dir (legacy): {docs_dir}')

    # Send initial log message
    if log_callback:
        log_callback(task.id, "info", f"▶ Starting task: {task.name}")

    # Validate cwd exists before attempting to create ClaudeAgentOptions
    if not Path(task.cwd).exists():
        error_msg = f"Workspace directory does not exist: {task.cwd}"
        logger.task_error(task.id, error_msg)
        return TaskResult(task_id=task.id, success=False, error=error_msg)

    # Apply env vars from workspace settings.local.json BEFORE SDK init.
    # The SDK resolves auth on startup — if ANTHROPIC_BASE_URL isn't in os.environ
    # at that point, it falls back to the global ~/.claude OAuth token.
    _apply_workspace_env(task.workspace, task.cwd)

    # Apply any task-level env overrides from the plan (highest priority)
    if task.env:
        os.environ.update(task.env)

    # Ensure "Skill" is in allowed tools so the SDK can invoke skills on demand
    tools = list(task.tools)
    if "Skill" not in tools:
        tools.append("Skill")

    # Build can_use_tool callback to handle ExitPlanMode and other
    # permission requests that would otherwise hang in daemon mode.
    can_use_tool = _make_can_use_tool_callback(task.permission_mode)

    # Build SDK options
    options_kwargs: dict = {
        "cwd": task.cwd,
        "allowed_tools": tools,
        "permission_mode": task.permission_mode,
        "max_turns": task.max_turns,
        "system_prompt": build_system_prompt(task, plan_id, workflow_path=workflow_path),
        # "project" loads CLAUDE.md, .claude/skills/, .claude/agents/, .claude/settings*.json
        # from the cwd. Without this, all project-level features are silently ignored.
        "setting_sources": ["project"],
        "can_use_tool": can_use_tool,
    }

    # Unset CLAUDECODE to prevent nested session detection
    # This allows the daemon to run within Claude Code sessions
    if "CLAUDECODE" in os.environ:
        del os.environ["CLAUDECODE"]

    # If we have a sdk_session_id, pass it to resume the Claude Code session.
    # This preserves the full conversation context from the previous execution,
    # allowing resume after failures or daemon restarts.
    if sdk_session_id:
        options_kwargs["resume"] = sdk_session_id
        logger.info(f"[{task.id}] Resuming Claude Code session: {sdk_session_id[:12]}...")

    options = ClaudeAgentOptions(**options_kwargs)

    # Generate or retrieve cached workflow context
    workflow_context = generate_and_cache_context(project_path or task.cwd)

    prompt = build_prompt(task, context, ctx_dir, workflow_context, docs_dir=docs_dir or workflow_path or None, attachment_ids=attachment_ids, api_base_url=api_base_url, token=token, workflow_path=workflow_path)

    # Inject agents context for planner agents
    agent_context = await build_agent_context(task, client, plan_id)
    if agent_context:
        # Prepend agents context to the prompt with a separator
        prompt = f"{agent_context}\n\n---\n\n{prompt}"
        logger.debug(f"[{task.id}] Injected agents context for planner agent")

    # Log prompt summary (first 200 chars to verify handoff injection without spam)
    logger.info(f"[{task.id}] Prompt built: {len(prompt)} chars, workflow_path={workflow_path}, starts_with={repr(prompt[:200])}")

    final_result: ResultMessage | None = None
    task_sdk_session_id: str | None = None
    logs_buffer: list[dict] = []
    captured_texts: list[str] = []  # Capture all output text for structured output detection

    def send_logs_if_needed() -> None:
        """Send buffered logs if callback is available and buffer has content."""
        if log_callback and logs_buffer:
            for entry in logs_buffer:
                log_callback(entry["task_id"], entry["level"], entry["message"])
            logs_buffer.clear()

    def add_log(level: str, message: str) -> None:
        """Add a log entry to buffer and optionally send immediately."""
        entry = {
            "task_id": task.id,
            "level": level,
            "message": message,
        }
        logs_buffer.append(entry)

        # Send in batch: every 5 logs or immediately if callback prefers
        if log_callback and len(logs_buffer) >= 5:
            send_logs_if_needed()

    try:
        # IMPORTANT: do NOT return or break inside this loop.
        # Exiting early sends GeneratorExit to the SDK generator, which tries to close
        # an anyio cancel scope from a different task — causing RuntimeError.
        # Let the generator finish naturally; ResultMessage is always the last message.
        # When can_use_tool is set, the SDK requires an AsyncIterable prompt.
        async for message in query(prompt=_string_to_async_iterable(prompt), options=options):
            # Debug: log message type for first few messages
            if len(logs_buffer) == 0:
                logger.debug(f"[{task.id}] Message type: {type(message).__name__}, module: {type(message).__module__}")

            # Handle AssistantMessage (contains text and tool use)
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock) and block.text.strip():
                        logger.task_output(task.id, block.text)
                        add_log("info", block.text)
                        captured_texts.append(block.text)  # Capture for structured output
                    elif isinstance(block, ToolUseBlock):
                        logger.task_tool(task.id, block.name)
                        add_log("debug", f"⚙ {block.name}")

                        # Check if this tool requires approval
                        # When permission_mode is 'acceptEdits', the user has opted
                        # into auto-approval, so skip the deny-rules approval flow.
                        if client and plan_id and getattr(task, 'permission_mode', None) != 'acceptEdits':
                            deny_rules = _load_deny_rules(task.workspace, task.cwd)
                            needs_approval, matched_rule = _check_deny_rules(
                                block.name, block.input, deny_rules
                            )

                            if needs_approval:
                                logger.warning(
                                    f"[approval] Tool '{block.name}' matches deny rule "
                                    f'"{matched_rule}" — requesting approval'
                                )
                                add_log(
                                    "warning",
                                    f"⚠ Approval required for '{block.name}' "
                                    f"(rule: {matched_rule})",
                                )

                                reason = (
                                    f"Tool `{block.name}` matches deny rule: "
                                    f"`{matched_rule}`"
                                )

                                try:
                                    # Request approval
                                    approval_resp = client.request_approval(
                                        plan_id=plan_id,
                                        task_id=task.id,
                                        tool=block.name,
                                        input_data=block.input,
                                        reason=reason,
                                    )

                                    if approval_resp.error:
                                        error_msg = (
                                            f"Failed to request approval: "
                                            f"{approval_resp.error}"
                                        )
                                        logger.task_error(task.id, error_msg)
                                        add_log("error", error_msg)
                                        # Continue execution - fail-safe behavior

                                    elif approval_resp.data:
                                        approval_id = approval_resp.data.get("id")
                                        logger.info(
                                            f"[approval] Waiting for response "
                                            f"(ID: {approval_id})..."
                                        )
                                        add_log(
                                            "info",
                                            f"⏳ Waiting for approval (ID: {approval_id})...",
                                        )

                                        # Wait for decision
                                        decision_resp = client.wait_for_approval(approval_id)

                                        if decision_resp.error:
                                            error_msg = (
                                                f"Approval polling error: "
                                                f"{decision_resp.error}"
                                            )
                                            logger.task_error(task.id, error_msg)
                                            add_log("error", error_msg)
                                            # Continue execution - fail-safe behavior

                                        elif decision_resp.data:
                                            decision = decision_resp.data
                                            logger.info(f"[approval] Decision: {decision}")
                                            add_log("info", f"✅ Approval decision: {decision}")

                                            if decision == "denied":
                                                # Tool use was denied - stop execution
                                                error_msg = (
                                                    f"Tool '{block.name}' was denied approval. "
                                                    f"Task execution stopped."
                                                )
                                                logger.task_error(task.id, error_msg)
                                                add_log("error", f"❌ {error_msg}")
                                                return TaskResult(
                                                    task_id=task.id,
                                                    success=False,
                                                    error=error_msg,
                                                )
                                            elif decision == "timeout":
                                                # Approval timed out
                                                error_msg = (
                                                    f"Tool '{block.name}' approval timed out. "
                                                    f"Task execution stopped."
                                                )
                                                logger.task_error(task.id, error_msg)
                                                add_log("error", f"⏱ {error_msg}")
                                                return TaskResult(
                                                    task_id=task.id,
                                                    success=False,
                                                    error=error_msg,
                                                )
                                            # If 'approved', continue with tool execution

                                except Exception as e:
                                    error_msg = f"Error during approval flow: {e}"
                                    logger.task_error(task.id, error_msg)
                                    add_log("error", error_msg)
                                    # Continue execution - fail-safe behavior

            # Handle subagent lifecycle messages (Agent tool / Task tool spawning)
            elif isinstance(message, TaskStartedMessage):
                logger.subagent_start(
                    task.id,
                    message.task_id,
                    message.description,
                    task_type=getattr(message, 'task_type', None),
                )
                type_label = f" ({message.task_type})" if getattr(message, 'task_type', None) else ""
                add_log("info", f"🔄 Subagent spawned: {message.task_id}{type_label} — {message.description[:120]}")
                send_logs_if_needed()  # Flush immediately so the log is visible

            elif isinstance(message, TaskProgressMessage):
                usage = getattr(message, 'usage', None) or {}
                tokens = usage.get('total_tokens', 0)
                last_tool = getattr(message, 'last_tool_name', None)
                logger.subagent_progress(
                    task.id,
                    message.task_id,
                    message.description,
                    tokens=tokens,
                    last_tool=last_tool,
                )
                # Progress logs are verbose — only send to terminal, not to API
                # (they would flood the plan log with noise)

            elif isinstance(message, TaskNotificationMessage):
                status = getattr(message, 'status', 'unknown')
                summary = getattr(message, 'summary', '')
                usage = getattr(message, 'usage', None) or {}
                logger.subagent_done(task.id, message.task_id, status, summary)
                summary_text = f" — {summary[:100]}" if summary else ""
                level = "info" if status == "completed" else ("warning" if status == "stopped" else "error")
                add_log(level, f"{'✔' if status == 'completed' else '⏹' if status == 'stopped' else '✘'} Subagent {message.task_id} {status}{summary_text}")
                send_logs_if_needed()  # Flush immediately so the log is visible

            elif isinstance(message, ResultMessage):
                final_result = message  # store — don't return yet
                # Capture sdk_session_id from ResultMessage for session continuity
                task_sdk_session_id = (
                    getattr(message, 'session_id', None) or
                    getattr(message, 'sessionId', None)
                )
                if task_sdk_session_id:
                    logger.info(f"[{task.id}] SDK session ID captured: {task_sdk_session_id[:12]}...")
                add_log("info", f"✔ finished — {message.stop_reason}")
                send_logs_if_needed()  # Flush logs on completion

    except Exception as e:
        error_msg = str(e)
        # Enhance error message for authentication failures
        if '401' in error_msg or 'OAuth' in error_msg or 'authentication' in error_msg.lower():
            friendly_msg = (
                f"❌ Authentication failed: {error_msg}\n"
                f"→ Run: claude login"
            )
            logger.task_error(task.id, friendly_msg)
            add_log("error", friendly_msg)
            send_logs_if_needed()  # Flush logs on error
            return TaskResult(task_id=task.id, success=False, error=friendly_msg)
        # Enhance error message for SDK failures with stderr hints
        if 'Check stderr output for details' in error_msg:
            error_msg = f'Agent execution failed: {error_msg}'
        logger.task_error(task.id, error_msg)
        add_log("error", error_msg)
        send_logs_if_needed()  # Flush logs on error
        return TaskResult(task_id=task.id, success=False, error=error_msg)

    if final_result is not None:
        success = final_result.subtype == "success"
        output = final_result.result or ""
        logger.task_done(task.id, final_result.subtype)
        send_logs_if_needed()  # Flush any remaining logs

        # Save context note for dependent tasks if this task succeeded
        if success and ctx_dir:
            _save_task_note(ctx_dir, task, output)

        # Detect and save structured output for quick actions
        if success and client and plan_id:
            full_output = '\n'.join(captured_texts)
            structured = extract_structured_output(full_output)

            # Fallback: read improvement JSON from workflow directory when
            # the agent used the file-based blackboard pattern instead of
            # XML tags (agent / team improvement flows).
            if not structured and workflow_path:
                structured = load_improvement_from_workflow(workflow_path)

            if structured:
                logger.info(f"[{task.id}] Found structured output: {structured['type']}")
                try:
                    await client.save_structured_output(plan_id, structured)
                except Exception as e:
                    logger.warning(f"[{task.id}] Failed to save structured output: {e}")
            else:
                # Log when no structured output found — helps diagnose improvement flow issues
                logger.debug(f"[{task.id}] No structured output extracted from {len(captured_texts)} text blocks")

        return TaskResult(task_id=task.id, success=success, output=output, sdk_session_id=task_sdk_session_id or sdk_session_id)

    logger.task_done(task.id, "success")
    send_logs_if_needed()  # Flush any remaining logs

    # Save context note for dependent tasks if this task succeeded
    if ctx_dir:
        _save_task_note(ctx_dir, task, "")

    # Detect and save structured output for quick actions (no result case)
    if client and plan_id:
        full_output = '\n'.join(captured_texts)
        structured = extract_structured_output(full_output)

        # Fallback: read improvement JSON from workflow directory
        if not structured and workflow_path:
            structured = load_improvement_from_workflow(workflow_path)

        if structured:
            logger.info(f"[{task.id}] Found structured output: {structured['type']}")
            try:
                await client.save_structured_output(plan_id, structured)
            except Exception as e:
                logger.warning(f"[{task.id}] Failed to save structured output: {e}")
        else:
            logger.debug(f"[{task.id}] No structured output extracted from {len(captured_texts)} text blocks")

    return TaskResult(task_id=task.id, success=True, sdk_session_id=task_sdk_session_id or sdk_session_id)


async def run_wave(
    tasks: list[Task],
    context: dict[str, TaskResult],
    ctx_dir: Path | None = None,
    log_callback: callable[[str, str, str], None] | None = None,
    client: Any | None = None,
    plan_id: str | None = None,
    project_path: str | None = None,
    attachment_ids: list[str] | None = None,
    api_base_url: str | None = None,
    token: str | None = None,
    workflow_path: str | None = None,
    sdk_session_id: str | None = None,
) -> list[TaskResult]:
    """
    Run all tasks in a wave.

    NOTE: The Claude Agent SDK uses anyio internally with cancel scopes that are
    not safe to share across tasks. Running tasks sequentially within a wave avoids
    the 'cancel scope in different task' RuntimeError. True parallelism can be
    revisited once the SDK resolves this upstream.

    Args:
        tasks: List of tasks to run
        context: Results from previous tasks
        ctx_dir: Context directory for saving/loading dependency notes
        log_callback: Optional callback(task_id, level, message) for log collection
        client: Optional DaemonClient instance for approval requests
        plan_id: Optional plan ID for approval requests
        project_path: Optional project path for generating workflow context
        sdk_session_id: Optional Claude Code SDK session ID for resume

    Returns:
        List of TaskResult objects
    """
    results: list[TaskResult] = []
    for task in tasks:
        result = await run_task(task, context, ctx_dir, log_callback, client, plan_id, project_path, attachment_ids=attachment_ids, api_base_url=api_base_url, token=token, workflow_path=workflow_path, sdk_session_id=sdk_session_id)
        results.append(result)
    return results


async def run_plan(
    plan: Plan,
    log_callback: callable[[str, str, str], None] | None = None,
    client: Any | None = None,
    sdk_session_id: str | None = None,
) -> tuple[bool, dict | None, str | None]:
    """
    Execute the full plan in dependency order.

    Args:
        plan: Plan to execute
        log_callback: Optional callback(task_id, level, message) for log collection
        client: Optional DaemonClient for extracting reviews
        sdk_session_id: Optional Claude Code SDK session ID for resume

    Returns:
        Tuple of (success: bool, review: dict | None, sdk_session_id: str | None)
        review is the extracted <review> JSON if present in task outputs
        sdk_session_id is the captured session ID (new or existing) for persistence
    """
    logger.plan_start(plan.name)

    # Initialize context directory for this plan
    ctx_dir = _init_context_dir(plan.name)

    waves = plan.execution_order()
    context: dict[str, TaskResult] = {}  # task_id → result, passed downstream

    # Derive project_path from first task's cwd for context generation
    project_path = None
    if plan.tasks:
        project_path = plan.tasks[0].cwd

    # Fetch plan-level attachments (if client available)
    plan_attachment_ids: list[str] | None = None
    if client:
        try:
            plan_attachment_ids = client.get_plan_attachments(plan.id)
            if plan_attachment_ids:
                logger.info(f"[Plan] Found {len(plan_attachment_ids)} attachment(s) for plan {plan.id[:8]}")
        except Exception as e:
            logger.warning(f"[Plan] Failed to fetch plan attachments: {e}")

    # Resolve API base URL and token for attachment fetching
    api_base_url: str | None = None
    attach_token: str | None = None
    if client and hasattr(client, 'server_url') and hasattr(client, 'token'):
        api_base_url = client.server_url
        attach_token = client.token

    # Track the latest sdk_session_id across all tasks
    latest_sdk_session_id = sdk_session_id

    for wave_index, wave in enumerate(waves):
        logger.wave_start(wave_index, [t.name for t in wave])
        results = await run_wave(
            wave, context, ctx_dir, log_callback, client, plan.id, project_path,
            attachment_ids=plan_attachment_ids, api_base_url=api_base_url, token=attach_token,
            workflow_path=plan.workflow_path,
            sdk_session_id=latest_sdk_session_id,
        )

        for r in results:
            context[r.task_id] = r
            # Track the latest session ID from each task result
            if r.sdk_session_id:
                latest_sdk_session_id = r.sdk_session_id

        failed = [r for r in results if not r.success]
        if failed:
            for f in failed:
                logger.error(f"Task '{f.task_id}' failed — stopping plan.")
            logger.plan_done(plan.name, success=False)
            # Clear context cache for this project
            if project_path and project_path in _workflow_context_cache:
                del _workflow_context_cache[project_path]
            return False, None, latest_sdk_session_id

    logger.plan_done(plan.name, success=True)

    # Extract review structured output from accumulated task outputs
    review = None
    if context:
        # Concatenate all task outputs
        full_output = '\n'.join(r.output for r in context.values() if r.output)
        if full_output:
            # Try to extract a review (used by reviewer agents)
            review = extract_review_from_output(full_output)
            if review:
                logger.info(f"Extracted review from plan output: result_status={review.get('result_status')}")

    # Clear context cache for this project
    if project_path and project_path in _workflow_context_cache:
        del _workflow_context_cache[project_path]

    return True, review, latest_sdk_session_id