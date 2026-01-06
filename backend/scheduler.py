"""
Background scheduler for monitor checks using APScheduler.
"""
import logging
import os
import importlib
import inspect
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from database import SessionLocal, Monitor, StatusUpdate, Service, ServiceNotificationSettings, AppSettings
from monitors.base import BaseMonitor
from utils.service_helpers import (
    calculate_service_status, send_service_notification, update_service_incidents
)
import json
import time

logger = logging.getLogger(__name__)

scheduler = None


def discover_monitors():
    """
    Automatically discover and register all monitor classes.
    Scans the monitors/ directory for Python files and dynamically imports them.

    Returns:
        dict: Mapping of monitor_type (str) to monitor class
    """
    monitor_classes = {}
    monitors_dir = os.path.join(os.path.dirname(__file__), 'monitors')

    # Scan all Python files in monitors directory
    for filename in os.listdir(monitors_dir):
        if filename.endswith('.py') and filename not in ('base.py', '__init__.py'):
            module_name = filename[:-3]  # Remove .py extension

            try:
                # Dynamically import the module
                module = importlib.import_module(f'monitors.{module_name}')

                # Find all classes that inherit from BaseMonitor
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if issubclass(obj, BaseMonitor) and obj != BaseMonitor:
                        # Use the module name as the monitor type
                        # e.g., 'website' from 'website.py', 'ssl_cert' from 'ssl_cert.py'
                        monitor_type = module_name
                        monitor_classes[monitor_type] = obj
                        logger.info(f"Auto-registered monitor: {monitor_type} -> {obj.__name__}")
                        break  # Only register the first BaseMonitor subclass per file

            except Exception as e:
                logger.error(f"Failed to import monitor module '{module_name}': {e}")

    logger.info(f"Monitor auto-discovery complete: {len(monitor_classes)} monitor types registered")
    return monitor_classes


# Auto-discover all monitor classes at module load time
MONITOR_CLASSES = discover_monitors()

# Passive monitors that don't actively check (only receive data via API)
PASSIVE_MONITORS = {'metric_threshold'}


def check_monitor(monitor_id: int):
    """
    Execute a single monitor check.

    Args:
        monitor_id: ID of the monitor to check
    """
    db = SessionLocal()
    try:
        monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
        if not monitor or not monitor.is_active:
            return

        # Skip passive monitors (they only receive data via API)
        if monitor.monitor_type in PASSIVE_MONITORS:
            return

        config = json.loads(monitor.config_json)

        # Add monitor_id to config so monitors can access their database record if needed
        config['monitor_id'] = monitor.id

        # Get monitor class from registry
        monitor_class = MONITOR_CLASSES.get(monitor.monitor_type)
        if not monitor_class:
            logger.error(f"Unknown monitor type: {monitor.monitor_type}")
            return

        monitor_instance = monitor_class(config)

        logger.info(f"Checking monitor {monitor.id} ({monitor.monitor_type})")

        result = monitor_instance.check()

        status_update = StatusUpdate(
            service_id=monitor.service_id,
            monitor_id=monitor.id,
            status=result.get("status", "unknown"),
            timestamp=datetime.utcnow(),
            response_time_ms=result.get("response_time_ms"),
            metadata_json=json.dumps(result.get("metadata", {}))
        )
        db.add(status_update)

        # For deadman monitors, last_check_at should only be updated by heartbeat API
        # For other monitors, update last_check_at to track when the check ran
        if monitor.monitor_type != "deadman":
            monitor.last_check_at = datetime.utcnow()

        monitor.next_check_at = datetime.utcnow() + timedelta(minutes=monitor.check_interval_minutes)

        db.commit()

        # Check if service status changed and send notifications
        new_service_status = calculate_service_status(db, monitor.service_id)

        # Get previous service status from notification settings
        settings = db.query(ServiceNotificationSettings).filter(
            ServiceNotificationSettings.service_id == monitor.service_id
        ).first()

        old_service_status = settings.last_notified_status if settings else "unknown"

        # If status changed, send notification
        if new_service_status != old_service_status:
            logger.info(f"Service {monitor.service_id} status changed: {old_service_status} → {new_service_status}")
            send_service_notification(db, monitor.service_id, old_service_status, new_service_status)

        # Update incidents based on service status
        update_service_incidents(db, monitor.service_id)

        logger.info(f"Monitor {monitor.id} check completed: {result.get('status')}")

    except Exception as e:
        logger.error(f"Error checking monitor {monitor_id}: {e}")
        db.rollback()
    finally:
        db.close()


