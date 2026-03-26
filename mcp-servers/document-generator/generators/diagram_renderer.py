"""Diagram renderer — converts Mermaid code to PNG images."""

import subprocess
import tempfile
from pathlib import Path


def render_mermaid(
    code: str,
    output_path: Path,
    width: int = 1200,
    height: int = 800,
    theme: str = "default",
) -> dict:
    """Render Mermaid diagram to PNG using mermaid-cli (mmdc).

    Falls back to a placeholder if mmdc is not installed.
    Returns dict with rendering metadata.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write mermaid code to temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", delete=False) as f:
        f.write(code)
        mmd_path = f.name

    try:
        result = subprocess.run(
            [
                "mmdc",
                "-i", mmd_path,
                "-o", str(output_path),
                "-w", str(width),
                "-H", str(height),
                "-t", theme,
                "-b", "transparent",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode == 0 and output_path.exists():
            return {
                "rendered": True,
                "size": output_path.stat().st_size,
                "method": "mermaid-cli",
            }

        # mmdc failed — try npx fallback
        result2 = subprocess.run(
            [
                "npx", "-y", "@mermaid-js/mermaid-cli",
                "-i", mmd_path,
                "-o", str(output_path),
                "-w", str(width),
                "-H", str(height),
                "-t", theme,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result2.returncode == 0 and output_path.exists():
            return {
                "rendered": True,
                "size": output_path.stat().st_size,
                "method": "npx-mermaid-cli",
            }

        return {
            "rendered": False,
            "error": result.stderr[:200] or result2.stderr[:200],
            "method": "failed",
        }

    except FileNotFoundError:
        return {
            "rendered": False,
            "error": "mermaid-cli (mmdc) not installed. Run: npm install -g @mermaid-js/mermaid-cli",
            "method": "not_installed",
        }
    except subprocess.TimeoutExpired:
        return {
            "rendered": False,
            "error": "Mermaid rendering timed out after 30s",
            "method": "timeout",
        }
    finally:
        Path(mmd_path).unlink(missing_ok=True)
