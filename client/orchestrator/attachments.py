"""
Attachment handler for converting file attachments into prompt content.

Fetches files from the Weave API and formats them for inclusion in
Claude Agent SDK prompts. Since the SDK's query() function accepts
``str | AsyncIterable[dict]``, attachments are rendered as formatted
text blocks prepended to the user's prompt string.

Supported file types:
- Images (png, jpeg, gif, webp, svg): the absolute file path is included
  in the prompt so the agent can use the Read tool to view the image.
- Text-based files (.txt, .md, .py, .ts, .js, .json, .yaml, .csv, .html, .css, .xml):
  contents are inlined with a filename header.
- PDF and other binary files: noted with filename and size.
"""

from __future__ import annotations

import base64
import mimetypes
from typing import Any

import httpx

from orchestrator import logger

# ── File classification ────────────────────────────────────────────────────

# Extensions that we know are safe to decode as UTF-8 text.
_TEXT_EXTENSIONS: set[str] = {
    ".txt", ".md", ".markdown", ".py", ".pyw", ".ts", ".tsx", ".js", ".jsx",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".csv", ".tsv", ".html", ".htm", ".css", ".scss", ".less", ".sass",
    ".xml", ".svg", ".sql", ".sh", ".bash", ".zsh", ".fish",
    ".env", ".gitignore", ".dockerignore", ".editorconfig",
    ".rs", ".go", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".hpp",
    ".rb", ".php", ".pl", ".r", ".lua", ".vim", ".el",
    ".makefile", ".cmake", ".gradle",
    ".lock", ".log",
}

# MIME type prefixes that indicate text content.
_TEXT_MIME_PREFIXES: tuple[str, ...] = (
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
    "application/x-yaml",
    "application/yaml",
)

# MIME type prefixes that indicate image content.
_IMAGE_MIME_PREFIXES: tuple[str, ...] = (
    "image/",
)


def _is_text_file(file_name: str, media_type: str) -> bool:
    """Return True if the file is likely text-based."""
    import os

    ext = os.path.splitext(file_name)[1].lower()
    if ext in _TEXT_EXTENSIONS:
        return True
    return any(media_type.startswith(prefix) for prefix in _TEXT_MIME_PREFIXES)


def _is_image_file(media_type: str) -> bool:
    """Return True if the file is an image."""
    return any(media_type.startswith(prefix) for prefix in _IMAGE_MIME_PREFIXES)


def _human_size(size_bytes: int) -> str:
    """Format byte count as a human-readable string."""
    for unit in ("B", "KB", "MB"):
        if abs(size_bytes) < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} GB"


# ── API helpers ────────────────────────────────────────────────────────────

def resolve_attachment_path(
    attachment_id: str,
    api_base_url: str,
    token: str,
) -> tuple[str, str, bytes] | None:
    """
    Fetch attachment metadata and file content from the API.

    Calls GET /api/uploads/{attachment_id} with Bearer token authentication.

    Args:
        attachment_id: The attachment UUID.
        api_base_url: Base URL of the API (e.g. http://localhost:3001).
        token: Bearer token for authentication.

    Returns:
        ``(filename, media_type, content_bytes)`` on success, or ``None`` on failure.
    """
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                f"{api_base_url}/api/uploads/{attachment_id}",
                headers={"Authorization": f"Bearer {token}"},
                follow_redirects=True,
            )

        if response.status_code == 404:
            logger.warning(f"[Attachments] Attachment {attachment_id} not found (404)")
            return None

        if response.status_code != 200:
            logger.warning(
                f"[Attachments] Failed to fetch attachment {attachment_id}: "
                f"HTTP {response.status_code}"
            )
            return None

        # Extract filename from Content-Disposition if available
        content_disp = response.headers.get("content-disposition", "")
        filename = "unknown"
        if "filename=" in content_disp:
            # Handle both filename="file.txt" and filename=file.txt
            parts = content_disp.split("filename=")
            filename = parts[-1].strip().strip('"')

        media_type = response.headers.get("content-type", "application/octet-stream")
        # Strip charset suffix for cleaner matching (e.g. "text/plain; charset=utf-8")
        media_type = media_type.split(";")[0].strip()

        return (filename, media_type, response.content)

    except httpx.HTTPError as exc:
        logger.warning(f"[Attachments] HTTP error fetching {attachment_id}: {exc}")
    except Exception as exc:
        logger.warning(f"[Attachments] Error fetching attachment {attachment_id}: {exc}")

    return None


# ── Prompt building ────────────────────────────────────────────────────────

def _resolve_attachment_metadata(
    attachment_id: str,
    api_base_url: str,
    token: str,
) -> dict[str, Any] | None:
    """
    Fetch attachment metadata including the absolute file path from the API.

    Calls GET /api/uploads/{attachment_id}/metadata with Bearer token auth.

    Returns:
        Dict with keys ``absolute_path``, ``file_name``, ``file_type``, etc.
        or ``None`` on failure.
    """
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                f"{api_base_url}/api/uploads/{attachment_id}/metadata",
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code != 200:
            logger.warning(
                f"[Attachments] Failed to fetch metadata for {attachment_id}: "
                f"HTTP {response.status_code}"
            )
            return None
        return response.json()
    except Exception as exc:
        logger.warning(f"[Attachments] Error fetching metadata for {attachment_id}: {exc}")
        return None


