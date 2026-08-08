import stat
from pathlib import Path

from openhands_factory.authentication import secure_openai_credentials


def test_secure_openai_credentials_preserves_directory_traversal(tmp_path: Path) -> None:
    credentials_dir = tmp_path / ".openhands" / "auth"
    credentials_dir.mkdir(parents=True)
    credential = credentials_dir / "openai_oauth.json"
    credential.write_text("{}", encoding="utf-8")
    credentials_dir.chmod(0o755)
    credential.chmod(0o644)

    secure_openai_credentials(tmp_path)

    assert stat.S_IMODE(credentials_dir.stat().st_mode) == 0o700
    assert stat.S_IMODE(credential.stat().st_mode) == 0o600
