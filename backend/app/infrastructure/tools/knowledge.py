"""Static knowledge base + historical cases for the deterministic agent.

Domain-only (cold-chain preservation). No internet / general search. Used by
the ``knowledge.search`` and ``cases.search`` tools.
"""

from __future__ import annotations

KNOWLEDGE_ENTRIES = [
    {
        "id": "kb-1",
        "topic": "入库热量负荷",
        "summary": "常温货物入库带入大量显热，库温在 30~60 分钟内显著上升，制冷系统需额外负荷消化。",
    },
    {
        "id": "kb-2",
        "topic": "库门扰动",
        "summary": "库门长时间开启造成热湿空气侵入，与升温时段高度相关，并增加结霜风险。",
    },
    {
        "id": "kb-3",
        "topic": "制冷效率下降",
        "summary": "压缩机效率偏低、排气温度偏高提示制冷剂泄漏或冷凝不良，制冷量下降导致库温难以下降。",
    },
]

HISTORICAL_CASES = [
    {
        "id": "case-1",
        "title": "1号库 高温事件 · 入库热量 + 库门扰动",
        "similarity": 0.82,
        "root_cause": "入库热量负荷叠加库门长时间开启",
    },
    {
        "id": "case-2",
        "title": "3号库 高温事件 · 入库未预冷",
        "similarity": 0.71,
        "root_cause": "常温入库未预冷，库温回升",
    },
]
