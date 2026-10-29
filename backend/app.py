import hmac
import logging
import os
import secrets
import smtplib
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if __package__ in {None, ""} and str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

print("Server admin is running on http://127.0.0.1:5000/update-products.html")

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory, session
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from werkzeug.exceptions import HTTPException

from backend.database.mongodb import (
    connect_mongodb_collection,
    normalize_product,
    product_filter,
    validate_product_update,
)
from backend.media import remove_product_image, save_product_image
from backend.notifications.email import send_order_email, send_test_email

FRONTEND_DIR = PROJECT_ROOT / "frontend"
STATIC_FILES = {
    "update-products.html",
    "assets/css/style.css",
    "assets/js/store.js",
    "assets/js/product-admin.js",
    "assets/js/product-images.js",
    "assets/images/product-placeholder.svg",
    "assets/images/musterd seeds.jpeg",
    "assets/images/pea.jpeg",
    "assets/images/pestiside .jpeg",
    "assets/images/tata wheet.jpeg",
    "assets/images/wheet.jpeg",
    "assets/images/om-beej-bhandar-logo.jpeg",
}
SESSION_LIFETIME = timedelta(hours=8)
LOGIN_WINDOW_SECONDS = 15 * 60
MAX_LOGIN_ATTEMPTS = 10
ORDER_EMAIL_WINDOW_SECONDS = 10 * 60
MAX_ORDER_EMAILS_PER_WINDOW = 5
login_attempts: dict[str, tuple[int, float]] = {}
login_attempts_lock = threading.Lock()
order_email_attempts: dict[str, tuple[int, float]] = {}
order_email_attempts_lock = threading.Lock()


