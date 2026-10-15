import argparse
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Activity, Category, Customer, Order, Product
from app.utils.dates import day_start, utc_now

CATEGORIES = ["Electronics", "Furniture", "Office Supplies", "Appliances", "Accessories"]

# (name, category, unit_price, unit_cost)  -- cost is what the business pays per unit
PRODUCTS = [
    ("Business Laptop 15", "Electronics", 54999, 41500),
    ("Smartphone Pro", "Electronics", 32999, 25200),
    ("27-inch Monitor", "Electronics", 15499, 11300),
    ("Ergonomic Office Chair", "Furniture", 9499, 5900),
    ("Standing Desk", "Furniture", 18999, 12400),
    ("Filing Cabinet", "Furniture", 6499, 4100),
    ("A4 Paper (Carton)", "Office Supplies", 1899, 1250),
    ("Printer Ink Pack", "Office Supplies", 2799, 1800),
    ("Whiteboard 4x3 ft", "Office Supplies", 3299, 2100),
    ("Water Purifier", "Appliances", 12499, 8200),
    ("Air Cooler", "Appliances", 8999, 6100),
    ("Wireless Mouse", "Accessories", 899, 520),
    ("Mechanical Keyboard", "Accessories", 3499, 2100),
    ("USB-C Dock", "Accessories", 4299, 2700),
]

CUSTOMER_NAMES = [
    "Arjun Mehta", "Priya Nair", "Rahul Verma", "Sneha Iyer", "Vikram Singh",
    "Ananya Reddy", "Karthik Subramanian", "Meera Pillai", "Rohan Gupta", "Divya Menon",
    "Aditya Joshi", "Kavya Krishnan", "Suresh Babu", "Nisha Agarwal", "Manoj Kumar",
    "Pooja Desai", "Sanjay Rao", "Lakshmi Narayanan", "Imran Sheikh", "Harini Raghavan",
    "Deepak Chauhan", "Swati Kulkarni", "Naveen Prasad", "Fatima Khan", "Gokul Ramesh",
]

HISTORY_DAYS = 60  # orders are generated for today and the 59 days before it
STATUS_WEIGHTS = (("completed", 78), ("pending", 14), ("cancelled", 8))


def seed(db: Session, reset: bool = False, now: datetime | None = None) -> dict[str, int]:
    now = now or utc_now()
    today = now.date()
    rng = random.Random(42)
    inserted = {"categories": 0, "products": 0, "customers": 0, "orders": 0, "activities": 0}

    if reset:
        for model in (Activity, Order, Product, Category, Customer):  # children before parents
            db.execute(delete(model))
        db.flush()

    # --- categories -------------------------------------------------------------------------
    categories = {c.name: c for c in db.scalars(select(Category))}
    for name in CATEGORIES:
        if name not in categories:
            categories[name] = Category(name=name)
            db.add(categories[name])
            inserted["categories"] += 1
    db.flush()

    # --- products ---------------------------------------------------------------------------
    products = {p.name: p for p in db.scalars(select(Product))}
    for name, category, price, cost in PRODUCTS:
        if name not in products:
            products[name] = Product(
                name=name,
                category_id=categories[category].id,
                unit_price=Decimal(price),
                unit_cost=Decimal(cost),
            )
            db.add(products[name])
            inserted["products"] += 1
    db.flush()

    # --- customers --------------------------------------------------------------------------
    customers = {c.email: c for c in db.scalars(select(Customer))}
    for index, name in enumerate(CUSTOMER_NAMES):
        email = f"{name.lower().replace(' ', '.')}@example.com"
        # most customers joined long ago; the last few joined recently (for the activity feed).
        # Drawn before the existence check so the random sequence is the same on every run.
        age_days = rng.randint(70, 400) if index < len(CUSTOMER_NAMES) - 4 else rng.randint(1, 20)
        if email in customers:
            continue
        customers[email] = Customer(
            name=name,
            email=email,
            registered_at=today - timedelta(days=age_days),
            status="inactive" if index in (7, 18) else "active",
        )
        db.add(customers[email])
        inserted["customers"] += 1
    db.flush()

    # --- orders -----------------------------------------------------------------------------
    existing_numbers = set(db.scalars(select(Order.order_number)))
    buyers = [c for c in customers.values() if c.status == "active"]
    product_list = list(products.values())
    statuses = [s for s, w in STATUS_WEIGHTS for _ in range(w)]
    number = 1000

    for days_ago in range(HISTORY_DAYS - 1, -1, -1):  # oldest day first -> order numbers ascend
        per_day = rng.randint(3, 6) + (2 if days_ago < 30 else 0)  # business is growing
        for _ in range(per_day):
            number += 1
            # draw every random value first so the sequence is identical on every run,
            # whether or not this particular order already exists
            seconds = rng.randint(0, 86399)
            product = rng.choice(product_list)
            customer = rng.choice(buyers)
            quantity = rng.randint(1, 4) if product.unit_price < 10000 else rng.randint(1, 2)
            status = rng.choice(statuses)

            order_number = f"ORD{number}"
            if order_number in existing_numbers:
                continue
            ordered_at = day_start(today - timedelta(days=days_ago)) + timedelta(seconds=seconds)
            if ordered_at > now:  # never create orders in the future
                ordered_at = now - timedelta(seconds=60 + seconds % 3000)  # no extra rng draw: keeps runs identical
            if ordered_at.date() < customer.registered_at:
                customer = buyers[0]
            db.add(
                Order(
                    order_number=order_number,
                    customer_id=customer.id,
                    product_id=product.id,
                    ordered_at=ordered_at,
                    quantity=quantity,
                    total_amount=product.unit_price * quantity,  # price paid at order time
                    status=status,
                )
            )
            inserted["orders"] += 1
    db.flush()

    # --- activities -------------------------------------------------------------------------
    inserted["activities"] = _seed_activities(db, now)
    db.commit()
    return inserted


