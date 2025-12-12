"""
SEO Meta Tag monitor implementation.
Checks for presence and validity of critical SEO meta tags.
"""
import requests
from bs4 import BeautifulSoup
import time
from typing import Dict, Any, List
from monitors.base import BaseMonitor


class SEOMonitor(BaseMonitor):
    """Monitor for checking SEO meta tags on web pages."""

    def check(self) -> Dict[str, Any]:
        """Check SEO meta tags for a URL."""
        url = self.config.get("url")
        timeout_seconds = self.config.get("timeout_seconds", 10)

        # Required tags configuration
        check_title = self.config.get("check_title", True)
        check_description = self.config.get("check_description", True)
        check_og_tags = self.config.get("check_og_tags", True)
        check_canonical = self.config.get("check_canonical", False)
        check_robots = self.config.get("check_robots", False)

        # Length thresholds
        title_min_length = self.config.get("title_min_length", 30)
        title_max_length = self.config.get("title_max_length", 60)
        description_min_length = self.config.get("description_min_length", 120)
        description_max_length = self.config.get("description_max_length", 160)

        try:
            start_time = time.time()

            # Fetch the page
            response = requests.get(
                url,
                timeout=timeout_seconds,
                headers={'User-Agent': 'SimpleWatch-SEO-Monitor/1.0'}
            )

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            response.raise_for_status()

            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')

            # Track findings
            issues = []
            warnings = []
            metadata = {}

            # Check title tag
            if check_title:
                title = soup.find('title')
                if title and title.string:
                    title_text = title.string.strip()
                    title_length = len(title_text)
                    metadata['title'] = title_text
                    metadata['title_length'] = title_length

                    if title_length < title_min_length:
                        warnings.append(f"Title too short ({title_length} chars, recommended: {title_min_length}-{title_max_length})")
                    elif title_length > title_max_length:
                        warnings.append(f"Title too long ({title_length} chars, recommended: {title_min_length}-{title_max_length})")
                else:
                    issues.append("Missing <title> tag")
                    metadata['title'] = None

            # Check meta description
            if check_description:
                description = soup.find('meta', attrs={'name': 'description'})
                if description and description.get('content'):
                    desc_text = description.get('content').strip()
                    desc_length = len(desc_text)
                    metadata['description'] = desc_text
                    metadata['description_length'] = desc_length

                    if desc_length < description_min_length:
                        warnings.append(f"Description too short ({desc_length} chars, recommended: {description_min_length}-{description_max_length})")
                    elif desc_length > description_max_length:
                        warnings.append(f"Description too long ({desc_length} chars, recommended: {description_min_length}-{description_max_length})")
                else:
                    issues.append("Missing meta description")
                    metadata['description'] = None

            # Check Open Graph tags
            if check_og_tags:
                og_title = soup.find('meta', attrs={'property': 'og:title'})
                og_description = soup.find('meta', attrs={'property': 'og:description'})
                og_image = soup.find('meta', attrs={'property': 'og:image'})

                metadata['og_title'] = og_title.get('content') if og_title else None
                metadata['og_description'] = og_description.get('content') if og_description else None
                metadata['og_image'] = og_image.get('content') if og_image else None

                if not og_title:
                    warnings.append("Missing Open Graph title (og:title)")
                if not og_description:
                    warnings.append("Missing Open Graph description (og:description)")
                if not og_image:
                    warnings.append("Missing Open Graph image (og:image)")

            # Check canonical link
            if check_canonical:
                canonical = soup.find('link', attrs={'rel': 'canonical'})
                metadata['canonical'] = canonical.get('href') if canonical else None

                if not canonical:
                    warnings.append("Missing canonical link")

            # Check robots meta tag
            if check_robots:
                robots = soup.find('meta', attrs={'name': 'robots'})
                metadata['robots'] = robots.get('content') if robots else None

                if not robots:
                    warnings.append("Missing robots meta tag")

            # Determine status
            if issues:
                # Critical tags missing - DOWN
                status = "down"
                message = f"Critical SEO issues: {', '.join(issues)}"
            elif warnings:
                # Optional tags missing or length issues - DEGRADED
                status = "degraded"
                message = f"SEO warnings: {', '.join(warnings)}"
            else:
                # All good - OPERATIONAL
                status = "operational"
                message = "All SEO tags present and valid"

            metadata['issues'] = issues
            metadata['warnings'] = warnings
            metadata['total_issues'] = len(issues)
            metadata['total_warnings'] = len(warnings)

            return {
                "status": status,
                "response_time_ms": response_time_ms,
                "metadata": metadata,
                "message": message
            }

        except requests.exceptions.Timeout:
            return {
                "status": "down",
                "metadata": {
                    "error": "timeout",
                    "url": url
                },
                "message": f"Request timed out after {timeout_seconds} seconds"
            }

        except requests.exceptions.ConnectionError:
            return {
                "status": "down",
                "metadata": {
                    "error": "connection_error",
                    "url": url
                },
                "message": "Failed to connect to URL"
            }

        except requests.exceptions.HTTPError as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "http_error",
                    "url": url,
                    "status_code": e.response.status_code if e.response else None
                },
                "message": f"HTTP error: {e.response.status_code if e.response else 'Unknown'}"
            }

        except Exception as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "check_failed",
                    "url": url,
                    "reason": str(e)
                },
                "message": f"Check failed: {str(e)}"
            }