def create_app(
    collection: Any | None = None,
    admin_password: str | None = None,
    secret_key: str | None = None,
) -> Flask:
    app = Flask(__name__)
    client: Any | None = None
    load_dotenv(PROJECT_ROOT / ".env")

    configured_admin_password = (
        admin_password if admin_password is not None else os.environ.get("ADMIN_PASSWORD", "")
    )
    configured_secret_key = (
        secret_key if secret_key is not None else os.environ.get("FLASK_SECRET_KEY", "")
    )
    if len(configured_admin_password) < 12:
        configured_admin_password = ""
        app.logger.warning("ADMIN_PASSWORD is missing or too short; admin updates are disabled.")
    if len(configured_secret_key) < 32:
        configured_secret_key = secrets.token_hex(32)
        app.logger.warning(
            "FLASK_SECRET_KEY is not configured; sessions reset when the server restarts."
        )

    if collection is None:
        try:
            collection, client = connect_mongodb_collection()
        except (RuntimeError, ValueError, PyMongoError) as error:
            app.logger.warning("MongoDB Atlas is unavailable: %s", error)

    app.secret_key = configured_secret_key
    app.config.update(
        MAX_CONTENT_LENGTH=6 * 1024 * 1024,
        PERMANENT_SESSION_LIFETIME=SESSION_LIFETIME,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Strict",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "").lower() == "true",
    )

    @app.after_request
    def set_security_headers(response: Any) -> Any:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException) -> Any:
        if request.path.startswith("/api/"):
            return jsonify(error=error.description), error.code
        return error

    @app.errorhandler(PyMongoError)
    def handle_database_error(error: PyMongoError) -> Any:
        app.logger.warning("MongoDB request failed: %s", error)
        message = "MongoDB Atlas connection failed. Check .env and Atlas network settings."
        if request.path.startswith("/api/"):
            return jsonify(error=message), 503
        return message, 503

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception) -> Any:
        app.logger.exception("Request failed: %s %s", request.method, request.path)
        if request.path.startswith("/api/"):
            return jsonify(error="सर्वर अनुरोध पूरा नहीं कर सका।"), 500
        return "सर्वर अनुरोध पूरा नहीं कर सका।", 500

    @app.get("/")
    def home() -> Any:
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/admin")
    @app.get("/admin/")
    def admin_page() -> Any:
        return send_from_directory(FRONTEND_DIR, "update-products.html")

    @app.get("/<path:filename>")
    def static_file(filename: str) -> Any:
        if filename not in STATIC_FILES:
            abort(404)
        return send_from_directory(FRONTEND_DIR, filename)

    @app.get("/uploads/<path:filename>")
    def product_image(filename: str) -> Any:
        return send_from_directory(FRONTEND_DIR / "uploads", filename, max_age=31_536_000)

    @app.get("/api/products")
    def list_products() -> Any:
        if collection is None:
            return jsonify(error="MongoDB Atlas सेट नहीं है। .env में MONGODB_URI जाँचें।"), 503
        return jsonify([normalize_product(document) for document in collection.find({})])

    @app.post("/api/products")
    def create_product() -> Any:
        if session.get("authenticated") is not True:
            return jsonify(error="उत्पाद जोड़ने के लिए पहले लॉगिन करें।"), 401
        if collection is None:
            return jsonify(error="MongoDB Atlas सेट नहीं है। .env में MONGODB_URI जाँचें।"), 503

        try:
            product = validate_product_update(request.form.to_dict())
            product["image"] = save_product_image(request.files.get("image"))
            if not product["image"]:
                raise ValueError("नया उत्पाद जोड़ने के लिए image upload करें।")
        except ValueError as error:
            return jsonify(error=str(error)), 400

        try:
            result = collection.insert_one({
                **product,
                "createdAt": datetime.now(timezone.utc),
            })
            created = collection.find_one({"_id": result.inserted_id})
            if created is None:
                remove_product_image(product["image"])
                return jsonify(error="नया उत्पाद MongoDB में नहीं मिला।"), 500
        except PyMongoError:
            remove_product_image(product["image"])
            raise
        return jsonify(normalize_product(created)), 201

    @app.post("/api/orders")
    def create_order() -> Any:
        if collection is None:
            return jsonify(error="MongoDB Atlas सेट नहीं है। .env में MONGODB_URI जाँचें।"), 503

        body = request.get_json()
        if not isinstance(body, dict):
            return jsonify(error="ऑर्डर का विवरण मान्य नहीं है।"), 400

        buyer_name = body.get("name")
        buyer_phone = body.get("phone")
        address = body.get("address")
        city = body.get("city")
        pin = body.get("pin")
        delivery_area = body.get("deliveryArea")
        payment = body.get("payment")
        items = body.get("items")
        if (
            not isinstance(buyer_name, str)
            or not buyer_name.strip()
            or len(buyer_name.strip()) > 120
            or not isinstance(buyer_phone, str)
            or not buyer_phone.isdigit()
            or len(buyer_phone) != 10
            or not isinstance(address, str)
            or not address.strip()
            or len(address.strip()) > 500
            or not isinstance(city, str)
            or not city.strip()
            or len(city.strip()) > 120
            or not isinstance(pin, str)
            or not pin.isdigit()
            or len(pin) != 6
            or not isinstance(delivery_area, str)
            or delivery_area not in {"local", "india"}
            or not isinstance(payment, str)
            or payment not in {"UPI", "COD"}
            or not isinstance(items, list)
            or not items
            or len(items) > 50
        ):
            return jsonify(error="नाम, फोन, पता, PIN या ऑर्डर विवरण मान्य नहीं है।"), 400

        validated_items = []
        for item in items:
            if not isinstance(item, dict):
                return jsonify(error="ऑर्डर में उत्पाद विवरण मान्य नहीं है।"), 400

            product_id = item.get("id")
            quantity = item.get("qty")
            if (
                not isinstance(product_id, str)
                or not product_id
                or isinstance(quantity, bool)
                or not isinstance(quantity, int)
                or quantity < 1
                or quantity > 1000
            ):
                return jsonify(error="उत्पाद या मात्रा मान्य नहीं है।"), 400

            validated_items.append((product_id, quantity))

        address_key = request.remote_addr or "unknown"
        now = time.monotonic()
        with order_email_attempts_lock:
            attempt = order_email_attempts.get(address_key)
            if attempt and attempt[1] <= now:
                order_email_attempts.pop(address_key, None)
                attempt = None
            if attempt and attempt[0] >= MAX_ORDER_EMAILS_PER_WINDOW:
                return jsonify(error="बहुत सारे ऑर्डर अनुरोध हुए। कुछ देर बाद कोशिश करें।"), 429
            expires_at = attempt[1] if attempt else now + ORDER_EMAIL_WINDOW_SECONDS
            order_email_attempts[address_key] = ((attempt[0] if attempt else 0) + 1, expires_at)

        reservations: list[tuple[dict[str, Any], int]] = []
        reserved_products = []
        email_sent = True
        try:
            order_lines = []
            total_amount = 0
            for product_id, quantity in validated_items:
                selector = {
                    "$and": [
                        product_filter(product_id),
                        {"quantity": {"$gte": quantity}},
                    ]
                }
                product_document = collection.find_one_and_update(
                    selector,
                    {"$inc": {"quantity": -quantity}},
                    return_document=ReturnDocument.AFTER,
                )
                if product_document is None:
                    raise ValueError("उत्पाद उपलब्ध नहीं है या पर्याप्त stock नहीं है।")

                reservations.append((product_filter(product_id), quantity))
                product = normalize_product(product_document)
                reserved_products.append({
                    "id": product["id"],
                    "quantity": product["quantity"],
                })
                line_total = product["price"] * quantity
                total_amount += line_total
                pack_size = f" ({product['packSize']})" if product["packSize"] else ""
                order_lines.append(
                    f"- {product['name']}{pack_size}: "
                    f"{quantity} x ₹{product['price']:,.2f} = ₹{line_total:,.2f}"
                )

            if total_amount <= 0 or total_amount > 100_000_000:
                raise ValueError("ऑर्डर की कुल कीमत मान्य सीमा से बाहर है।")

            order = {
                "buyer_name": buyer_name.strip(),
                "email_body": "\n".join(
                    [
                        "New order request for Om Beej Bhandar",
                        "",
                        f"Name: {buyer_name.strip()}",
                        f"Phone: {buyer_phone}",
                        f"Address: {address.strip()}, {city.strip()}, PIN {pin}",
                        f"Delivery: {'Local' if delivery_area == 'local' else 'All India courier'}",
                        f"Payment preference: {payment}",
                        "",
                        "Products:",
                        *order_lines,
                        "",
                        f"Product total: ₹{total_amount:,.2f}",
                        "Stock is reserved for this order request. Confirm payment and delivery with the customer.",
                    ]
                ),
            }
            send_order_email(order)
        except ValueError as error:
            for selector, quantity in reversed(reservations):
                collection.update_one(selector, {"$inc": {"quantity": quantity}})
            return jsonify(error=str(error)), 409
        except (RuntimeError, OSError, smtplib.SMTPException) as error:
            app.logger.warning("Order email could not be sent: %s", error)
            email_sent = False
        except PyMongoError:
            for selector, quantity in reversed(reservations):
                collection.update_one(selector, {"$inc": {"quantity": quantity}})
            raise

        return jsonify(
            message=(
                "ऑर्डर का stock reserve हुआ और सूचना email कर दी गई।"
                if email_sent
                else "ऑर्डर का stock reserve हुआ, लेकिन email नहीं भेजा जा सका। WhatsApp पर भेजें।"
            ),
            emailSent=email_sent,
            products=reserved_products,
        ), 201

    @app.get("/api/admin/session")
    def admin_session() -> Any:
        return jsonify(authenticated=session.get("authenticated") is True)

    @app.post("/api/admin/login")
    def admin_login() -> Any:
        if not configured_admin_password:
            return (
                jsonify(error="एडमिन अपडेट के लिए .env में 12+ अक्षरों का ADMIN_PASSWORD सेट करें।"),
                503,
            )

        address = request.remote_addr or "unknown"
        now = time.monotonic()
        with login_attempts_lock:
            attempt = login_attempts.get(address)
            if attempt and attempt[1] <= now:
                login_attempts.pop(address, None)
                attempt = None
            if attempt and attempt[0] >= MAX_LOGIN_ATTEMPTS:
                return jsonify(error="बहुत अधिक प्रयास हुए। कुछ देर बाद कोशिश करें।"), 429
            expires_at = attempt[1] if attempt else now + LOGIN_WINDOW_SECONDS
            login_attempts[address] = ((attempt[0] if attempt else 0) + 1, expires_at)

        body = request.get_json()
        password = body.get("password", "") if isinstance(body, dict) else ""
        if not isinstance(password, str) or not hmac.compare_digest(
            password, configured_admin_password
        ):
            return jsonify(error="पासवर्ड सही नहीं है।"), 401

        with login_attempts_lock:
            login_attempts.pop(address, None)
        session.clear()
        session["authenticated"] = True
        session.permanent = True
        return jsonify(authenticated=True)

    @app.post("/api/admin/logout")
    def admin_logout() -> Any:
        session.clear()
        return jsonify(authenticated=False)

    @app.post("/api/admin/email-test")
    def admin_email_test() -> Any:
        if session.get("authenticated") is not True:
            return jsonify(error="ईमेल टेस्ट करने के लिए पहले एडमिन लॉगिन करें।"), 401
        try:
            send_test_email()
        except (RuntimeError, OSError, smtplib.SMTPException) as error:
            app.logger.warning("Email test could not be sent: %s", error)
            return (
                jsonify(error="टेस्ट ईमेल नहीं भेजा जा सका। .env की SMTP सेटिंग जाँचें।"),
                503,
            )
        return jsonify(message="टेस्ट ईमेल दुकान के Gmail पते पर भेज दिया गया।")

    @app.put("/api/products/<product_id>")
    def update_product(product_id: str) -> Any:
        if session.get("authenticated") is not True:
            return jsonify(error="उत्पाद अपडेट करने के लिए पहले लॉगिन करें।"), 401
        if collection is None:
            return jsonify(error="MongoDB Atlas सेट नहीं है। .env में MONGODB_URI जाँचें।"), 503

        selector = product_filter(product_id)
        existing = collection.find_one(selector)
        if existing is None:
            return jsonify(error="यह उत्पाद MongoDB में नहीं मिला।"), 404
        existing_image = existing.get("image")

        uploaded_image = None
        try:
            update = validate_product_update(request.form.to_dict())
            uploaded_image = save_product_image(request.files.get("image"))
            update["image"] = uploaded_image or existing.get("image", "")
        except ValueError as error:
            return jsonify(error=str(error)), 400

        try:
            result = collection.update_one(
                selector,
                {"$set": {**update, "updatedAt": datetime.now(timezone.utc)}},
            )
        except PyMongoError:
            remove_product_image(uploaded_image)
            raise
        if not result.matched_count:
            remove_product_image(uploaded_image)
            return jsonify(error="यह उत्पाद MongoDB में नहीं मिला।"), 404

        updated = collection.find_one(selector)
        if updated is None:
            return jsonify(error="अपडेट के बाद उत्पाद MongoDB में नहीं मिला।"), 404
        if uploaded_image:
            remove_product_image(existing_image)
        return jsonify(normalize_product(updated))

    @app.delete("/api/products/<product_id>")
    def delete_product(product_id: str) -> Any:
        if session.get("authenticated") is not True:
            return jsonify(error="उत्पाद हटाने के लिए पहले लॉगिन करें।"), 401
        if collection is None:
            return jsonify(error="MongoDB Atlas सेट नहीं है। .env में MONGODB_URI जाँचें।"), 503

        selector = product_filter(product_id)
        existing = collection.find_one(selector)
        if existing is None:
            return jsonify(error="यह उत्पाद MongoDB में नहीं मिला।"), 404

        result = collection.delete_one(selector)
        if not result.deleted_count:
            return jsonify(error="यह उत्पाद MongoDB में नहीं मिला।"), 404

        remove_product_image(existing.get("image"))
        return jsonify(message="उत्पाद सफलतापूर्वक हटा दिया गया।")

    if client is not None:
        app.extensions["mongodb_client"] = client
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    application = create_app()
    application.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
    )
