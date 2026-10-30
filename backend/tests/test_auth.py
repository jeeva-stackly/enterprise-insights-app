"""Authentication and role-based access control tests.

Everything runs on an in-memory SQLite database with throwaway users and a throwaway JWT secret.
No real credentials or tokens exist anywhere in these tests.
"""

from datetime import timedelta

import jwt
import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models import User
from helpers import TEST_PASSWORD, make_user

LOGIN = "/api/auth/login"
ME = "/api/auth/me"


def _login(client, email, password=TEST_PASSWORD):
    return client.post(LOGIN, json={"email": email, "password": password})


# --------------------------------------------------------------------------- login
def test_login_with_valid_credentials(anon_client, users):
    response = _login(anon_client, "analyst@test.com")
    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] == 3600
    assert body["user"] == {
        "id": users["analyst"].id,
        "fullName": "Ana Analyst",
        "email": "analyst@test.com",
        "role": "analyst",
        "status": "active",
    }
    # The token works on a protected endpoint.
    me = anon_client.get(ME, headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200


def test_login_email_is_case_insensitive(anon_client, users):
    assert _login(anon_client, "  ANALYST@Test.com ").status_code == 200


def test_login_with_wrong_password(anon_client, users):
    response = _login(anon_client, "analyst@test.com", "wrong-password")
    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}
    assert "accessToken" not in response.text


def test_login_with_unknown_email_gives_the_same_answer(anon_client, users):
    wrong_password = _login(anon_client, "analyst@test.com", "wrong-password")
    unknown_email = _login(anon_client, "nobody@test.com")
    assert unknown_email.status_code == 401
    assert unknown_email.json() == wrong_password.json()  # does not reveal which emails exist


def test_login_with_disabled_account_is_rejected(anon_client, users):
    response = _login(anon_client, "disabled@test.com")
    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()
    assert "accessToken" not in response.text


def test_disabled_account_with_wrong_password_is_not_revealed(anon_client, users):
    assert _login(anon_client, "disabled@test.com", "wrong-password").status_code == 401


@pytest.mark.parametrize(
    "payload",
    [{}, {"email": "a@test.com"}, {"password": "x"}, {"email": "not-an-email", "password": "x"}, {"email": "a@test.com", "password": ""}],
)
def test_login_validates_the_request(anon_client, users, payload):
    assert anon_client.post(LOGIN, json=payload).status_code == 422


# --------------------------------------------------------------------------- tokens
def test_me_without_token_is_401(anon_client, users):
    response = anon_client.get(ME)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_returns_the_authenticated_identity(anon_client, users, auth_header):
    body = anon_client.get(ME, headers=auth_header(users["viewer"])).json()
    assert (body["id"], body["email"], body["role"], body["fullName"]) == (
        users["viewer"].id,
        "viewer@test.com",
        "viewer",
        "Vik Viewer",
    )


