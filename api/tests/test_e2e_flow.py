"""End-to-end integration test for the core VibeVariant flow.

Tests the full lifecycle:
1. Create user + project (with tokens)
2. Create experiment
3. SDK init (get variant assignment)
4. Send events
5. Get experiment results

Requires: API server running on localhost:8001, PostgreSQL running locally.
"""

import asyncio
import sys
from uuid import UUID

import httpx
import pytest

sys.path.insert(0, "/Users/discordwell/Projects/vibevariant/api")

BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=10) as c:
        yield c


@pytest.fixture(scope="module")
def setup_user_and_project():
    """Create a user and project directly via the database for testing."""
    from app.core.database import async_session
    from app.models.project import Project
    from app.models.user import User

    async def create_test_data():
        from sqlalchemy import select

        async with async_session() as db:
            # Check if test user already exists (idempotent)
            result = await db.execute(
                select(User).where(User.email == "test@vibevariant.com")
            )
            user = result.scalar_one_or_none()

            if user is None:
                user = User(email="test@vibevariant.com", name="Test User")
                db.add(user)
                await db.flush()

            # Check if test project already exists
            result = await db.execute(
                select(Project).where(Project.user_id == user.id, Project.name == "Test Project")
            )
            project = result.scalar_one_or_none()

            if project is None:
                project = Project(name="Test Project", user_id=user.id)
                db.add(project)
                await db.flush()

            data = {
                "user_id": str(user.id),
                "project_id": str(project.id),
                "project_token": project.project_token,
                "api_key": project.api_key,
            }
            await db.commit()
            return data

    loop = asyncio.new_event_loop()
    data = loop.run_until_complete(create_test_data())
    loop.close()
    return data


@pytest.fixture(scope="module")
def jwt_token(setup_user_and_project):
    """Generate a JWT for the test user."""
    from app.core.security import create_access_token

    return create_access_token(UUID(setup_user_and_project["user_id"]))