def _seed_activities(db: Session, now: datetime) -> int:
    existing = {(a.activity_type, a.description) for a in db.scalars(select(Activity))}
    pending: list[Activity] = []

    def add(kind: str, description: str, created_at: datetime, ref: tuple[str, int] | None = None) -> None:
        if (kind, description) in existing:
            return
        existing.add((kind, description))
        pending.append(
            Activity(
                activity_type=kind,
                description=description,
                reference_type=ref[0] if ref else None,
                reference_id=ref[1] if ref else None,
                created_at=created_at,
            )
        )

    latest_completed = list(
        db.scalars(
            select(Order).where(Order.status == "completed").order_by(Order.ordered_at.desc(), Order.id.desc()).limit(5)
        )
    )
    for i, order in enumerate(latest_completed[:3]):
        add("order", f"Order #{order.order_number}", now - timedelta(minutes=5 + i * 40), ("order", order.id))
    for i, order in enumerate(latest_completed[3:5]):
        add("payment", f"Invoice #INV-{order.order_number[3:]}", now - timedelta(hours=5 + i * 3), ("order", order.id))

    newest_customers = list(db.scalars(select(Customer).order_by(Customer.registered_at.desc(), Customer.id.desc()).limit(2)))
    for i, customer in enumerate(newest_customers):
        add("customer", customer.name, now - timedelta(hours=3 + i * 20), ("customer", customer.id))

    add("target", "North Region monthly target updated", now - timedelta(hours=2))
    add("target", "South Region monthly target updated", now - timedelta(days=2, hours=4))

    low_stock = db.scalar(select(Product).where(Product.name == "Wireless Mouse"))
    if low_stock is not None:
        add("alert", "Low stock: Wireless Mouse", now - timedelta(hours=26), ("product", low_stock.id))
    add("alert", "Payment gateway latency above threshold", now - timedelta(days=3))

    db.add_all(pending)
    return len(pending)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database with sample business data.")
    parser.add_argument("--reset", action="store_true", help="delete existing business data first")
    args = parser.parse_args()

    with SessionLocal() as db:
        counts = seed(db, reset=args.reset)

    print("Seed complete. Rows inserted this run:")
    for table, count in counts.items():
        print(f"  {table:<11} {count}")
    if not any(counts.values()):
        print("(Nothing new: the data was already present. Use --reset to rebuild with fresh dates.)")


if __name__ == "__main__":
    main()