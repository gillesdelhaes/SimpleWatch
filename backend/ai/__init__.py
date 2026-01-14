"""
AI SRE Companion module for SimpleWatch.

This module provides AI-powered incident analysis and remediation suggestions.
"""

from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


def get_llm(settings):
    """
    Initialize and return the appropriate LLM based on settings.

    Args:
        settings: AISettings database object

    Returns:
        LangChain LLM instance or None if not configured
    """
    if not settings or not settings.enabled:
        return None

    try:
        if settings.provider == 'local':
            from langchain_community.llms import Ollama
            return Ollama(
                base_url=settings.endpoint or "http://localhost:11434",
                model=settings.model_name or "llama3.2",
                temperature=0.3
            )
        elif settings.provider == 'openai':
            from langchain_openai import ChatOpenAI
            api_key = decrypt_api_key(settings.api_key_encrypted)
            return ChatOpenAI(
                openai_api_key=api_key,
                model_name=settings.model_name or "gpt-4o-mini",
                temperature=0.3
            )
        elif settings.provider == 'anthropic':
            from langchain_anthropic import ChatAnthropic
            api_key = decrypt_api_key(settings.api_key_encrypted)
            return ChatAnthropic(
                anthropic_api_key=api_key,
                model=settings.model_name or "claude-sonnet-4-20250514",
                temperature=0.3
            )
    except Exception as e:
        logger.error(f"Failed to initialize LLM: {e}")
        return None

    return None


def decrypt_api_key(encrypted_key: Optional[str]) -> Optional[str]:
    """Decrypt an API key from database storage."""
    if not encrypted_key:
        return None

    try:
        from cryptography.fernet import Fernet
        from database import SessionLocal, EncryptionKey

        db = SessionLocal()
        try:
            encryption_record = db.query(EncryptionKey).first()
            if not encryption_record:
                logger.error("No encryption key found in database")
                return None

            fernet = Fernet(encryption_record.key_value.encode())
            return fernet.decrypt(encrypted_key.encode()).decode()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to decrypt API key: {e}")
        return None


def encrypt_api_key(api_key: str, db: Session) -> str:
    """Encrypt an API key for database storage."""
    from cryptography.fernet import Fernet
    from database import EncryptionKey

    # Get or create encryption key
    encryption_record = db.query(EncryptionKey).first()
    if not encryption_record:
        # Generate new encryption key
        key = Fernet.generate_key().decode()
        encryption_record = EncryptionKey(key_value=key)
        db.add(encryption_record)
        db.commit()

    fernet = Fernet(encryption_record.key_value.encode())
    return fernet.encrypt(api_key.encode()).decode()


async def test_llm_connection(settings) -> Dict[str, Any]:
    """
    Test the LLM connection by sending a simple prompt.

    Returns:
        {"success": True/False, "message": str, "error": str (if failed)}
    """
    llm = get_llm(settings)

    if not llm:
        return {
            "success": False,
            "error": "LLM not configured or failed to initialize"
        }

    try:
        # Simple test prompt
        test_prompt = "Respond with exactly: CONNECTION_OK"

        # Handle both sync and async LLMs
        if hasattr(llm, 'ainvoke'):
            response = await llm.ainvoke(test_prompt)
        else:
            response = llm.invoke(test_prompt)

        # Extract text from response
        if hasattr(response, 'content'):
            response_text = response.content
        else:
            response_text = str(response)

        return {
            "success": True,
            "message": f"Connected to {settings.provider} ({settings.model_name})",
            "response": response_text[:100]  # Truncate for safety
        }
    except Exception as e:
        logger.error(f"LLM connection test failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }
