"""
Colored terminal output for the orchestrator.
"""

import sys
from datetime import datetime


RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"

CYAN   = "\033[36m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
BLUE   = "\033[34m"
MAGENTA = "\033[35m"
WHITE  = "\033[37m"


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def header(text: str) -> None:
    print(f"\n{BOLD}{CYAN}{'━' * 60}{RESET}")
    print(f"{BOLD}{CYAN}  {text}{RESET}")
    print(f"{BOLD}{CYAN}{'━' * 60}{RESET}\n")


def plan_start(plan_name: str) -> None:
    header(f"🗂  Plan: {plan_name}")


def wave_start(wave_index: int, task_names: list[str]) -> None:
    names = ", ".join(task_names)
    print(f"{BOLD}{BLUE}▶ Wave {wave_index + 1}: [{names}]{RESET}\n")


def task_start(task_id: str, task_name: str, cwd: str) -> None:
    print(f"{GREEN}┌─ Agent started{RESET}  {BOLD}{task_id}{RESET} — {task_name}")
    print(f"{GREEN}│  cwd:{RESET} {DIM}{cwd}{RESET}")


def task_output(task_id: str, text: str) -> None:
    for line in text.splitlines():
        print(f"{DIM}│ [{task_id}]{RESET} {line}")


def task_tool(task_id: str, tool_name: str) -> None:
    print(f"{YELLOW}│ [{task_id}]{RESET} {YELLOW}⚙ {tool_name}{RESET}")


def task_done(task_id: str, subtype: str) -> None:
    color = GREEN if subtype == "success" else RED
    symbol = "✔" if subtype == "success" else "✘"
    print(f"{color}└─ {symbol} [{task_id}] finished ({subtype}){RESET}\n")


def task_error(task_id: str, error: Exception) -> None:
    print(f"{RED}└─ ✘ [{task_id}] ERROR: {error}{RESET}\n", file=sys.stderr)


def plan_done(plan_name: str, success: bool) -> None:
    color = GREEN if success else RED
    symbol = "✔" if success else "✘"
    print(f"\n{BOLD}{color}{'━' * 60}{RESET}")
    print(f"{BOLD}{color}  {symbol}  Plan '{plan_name}' {'completed' if success else 'failed'}{RESET}")
    print(f"{BOLD}{color}{'━' * 60}{RESET}\n")


def info(text: str) -> None:
    print(f"{CYAN}[{_ts()}] ℹ {text}{RESET}")


def warn(text: str) -> None:
    print(f"{YELLOW}[{_ts()}] ⚠ {text}{RESET}")


def error(text: str) -> None:
    print(f"{RED}[{_ts()}] ✘ {text}{RESET}", file=sys.stderr)


def debug(text: str) -> None:
    """Debug messages — only shown if AGENT_DEBUG env var is set."""
    import os
    if os.getenv('AGENT_DEBUG'):
        print(f"{DIM}[{_ts()}] 🔍 {text}{RESET}")


def warning(text: str) -> None:
    """Alias for warn() for compatibility."""
    warn(text)


def success(text: str) -> None:
    """Success messages with green checkmark."""
    print(f"{GREEN}[{_ts()}] ✔ {text}{RESET}")


# ── Subagent lifecycle logging ──────────────────────────────────────────────

def subagent_start(task_id: str, agent_id: str, description: str, task_type: str | None = None) -> None:
    """Log when a subagent (Agent tool / Task tool) is spawned."""
    type_label = f" ({task_type})" if task_type else ""
    print(f"{MAGENTA}┌─ Subagent spawned{RESET}  {BOLD}{agent_id}{RESET}{type_label}")
    print(f"{MAGENTA}│  parent: {task_id}{RESET}  {DIM}{description[:120]}{RESET}")


def subagent_progress(task_id: str, agent_id: str, description: str, tokens: int = 0, last_tool: str | None = None) -> None:
    """Log subagent progress updates."""
    parts = [f"{DIM}│ [{agent_id}]{RESET} {description[:100]}"]
    if tokens:
        parts.append(f"{DIM}(tokens: {tokens}){RESET}")
    if last_tool:
        parts.append(f"{YELLOW}⚙ {last_tool}{RESET}")
    print(" ".join(parts))


def subagent_done(task_id: str, agent_id: str, status: str, summary: str = "") -> None:
    """Log when a subagent finishes."""
    color = GREEN if status == "completed" else (YELLOW if status == "stopped" else RED)
    symbol = "✔" if status == "completed" else ("⏹" if status == "stopped" else "✘")
    print(f"{color}└─ {symbol} Subagent {agent_id} {status}{RESET}")
    if summary:
        print(f"{color}│  {DIM}{summary[:120]}{RESET}")
