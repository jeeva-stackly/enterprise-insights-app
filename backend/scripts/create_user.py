"""Create a user account from the command line (account provisioning, no public sign-up).

    python -m scripts.create_user --email admin@company.com --name "Jeeva Admin" --role admin

The password is typed at a hidden prompt (or read from the NEW_USER_PASSWORD environment variable
for automation). It is hashed with Argon2 before it touches the database and is never printed.
Use this once to create the first Admin; after that, Admins can add people from the app or from
POST /api/users.
"""

import argparse
import getpass
import os
import sys

from pydantic import ValidationError

from app.db.session import SessionLocal
from app.models.constants import USER_ROLES
from app.schemas.user import UserCreate
from app.services import user_service
from app.services.errors import ConflictError


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a user account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True, help="Full name, e.g. \"Jeeva Murugan\"")
    parser.add_argument("--role", choices=USER_ROLES, default="viewer")
    args = parser.parse_args()

    password = os.environ.get("NEW_USER_PASSWORD")
    if not password:
        password = getpass.getpass("Password (min 8 characters): ")
        if password != getpass.getpass("Repeat password: "):
            print("Passwords do not match.")
            return 1

    try:
        data = UserCreate(full_name=args.name, email=args.email, password=password, role=args.role)
    except ValidationError as exc:
        for error in exc.errors():
            print(f"Invalid {error['loc'][-1]}: {error['msg']}")
        return 1

    with SessionLocal() as db:
        try:
            user = user_service.create_user(db, data)
        except ConflictError as exc:
            print(exc.detail)
            return 1
    print(f"Created {user.role} account for {user.email} (id {user.id}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())