def monitor_scheduler_job():
    """
    Main scheduler job that checks for monitors that need to run.
    Runs every 30 seconds to check for due monitors.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        due_monitors = db.query(Monitor).filter(
            Monitor.is_active == True,
            Monitor.next_check_at <= now
        ).all()

        if due_monitors:
            logger.info(f"Found {len(due_monitors)} monitors due for checking")

        for monitor in due_monitors:
            try:
                check_monitor(monitor.id)
            except Exception as e:
                logger.error(f"Failed to check monitor {monitor.id}: {e}")

    except Exception as e:
        logger.error(f"Error in monitor scheduler job: {e}")
    finally:
        db.close()


def initialize_monitors():
    """
    Initialize next_check_at for monitors that don't have it set.
    """
    db = SessionLocal()
    try:
        monitors = db.query(Monitor).filter(
            Monitor.is_active == True,
            Monitor.next_check_at == None
        ).all()

        for monitor in monitors:
            monitor.next_check_at = datetime.utcnow() + timedelta(minutes=1)

        db.commit()
        logger.info(f"Initialized {len(monitors)} monitors")
    except Exception as e:
        logger.error(f"Error initializing monitors: {e}")
    finally:
        db.close()


def cleanup_old_status_updates():
    """
    Clean up old status updates based on retention policy.
    Runs daily to remove status updates older than the configured retention period.
    """
    db = SessionLocal()
    try:
        # Get retention days from settings (default: 365 days)
        retention_setting = db.query(AppSettings).filter(
            AppSettings.key == "retention_days"
        ).first()

        retention_days = int(retention_setting.value) if retention_setting else 365

        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        # Delete old status updates
        deleted_count = db.query(StatusUpdate).filter(
            StatusUpdate.timestamp < cutoff_date
        ).delete(synchronize_session=False)

        db.commit()

        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} status updates older than {retention_days} days")

    except Exception as e:
        logger.error(f"Error cleaning up old status updates: {e}")
        db.rollback()
    finally:
        db.close()


def update_cached_uptime():
    """
    Update cached uptime for all services.
    Runs every 5 minutes to keep uptime data fresh.
    """
    from utils.uptime import update_uptime_cache

    db = SessionLocal()
    try:
        update_uptime_cache(db)
    except Exception as e:
        logger.error(f"Error updating cached uptime: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler background scheduler."""
    global scheduler

    if scheduler is not None:
        logger.warning("Scheduler already running")
        return

    scheduler = BackgroundScheduler()

    scheduler.add_job(
        func=monitor_scheduler_job,
        trigger=IntervalTrigger(seconds=30),
        id='monitor_scheduler',
        name='Check monitors every 30 seconds',
        replace_existing=True
    )

    scheduler.add_job(
        func=cleanup_old_status_updates,
        trigger=IntervalTrigger(hours=24),
        id='cleanup_scheduler',
        name='Clean up old status updates daily',
        replace_existing=True
    )

    scheduler.add_job(
        func=update_cached_uptime,
        trigger=IntervalTrigger(minutes=5),
        id='uptime_cache_scheduler',
        name='Update cached uptime every 5 minutes',
        replace_existing=True
    )

    scheduler.start()

    initialize_monitors()

    logger.info("Monitor scheduler started successfully")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global scheduler

    if scheduler is not None:
        scheduler.shutdown()
        scheduler = None
        logger.info("Monitor scheduler stopped")
