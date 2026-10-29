import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

ORDER_NOTIFICATION_EMAIL = "shivamyadav9795877841@gmail.com"


def _send_email(message: EmailMessage) -> None:
    username = os.environ.get("SMTP_USERNAME", ORDER_NOTIFICATION_EMAIL)
    password = os.environ.get("SMTP_PASSWORD", "")
    if not username or not password:
        raise RuntimeError(
            "Set SMTP_USERNAME and SMTP_PASSWORD in .env to enable order emails."
        )

    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError as error:
        raise RuntimeError("SMTP_PORT must be 587 (STARTTLS) or 465 (SSL).") from error
    if not host or port not in {465, 587}:
        raise RuntimeError("SMTP_HOST and a supported SMTP_PORT (587 or 465) are required.")
    sender = os.environ.get("SMTP_FROM", username)
    if not sender:
        raise RuntimeError("SMTP_FROM cannot be empty.")
    message["From"] = sender

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(username, password)
        smtp.send_message(message)


def send_order_email(order: dict[str, Any]) -> None:
    message = EmailMessage()
    message["Subject"] = "New Om Beej Bhandar order request"
    message["To"] = ORDER_NOTIFICATION_EMAIL
    message.set_content(order["email_body"])
    _send_email(message)


def send_test_email() -> None:
    message = EmailMessage()
    message["Subject"] = "Om Beej Bhandar email setup test"
    message["To"] = ORDER_NOTIFICATION_EMAIL
    message.set_content(
        "This is a test email. SMTP is configured correctly for Om Beej Bhandar order notifications."
    )
    _send_email(message)
