#!/usr/bin/env python3
"""
Example script: Disk usage reporter for SimpleWatch
Reports disk usage percentage to a metric threshold monitor.
"""
import argparse
import requests
import random
import time


def get_disk_usage():
    """Simulate disk usage reading (replace with real monitoring)."""
    return random.uniform(60, 95)


def send_metric(api_url, api_key, service_name, value):
    """Send metric value to SimpleWatch."""
    url = f"{api_url}/api/v1/metric/{service_name}"

    payload = {
        "api_key": api_key,
        "value": value
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    return response.json()


def main():
    parser = argparse.ArgumentParser(description='Report disk usage to SimpleWatch')
    parser.add_argument('--api-url', default='http://localhost:5050', help='SimpleWatch API URL')
    parser.add_argument('--api-key', required=True, help='API key for authentication')
    parser.add_argument('--service-name', default='Server Disk Usage', help='Service name')
    parser.add_argument('--interval', type=int, default=900, help='Report interval in seconds (default: 900 = 15 min)')
    parser.add_argument('--once', action='store_true', help='Send once and exit')

    args = parser.parse_args()

    print(f"Disk Usage Reporter for SimpleWatch")
    print(f"Service: {args.service_name}")
    print(f"Interval: {args.interval}s")
    print("-" * 50)

    if args.once:
        disk_usage = get_disk_usage()
        result = send_metric(args.api_url, args.api_key, args.service_name, disk_usage)
        print(f"Sent: {disk_usage:.1f}% - Status: {result['status']}")
        return

    while True:
        try:
            disk_usage = get_disk_usage()
            result = send_metric(args.api_url, args.api_key, args.service_name, disk_usage)
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Sent: {disk_usage:.1f}% - Status: {result['status']}")
        except Exception as e:
            print(f"Error: {e}")

        time.sleep(args.interval)


if __name__ == '__main__':
    main()
