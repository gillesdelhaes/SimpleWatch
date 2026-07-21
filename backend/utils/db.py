"""
Database utility functions.
"""
from sqlalchemy.orm import Session
from database import User, Service



def get_user_by_api_key(db: Session, api_key: str):
    """Get user by API key."""
    return db.query(User).filter(User.api_key == api_key).first()


def get_user_by_username(db: Session, username: str):
    """Get user by username."""
    return db.query(User).filter(User.username == username).first()


def get_service_by_name(db: Session, name: str):
    """Get service by name."""
    return db.query(Service).filter(Service.name == name).first()



def initialize_encryption_key() -> str:
    """
    Load or generate the Fernet key used to encrypt SMTP passwords and AI
    provider API keys. Lives in a local key file (see utils/secret_store.py),
    never in the database - otherwise a copied .db file would carry both
    the ciphertext and the key that opens it. Called automatically during
    app startup.
    """
    from utils.secret_store import load_or_create_encryption_key
    return load_or_create_encryption_key()


def initialize_jwt_secret() -> str:
    """
    Load or generate the JWT signing secret. Lives in a local key file (see
    utils/secret_store.py), never in the database - a leaked DB backup
    should not also hand over the key that can forge admin sessions.
    Respects SECRET_KEY env var if set (advanced deployments can pin the
    key explicitly).
    """
    import os

    env_key = os.getenv("SECRET_KEY")
    if env_key:
        return env_key

    from utils.secret_store import load_or_create_jwt_secret
    return load_or_create_jwt_secret()


def get_encryption_key() -> str:
    """
    Get the encryption key from its local key file.
    Returns the key as a string (base64-encoded).
    """
    from utils.secret_store import load_or_create_encryption_key
    return load_or_create_encryption_key()
