from __future__ import annotations

import shutil
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SUBMISSION_ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = SUBMISSION_ROOT / "07-ColdPilot-source.zip"
ARCHIVE_ROOT = Path("ColdPilot-source")

SOURCE_DIRECTORIES = (
    Path("backend/app"),
    Path("backend/alembic"),
    Path("backend/tests"),
    Path("backend/scripts"),
    Path("frontend/src"),
    Path("frontend/public"),
    Path("docs/contracts"),
    Path("docs/handoff"),
)

SOURCE_FILES = (
    Path("backend/.env.example"),
    Path("backend/alembic.ini"),
    Path("backend/pyproject.toml"),
    Path("backend/requirements.txt"),
    Path("frontend/.env.example"),
    Path("frontend/.env.test"),
    Path("frontend/eslint.config.js"),
    Path("frontend/index.html"),
    Path("frontend/package.json"),
    Path("frontend/pnpm-lock.yaml"),
    Path("frontend/tsconfig.json"),
    Path("frontend/vite.config.ts"),
)

EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".pytest_cache",
    ".ruff_cache",
    "__pycache__",
    "dist",
    "node_modules",
}

EXCLUDED_FILE_SUFFIXES = {
    ".db",
    ".log",
    ".pyc",
}

README_CONTENT = """# 鲜知 ColdPilot 评审工程包

这是 GOAI 初赛评审用源码包，包含 React + TypeScript 前端、FastAPI 后端、数据库迁移、测试、接口契约和非敏感环境变量模板。

## 快速启动

详细命令见 `RUNNING.md`。默认后端 Agent 模式为 `deterministic`，无需外部模型服务即可运行。

## 重要边界

- 数据、异常、库存和候选方案为演示种子数据。
- 仿真器采用一阶热力学近似。
- 当前执行为仿真回放，不连接真实 PLC。
- LLM 模式为可选 OpenAI 兼容诊断综合模式；LLM 不参与安全、审批或执行。
- 该评审包未附带开源许可证；若公开发布，请由项目团队选择并补充合适许可证。

## 不包含

此包不包含 `.env`、API 密钥、本地数据库、虚拟环境、依赖目录、构建产物或浏览器缓存。
"""


def should_include_file(file_path: Path) -> bool:
    if any(part in EXCLUDED_DIRECTORY_NAMES for part in file_path.parts):
        return False
    if file_path.suffix.lower() in EXCLUDED_FILE_SUFFIXES:
        return False
    return True


def write_project_file(archive: zipfile.ZipFile, relative_path: Path) -> None:
    source_path = PROJECT_ROOT / relative_path
    if not source_path.is_file() or not should_include_file(relative_path):
        return
    archive.write(source_path, ARCHIVE_ROOT / relative_path)


def write_project_directory(archive: zipfile.ZipFile, relative_directory: Path) -> None:
    source_directory = PROJECT_ROOT / relative_directory
    if not source_directory.is_dir():
        return
    for source_path in sorted(source_directory.rglob("*")):
        if not source_path.is_file():
            continue
        relative_path = source_path.relative_to(PROJECT_ROOT)
        if should_include_file(relative_path):
            archive.write(source_path, ARCHIVE_ROOT / relative_path)


def build_archive() -> None:
    if ARCHIVE_PATH.exists():
        ARCHIVE_PATH.unlink()

    with zipfile.ZipFile(ARCHIVE_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        archive.writestr(str(ARCHIVE_ROOT / "README.md"), README_CONTENT)
        archive.write(SUBMISSION_ROOT / "05-项目运行说明.md", ARCHIVE_ROOT / "RUNNING.md")
        for source_file in SOURCE_FILES:
            write_project_file(archive, source_file)
        for source_directory in SOURCE_DIRECTORIES:
            write_project_directory(archive, source_directory)

    shutil.unpack_archive(ARCHIVE_PATH, SUBMISSION_ROOT / ".source-verification")
    shutil.rmtree(SUBMISSION_ROOT / ".source-verification")
    print(ARCHIVE_PATH)


if __name__ == "__main__":
    build_archive()
