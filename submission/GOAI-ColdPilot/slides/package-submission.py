from __future__ import annotations

import shutil
import zipfile
from pathlib import Path


SUBMISSION_ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = SUBMISSION_ROOT.parent / "GOAI-ColdPilot-Submission.zip"
ARCHIVE_ROOT = Path("GOAI-ColdPilot-Submission")

DELIVERABLE_FILES = (
    "01-作品简介.txt",
    "02-ColdPilot-GOAI-Preliminary.pptx",
    "02-ColdPilot-GOAI-Preliminary.pdf",
    "03-Demo截图索引.md",
    "04-提交说明与自检.md",
    "05-项目运行说明.md",
    "06-三分钟演示讲稿.md",
    "07-ColdPilot-source.zip",
)


def build_archive() -> None:
    if ARCHIVE_PATH.exists():
        ARCHIVE_PATH.unlink()

    with zipfile.ZipFile(ARCHIVE_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file_name in DELIVERABLE_FILES:
            source_path = SUBMISSION_ROOT / file_name
            if not source_path.is_file():
                raise FileNotFoundError(source_path)
            archive.write(source_path, ARCHIVE_ROOT / file_name)

        screenshot_directory = SUBMISSION_ROOT / "03-Demo截图"
        screenshots = sorted(screenshot_directory.glob("*.png"))
        if len(screenshots) != 9:
            raise RuntimeError(f"Expected 9 screenshots, found {len(screenshots)}")
        for screenshot_path in screenshots:
            archive.write(screenshot_path, ARCHIVE_ROOT / "03-Demo截图" / screenshot_path.name)

    verification_directory = SUBMISSION_ROOT.parent / ".submission-verification"
    if verification_directory.exists():
        shutil.rmtree(verification_directory)
    shutil.unpack_archive(ARCHIVE_PATH, verification_directory)
    shutil.rmtree(verification_directory)
    print(ARCHIVE_PATH)


if __name__ == "__main__":
    build_archive()
