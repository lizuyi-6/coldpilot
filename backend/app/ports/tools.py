"""Agent tool port (abstract). Concrete tools live in app.infrastructure.tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ToolResult:
    output_json: dict[str, Any]
    output_summary: str
    status: str = "succeeded"  # succeeded | failed
    error_code: str | None = None
    duration_ms: int = 0


class Tool(Protocol):
    name: str
    label: str

    async def run(self, session, input_data: dict[str, Any]) -> ToolResult:  # noqa: ANN001
        ...


@dataclass
class ToolDescriptor:
    name: str
    label: str
    input_schema: dict[str, Any] = field(default_factory=dict)


class ToolRegistry:
    """Versioned registry of available tools. The agent may only call these."""

    version: str = "1"

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return list(self._tools.keys())

    def describe(self) -> list[ToolDescriptor]:
        return [
            ToolDescriptor(name=t.name, label=t.label) for t in self._tools.values()
        ]
