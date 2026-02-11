"""
GitHub Actions monitor implementation.
Monitors workflow runs status for a GitHub repository.
"""
import requests
import time
from typing import Dict, Any, List
from monitors.base import BaseMonitor


class GitHubActionsMonitor(BaseMonitor):
    """Monitor for checking GitHub Actions workflow status."""

    GRAPH_METRICS = [
        {"key": "success_rate", "label": "Success Rate", "unit": "%", "color": "#10B981", "source": "metadata.success_rate"},
        {"key": "avg_duration_seconds", "label": "Avg Duration", "unit": "s", "color": "#6366F1", "source": "metadata.avg_duration_seconds"},
    ]

    GITHUB_API_BASE = "https://api.github.com"

    def _create_status_response(self, status: str, response_time_ms: int = None,
                                reason: str = None, **metadata) -> Dict[str, Any]:
        """Create standardized status response."""
        response = {"status": status}
        if response_time_ms is not None:
            response["response_time_ms"] = response_time_ms
        if reason or metadata:
            response["metadata"] = {}
            if reason:
                response["metadata"]["reason"] = reason
            response["metadata"].update(metadata)
        return response

    def _get_headers(self, token: str = None) -> Dict[str, str]:
        """Build request headers with optional authentication."""
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _calculate_success_rate(self, runs: List[Dict]) -> float:
        """Calculate success rate from workflow runs."""
        if not runs:
            return 0.0

        completed_runs = [r for r in runs if r.get("conclusion") is not None]
        if not completed_runs:
            return 0.0

        successful = sum(1 for r in completed_runs if r.get("conclusion") == "success")
        return round((successful / len(completed_runs)) * 100, 1)

    def _calculate_avg_duration(self, runs: List[Dict]) -> int:
        """Calculate average build duration in seconds from workflow runs."""
        durations = []
        for run in runs:
            if run.get("conclusion") is not None:
                # GitHub provides run_started_at and updated_at
                try:
                    from datetime import datetime
                    start = datetime.fromisoformat(run["run_started_at"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(run["updated_at"].replace("Z", "+00:00"))
                    duration = (end - start).total_seconds()
                    if duration > 0:
                        durations.append(duration)
                except (KeyError, ValueError):
                    continue

        if not durations:
            return 0
        return int(sum(durations) / len(durations))

    def _get_latest_run_status(self, runs: List[Dict]) -> str:
        """Get status of the most recent run."""
        if not runs:
            return "unknown"

        latest = runs[0]  # API returns in descending order
        status = latest.get("status")
        conclusion = latest.get("conclusion")

        if status == "in_progress" or status == "queued":
            return "running"
        elif conclusion == "success":
            return "success"
        elif conclusion in ("failure", "cancelled", "timed_out"):
            return "failure"
        else:
            return "unknown"

    def check(self) -> Dict[str, Any]:
        """Check GitHub Actions workflow status for a repository."""
        # Extract configuration
        owner = self.config.get("owner", "").strip()
        repo = self.config.get("repo", "").strip()
        workflow_file = self.config.get("workflow_file", "").strip()  # Optional
        branch = self.config.get("branch", "").strip()  # Optional
        token = self.config.get("token", "").strip()  # Optional
        timeout = self.config.get("timeout_seconds", 10)
        success_threshold = self.config.get("success_threshold", 80)  # Below this = degraded

        if not owner or not repo:
            return self._create_status_response(
                "down",
                None,
                "Missing required configuration: owner and repo"
            )

        # Build API URL
        if workflow_file:
            url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/actions/workflows/{workflow_file}/runs"
        else:
            url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/actions/runs"

        # Add query parameters
        params = {"per_page": 20}  # Get last 20 runs for statistics
        if branch:
            params["branch"] = branch

        try:
            start_time = time.time()
            response = requests.get(
                url,
                headers=self._get_headers(token),
                params=params,
                timeout=timeout
            )
            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            if response.status_code == 404:
                return self._create_status_response(
                    "down",
                    response_time_ms,
                    f"Repository or workflow not found: {owner}/{repo}",
                    url=url
                )

            if response.status_code == 403:
                # Rate limited or forbidden
                remaining = response.headers.get("X-RateLimit-Remaining", "?")
                return self._create_status_response(
                    "degraded",
                    response_time_ms,
                    f"API rate limited or forbidden (remaining: {remaining})",
                    rate_limit_remaining=remaining
                )

            if response.status_code != 200:
                return self._create_status_response(
                    "down",
                    response_time_ms,
                    f"GitHub API returned status {response.status_code}",
                    url=url
                )

            data = response.json()
            runs = data.get("workflow_runs", [])
            total_count = data.get("total_count", 0)

            if total_count == 0:
                return self._create_status_response(
                    "operational",
                    response_time_ms,
                    None,
                    repository=f"{owner}/{repo}",
                    message="No workflow runs found",
                    total_runs=0
                )

            # Calculate metrics
            success_rate = self._calculate_success_rate(runs)
            avg_duration = self._calculate_avg_duration(runs)
            latest_status = self._get_latest_run_status(runs)
            latest_run = runs[0] if runs else None

            # Build metadata
            metadata = {
                "repository": f"{owner}/{repo}",
                "success_rate": success_rate,
                "avg_duration_seconds": avg_duration,
                "latest_status": latest_status,
                "total_runs": total_count,
                "analyzed_runs": len(runs)
            }

            if workflow_file:
                metadata["workflow"] = workflow_file
            if branch:
                metadata["branch"] = branch

            if latest_run:
                metadata["latest_run"] = {
                    "name": latest_run.get("name", ""),
                    "status": latest_run.get("status"),
                    "conclusion": latest_run.get("conclusion"),
                    "run_number": latest_run.get("run_number"),
                    "html_url": latest_run.get("html_url", "")
                }

            # Rate limit info
            rate_remaining = response.headers.get("X-RateLimit-Remaining")
            if rate_remaining:
                metadata["rate_limit_remaining"] = int(rate_remaining)

            # Determine status based on metrics
            if latest_status == "failure":
                return self._create_status_response(
                    "degraded",
                    response_time_ms,
                    f"Latest build failed (success rate: {success_rate}%)",
                    **metadata
                )

            if success_rate < success_threshold:
                return self._create_status_response(
                    "degraded",
                    response_time_ms,
                    f"Success rate {success_rate}% below threshold {success_threshold}%",
                    **metadata
                )

            # All good
            return self._create_status_response(
                "operational",
                response_time_ms,
                None,
                **metadata
            )

        except requests.exceptions.Timeout:
            return self._create_status_response(
                "down",
                None,
                f"GitHub API timed out after {timeout} seconds"
            )

        except requests.exceptions.ConnectionError as e:
            return self._create_status_response(
                "down",
                None,
                f"Connection failed: {str(e)}"
            )

        except Exception as e:
            return self._create_status_response(
                "down",
                None,
                f"Check failed: {str(e)}"
            )
