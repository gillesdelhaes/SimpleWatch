"""
Ollama/Local LLM monitor implementation.
Supports Ollama, LM Studio, LocalAI, and any OpenAI-compatible local LLM API.
"""
import requests
import time
from typing import Dict, Any, List, Tuple
from monitors.base import BaseMonitor


# API-specific configurations
API_CONFIGS = {
    "ollama": {
        "models_endpoint": "/api/tags",
        "completion_endpoint": "/api/generate",
        "models_key": "models",
        "model_name_key": "name",
        "tests_loaded_models": True  # /api/tags returns only loaded models
    },
    "lm_studio": {
        "models_endpoint": "/v1/models",
        "completion_endpoint": "/v1/chat/completions",
        "models_key": "data",
        "model_name_key": "id",
        "tests_loaded_models": False  # /v1/models returns all available models
    },
    "openai_compatible": {
        "models_endpoint": "/v1/models",
        "completion_endpoint": "/v1/chat/completions",
        "models_key": "data",
        "model_name_key": "id",
        "tests_loaded_models": False
    }
}

# Constants
DEFAULT_MODEL_DISPLAY_LIMIT = 3
ERROR_MODEL_DISPLAY_LIMIT = 5


class OllamaMonitor(BaseMonitor):
    """Monitor for checking local LLM API availability and model status."""

    def _build_url(self, protocol: str, host: str, port: int, endpoint: str) -> str:
        """Build full URL from components."""
        return f"{protocol}://{host}:{port}{endpoint}"

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

    def _extract_model_names(self, data: Dict, api_config: Dict) -> List[str]:
        """Extract model names from API response based on API type."""
        models = data.get(api_config["models_key"], [])
        return [m.get(api_config["model_name_key"], "") for m in models]

    def _test_completion(self, base_url: str, model: str, timeout: int) -> Tuple[int, Dict]:
        """Test if a model can complete requests. Returns (status_code, response_data)."""
        try:
            response = requests.post(
                base_url,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "test"}],
                    "max_tokens": 1
                },
                timeout=timeout,
                verify=False
            )
            # Always try to parse JSON response (error messages are in JSON too)
            try:
                data = response.json()
            except:
                data = {}
            return response.status_code, data
        except Exception as e:
            return 0, {"error": {"message": str(e)}}

    def check(self) -> Dict[str, Any]:
        """Check if local LLM API is responding and expected model is loaded."""
        # Extract configuration
        host = self.config.get("host", "localhost")
        port = self.config.get("port", 11434)
        protocol = self.config.get("protocol", "http")
        api_type = self.config.get("api_type", "ollama")
        expected_model = self.config.get("expected_model", "").strip()
        timeout = self.config.get("timeout_seconds", 10)
        slow_threshold = self.config.get("slow_response_threshold", 5000)

        # Get API-specific configuration
        api_config = API_CONFIGS.get(api_type, API_CONFIGS["ollama"])
        url = self._build_url(protocol, host, port, api_config["models_endpoint"])

        try:
            # Fetch models list
            start_time = time.time()
            response = requests.get(url, timeout=timeout, verify=False)
            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            if response.status_code != 200:
                return self._create_status_response(
                    "down",
                    response_time_ms,
                    f"API returned status code {response.status_code}",
                    url=url,
                    api_type=api_type
                )

            # Parse models list
            try:
                data = response.json()
                model_names = self._extract_model_names(data, api_config)
                model_count = len(model_names)

                # Check if no models are loaded (for APIs that only show loaded models)
                if model_count == 0 and api_config["tests_loaded_models"]:
                    return self._create_status_response(
                        "degraded",
                        response_time_ms,
                        "No models loaded",
                        model_count=0,
                        api_type=api_type
                    )

                # For APIs that show all available models, test if any are actually loaded
                loaded_model = None  # Track which model is actually loaded
                if not api_config["tests_loaded_models"]:
                    completion_url = self._build_url(protocol, host, port, api_config["completion_endpoint"])
                    test_model = expected_model if expected_model else (model_names[0] if model_names else "test")

                    status_code, response_data = self._test_completion(completion_url, test_model, timeout)

                    # Check for "no models loaded" error
                    if status_code != 200:
                        error_msg = response_data.get("error", {}).get("message", "") if response_data else ""
                        if "no models loaded" in error_msg.lower():
                            return self._create_status_response(
                                "degraded",
                                response_time_ms,
                                "No models loaded (API available but no models in memory)",
                                model_count=model_count,
                                available_models=model_names[:DEFAULT_MODEL_DISPLAY_LIMIT],
                                api_type=api_type
                            )

                    # Get the actual loaded model from completion response
                    if status_code == 200 and response_data:
                        loaded_model = response_data.get("model", "")

                        # Verify expected model is actually loaded
                        if expected_model and loaded_model and expected_model.lower() not in loaded_model.lower():
                            return self._create_status_response(
                                "degraded",
                                response_time_ms,
                                f"Expected model '{expected_model}' not loaded. Using '{loaded_model}' instead.",
                                expected_model=expected_model,
                                actual_model=loaded_model,
                                available_models=model_names[:ERROR_MODEL_DISPLAY_LIMIT],
                                model_count=model_count,
                                api_type=api_type
                            )

                # For APIs that show only loaded models, check expected model presence
                if expected_model and api_config["tests_loaded_models"]:
                    if not any(expected_model.lower() in name.lower() for name in model_names):
                        return self._create_status_response(
                            "degraded",
                            response_time_ms,
                            f"Expected model '{expected_model}' not loaded",
                            expected_model=expected_model,
                            available_models=model_names[:ERROR_MODEL_DISPLAY_LIMIT],
                            model_count=model_count,
                            api_type=api_type
                        )

                # Check if response time exceeds threshold
                if response_time_ms > slow_threshold:
                    return self._create_status_response(
                        "degraded",
                        response_time_ms,
                        f"Slow response time: {response_time_ms}ms (threshold: {slow_threshold}ms)",
                        model_count=model_count,
                        available_models=model_names[:DEFAULT_MODEL_DISPLAY_LIMIT],
                        api_type=api_type,
                        threshold=slow_threshold
                    )

                # All checks passed - operational
                metadata = {
                    "model_count": model_count,
                    "available_models": model_names[:DEFAULT_MODEL_DISPLAY_LIMIT],
                    "api_type": api_type
                }

                # Add loaded model info
                if loaded_model:
                    metadata["loaded_model"] = loaded_model
                elif model_names:
                    # For Ollama, show first loaded model
                    metadata["loaded_model"] = model_names[0]

                if expected_model:
                    metadata["expected_model"] = expected_model
                    metadata["model_found"] = True

                return self._create_status_response("operational", response_time_ms, None, **metadata)

            except (ValueError, KeyError) as e:
                return self._create_status_response(
                    "degraded",
                    response_time_ms,
                    f"Failed to parse response: {str(e)}",
                    api_type=api_type
                )

        except requests.exceptions.Timeout:
            return self._create_status_response(
                "down",
                None,
                f"API timed out after {timeout} seconds",
                url=url,
                api_type=api_type
            )

        except requests.exceptions.ConnectionError as e:
            return self._create_status_response(
                "down",
                None,
                f"Connection failed: {str(e)}",
                url=url,
                api_type=api_type
            )

        except Exception as e:
            return self._create_status_response(
                "down",
                None,
                f"Check failed: {str(e)}",
                url=url,
                api_type=api_type
            )
