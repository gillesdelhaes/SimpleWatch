"""
Expiration monitor implementation.
Monitors expiration dates for licenses, subscriptions, domains, contracts, etc.
"""
from datetime import datetime
from typing import Dict, Any
from monitors.base import BaseMonitor


class ExpirationMonitor(BaseMonitor):
    """Monitor for tracking expiration dates of licenses, subscriptions, and other items."""

    def check(self) -> Dict[str, Any]:
        """Check expiration date and determine status based on days remaining."""
        item_name = self.config.get("item_name", "Item")
        expiration_date_str = self.config.get("expiration_date")
        warning_days = self.config.get("warning_days", 30)
        critical_days = self.config.get("critical_days", 7)
        renewal_url = self.config.get("renewal_url", "")
        cost = self.config.get("cost", "")
        notes = self.config.get("notes", "")

        try:
            # Parse expiration date (expecting ISO format: YYYY-MM-DD)
            expiration_date = datetime.fromisoformat(expiration_date_str.replace('Z', '+00:00'))

            # Strip time component for day-based comparison
            expiration_date = expiration_date.replace(hour=0, minute=0, second=0, microsecond=0)
            now = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

            # Calculate days until expiration
            days_until_expiry = (expiration_date - now).days

            # Build metadata
            metadata = {
                "item_name": item_name,
                "expiry_date": expiration_date.date().isoformat(),
                "days_until_expiry": days_until_expiry,
                "warning_threshold": warning_days,
                "critical_threshold": critical_days
            }

            if renewal_url:
                metadata["renewal_url"] = renewal_url
            if cost:
                metadata["cost"] = cost
            if notes:
                metadata["notes"] = notes

            # Determine status based on days remaining
            if days_until_expiry < 0:
                status = "down"
                message = f"{item_name} expired {abs(days_until_expiry)} days ago"
                metadata["reason"] = message
            elif days_until_expiry == 0:
                status = "down"
                message = f"{item_name} expires today"
                metadata["reason"] = message
            elif days_until_expiry <= critical_days:
                status = "down"
                message = f"{item_name} expires in {days_until_expiry} days (critical)"
                metadata["reason"] = message
            elif days_until_expiry <= warning_days:
                status = "degraded"
                message = f"{item_name} expires in {days_until_expiry} days (warning)"
                metadata["reason"] = message
            else:
                status = "operational"
                message = f"{item_name} valid for {days_until_expiry} days"

            return {
                "status": status,
                "metadata": metadata
            }

        except ValueError as e:
            message = f"Invalid expiration date format: {expiration_date_str}. Expected YYYY-MM-DD"
            return {
                "status": "down",
                "metadata": {
                    "error": "invalid_date_format",
                    "item_name": item_name,
                    "reason": message
                }
            }

        except Exception as e:
            message = f"Check failed: {str(e)}"
            return {
                "status": "down",
                "metadata": {
                    "error": "unknown_error",
                    "item_name": item_name,
                    "reason": message
                }
            }
