"""
Background scheduler for monitor checks using APScheduler.
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from database import SessionLocal, Monitor, StatusUpdate, Service
from monitors.website import WebsiteMonitor
from monitors.api import APIMonitor
from monitors.metric import MetricThresholdMonitor
from monitors.port import PortMonitor
from monitors.deadman import DeadmanMonitor
import json
import time

logger = logging.getLogger(__name__)

scheduler = None


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

        config = json.loads(monitor.config_json)

        monitor_instance = None
        if monitor.monitor_type == "website":
            monitor_instance = WebsiteMonitor(config)
        elif monitor.monitor_type == "api":
            monitor_instance = APIMonitor(config)
        elif monitor.monitor_type == "metric_threshold":
            return
        elif monitor.monitor_type == "port":
            monitor_instance = PortMonitor(config)
        elif monitor.monitor_type == "deadman":
            # Deadman monitor needs last_check_at timestamp
            monitor_instance = DeadmanMonitor(config, monitor.last_check_at)
        else:
            logger.error(f"Unknown monitor type: {monitor.monitor_type}")
            return

        logger.info(f"Checking monitor {monitor.id} ({monitor.monitor_type})")

        result = monitor_instance.check()

        status_update = StatusUpdate(
            service_id=monitor.service_id,
            status=result.get("status", "unknown"),
            timestamp=datetime.utcnow(),
            response_time_ms=result.get("response_time_ms"),
            metadata_json=json.dumps(result.get("metadata", {}))
        )
        db.add(status_update)

        monitor.last_check_at = datetime.utcnow()
        monitor.next_check_at = datetime.utcnow() + timedelta(minutes=monitor.check_interval_minutes)

        db.commit()

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