@pytest.mark.parametrize("token", ["garbage", "a.b.c", ""])
def test_invalid_token_is_401(anon_client, users, token):
    response = anon_client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_expired_token_is_401(anon_client, users):
    token, _ = create_access_token(users["admin"].id, expires_delta=timedelta(seconds=-5))
    response = anon_client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_token_signed_with_another_secret_is_401(anon_client, users):
    forged = jwt.encode({"sub": str(users["admin"].id), "iat": 1, "exp": 9999999999}, "x" * 40, algorithm="HS256")
    assert anon_client.get(ME, headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_unsigned_alg_none_token_is_401(anon_client, users):
    forged = jwt.encode({"sub": str(users["admin"].id), "iat": 1, "exp": 9999999999}, key=None, algorithm="none")
    assert anon_client.get(ME, headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_token_of_a_disabled_user_stops_working(anon_client, users, auth_header, db_session):
    headers = auth_header(users["viewer"])
    assert anon_client.get(ME, headers=headers).status_code == 200
    users["viewer"].status = "disabled"
    db_session.commit()
    assert anon_client.get(ME, headers=headers).status_code == 401


def test_role_change_applies_immediately_even_to_an_old_token(anon_client, users, auth_header, db_session):
    headers = auth_header(users["analyst"])
    assert anon_client.get("/api/users", headers=headers).status_code == 403
    users["analyst"].role = "admin"
    db_session.commit()
    assert anon_client.get("/api/users", headers=headers).status_code == 200  # role is read from the DB


# --------------------------------------------------------------------------- protected data endpoints
@pytest.mark.parametrize(
    "url",
    [
        "/api/dashboard",
        "/api/orders",
        "/api/customers",
        "/api/activities",
        "/api/analytics/overview",
        "/api/analytics/revenue-trend",
        "/api/users",
    ],
)
def test_protected_endpoints_require_a_token(anon_client, users, url):
    assert anon_client.get(url).status_code == 401


@pytest.mark.parametrize("role", ["admin", "analyst", "viewer"])
@pytest.mark.parametrize(
    "url", ["/api/dashboard", "/api/orders", "/api/customers", "/api/activities", "/api/analytics/overview"]
)
def test_every_role_can_view_dashboard_analytics_and_activities(anon_client, users, auth_header, role, url):
    assert anon_client.get(url, headers=auth_header(users[role])).status_code == 200


def test_dashboard_shows_the_logged_in_user(anon_client, users, auth_header):
    body = anon_client.get("/api/dashboard", headers=auth_header(users["analyst"])).json()
    assert body["user"]["name"] == "Ana Analyst"
    assert body["user"]["role"] == "Analyst"


# --------------------------------------------------------------------------- user management permissions
def test_admin_can_access_user_management(anon_client, users, auth_header):
    response = anon_client.get("/api/users", headers=auth_header(users["admin"]))
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4 and len(body["items"]) == 4


@pytest.mark.parametrize("role", ["analyst", "viewer"])
def test_analyst_and_viewer_cannot_access_user_management(anon_client, users, auth_header, role):
    headers = auth_header(users[role])
    assert anon_client.get("/api/users", headers=headers).status_code == 403
    assert (
        anon_client.post(
            "/api/users", headers=headers, json={"fullName": "X", "email": "x@test.com", "password": "longenough1"}
        ).status_code
        == 403
    )


def test_viewer_cannot_change_roles_or_status(anon_client, users, auth_header):
    headers = auth_header(users["viewer"])
    target = users["analyst"].id
    assert anon_client.patch(f"/api/users/{target}/role", headers=headers, json={"role": "admin"}).status_code == 403
    assert anon_client.patch(f"/api/users/{target}/status", headers=headers, json={"status": "disabled"}).status_code == 403


def test_viewer_cannot_make_themselves_admin(anon_client, users, auth_header, db_session):
    headers = auth_header(users["viewer"])
    response = anon_client.patch(f"/api/users/{users['viewer'].id}/role", headers=headers, json={"role": "admin"})
    assert response.status_code == 403
    db_session.refresh(users["viewer"])
    assert users["viewer"].role == "viewer"


# --------------------------------------------------------------------------- user management behaviour
def test_admin_creates_a_user_who_can_then_log_in(anon_client, users, auth_header):
    payload = {"fullName": "New Person", "email": "New.Person@Test.com", "password": "brand-new-pass", "role": "analyst"}
    response = anon_client.post("/api/users", headers=auth_header(users["admin"]), json=payload)
    assert response.status_code == 201
    body = response.json()
    assert (body["email"], body["role"], body["status"]) == ("new.person@test.com", "analyst", "active")
    assert _login(anon_client, "new.person@test.com", "brand-new-pass").status_code == 200


def test_duplicate_email_is_rejected_case_insensitively(anon_client, users, auth_header):
    payload = {"fullName": "Copy", "email": "VIEWER@test.com", "password": "longenough1"}
    response = anon_client.post("/api/users", headers=auth_header(users["admin"]), json=payload)
    assert response.status_code == 409


@pytest.mark.parametrize(
    "patch",
    [{"role": "superuser"}, {"password": "short"}, {"email": "bad"}, {"fullName": "   "}],
)
def test_create_user_validation(anon_client, users, auth_header, patch):
    payload = {"fullName": "Valid Name", "email": "valid@test.com", "password": "longenough1", "role": "viewer", **patch}
    assert anon_client.post("/api/users", headers=auth_header(users["admin"]), json=payload).status_code == 422


def test_admin_changes_role_and_status(anon_client, users, auth_header):
    headers = auth_header(users["admin"])
    target = users["viewer"].id
    role = anon_client.patch(f"/api/users/{target}/role", headers=headers, json={"role": "analyst"})
    assert role.status_code == 200 and role.json()["role"] == "analyst"
    status = anon_client.patch(f"/api/users/{target}/status", headers=headers, json={"status": "disabled"})
    assert status.status_code == 200 and status.json()["status"] == "disabled"
    assert _login(anon_client, "viewer@test.com").status_code == 403


def test_invalid_role_or_status_values_are_422(anon_client, users, auth_header):
    headers = auth_header(users["admin"])
    target = users["viewer"].id
    assert anon_client.patch(f"/api/users/{target}/role", headers=headers, json={"role": "boss"}).status_code == 422
    assert anon_client.patch(f"/api/users/{target}/status", headers=headers, json={"status": "banned"}).status_code == 422


def test_unknown_user_id_is_404(anon_client, users, auth_header):
    headers = auth_header(users["admin"])
    assert anon_client.patch("/api/users/9999/role", headers=headers, json={"role": "viewer"}).status_code == 404
    assert anon_client.patch("/api/users/9999/status", headers=headers, json={"status": "active"}).status_code == 404


def test_the_last_active_admin_cannot_be_demoted_or_disabled(anon_client, users, auth_header):
    headers = auth_header(users["admin"])
    me = users["admin"].id
    assert anon_client.patch(f"/api/users/{me}/role", headers=headers, json={"role": "viewer"}).status_code == 409
    assert anon_client.patch(f"/api/users/{me}/status", headers=headers, json={"status": "disabled"}).status_code == 409


def test_an_admin_can_step_down_when_another_active_admin_exists(anon_client, users, auth_header, db_session):
    make_user(db_session, "admin2@test.com", "admin")
    headers = auth_header(users["admin"])
    response = anon_client.patch(f"/api/users/{users['admin'].id}/role", headers=headers, json={"role": "analyst"})
    assert response.status_code == 200


def test_a_disabled_second_admin_does_not_count_as_a_backup(anon_client, users, auth_header, db_session):
    make_user(db_session, "admin2@test.com", "admin", status="disabled")
    headers = auth_header(users["admin"])
    response = anon_client.patch(f"/api/users/{users['admin'].id}/role", headers=headers, json={"role": "viewer"})
    assert response.status_code == 409


def test_users_list_is_paginated(anon_client, users, auth_header):
    body = anon_client.get("/api/users?limit=2&offset=1", headers=auth_header(users["admin"])).json()
    assert (body["total"], body["limit"], body["offset"], len(body["items"])) == (4, 2, 1, 2)
    assert anon_client.get("/api/users?limit=0", headers=auth_header(users["admin"])).status_code == 422


# --------------------------------------------------------------------------- password security
def test_password_hashes_are_never_returned(anon_client, users, auth_header):
    admin = auth_header(users["admin"])
    responses = [
        _login(anon_client, "admin@test.com"),
        anon_client.get(ME, headers=admin),
        anon_client.get("/api/users", headers=admin),
        anon_client.post(
            "/api/users", headers=admin, json={"fullName": "Y", "email": "y@test.com", "password": "longenough1"}
        ),
        anon_client.patch(f"/api/users/{users['viewer'].id}/role", headers=admin, json={"role": "analyst"}),
        anon_client.patch(f"/api/users/{users['viewer'].id}/status", headers=admin, json={"status": "active"}),
    ]
    for response in responses:
        text = response.text.lower()
        assert "hash" not in text and "argon2" not in text and "password" not in text and TEST_PASSWORD.lower() not in text


def test_passwords_are_stored_as_argon2_hashes_not_plain_text(db_session, users):
    for user in db_session.scalars(select(User)):
        assert user.password_hash.startswith("$argon2")
        assert TEST_PASSWORD not in user.password_hash


def test_same_password_gets_different_hashes(users):
    assert users["admin"].password_hash != users["analyst"].password_hash  # random salt per hash