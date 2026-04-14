"""
Chat runner: executa uma mensagem de sessão usando o Claude Agent SDK.

Mantém o sdk_session_id para permitir conversas iterativas.
"""

from __future__ import annotations

import os
import subprocess
from typing import Any, Callable, Awaitable
from io import StringIO

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    PermissionResultAllow,
    ResultMessage,
    TaskNotificationMessage,
    TaskProgressMessage,
    TaskStartedMessage,
    TextBlock,
    ToolPermissionContext,
    ToolUseBlock,
    query,
)
from claude_agent_sdk._errors import ProcessError

from orchestrator import logger
from orchestrator.attachments import build_prompt_with_attachments
from orchestrator.runner import (
    _apply_workspace_env,
    extract_structured_output, STRUCTURED_PATTERNS, prepare_agent_docs_dir,
    list_agent_docs,
)


async def _string_to_async_iterable(text: str):
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


async def _chat_can_use_tool(
    tool_name: str,
    tool_input: dict,
    context: ToolPermissionContext,
) -> PermissionResultAllow:
    """
    Auto-approve all tool permission requests in chat sessions.

    Chat sessions run with permission_mode='acceptEdits' and there is no
    interactive user to approve requests. Without this callback, tools like
    ExitPlanMode cause the CLI to hang waiting for a response on stdin.
    """
    logger.info(f"[ChatPermission] Auto-approved tool '{tool_name}'")
    return PermissionResultAllow()


# Standard tools available to all chat sessions, matching workflow task defaults.
# This ensures chat agents have the same capabilities as workflow teams.
CHAT_STANDARD_TOOLS = [
    'Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep',
    'WebFetch', 'NotebookEdit', 'Task',
]


def _ensure_chat_permissions(workspace_path: str) -> None:
    """
    Ensure the workspace settings.local.json includes proper permissions for chat.

    Teams created via Claude Code CLI directly may have settings files that
    lack the necessary tool permissions (especially Bash). This function
    repairs the settings file to include the standard chat tool set.
    """
    import json as _json

    settings_path = os.path.join(workspace_path, '.claude', 'settings.local.json')
    if not os.path.exists(settings_path):
        # No settings file at all — create one with full permissions
        claude_dir = os.path.dirname(settings_path)
        os.makedirs(claude_dir, exist_ok=True)
        default_settings = {
            'permissions': {
                'allow': CHAT_STANDARD_TOOLS,
                'deny': [],
            }
        }
        try:
            with open(settings_path, 'w') as f:
                _json.dump(default_settings, f, indent=2)
            logger.info(f"[ChatPermissions] Created settings.local.json with standard permissions at {settings_path}")
        except Exception as e:
            logger.warning(f"[ChatPermissions] Failed to create settings: {e}")
        return

    try:
        with open(settings_path) as f:
            settings = _json.load(f)

        # Check if permissions exist and have the required tools
        permissions = settings.get('permissions', {})
        allow_list = permissions.get('allow', [])

        # Check if Bash is allowed (either as generic 'Bash' or any 'Bash(...)' pattern)
        has_bash = 'Bash' in allow_list or any(s.startswith('Bash') for s in allow_list)
        has_read = 'Read' in allow_list
        has_write = 'Write' in allow_list
        has_edit = 'Edit' in allow_list

        needs_repair = not has_bash or not has_read or not has_write or not has_edit

        if needs_repair:
            # Merge standard tools into the existing allow list
            merged_allow = list(allow_list)
            for tool in CHAT_STANDARD_TOOLS:
                # Only add if no version of this tool exists
                if tool not in merged_allow and not any(
                    existing.startswith(tool + '(') or existing == tool
                    for existing in merged_allow
                ):
                    merged_allow.append(tool)

            settings['permissions'] = {
                'allow': merged_allow,
                'deny': permissions.get('deny', []),
                **{k: v for k, v in permissions.items() if k not in ('allow', 'deny')},
            }

            with open(settings_path, 'w') as f:
                _json.dump(settings, f, indent=2)

            logger.info(
                f"[ChatPermissions] Repaired settings.local.json — "
                f"added missing tools (bash={has_bash}, read={has_read}, "
                f"write={has_write}, edit={has_edit})"
            )
    except Exception as e:
        logger.warning(f"[ChatPermissions] Failed to check/repair settings: {e}")


