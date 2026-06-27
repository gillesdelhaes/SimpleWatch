"""
Monitor implementations for SimpleWatch.

Auto-discovers all monitor classes at import time and exposes capability sets.
Any module that needs monitor type metadata should import from here, not from
scheduler.py, to avoid circular dependencies.
"""
import os
import importlib
import inspect
import logging
from monitors.base import BaseMonitor

logger = logging.getLogger(__name__)


def _discover_monitors():
    monitors_dir = os.path.dirname(__file__)
    classes = {}
    for filename in sorted(os.listdir(monitors_dir)):
        if filename.endswith('.py') and filename not in ('base.py', '__init__.py'):
            module_name = filename[:-3]
            try:
                module = importlib.import_module(f'monitors.{module_name}')
                for _, obj in inspect.getmembers(module, inspect.isclass):
                    if issubclass(obj, BaseMonitor) and obj is not BaseMonitor:
                        obj.MONITOR_TYPE = module_name
                        classes[module_name] = obj
                        logger.debug(f"Registered monitor: {module_name} -> {obj.__name__}")
                        break
            except Exception as e:
                logger.error(f"Failed to import monitor module '{module_name}': {e}")
    logger.info(f"Monitor discovery complete: {len(classes)} types registered")
    return classes


MONITOR_CLASSES = _discover_monitors()

# Derived capability sets — add new sets here as new class-level flags are introduced
PASSIVE_MONITORS = frozenset(
    t for t, cls in MONITOR_CLASSES.items() if getattr(cls, 'IS_PASSIVE', False)
)
HEARTBEAT_MONITORS = frozenset(
    t for t, cls in MONITOR_CLASSES.items() if getattr(cls, 'ACCEPTS_HEARTBEAT', False)
)