class TestHealthCheck:
    def test_health(self, client: httpx.Client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestExperimentCRUD:
    def test_create_experiment(self, client: httpx.Client, jwt_token: str, setup_user_and_project: dict):
        resp = client.post(
            "/api/v1/experiments",
            json={
                "project_id": setup_user_and_project["project_id"],
                "key": "hero-cta",
                "name": "Hero CTA Test",
                "variant_keys": ["control", "bold", "minimal"],
                "traffic_percentage": 1.0,
            },
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        assert resp.status_code == 201, f"Failed: {resp.text}"
        data = resp.json()
        assert data["key"] == "hero-cta"
        assert data["variant_keys"] == ["control", "bold", "minimal"]
        assert data["status"] == "draft"

    def test_list_experiments(self, client: httpx.Client, jwt_token: str, setup_user_and_project: dict):
        resp = client.get(
            f"/api/v1/experiments?project_id={setup_user_and_project['project_id']}",
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["key"] == "hero-cta"

    def test_update_experiment_to_running(self, client: httpx.Client, jwt_token: str, setup_user_and_project: dict):
        # Get experiment ID
        resp = client.get(
            f"/api/v1/experiments?project_id={setup_user_and_project['project_id']}",
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        exp_id = resp.json()[0]["id"]

        # Update to running
        resp = client.patch(
            f"/api/v1/experiments/{exp_id}",
            json={"status": "running"},
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        assert resp.json()["status"] == "running"


class TestSDKInit:
    def test_init_returns_assignments(self, client: httpx.Client, setup_user_and_project: dict):
        resp = client.post(
            "/api/v1/init",
            json={
                "visitor_id": "vv_test_visitor_001",
                "session_id": "vvs_test_session_001",
                "attributes": {"source": "test"},
            },
            headers={"X-Project-Token": setup_user_and_project["project_token"]},
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "visitor_id" in data
        assert "assignments" in data
        assignments = data["assignments"]
        assert isinstance(assignments, list)
        if len(assignments) > 0:
            assert "experiment_key" in assignments[0]
            assert "variant" in assignments[0]
            assert assignments[0]["variant"] in ["control", "bold", "minimal"]

    def test_init_deterministic(self, client: httpx.Client, setup_user_and_project: dict):
        """Same visitor should always get the same variant."""
        results = []
        for _ in range(3):
            resp = client.post(
                "/api/v1/init",
                json={"visitor_id": "vv_determinism_test", "session_id": "vvs_sess_001"},
                headers={"X-Project-Token": setup_user_and_project["project_token"]},
            )
            assert resp.status_code == 200
            results.append(resp.json()["assignments"])
        assert results[0] == results[1] == results[2]


class TestEventIngestion:
    def test_send_events_with_header_token(self, client: httpx.Client, setup_user_and_project: dict):
        resp = client.post(
            "/api/v1/events",
            json={
                "events": [
                    {
                        "visitor_id": "vv_test_visitor_001",
                        "session_id": "vvs_test_session_001",
                        "experiment_assignments": {"hero-cta": "bold"},
                        "event_type": "page_view",
                        "payload": {"url": "https://example.com"},
                        "timestamp": "2026-02-26T12:00:00Z",
                    },
                    {
                        "visitor_id": "vv_test_visitor_001",
                        "session_id": "vvs_test_session_001",
                        "experiment_assignments": {"hero-cta": "bold"},
                        "event_type": "click",
                        "payload": {"selector": "#cta-button", "text": "Sign Up"},
                        "timestamp": "2026-02-26T12:00:05Z",
                    },
                    {
                        "visitor_id": "vv_test_visitor_001",
                        "session_id": "vvs_test_session_001",
                        "experiment_assignments": {"hero-cta": "bold"},
                        "event_type": "goal_completed",
                        "payload": {"goal_id": "signup"},
                        "timestamp": "2026-02-26T12:00:10Z",
                    },
                ]
            },
            headers={"X-Project-Token": setup_user_and_project["project_token"]},
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert data["accepted"] == 3

    def test_send_events_with_body_token(self, client: httpx.Client, setup_user_and_project: dict):
        """Test sendBeacon fallback: token in body instead of header."""
        resp = client.post(
            "/api/v1/events",
            json={
                "projectToken": setup_user_and_project["project_token"],
                "events": [
                    {
                        "visitor_id": "vv_test_visitor_002",
                        "session_id": "vvs_test_session_002",
                        "experiment_assignments": {"hero-cta": "control"},
                        "event_type": "page_view",
                        "payload": {"url": "https://example.com"},
                        "timestamp": "2026-02-26T12:01:00Z",
                    },
                ]
            },
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        assert resp.json()["accepted"] == 1

    def test_reject_without_token(self, client: httpx.Client):
        """Events without any token should be rejected."""
        resp = client.post(
            "/api/v1/events",
            json={
                "events": [
                    {
                        "visitor_id": "vv_test",
                        "session_id": "vvs_test",
                        "event_type": "page_view",
                        "payload": {},
                        "timestamp": "2026-02-26T12:00:00Z",
                    }
                ]
            },
        )
        assert resp.status_code == 401


class TestGoals:
    def test_report_single_goal(self, client: httpx.Client, setup_user_and_project: dict):
        """SDK reports a single detected goal (flat body, not array)."""
        resp = client.post(
            "/api/v1/goals",
            json={
                "type": "signup",
                "label": "Sign Up Form",
                "trigger": {"type": "form_submit", "selector": "#signup-form"},
                "confidence": 0.85,
            },
            headers={"X-Project-Token": setup_user_and_project["project_token"]},
        )
        assert resp.status_code == 201, f"Failed: {resp.text}"
        data = resp.json()
        assert data["type"] == "signup"
        assert data["confirmed"] is False

    def test_list_goals(self, client: httpx.Client, jwt_token: str, setup_user_and_project: dict):
        resp = client.get(
            f"/api/v1/goals?project_id={setup_user_and_project['project_id']}",
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["type"] == "signup"

    def test_confirm_goal(self, client: httpx.Client, jwt_token: str, setup_user_and_project: dict):
        # Get goal ID
        resp = client.get(
            f"/api/v1/goals?project_id={setup_user_and_project['project_id']}",
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        goal_id = resp.json()[0]["id"]

        # Confirm the goal
        resp = client.patch(
            f"/api/v1/goals/{goal_id}",
            json={"confirmed": True},
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        assert resp.json()["confirmed"] is True


class TestFNV1aConsistency:
    """Verify FNV-1a hash produces deterministic, correct results."""

    def test_known_values(self):
        from app.services.assignment import assign_variant, fnv1a

        assert fnv1a("test_visitor:hero-cta") == 2186455057
        result = assign_variant("test_visitor", "hero-cta", ["control", "bold", "minimal"])
        assert result == "control"

    def test_unicode_consistency(self):
        from app.services.assignment import fnv1a

        # Unicode should produce consistent results
        assert fnv1a("café:experiment") == 4080878006

    def test_traffic_gating(self):
        from app.services.assignment import assign_variant

        result = assign_variant("any_visitor", "any_exp", ["a", "b"], traffic_percentage=0.0)
        assert result is None

    def test_deterministic(self):
        from app.services.assignment import assign_variant

        results = set()
        for _ in range(100):
            r = assign_variant("visitor_123", "exp_abc", ["a", "b", "c"])
            results.add(r)
        assert len(results) == 1
