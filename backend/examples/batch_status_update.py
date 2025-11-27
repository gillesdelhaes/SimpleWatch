#!/usr/bin/env python3
"""
Example script: Batch status update for SimpleWatch
Updates status for multiple services in one request.
"""
import argparse
import requests
import json


def batch_update(api_url, api_key, updates):
    """Send batch status update to SimpleWatch."""
    url = f"{api_url}/api/v1/status/bulk"

    payload = {
        "api_key": api_key,
        "updates": updates
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    return response.json()


def main():
    parser = argparse.ArgumentParser(description='Batch update service statuses in SimpleWatch')
    parser.add_argument('--api-url', default='http://localhost:5050', help='SimpleWatch API URL')
    parser.add_argument('--api-key', required=True, help='API key for authentication')
    parser.add_argument('--file', required=True, help='JSON file with updates')

    args = parser.parse_args()

    with open(args.file, 'r') as f:
        updates = json.load(f)

    print(f"Batch Status Update for SimpleWatch")
    print(f"Updates: {len(updates)}")
    print("-" * 50)

    result = batch_update(args.api_url, args.api_key, updates)
    print(f"Success: {result['message']}")


if __name__ == '__main__':
    main()
