"""
Create example monitors for demonstration.
"""
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Service, Monitor, DashboardLayout, User


def create_example_monitors(db: Session):
    """
    Create 4 example monitors to demonstrate capabilities.
    Only creates them if they don't already exist.
    """
    admin_user = db.query(User).filter(User.is_admin == True).first()
    if not admin_user:
        return

    examples = [
        {
            "name": "Google Search",
            "description": "Website monitor example - Should always be operational",
            "monitor_type": "website",
            "config": {
                "url": "https://www.google.com",
                "timeout_seconds": 10,
                "follow_redirects": True,
                "verify_ssl": True
            },
            "check_interval_minutes": 5
        },
        {
            "name": "Slow Response API",
            "description": "API monitor example - Intentionally times out to demonstrate alerts",
            "monitor_type": "api",
            "config": {
                "url": "https://httpstat.us/200?sleep=8000",
                "method": "GET",
                "expected_status_code": 200,
                "timeout_seconds": 5
            },
            "check_interval_minutes": 5
        },
        {
            "name": "Server Disk Usage",
            "description": "Metric threshold monitor - Demonstrates threshold-based monitoring",
            "monitor_type": "metric_threshold",
            "config": {
                "name": "disk",
                "warning_threshold": 75.0,
                "critical_threshold": 90.0,
                "comparison": "greater"
            },
            "check_interval_minutes": 15
        },
        {
            "name": "Cloudflare DNS (1.1.1.1)",
            "description": "Port monitor example - Checks if DNS service is available",
            "monitor_type": "port",
            "config": {
                "host": "1.1.1.1",
                "port": 53,
                "timeout_seconds": 5
            },
            "check_interval_minutes": 15
        }
    ]

    created_services = []

    for example in examples:
        existing_service = db.query(Service).filter(Service.name == example["name"]).first()
        if existing_service:
            continue

        service = Service(
            name=example["name"],
            description=example["description"],
            category="Example",
            created_by=admin_user.id,
            is_active=True
        )
        db.add(service)
        db.flush()

        monitor = Monitor(
            service_id=service.id,
            monitor_type=example["monitor_type"],
            config_json=json.dumps(example["config"]),
            check_interval_minutes=example["check_interval_minutes"],
            is_active=True,
            next_check_at=datetime.utcnow() + timedelta(minutes=1),
            created_by=admin_user.id
        )
        db.add(monitor)

        created_services.append({
            "service_id": service.id,
            "name": example["name"],
            "monitor_type": example["monitor_type"]
        })

    if created_services:
        db.commit()

        create_example_dashboard(db, admin_user.id, created_services)

        print(f"Created {len(created_services)} example monitors")


def create_example_dashboard(db: Session, user_id: int, services: list):
    """
    Create example dashboard layout for the admin user.
    """
    existing_layout = db.query(DashboardLayout).filter(
        DashboardLayout.user_id == user_id
    ).first()

    if existing_layout:
        return

    layout = {
        "widgets": [
            {
                "id": "widget-1",
                "type": "status_box",
                "service_id": services[0]["service_id"],
                "position": {"x": 0, "y": 0, "w": 6, "h": 4}
            },
            {
                "id": "widget-2",
                "type": "status_box",
                "service_id": services[1]["service_id"],
                "position": {"x": 6, "y": 0, "w": 6, "h": 4}
            },
            {
                "id": "widget-3",
                "type": "custom_metric",
                "service_id": services[2]["service_id"],
                "position": {"x": 0, "y": 4, "w": 6, "h": 4}
            },
            {
                "id": "widget-4",
                "type": "status_box",
                "service_id": services[3]["service_id"],
                "position": {"x": 6, "y": 4, "w": 6, "h": 4}
            }
        ]
    }

    dashboard_layout = DashboardLayout(
        user_id=user_id,
        layout_json=json.dumps(layout)
    )
    db.add(dashboard_layout)
    db.commit()

    print(f"Created example dashboard layout for user {user_id}")
