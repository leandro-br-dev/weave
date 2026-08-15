"""
Unit tests for attachment prompt/content-block building.

Covers the image content-block path introduced so images are delivered to
Claude as real image blocks instead of a text note pointing at a file path.
"""

import base64
from unittest.mock import Mock, patch

import pytest

from orchestrator import attachments


# ============================================================================
# Fixtures / helpers
# ============================================================================

def _make_response(status_code: int = 200, content: bytes = b"", headers: dict | None = None):
    """Build a mock httpx.Response-like object."""
    response = Mock()
    response.status_code = status_code
    response.content = content
    response.headers = headers or {}
    response.json = lambda: {}
    return response


@pytest.fixture
def mock_attachments_http(monkeypatch):
    """
    Patch httpx.Client used by the attachments module.

    Yields a list the test fills with canned responses; each
    resolve_attachment_path / _resolve_attachment_metadata call pops one.
    """
    queue: list = []

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, *args, **kwargs):
            if not queue:
                return _make_response(404)
            return queue.pop(0)

    monkeypatch.setattr(attachments.httpx, "Client", _FakeClient)
    return queue


def _queue_image(queue: list, payload: bytes, media_type: str = "image/webp",
                 filename: str = "photo.webp", absolute_path: str = "/tmp/uploads/photo.webp"):
    """Queue a download response followed by a metadata response."""
    queue.append(_make_response(
        content=payload,
        headers={
            "content-type": media_type,
            "content-disposition": f'attachment; filename="{filename}"',
        },
    ))
    queue.append(_make_response(200, headers={}, content=b"{}"))  # metadata endpoint

    # Metadata responses return JSON via response.json(); use a real dict.
    meta = Mock()
    meta.status_code = 200
    meta.headers = {}
    meta.content = b"{}"
    meta.json = lambda: {"absolute_path": absolute_path, "file_name": filename}
    queue[-1] = meta


# ============================================================================
# build_content_with_attachments
# ============================================================================

class TestBuildContentWithAttachments:

    def test_no_attachments_returns_single_text_block(self):
        blocks = attachments.build_content_with_attachments(
            text_prompt="hello",
            attachment_ids=[],
            api_base_url="http://localhost:3001",
            token="tok",
        )
        assert blocks == [{"type": "text", "text": "hello"}]

    def test_image_becomes_image_content_block(self, mock_attachments_http):
        payload = b"fake-webp-bytes"
        _queue_image(mock_attachments_http, payload)

        blocks = attachments.build_content_with_attachments(
            text_prompt="look at this",
            attachment_ids=["img-1"],
            api_base_url="http://localhost:3001",
            token="tok",
        )

        assert len(blocks) == 2
        text_block, image_block = blocks

        assert text_block["type"] == "text"
        assert "look at this" in text_block["text"]
        assert "Attached Image: photo.webp" in text_block["text"]

        assert image_block["type"] == "image"
        source = image_block["source"]
        assert source["type"] == "base64"
        assert source["media_type"] == "image/webp"
        assert source["data"] == base64.b64encode(payload).decode("ascii")

    def test_text_attachment_stays_inline_no_image_block(self, mock_attachments_http):
        mock_attachments_http.append(_make_response(
            content=b"print('hi')",
            headers={
                "content-type": "text/x-python",
                "content-disposition": 'attachment; filename="main.py"',
            },
        ))

        blocks = attachments.build_content_with_attachments(
            text_prompt="review this",
            attachment_ids=["file-1"],
            api_base_url="http://localhost:3001",
            token="tok",
        )

        assert len(blocks) == 1
        assert blocks[0]["type"] == "text"
        assert "print('hi')" in blocks[0]["text"]
        assert "review this" in blocks[0]["text"]

    def test_oversized_image_falls_back_to_text_path(self, mock_attachments_http, monkeypatch):
        monkeypatch.setattr(attachments, "_MAX_INLINE_IMAGE_BYTES", 10)
        _queue_image(mock_attachments_http, b"x" * 50)

        blocks = attachments.build_content_with_attachments(
            text_prompt="check",
            attachment_ids=["img-1"],
            api_base_url="http://localhost:3001",
            token="tok",
        )

        assert len(blocks) == 1
        assert blocks[0]["type"] == "text"
        # Read-tool fallback hint is present in the text
        assert "Read tool" in blocks[0]["text"]

    def test_failed_attachment_skipped(self, mock_attachments_http):
        mock_attachments_http.append(_make_response(404))

        blocks = attachments.build_content_with_attachments(
            text_prompt="hi",
            attachment_ids=["missing"],
            api_base_url="http://localhost:3001",
            token="tok",
        )

        assert blocks == [{"type": "text", "text": "hi"}]

    def test_mixed_image_and_text_preserves_order(self, mock_attachments_http):
        _queue_image(mock_attachments_http, b"imgbytes")
        mock_attachments_http.append(_make_response(
            content=b"notes",
            headers={
                "content-type": "text/plain",
                "content-disposition": 'attachment; filename="notes.txt"',
            },
        ))

        blocks = attachments.build_content_with_attachments(
            text_prompt="both",
            attachment_ids=["img-1", "txt-1"],
            api_base_url="http://localhost:3001",
            token="tok",
        )

        assert len(blocks) == 2
        assert blocks[0]["type"] == "text"
        assert "notes" in blocks[0]["text"]
        assert blocks[1]["type"] == "image"


# ============================================================================
# load_attachment image payload
# ============================================================================

class TestLoadAttachment:

    def test_image_info_includes_base64_data(self, mock_attachments_http):
        payload = b"raw-image"
        _queue_image(mock_attachments_http, payload)

        info = attachments.load_attachment(
            "img-1", "http://localhost:3001", "tok"
        )

        assert info is not None
        assert info["kind"] == "image"
        assert info["data"] == base64.b64encode(payload).decode("ascii")
        assert info["absolute_path"] == "/tmp/uploads/photo.webp"

    def test_metadata_failure_still_returns_image(self, mock_attachments_http):
        mock_attachments_http.append(_make_response(
            content=b"img",
            headers={
                "content-type": "image/png",
                "content-disposition": 'attachment; filename="x.png"',
            },
        ))
        mock_attachments_http.append(_make_response(500))  # metadata fails

        info = attachments.load_attachment(
            "img-1", "http://localhost:3001", "tok"
        )

        assert info is not None
        assert info["kind"] == "image"
        assert "data" in info
        assert "absolute_path" not in info


# ============================================================================
# Legacy string builder still works
# ============================================================================

class TestBuildPromptWithAttachments:

    def test_returns_string_with_read_tool_hint(self, mock_attachments_http):
        _queue_image(mock_attachments_http, b"imgbytes")

        prompt = attachments.build_prompt_with_attachments(
            text_prompt="do it",
            attachment_ids=["img-1"],
            api_base_url="http://localhost:3001",
            token="tok",
        )

        assert isinstance(prompt, str)
        assert "do it" in prompt
        assert "Attached Image: photo.webp" in prompt
