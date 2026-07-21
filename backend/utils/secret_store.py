"""
File-based master secret storage.

Two secrets are auto-generated on first boot and persisted as files under
/data/secret/, deliberately NOT in the SQLite database:

  - encryption_key: the Fernet key that encrypts SMTP passwords and AI
    provider API keys before they're stored in the database.
  - jwt_secret: signs session tokens.

Keeping a database's own master key inside that same database means a
copied .db file — a manual backup, a volume snapshot, a support bundle —
hands over the ciphertext and the key that opens it in one step. Storing
these as files on their own Docker volume (see docker-compose.yml) keeps
that failure domain separate from the database's, while still requiring
zero configuration: nothing to set, nothing to lose track of, generated
automatically on first run.
"""
import os
import stat
from pathlib import Path
from typing import Callable

_SECRET_DIR = Path(os.getenv("SIMPLEWATCH_SECRET_DIR", "/data/secret"))

_ENCRYPTION_KEY_FILE = "encryption_key"
_JWT_SECRET_FILE = "jwt_secret"


def _read_or_create(filename: str, generate: Callable[[], str]) -> str:
    """Return the persisted value for `filename`, creating it on first use."""
    path = _SECRET_DIR / filename

    if path.exists():
        existing = path.read_text().strip()
        if existing:
            return existing

    value = generate()

    _SECRET_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(value)
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600 - readable/writable by owner only

    return value


def load_or_create_encryption_key() -> str:
    """Load the persisted Fernet encryption key, generating it on first use."""
    from cryptography.fernet import Fernet

    return _read_or_create(_ENCRYPTION_KEY_FILE, generate=lambda: Fernet.generate_key().decode())


def load_or_create_jwt_secret() -> str:
    """Load the persisted JWT signing secret, generating it on first use."""
    import secrets

    return _read_or_create(_JWT_SECRET_FILE, generate=lambda: secrets.token_urlsafe(32))
