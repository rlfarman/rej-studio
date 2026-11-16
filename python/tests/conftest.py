"""Shared fixtures.

`modal_app` loads `modal/app.py` by path. It can't be imported normally: the
directory is `modal/`, which would shadow the installed Modal SDK, and the
file isn't part of a package.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MODAL_APP_PATH = REPO_ROOT / "modal" / "app.py"


@pytest.fixture(scope="session")
def modal_app():
    """The loaded modal/app.py module.

    Skips when the Modal client isn't installed (`uv sync` without
    `--group deploy`); CI installs it so these tests always run there.
    """
    pytest.importorskip("modal", reason="Modal client not installed (uv sync --group deploy)")
    if "modal_app" in sys.modules:
        return sys.modules["modal_app"]
    spec = importlib.util.spec_from_file_location("modal_app", MODAL_APP_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["modal_app"] = module
    spec.loader.exec_module(module)
    return module