def load_attachment(
    attachment_id: str,
    api_base_url: str,
    token: str,
) -> dict[str, Any] | None:
    """
    Fetch an attachment and return it as a content-block descriptor.

    Since the Claude Agent SDK prompt parameter only accepts ``str`` (or
    ``AsyncIterable``), this function returns a dict describing how the
    attachment should be rendered in the prompt string.  The caller (typically
    :func:`build_prompt_with_attachments`) converts these descriptors into
    text.

    Returns:
        A dict with keys:
        - ``"kind"`` — ``"image"`` | ``"text"`` | ``"binary"``
        - ``"file_name"`` — original file name
        - ``"media_type"`` — MIME type
        - ``"file_size"`` — size in bytes
        - ``"absolute_path"`` — absolute path on disk (only for ``kind="image"``)
        - ``"text"`` — decoded text content (only for ``kind="text"``)
    """
    result = resolve_attachment_path(attachment_id, api_base_url, token)
    if result is None:
        return None

    filename, media_type, content_bytes = result

    info: dict[str, Any] = {
        "kind": "binary",
        "file_name": filename,
        "media_type": media_type,
        "file_size": len(content_bytes),
    }

    if _is_image_file(media_type):
        info["kind"] = "image"
        # Fetch absolute file path so the agent can use Read tool
        metadata = _resolve_attachment_metadata(attachment_id, api_base_url, token)
        if metadata and "absolute_path" in metadata:
            info["absolute_path"] = metadata["absolute_path"]

    elif _is_text_file(filename, media_type):
        try:
            text = content_bytes.decode("utf-8")
            info["kind"] = "text"
            info["text"] = text
        except UnicodeDecodeError:
            # Fall through — treated as binary
            pass

    return info


def _render_attachment(info: dict[str, Any]) -> str:
    """
    Render a single attachment descriptor into a text block for the prompt.
    """
    kind = info["kind"]
    file_name = info["file_name"]
    media_type = info["media_type"]
    size_str = _human_size(info["file_size"])

    if kind == "image":
        absolute_path = info.get("absolute_path", "")
        block = (
            f"## Attached Image: {file_name}\n"
            f"- Type: {media_type}\n"
            f"- Size: {size_str}\n"
        )
        if absolute_path:
            block += (
                f"- File path: {absolute_path}\n"
                f"\n> Use the Read tool with the file path above to view the image.\n"
            )
        else:
            block += (
                f"- ID: [image attachment — file path not available]\n"
            )
        return block

    if kind == "text":
        text = info["text"]
        # Truncate very large files to keep the prompt manageable
        max_chars = 100_000
        truncated = False
        if len(text) > max_chars:
            text = text[:max_chars]
            truncated = True

        # Guess language for syntax hinting
        ext = _extension_from_name(file_name)
        lang_hint = f" ({ext})" if ext else ""

        block = (
            f"## Attached File: {file_name}\n"
            f"- Type: {media_type}{lang_hint}\n"
            f"- Size: {size_str}\n"
            f"```\n{text}\n```"
        )
        if truncated:
            block += f"\n> File truncated at {max_chars:,} characters."

        return block

    # Binary / PDF / other
    return (
        f"## Attached File: {file_name}\n"
        f"- Type: {media_type}\n"
        f"- Size: {size_str}\n"
        f"> Binary file — content not displayed. Reference by name if needed.\n"
    )


def _extension_from_name(file_name: str) -> str:
    """Return the file extension without the dot (e.g. 'py', 'ts')."""
    import os
    _, ext = os.path.splitext(file_name)
    return ext.lstrip(".")


def build_prompt_with_attachments(
    text_prompt: str,
    attachment_ids: list[str],
    api_base_url: str,
    token: str,
) -> str:
    """
    Build a prompt string combining text and attachment content blocks.

    Since the Claude Agent SDK only accepts ``str`` (or ``AsyncIterable``) for
    the ``prompt`` parameter, we render attachments as formatted text sections
    prepended to the user's prompt.

    Order:
    1. Image references
    2. Text file contents
    3. Binary file references
    4. The user's original text prompt

    Args:
        text_prompt: The user's text prompt.
        attachment_ids: List of attachment UUIDs to include.
        api_base_url: Base URL of the API.
        token: Bearer token for authentication.

    Returns:
        The combined prompt string.  If no attachments resolve successfully,
        returns ``text_prompt`` unchanged.
    """
    if not attachment_ids:
        return text_prompt

    image_blocks: list[str] = []
    text_blocks: list[str] = []
    binary_blocks: list[str] = []

    for aid in attachment_ids:
        info = load_attachment(aid, api_base_url, token)
        if info is None:
            logger.warning(f"[Attachments] Skipping failed attachment: {aid}")
            continue

        rendered = _render_attachment(info)
        kind = info["kind"]

        if kind == "image":
            image_blocks.append(rendered)
        elif kind == "text":
            text_blocks.append(rendered)
        else:
            binary_blocks.append(rendered)

    if not (image_blocks or text_blocks or binary_blocks):
        return text_prompt

    parts: list[str] = []

    if image_blocks or text_blocks or binary_blocks:
        parts.append("# Attachments\n")

    for block in image_blocks:
        parts.append(block)
        parts.append("")

    for block in text_blocks:
        parts.append(block)
        parts.append("")

    for block in binary_blocks:
        parts.append(block)
        parts.append("")

    parts.append(text_prompt)

    return "\n".join(parts)
