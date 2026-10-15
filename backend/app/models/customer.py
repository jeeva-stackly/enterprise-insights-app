from datetime import date

from sqlalchemy import CheckConstraint, Date, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.constants import CUSTOMER_STATUSES, in_list


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    registered_at: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")

    orders: Mapped[list["Order"]] = relationship(back_populates="customer")

    __table_args__ = (CheckConstraint(in_list("status", CUSTOMER_STATUSES), name="status_valid"),)