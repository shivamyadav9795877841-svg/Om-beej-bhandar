import math
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PRODUCT_CATEGORIES = {"बीज", "खाद", "कीटनाशक", "उपकरण", "जैविक"}


def build_mongodb_uri(uri: str, username: str = "", password: str = "") -> str:
    if not username and not password:
        return uri
    if not username or not password:
        raise ValueError("Set both MONGODB_USERNAME and MONGODB_PASSWORD, or leave both empty.")

    match = re.match(r"^(mongodb(?:\+srv)?://)([^/?#]*)(.*)$", uri)
    if not match:
        raise ValueError("MONGODB_URI must be a MongoDB connection string.")

    authority = re.sub(r"^[^@]*@", "", match.group(2))
    credentials = f"{quote(username, safe='')}:{quote(password, safe='')}@"
    return f"{match.group(1)}{credentials}{authority}{match.group(3)}"


def normalize_product(document: dict[str, Any]) -> dict[str, Any]:
    identifier = document.get("id")
    if identifier is None:
        identifier = document.get("productId")
    if identifier is None:
        identifier = document.get("_id")

    name = document.get("name")
    category = document.get("category")
    quantity = document.get("quantity", 0)
    try:
        price = float(document.get("price"))
    except (TypeError, ValueError):
        price = float("nan")

    if (
        identifier is None
        or not str(identifier).strip()
        or not isinstance(name, str)
        or not name.strip()
        or not isinstance(category, str)
        or category not in PRODUCT_CATEGORIES
        or not math.isfinite(price)
        or price <= 0
        or isinstance(quantity, bool)
        or not isinstance(quantity, int)
        or quantity < 0
    ):
        raise ValueError("A MongoDB product has invalid id, name, category, or price fields.")

    description = document.get("description")
    return {
        "id": str(identifier),
        "name": name.strip(),
        "category": category,
        "image": document.get("image") if isinstance(document.get("image"), str) else "",
        "description": description if isinstance(description, str) else "",
        "packSize": document.get("packSize") if isinstance(document.get("packSize"), str) else "",
        "price": price,
        "quantity": quantity,
    }


def validate_product_update(body: Any) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("उत्पाद का विवरण मान्य नहीं है।")

    name = body.get("name", "").strip() if isinstance(body.get("name"), str) else ""
    category = body.get("category")
    image = body.get("image", "").strip() if isinstance(body.get("image"), str) else ""
    description = (
        body.get("description", "").strip()
        if isinstance(body.get("description"), str)
        else ""
    )
    pack_size = body.get("packSize", "").strip() if isinstance(body.get("packSize"), str) else ""
    try:
        price = float(body.get("price"))
    except (TypeError, ValueError):
        price = float("nan")
    quantity_value = body.get("quantity")
    quantity_text = str(quantity_value).strip()
    try:
        quantity = int(quantity_text)
    except (TypeError, ValueError):
        quantity = -1

    if (
        not name
        or len(name) > 120
        or not isinstance(category, str)
        or category not in PRODUCT_CATEGORIES
        or len(image) > 500
        or len(description) > 500
        or len(pack_size) > 80
        or not math.isfinite(price)
        or price <= 0
        or price > 10_000_000
        or isinstance(quantity_value, bool)
        or not quantity_text.isascii()
        or not quantity_text.isdecimal()
        or quantity < 0
        or quantity > 1_000_000
    ):
        raise ValueError("नाम, कैटेगरी, image, विवरण, कीमत या quantity मान्य नहीं है।")

    return {
        "name": name,
        "category": category,
        "image": image,
        "description": description,
        "packSize": pack_size,
        "price": price,
        "quantity": quantity,
    }


def product_filter(product_id: str) -> dict[str, Any]:
    conditions: list[dict[str, Any]] = [
        {"id": product_id},
        {"productId": product_id},
        {"_id": product_id},
    ]
    if ObjectId.is_valid(product_id):
        conditions.insert(0, {"_id": ObjectId(product_id)})
    if product_id.isdecimal():
        conditions.append({"id": int(product_id)})
    return {"$or": conditions}


def connect_mongodb_collection() -> tuple[Any, MongoClient[Any]]:
    load_dotenv(PROJECT_ROOT / ".env")
    uri = os.environ.get("MONGODB_URI", "")
    if not uri:
        raise RuntimeError("Set MONGODB_URI in .env to enable the Atlas product API.")

    uri_database = unquote(urlsplit(uri).path.lstrip("/").split("/", 1)[0])
    database_name = os.environ.get("MONGODB_DB") or uri_database or "om_beej_bhandar"
    collection_name = os.environ.get("MONGODB_COLLECTION", "products")
    connection_string = build_mongodb_uri(
        uri,
        os.environ.get("MONGODB_USERNAME", ""),
        os.environ.get("MONGODB_PASSWORD", ""),
    )
    client: MongoClient[Any] = MongoClient(
        connection_string,
        serverSelectionTimeoutMS=10_000,
    )
    return client[database_name][collection_name], client
