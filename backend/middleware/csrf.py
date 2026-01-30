"""
CSRF Protection Middleware

Uses Origin header validation - the modern approach for API CSRF protection.
This is more secure than token-based CSRF for stateless APIs because:
1. Origin header is set by the browser and cannot be forged by JavaScript
2. No need to manage CSRF tokens
3. Works with all HTTP methods that need protection
"""

from typing import Callable, List
from urllib.parse import urlparse

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# HTTP methods that can modify state and need CSRF protection
UNSAFE_METHODS = {"POST", "PUT", "DELETE", "PATCH"}


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Middleware that validates Origin header for unsafe HTTP methods.

    Rejects requests where:
    - Method is POST/PUT/DELETE/PATCH
    - Origin header is missing or doesn't match allowed origins
    """

    def __init__(self, app, allowed_origins: List[str]):
        super().__init__(app)
        # Normalize origins (remove trailing slashes, lowercase)
        self.allowed_origins = set(
            origin.rstrip("/").lower() for origin in allowed_origins
        )

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        # Skip CSRF check for safe methods
        if request.method not in UNSAFE_METHODS:
            return await call_next(request)

        # Get Origin header
        origin = request.headers.get("origin", "").lower()

        # Also check Referer as fallback (some browsers don't send Origin)
        referer = request.headers.get("referer", "")
        if referer:
            parsed = urlparse(referer)
            referer_origin = f"{parsed.scheme}://{parsed.netloc}".lower()
        else:
            referer_origin = ""

        # Validate origin
        if origin:
            if origin not in self.allowed_origins:
                return self._cors_error_response(origin, "origin_mismatch")
        elif referer_origin:
            if referer_origin not in self.allowed_origins:
                return self._cors_error_response(referer_origin, "referer_mismatch")
        else:
            # No Origin or Referer header - reject for safety
            return self._cors_error_response("", "missing_origin")

        # Origin is valid, continue to next middleware
        return await call_next(request)

    def _cors_error_response(self, origin: str, reason: str) -> JSONResponse:
        """Return CSRF error with CORS headers to prevent browser CORS errors."""
        response = JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "CSRF_VALIDATION_FAILED",
                    "message": "Cross-site request blocked",
                    "details": {"reason": reason},
                }
            },
        )
        # Add CORS headers so browser can read the error
        if origin and origin in self.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
