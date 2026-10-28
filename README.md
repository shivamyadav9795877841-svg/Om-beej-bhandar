# Om Beej Bhandar

A responsive storefront starter for Om Beej Bhandar, a local agricultural supplies shop. The site uses a green agriculture-inspired theme and Hindi content to help customers browse example products and send order enquiries through WhatsApp.

## Features

- Responsive layout for desktop, tablet, and mobile
- Product catalogue with category filters, search, and price sorting
- Shopping cart with customer and delivery details
- WhatsApp product enquiries and order summaries
- UPI app hand-off when a merchant UPI ID is configured
- Soft blur effects and reduced-motion support

## Run locally

This is a static website and does not require a build step or package installation.

1. Open `index.html` in a browser, or serve this folder with any static web server.
2. Browse the products and test the search, category filters, cart, and checkout form.

## Before publishing

- Replace the example products, descriptions, and prices in `script.js` with current shop information.
- Confirm the contact number in `script.js` (`STORE_PHONE`) and in the phone and WhatsApp links in `index.html`.
- To enable the UPI app hand-off, replace `YOUR_UPI_ID@bank` in `script.js` with the shop's verified merchant UPI ID.
- Review the delivery, payment, and shop address details in `index.html`.

## Order and payment notes

The checkout sends the order details to WhatsApp. It does not reserve stock, calculate delivery charges, book a courier, or verify payments. UPI is a payment-app hand-off only; payment confirmation must be checked by the shop. The product list currently contains demo entries and prices.