async def run_chat_turn(
    *,
    session_id: str,
    message: str,
    workspace_path: str,
    cwd: str,
    sdk_session_id: str | None = None,
    source_type: str = 'manual',  # 'manual' or 'workflow' (from plan-to-chat conversion)
    on_sdk_session: Callable[[str], Awaitable[None]] | None = None,
    on_response: Callable[[str, dict | None], Awaitable[None]] | None = None,
    log_callback: Callable[[list], Awaitable[None]] | None = None,
    client: Any | None = None,  # DaemonClient instance
    project_id: str | None = None,  # Project ID for fetching agents context
    attachment_ids: list[str] | None = None,  # Attachment UUIDs from user message
    api_base_url: str | None = None,  # API base URL for fetching attachment content
    token: str | None = None,  # Auth token for fetching attachment content
) -> str | None:
    """
    Executa um turno da conversa.

    Retorna o sdk_session_id gerado (para persistir no banco).

    Args:
        session_id: ID da sessão no banco de dados
        message: Mensagem do usuário
        workspace_path: Caminho do workspace para o agente
        cwd: Diretório de trabalho para o agente
        sdk_session_id: ID da sessão do SDK (para retomar conversa)
        source_type: Tipo da sessão ('manual' ou 'workflow')
        on_sdk_session: Callback chamado quando novo sdk_session_id é gerado
        on_response: Callback chamado quando resposta completa é recebida
        log_callback: Callback para streaming de logs em tempo real
        client: Optional DaemonClient instance for fetching agents context
        project_id: Optional project ID for fetching agents context
        attachment_ids: Optional list of attachment UUIDs associated with the message
        api_base_url: Optional API base URL for fetching attachment content
        token: Optional auth token for fetching attachment content

    Returns:
        O sdk_session_id (novo ou existente) para persistência
    """
    # Apply env vars from workspace settings.local.json BEFORE SDK init.
    # The SDK resolves auth on startup — if ANTHROPIC_BASE_URL isn't in os.environ
    # at that point, it falls back to the global ~/.claude OAuth token, causing 401 errors.
    # This mirrors what runner.py does for plan tasks (line 973).
    _apply_workspace_env(workspace_path, cwd)

    # Ensure the workspace has proper permissions for chat sessions.
    # Teams created via Claude Code CLI may have empty or restrictive settings.local.json
    # that lack Bash/Read/Write/Edit permissions needed for chat to function properly.
    # This mirrors how runner.py passes allowed_tools explicitly for workflow tasks.
    _ensure_chat_permissions(workspace_path)

    # Determine the SDK's cwd.
    #
    # The Claude CLI stores session files under ~/.claude/projects/<encoded-cwd>/.
    # When --resume is used, the CLI derives the project path from cwd to locate
    # the session.  If cwd doesn't match the directory where the session was
    # originally created, the CLI won't find the session, will attempt a fresh
    # bootstrap against api.anthropic.com, and exit with code 1 (the proxy API
    # key is not a valid Anthropic key for direct calls).
    #
    # There are two scenarios:
    #
    # 1. Chat from plan-to-chat conversion (source_type='workflow'): the
    #    sdk_session_id comes from a workflow that used cwd = project dir.
    #    We MUST use the same project dir as cwd so the CLI finds the session.
    #
    # 2. Native chat (source_type='manual'): the first message uses
    #    workspace_path as cwd (so the SDK discovers settings.local.json from
    #    the team workspace).  Subsequent messages must keep using
    #    workspace_path to find the session created by the first message.
    #
    # Env vars from settings.local.json are pre-injected into os.environ by
    # _apply_workspace_env above, so they are inherited by the CLI subprocess
    # regardless of which cwd we use here.
    if source_type == 'workflow' and cwd and cwd != workspace_path:
        # Session from a plan-to-chat conversion: use project dir to match
        # the original workflow's cwd where the session was created.
        sdk_cwd = cwd
        sdk_setting_sources = ["project"]
        logger.info(f"[ChatTurn] Workflow session — using project cwd={sdk_cwd} (workspace={workspace_path})")
    else:
        # Native chat or workspace-based session: use workspace_path.
        sdk_cwd = workspace_path
        sdk_setting_sources = ["project", "local"]
        logger.info(f"[ChatTurn] Native session — using workspace cwd={sdk_cwd}")

    options_kwargs = {
        "cwd": sdk_cwd,
        "permission_mode": "acceptEdits",
        "setting_sources": sdk_setting_sources,
        "allowed_tools": CHAT_STANDARD_TOOLS,
    }

    # Unset CLAUDECODE to prevent nested session detection
    # This allows the daemon to run within Claude Code sessions
    if "CLAUDECODE" in os.environ:
        del os.environ["CLAUDECODE"]

    # Se temos um sdk_session_id, adicionar para retomar a sessão
    # O SDK usa resume internamente quando session_id é passado
    if sdk_session_id:
        options_kwargs["resume"] = sdk_session_id

    # Capture stderr to get real error messages
    stderr_buffer = StringIO()

    def stderr_callback(line: str) -> None:
        """Capture stderr lines for better error diagnostics."""
        logger.debug(f"Claude CLI stderr: {line}")
        stderr_buffer.write(line + "\n")

    options_kwargs["stderr"] = stderr_callback
    options_kwargs["extra_args"] = {"debug-to-stderr": True}  # Enable debug mode

    # Detailed logging for authentication diagnostics
    logger.info(f"[ChatTurn] session_id={session_id}")
    logger.info(f"[ChatTurn] workspace_path={workspace_path}")
    logger.info(f"[ChatTurn] cwd={options_kwargs.get('cwd')}")
    logger.info(f"[ChatTurn] setting_sources={options_kwargs.get('setting_sources')}")
    logger.info(f"[ChatTurn] sdk_session_id={sdk_session_id}")
    logger.info(f"[ChatTurn] settings.local.json exists={os.path.exists(os.path.join(workspace_path, '.claude', 'settings.local.json'))}")
    logger.info(f"[ChatTurn] settings.local.json path={os.path.join(workspace_path, '.claude', 'settings.local.json')}")

    # Log settings.local.json contents (env vars only, no credentials)
    try:
        import json
        settings_path = os.path.join(workspace_path, '.claude', 'settings.local.json')
        if os.path.exists(settings_path):
            with open(settings_path) as f:
                settings_data = json.load(f)
            env_keys = list(settings_data.get('env', {}).keys())
            logger.info(f"[ChatTurn] settings env keys={env_keys}")
        else:
            logger.warning(f"[ChatTurn] settings.local.json NOT FOUND at {settings_path}")
    except Exception as e:
        logger.warning(f"[ChatTurn] Error reading settings: {e}")

    options = ClaudeAgentOptions(**options_kwargs, can_use_tool=_chat_can_use_tool)

    captured_texts = []
    final_result = None
    new_sdk_session_id = None
    logs_buffer: list[dict] = []

    def add_log(level: str, message: str) -> None:
        """Add a log entry to buffer and optionally send immediately."""
        entry = {
            'level': level,
            'message': message,
        }
        logs_buffer.append(entry)
        # Print to terminal for debugging
        prefix = {
            'debug': '  🔧',
            'info': '  💬',
            'tool': '  ⚙',
            'warning': '  ⚠',
            'error': '  ❌',
        }.get(level, '  📝')
        logger.info(f"[ChatLog]{prefix} {message[:200]}")
        # Send in batch: every 3 logs or immediately for important ones
        if log_callback and len(logs_buffer) >= 3:
            _flush_logs()

    async def _flush_logs() -> None:
        """Flush buffered logs to the API."""
        if log_callback and logs_buffer:
            batch = logs_buffer.copy()
            logs_buffer.clear()
            try:
                await log_callback(batch)
            except Exception as e:
                logger.warning(f"[ChatTurn] Failed to send logs: {e}")

    # Build the prompt with project context, environment info, and working directory
    full_prompt = message
    prompt_prefix_parts: list[str] = []

    logger.info(f"[ChatTurn] Injecting context: cwd={cwd}, workspace_path={workspace_path}")

    # 1. Inject project context (directory tree + git info) from cwd
    # This mirrors what runner.py does for plan tasks, so chat agents also
    # know the project structure they should be working on.
    if cwd and cwd != workspace_path:
        try:
            from orchestrator.project_context import generate_workflow_context
            project_ctx = generate_workflow_context(cwd)
            if project_ctx:
                prompt_prefix_parts.append(project_ctx)
        except Exception as e:
            logger.warning(f"[ChatTurn] Failed to generate project context from cwd={cwd}: {e}")

    # 2. Inject explicit working directory so the agent knows where to operate
    if cwd and cwd != workspace_path:
        prompt_prefix_parts.append(f"Working directory: {cwd}")
        prompt_prefix_parts.append(f"All files must be created inside {cwd}. Do not use /tmp or any other path.")

    if prompt_prefix_parts:
        full_prompt = "\n\n".join(prompt_prefix_parts) + "\n\n---\n\n" + message

    # Inject agents context for planner agents
    if client and project_id and 'planner' in workspace_path.lower():
        try:
            agents_context = await client.get_project_agents_context(project_id)
            if agents_context:
                full_prompt = f"{agents_context}\n\n---\n\n{full_prompt}"
                logger.info(f"[ChatTurn] Injected agents context for planner agent")
        except Exception as e:
            logger.warning(f"[ChatTurn] Failed to fetch agents context: {e}")

    # If no attachment IDs were passed explicitly, try to fetch them from the session
    if not attachment_ids and client:
        try:
            attachment_ids = client.get_message_attachments(session_id)
            if attachment_ids:
                logger.info(f"[ChatTurn] Found {len(attachment_ids)} attachment(s) for session {session_id[:8]}")
        except Exception as e:
            logger.warning(f"[ChatTurn] Failed to fetch message attachments: {e}")
            attachment_ids = None

    # Build prompt with attachments if present
    if attachment_ids and api_base_url and token:
        try:
            full_prompt = build_prompt_with_attachments(
                text_prompt=full_prompt,
                attachment_ids=attachment_ids,
                api_base_url=api_base_url,
                token=token,
            )
            logger.info(f"[ChatTurn] Built prompt with {len(attachment_ids)} attachment(s)")
        except Exception as e:
            logger.warning(f"[ChatTurn] Failed to build prompt with attachments: {e}")

    # Create agent docs directory for this session and inject docs context
    docs_dir = prepare_agent_docs_dir(workspace_path, session_id, 'chat')
    if docs_dir:
        logger.info(f"[ChatTurn] Agent docs dir: {docs_dir}")

        # Inject docs inventory at the beginning of the prompt
        docs_inventory = list_agent_docs(docs_dir)
        if docs_inventory:
            full_prompt = f"{docs_inventory}\n\n---\n\n{full_prompt}"

        # Append documentation guidelines
        docs_guidelines = f"""\n\n## Documentation Workflow\nYour docs directory: `{docs_dir}/`\n- Use 3-digit numeric prefix for files: `001-`, `002-`, etc.\n- Read the last numbered doc before starting\n- Write a completion doc when done\n"""
        full_prompt += docs_guidelines

    try:
        async for message_obj in query(prompt=_string_to_async_iterable(full_prompt), options=options):
            msg_type = getattr(message_obj, 'type', None) or type(message_obj).__name__

            if msg_type in ('assistant', 'AssistantMessage') or hasattr(message_obj, 'content'):
                content = getattr(message_obj, 'content', [])
                for block in (content if isinstance(content, list) else []):
                    block_type = getattr(block, 'type', None)
                    # Capture text blocks - type might be 'text' or None (for text-only blocks)
                    if block_type in ('text', None) and hasattr(block, 'text'):
                        text = getattr(block, 'text', '')
                        if text:  # Only append non-empty text
                            captured_texts.append(text)
                            # Stream text as 'info' level logs for real-time display
                            add_log('info', text)

                    # Capture tool use blocks — stream tool usage for transparency
                    elif isinstance(block, ToolUseBlock):
                        tool_name = getattr(block, 'name', 'unknown')
                        tool_input = getattr(block, 'input', {})
                        add_log('tool', f"Using {tool_name}")
                        # Log relevant details for key tools
                        if tool_name == 'Read':
                            fp = tool_input.get('file_path', '')
                            if fp:
                                add_log('debug', f"Reading {fp}")
                        elif tool_name == 'Write':
                            fp = tool_input.get('file_path', '')
                            if fp:
                                add_log('debug', f"Writing {fp}")
                        elif tool_name == 'Edit':
                            fp = tool_input.get('file_path', '')
                            if fp:
                                add_log('debug', f"Editing {fp}")
                        elif tool_name == 'Bash':
                            cmd = tool_input.get('command', '')
                            if cmd:
                                # Show first 150 chars of the command
                                add_log('debug', f"$ {cmd[:150]}{'...' if len(cmd) > 150 else ''}")
                        elif tool_name == 'Grep':
                            pattern = tool_input.get('pattern', '')
                            add_log('debug', f"Searching: {pattern[:100]}")
                        elif tool_name == 'Glob':
                            pattern = tool_input.get('pattern', '')
                            add_log('debug', f"Finding files: {pattern[:100]}")
                        elif tool_name == 'Agent':
                            desc = tool_input.get('prompt', '')[:80]
                            add_log('tool', f"Spawning agent: {desc}")

            elif isinstance(message_obj, TaskStartedMessage):
                type_label = f" ({message_obj.task_type})" if getattr(message_obj, 'task_type', None) else ""
                logger.subagent_start("chat", message_obj.task_id, message_obj.description, task_type=getattr(message_obj, 'task_type', None))
                add_log('tool', f"Subagent spawned: {message_obj.task_id}{type_label} — {message_obj.description[:120]}")
                await _flush_logs()  # Flush immediately so the log is visible

            elif isinstance(message_obj, TaskProgressMessage):
                usage = getattr(message_obj, 'usage', None) or {}
                logger.subagent_progress("chat", message_obj.task_id, message_obj.description, tokens=usage.get('total_tokens', 0))

            elif isinstance(message_obj, TaskNotificationMessage):
                status = getattr(message_obj, 'status', 'unknown')
                summary = getattr(message_obj, 'summary', '')
                logger.subagent_done("chat", message_obj.task_id, status, summary)
                symbol = '✔' if status == 'completed' else ('⏹' if status == 'stopped' else '✘')
                level = 'info' if status == 'completed' else ('warning' if status == 'stopped' else 'error')
                add_log(level, f"{symbol} Subagent {message_obj.task_id} {status} — {summary[:100] if summary else ''}")
                await _flush_logs()  # Flush immediately

            elif msg_type in ('result', 'ResultMessage') or isinstance(message_obj, ResultMessage):
                final_result = message_obj
                # Capturar sdk_session_id do resultado
                new_sdk_session_id = (
                    getattr(message_obj, 'session_id', None) or
                    getattr(message_obj, 'sessionId', None)
                )
                add_log('info', f"✔ Completed — {getattr(final_result, 'stop_reason', 'end_turn')}")
                await _flush_logs()  # Flush remaining logs

    except ProcessError as e:
        # Enhanced error handling for ProcessError from SDK
        error_details = str(e)

        # Extract additional information from ProcessError
        if hasattr(e, 'exit_code') and e.exit_code:
            error_details += f"\nExit code: {e.exit_code}"

        # Get the real stderr from our buffer
        real_stderr = stderr_buffer.getvalue()
        if real_stderr:
            error_details += f"\n\nStderr output:\n{real_stderr}"
        elif hasattr(e, 'stderr') and e.stderr and e.stderr != "Check stderr output for details":
            error_details += f"\nStderr: {e.stderr}"

        # Provide helpful context for common errors
        if 'nested session' in str(e).lower() or 'CLAUDECODE' in str(e):
            error_details += "\n\n💡 Tip: The daemon cannot run inside a Claude Code session. " \
                           "Ensure CLAUDECODE environment variable is not set when starting the daemon."

        # Check for ANTHROPIC_BASE_URL connectivity issues
        settings_path = os.path.join(workspace_path, '.claude', 'settings.local.json')
        if os.path.exists(settings_path):
            try:
                import json as _json
                with open(settings_path) as f:
                    settings = _json.load(f)
                base_url = settings.get('env', {}).get('ANTHROPIC_BASE_URL', '')
                if base_url and 'localhost' in base_url:
                    # Try to check if the service is accessible
                    try:
                        import urllib.request
                        urllib.request.urlopen(base_url, timeout=2)
                    except Exception as url_err:
                        error_details += f"\n\n⚠️  ANTHROPIC_BASE_URL={base_url} is not accessible: {url_err}"
                        error_details += "\n   Ensure the service at the configured URL is running."
            except Exception:
                pass  # Ignore errors when trying to provide helpful context

        logger.error(f'Chat turn ProcessError: {error_details}')
        add_log('error', f'Process error: {str(e)[:200]}')
        await _flush_logs()
        if on_response:
            await on_response(f'❌ {error_details}', None)
        return sdk_session_id

    except Exception as e:
        # Generic exception handler - also try to capture stderr
        error_details = str(e)

        # Try to get stderr from our buffer even for generic exceptions
        real_stderr = stderr_buffer.getvalue()
        if real_stderr:
            error_details += f"\n\nStderr output:\n{real_stderr}"

        # Check if this is a ProcessError with additional info
        if hasattr(e, 'exit_code') and e.exit_code:
            error_details += f"\nExit code: {e.exit_code}"
        if hasattr(e, 'stderr') and e.stderr and e.stderr != "Check stderr output for details":
            error_details += f"\nStderr: {e.stderr}"

        logger.error(f'Chat turn error: {error_details}')
        add_log('error', f'Error: {str(e)[:200]}')
        await _flush_logs()
        if on_response:
            await on_response(f'❌ {error_details}', None)
        return sdk_session_id

    # Flush any remaining logs
    await _flush_logs()

    # Montar resposta completa
    full_text = '\n'.join(captured_texts)
    structured = extract_structured_output(full_text)

    # Notificar via callback
    if on_response:
        await on_response(full_text, structured)

    # Notificar novo sdk_session_id se mudou
    if new_sdk_session_id and new_sdk_session_id != sdk_session_id:
        if on_sdk_session:
            await on_sdk_session(new_sdk_session_id)

    return new_sdk_session_id or sdk_session_id
