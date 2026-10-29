# Om Beej Bhandar

A responsive storefront for Om Beej Bhandar, a local agricultural supplies shop. The site uses a green agriculture-inspired theme and Hindi content to display products from MongoDB Atlas and send order enquiries through WhatsApp.

## Features

- Responsive layout for desktop, tablet, and mobile
- MongoDB Atlas product catalogue with category filters, search, and price sorting
- Password-protected page to add and update products
- Shopping cart with customer and delivery details
- SMTP order notifications to the shop and an admin email test button
- WhatsApp product enquiries and order summaries
- UPI app hand-off when a merchant UPI ID is configured
- Soft blur effects and reduced-motion support

## Run locally

The storefront and product management page use HTML and browser JavaScript. A small Python API connects to Atlas so database credentials are never sent to the browser.

```text
backend/
  app.py
  database/
    mongodb.py
frontend/
  index.html
  update-products.html
  assets/
    css/style.css
    js/store.js
    js/product-admin.js
tests/
  test_app.py
run.py
```

1. Install Python 3.10 or newer.
2. Keep the existing Atlas connection settings in `.env`. The app uses the database named in `MONGODB_URI`, if present; otherwise it defaults to `om_beej_bhandar`. The collection defaults to `products`. Set `MONGODB_DB` or `MONGODB_COLLECTION` only to override these defaults.
3. Ensure the Atlas database user can read and update documents in that database/collection, and allow your server's IP address in Atlas Network Access.
4. Install Python requirements with `python -m pip install -r requirements.txt`.
5. Run `python run.py`.
6. Open `http://localhost:5000` for the storefront or `http://localhost:5000/admin` to manage products through the Python/Flask server.
7. The website server can start without admin settings. To add or update products, add `ADMIN_PASSWORD` (at least 12 characters) and `FLASK_SECRET_KEY` (at least 32 random characters) to `.env`. Without an Atlas URI, the pages still load but product requests report that the database is unavailable.

Products should have `name`, `category`, positive numeric `price`, and nonnegative integer `quantity` (available stock count) fields. An optional text `packSize` field can describe the product size, for example `1 किलो` or `500 ग्राम`; it is shown in the storefront, cart, and order message without changing stock calculations. `category` must be one of `बीज`, `खाद`, `कीटनाशक`, `उपकरण`, or `जैविक`. The admin page uploads product images (PNG, JPEG, GIF, or WebP; up to 5 MB) and stores them locally in the ignored `frontend/uploads/` folder. Each submitted order reserves stock atomically, even if email notification fails; the customer can continue via WhatsApp. Existing Atlas products without a `quantity` field are treated as out of stock until an admin sets inventory.

Run the API tests with `python -m unittest discover -s tests`.

## Before publishing

- Confirm the contact number in `frontend/assets/js/store.js` (`STORE_PHONE`) and in the phone and WhatsApp links in `frontend/index.html`.
- To enable the UPI app hand-off, replace `YOUR_UPI_ID@bank` in `frontend/assets/js/store.js` with the shop's verified merchant UPI ID.
- Review the delivery, payment, and shop address details in `frontend/index.html`.
- Use a unique admin password of at least 12 characters and a random Flask secret key of at least 32 characters. In production, serve through HTTPS and set `COOKIE_SECURE=true` so the admin session cookie is secure.

## Order and payment notes

The storefront reads live products from Atlas. Checkout reserves stock and sends order details to the shop by email, then opens a WhatsApp order message. If email delivery fails, stock stays reserved and the customer is told to continue via WhatsApp. The app does not calculate delivery charges, book a courier, or verify payments. UPI is a payment-app hand-off only; payment confirmation must be checked by the shop.

Order notifications are emailed to `shivamyadav9795877841@gmail.com`. Enable 2-Step Verification on the Gmail account, create a Google App Password, then add these settings to the existing `.env` file (never use the regular Gmail password):

```dotenv
SMTP_USERNAME=your-gmail-address@gmail.com
SMTP_PASSWORD=your-16-character-google-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

`SMTP_USERNAME` defaults to the notification email, `SMTP_HOST` defaults to Gmail, and `SMTP_PORT` defaults to 587 (STARTTLS); port 465 (SSL) is also supported. Restart the Flask server after editing `.env`, sign in to `/admin`, and click **टेस्ट ईमेल भेजें**. A successful test arrives at the shop notification address. If SMTP is missing or fails, checkout reports the problem and still opens the WhatsApp order; submitted stock remains reserved. Order requests include customer name, phone, address, and product details.
