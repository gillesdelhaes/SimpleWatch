"""
Audit log API endpoints.
"""
import csv
from io import StringIO
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db, AuditLog, User
from api.auth import get_current_user

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/export")
def export_audit_log(
    from_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: str = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export audit log as CSV (admin only). Optional date range filtering."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    if from_date:
        try:
            start = datetime.strptime(from_date, "%Y-%m-%d")
            query = query.filter(AuditLog.created_at >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format. Use YYYY-MM-DD.")

    if to_date:
        try:
            end = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(AuditLog.created_at <= end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format. Use YYYY-MM-DD.")

    entries = query.all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp", "Username", "Action", "Resource Type",
        "Resource ID", "Resource Name", "Details", "IP Address"
    ])

    for entry in entries:
        writer.writerow([
            entry.created_at.isoformat() if entry.created_at else "",
            entry.username or "",
            entry.action,
            entry.resource_type or "",
            entry.resource_id or "",
            entry.resource_name or "",
            entry.details or "",
            entry.ip_address or ""
        ])

    output.seek(0)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_log_{timestamp}.csv"}
    )


@router.get("/count")
def get_audit_log_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get total audit log entry count (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    count = db.query(AuditLog).count()
    return {"count": count}
