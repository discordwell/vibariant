"""Tests for CLI device-code auth flow and new API endpoints.

Requires: API server running on localhost:8001, PostgreSQL running locally.
"""

import os
import sys
import time
from uuid import UUID

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=10) as c:
        yield c


@pytest.fixture(scope="module")
def auth_data(client: httpx.Client):
    """Authenticate via CLI flow and return access token + user info."""
    # Step 1: Start CLI login
    resp = client.post("/api/v1/auth/cli-login", json={"email": "cli-test@vibariant.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert "device_code" in data
    assert data["expires_in"] == 300
    assert data["poll_interval"] == 2

    device_code = data["device_code"]
    dev_token = data.get("dev_token")

    # In dev mode, dev_token should be present
    assert dev_token is not None, "Expected dev_token in dev mode"

    # Step 2: Poll should show pending
    resp = client.post("/api/v1/auth/cli-poll", json={"device_code": device_code})
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"

    # Step 3: Complete auth with the dev token
    resp = client.post(
        "/api/v1/auth/cli-complete",
        json={"device_code": device_code, "token": dev_token},
    )
    assert resp.status_code == 200

    # Step 4: Poll should now show authorized
    resp = client.post("/api/v1/auth/cli-poll", json={"device_code": device_code})
    assert resp.status_code == 200
    poll_data = resp.json()
    assert poll_data["status"] == "authorized"
    assert poll_data["access_token"] is not None
    assert poll_data["email"] == "cli-test@vibariant.com"

    return {
        "access_token": poll_data["access_token"],
        "user_id": poll_data["user_id"],
        "email": poll_data["email"],
    }


class TestCLILogin:
    def test_cli_login_returns_device_code(self, client: httpx.Client):
        resp = client.post("/api/v1/auth/cli-login", json={"email": "test-login@vibariant.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert "device_code" in data
        assert isinstance(data["device_code"], str)
        assert len(data["device_code"]) > 10

    def test_cli_login_dev_mode_returns_token(self, client: httpx.Client):
        resp = client.post("/api/v1/auth/cli-login", json={"email": "dev-mode@vibariant.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["dev_token"] is not None

    def test_cli_login_invalid_email(self, client: httpx.Client):
        resp = client.post("/api/v1/auth/cli-login", json={"email": "not-an-email"})
        assert resp.status_code == 422


class TestCLIPoll:
    def test_poll_unknown_device_code(self, client: httpx.Client):
        resp = client.post("/api/v1/auth/cli-poll", json={"device_code": "nonexistent"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "expired"

    def test_poll_pending_then_authorized(self, client: httpx.Client):
        # Start login
        resp = client.post("/api/v1/auth/cli-login", json={"email": "poll-test@vibariant.com"})
        data = resp.json()
        device_code = data["device_code"]
        dev_token = data["dev_token"]

        # Poll - should be pending
        resp = client.post("/api/v1/auth/cli-poll", json={"device_code": device_code})
        assert resp.json()["status"] == "pending"

        # Complete
        client.post("/api/v1/auth/cli-complete", json={"device_code": device_code, "token": dev_token})

        # Poll - should be authorized
        resp = client.post("/api/v1/auth/cli-poll", json={"device_code": device_code})
        poll_data = resp.json()
        assert poll_data["status"] == "authorized"
        assert poll_data["access_token"] is not None

        # Poll again - should be expired (cleaned up after retrieval)
        resp = client.post("/api/v1/auth/cli-poll", json={"device_code": device_code})
        assert resp.json()["status"] == "expired"


class TestCLIComplete:
    def test_complete_invalid_device_code(self, client: httpx.Client):
        resp = client.post(
            "/api/v1/auth/cli-complete",
            json={"device_code": "nonexistent", "token": "fake"},
        )
        assert resp.status_code == 404

    def test_complete_invalid_token(self, client: httpx.Client):
        # Start login to get valid device_code
        resp = client.post("/api/v1/auth/cli-login", json={"email": "invalid-token@vibariant.com"})
        device_code = resp.json()["device_code"]

        # Complete with invalid token
        resp = client.post(
            "/api/v1/auth/cli-complete",
            json={"device_code": device_code, "token": "invalid-jwt-token"},
        )
        assert resp.status_code == 401

    def test_complete_creates_new_user(self, client: httpx.Client):
        email = f"newuser-{int(time.time())}@vibariant.com"
        resp = client.post("/api/v1/auth/cli-login", json={"email": email})
        data = resp.json()

        resp = client.post(
            "/api/v1/auth/cli-complete",
            json={"device_code": data["device_code"], "token": data["dev_token"]},
        )
        assert resp.status_code == 200

        # Poll to get the user data
        resp = client.post("/api/v1/auth/cli-poll", json={"device_code": data["device_code"]})
        poll_data = resp.json()
        assert poll_data["status"] == "authorized"
        assert poll_data["email"] == email


class TestAuthMe:
    def test_me_authenticated(self, client: httpx.Client, auth_data: dict):
        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "cli-test@vibariant.com"
        assert "user_id" in data

    def test_me_unauthenticated(self, client: httpx.Client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 403


class TestCreateProject:
    def test_create_project(self, client: httpx.Client, auth_data: dict):
        resp = client.post(
            "/api/v1/projects",
            json={"name": "CLI Test Project"},
            headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "CLI Test Project"
        assert data["project_token"].startswith("vv_proj_")
        assert data["api_key"].startswith("vv_sk_")
        assert "id" in data

    def test_create_project_unauthenticated(self, client: httpx.Client):
        resp = client.post("/api/v1/projects", json={"name": "Should Fail"})
        assert resp.status_code == 403

    def test_list_projects_includes_new(self, client: httpx.Client, auth_data: dict):
        resp = client.get(
            "/api/v1/projects",
            headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        names = [p["name"] for p in data]
        assert "CLI Test Project" in names
        # Should also have the auto-created "My Project" from signup
        assert "My Project" in names


class TestFullCLIFlow:
    """Integration test: full CLI auth + project create + experiment create flow."""

    def test_full_cli_workflow(self, client: httpx.Client):
        email = f"fullflow-{int(time.time())}@vibariant.com"

        # 1. CLI login
        resp = client.post("/api/v1/auth/cli-login", json={"email": email})
        login_data = resp.json()

        # 2. Complete (dev mode auto-verify)
        client.post(
            "/api/v1/auth/cli-complete",
            json={"device_code": login_data["device_code"], "token": login_data["dev_token"]},
        )

        # 3. Poll for access token
        resp = client.post("/api/v1/auth/cli-poll", json={"device_code": login_data["device_code"]})
        auth = resp.json()
        assert auth["status"] == "authorized"
        token = auth["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 4. List projects (auto-created "My Project" from signup)
        resp = client.get("/api/v1/projects", headers=headers)
        projects = resp.json()
        assert len(projects) >= 1
        project_id = projects[0]["id"]

        # 5. Create a new project
        resp = client.post("/api/v1/projects", json={"name": "My CLI App"}, headers=headers)
        assert resp.status_code == 201
        new_project = resp.json()

        # 6. Create experiment
        resp = client.post(
            "/api/v1/experiments",
            json={
                "project_id": new_project["id"],
                "key": "hero-headline",
                "name": "Hero Headline Test",
                "variant_keys": ["control", "bold"],
            },
            headers=headers,
        )
        assert resp.status_code == 201
        exp = resp.json()
        assert exp["key"] == "hero-headline"

        # 7. Start experiment
        resp = client.patch(
            f"/api/v1/experiments/{exp['id']}",
            json={"status": "running"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

        # 8. Get me
        resp = client.get("/api/v1/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == email
