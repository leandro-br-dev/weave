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
    TextBlock,
    ToolPermissionContext,
    query,
)
from claude_agent_sdk._errors import ProcessError

from orchestrator import logger
from orchestrator.attachments import build_prompt_with_attachments
from orchestrator.runner import (
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


async def run_chat_turn(
    *,
    session_id: str,
    message: str,
    workspace_path: str,
    cwd: str,
    sdk_session_id: str | None = None,
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
    # Build options for the SDK
    # IMPORTANT: cwd MUST be workspace_path to ensure settings.local.json is discovered.
    # The SDK walks up from cwd to find .claude/settings.local.json. If we use
    # env_project_path as cwd, the SDK won't be able to reach the workspace settings.
    # The env_project_path (passed as 'cwd' parameter) should only be used for context,
    # not as the SDK's working directory.
    options_kwargs = {
        "cwd": workspace_path,
        "permission_mode": "acceptEdits",
        "setting_sources": ["project", "local"],  # Load .claude/settings.local.json from workspace (same as runner.py)
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

    # Inject agents context for planner agents
    full_prompt = message
    if client and project_id and 'planner' in workspace_path.lower():
        try:
            agents_context = await client.get_project_agents_context(project_id)
            if agents_context:
                full_prompt = f"{agents_context}\n\n---\n\n{message}"
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
                            if log_callback:
                                await log_callback([{
                                    'session_id': session_id,
                                    'role': 'assistant_chunk',
                                    'message': text
                                }])

            elif msg_type in ('result', 'ResultMessage') or isinstance(message_obj, ResultMessage):
                final_result = message_obj
                # Capturar sdk_session_id do resultado
                new_sdk_session_id = (
                    getattr(message_obj, 'session_id', None) or
                    getattr(message_obj, 'sessionId', None)
                )

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
        if on_response:
            await on_response(f'❌ {error_details}', None)
        return sdk_session_id

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
