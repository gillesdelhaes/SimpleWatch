"""
Database utility functions.
"""
from sqlalchemy.orm import Session
from database import User, Service, EncryptionKey, AppSettings
from utils.auth import hash_password, generate_api_key
from cryptography.fernet import Fernet
import os


def create_default_admin(db: Session):
    """Create default admin user if not exists."""
    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "changeme")

    existing_admin = db.query(User).filter(User.username == admin_username).first()
    if not existing_admin:
        admin_user = User(
            username=admin_username,
            password_hash=hash_password(admin_password),
            email="admin@simplewatch.local",
            api_key=generate_api_key(),
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        print(f"Default admin user created: {admin_username}")
        return admin_user
    return existing_admin


def get_user_by_api_key(db: Session, api_key: str):
    """Get user by API key."""
    return db.query(User).filter(User.api_key == api_key).first()


def get_user_by_username(db: Session, username: str):
    """Get user by username."""
    return db.query(User).filter(User.username == username).first()


def get_service_by_name(db: Session, name: str):
    """Get service by name."""
    return db.query(Service).filter(Service.name == name).first()


def create_service_if_not_exists(db: Session, name: str, description: str = None, created_by: int = None):
    """Create a service if it doesn't already exist."""
    service = get_service_by_name(db, name)
    if not service:
        service = Service(
            name=name,
            description=description,
            created_by=created_by,
            is_active=True
        )
        db.add(service)
        db.commit()
        db.refresh(service)
    return service


def initialize_encryption_key(db: Session):
    """
    Initialize encryption key for SMTP password encryption.
    Creates a new Fernet key on first deployment if not exists.
    This is called automatically during app startup.
    """
    existing_key = db.query(EncryptionKey).first()
    if not existing_key:
        # Generate new Fernet key (32 url-safe base64-encoded bytes)
        new_key = Fernet.generate_key()
        encryption_key = EncryptionKey(
            key_value=new_key.decode()  # Store as string
        )
        db.add(encryption_key)
        db.commit()
        print("Encryption key auto-generated and stored in database")
        return new_key.decode()
    return existing_key.key_value


def initialize_jwt_secret(db: Session) -> str:
    """
    Load or generate the JWT signing secret.
    On first startup, generates a random secret and persists it to AppSettings
    so it survives container restarts. Respects SECRET_KEY env var if set.
    """
    import os
    import secrets as sec_module

    # Env var wins (advanced deployments can pin the key explicitly)
    env_key = os.getenv("SECRET_KEY")
    if env_key:
        return env_key

    existing = db.query(AppSettings).filter(AppSettings.key == "jwt_secret").first()
    if existing:
        return existing.value

    new_secret = sec_module.token_urlsafe(32)
    db.add(AppSettings(key="jwt_secret", value=new_secret))
    db.commit()
    print("JWT secret auto-generated and stored in database")
    return new_secret


def get_encryption_key(db: Session) -> str:
    """
    Get the encryption key from database.
    Returns the key as a string (base64-encoded).
    """
    key_record = db.query(EncryptionKey).first()
    if not key_record:
        raise RuntimeError("Encryption key not initialized. This should not happen - check app startup.")
    return key_record.key_value
