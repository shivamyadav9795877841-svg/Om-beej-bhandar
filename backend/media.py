import uuid
from pathlib import Path

from werkzeug.datastructures import FileStorage

PROJECT_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = PROJECT_ROOT / "frontend" / "uploads"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"GIF87a", ".gif", "image/gif"),
    (b"GIF89a", ".gif", "image/gif"),
)


def save_product_image(upload: FileStorage | None) -> str | None:
    if upload is None or not upload.filename:
        return None

    contents = upload.stream.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise ValueError("Image size must be 5 MB or less.")
    if not contents:
        raise ValueError("Uploaded image is empty.")

    extension = None
    content_type = None
    for signature, candidate_extension, candidate_type in IMAGE_SIGNATURES:
        if contents.startswith(signature):
            extension = candidate_extension
            content_type = candidate_type
            break
    if extension is None and len(contents) >= 12 and contents[8:12] == b"WEBP":
        if contents[:4] == b"RIFF":
            extension = ".webp"
            content_type = "image/webp"
    if extension is None or upload.mimetype != content_type:
        raise ValueError("Upload a valid PNG, JPEG, GIF, or WebP image.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    destination = UPLOAD_DIR / filename
    destination.write_bytes(contents)
    return f"/uploads/{filename}"


def remove_product_image(image_path: str | None) -> None:
    if not image_path or not image_path.startswith("/uploads/"):
        return
    filename = image_path.removeprefix("/uploads/")
    if Path(filename).name != filename:
        return
    (UPLOAD_DIR / filename).unlink(missing_ok=True)

