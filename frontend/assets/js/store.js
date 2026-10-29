const STORE_PHONE = "919554846920";
/* Replace this with the shop's verified merchant UPI ID before enabling UPI payments. */
const MERCHANT_UPI_ID = "YOUR_UPI_ID@bank";

let products = [];
let cart = [];
let category = "सभी";
let query = "";

const rupees = amount => "₹" + amount.toLocaleString("en-IN");
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

function renderProducts() {
  const visibleProducts = products.filter(product => {
    const matchesCategory = category === "सभी" || product.category === category;
    const searchableText = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return matchesCategory && searchableText.includes(query.toLowerCase());
  });
  const sortOrder = document.getElementById("sort").value;

  if (sortOrder === "low") {
    visibleProducts.sort((first, second) => first.price - second.price);
  } else if (sortOrder === "high") {
    visibleProducts.sort((first, second) => second.price - first.price);
  }

  document.getElementById("count").textContent = `${visibleProducts.length} उत्पाद`;
  document.getElementById("productGrid").innerHTML = visibleProducts.map(product => `
    <article class="product">
      <img class="productimg" src="${escapeHtml(getProductImage(product))}"
        alt="${escapeHtml(product.name)}" loading="lazy">
      <div class="productbody">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="muted">${escapeHtml(product.description)}</p>
        <div class="price">${rupees(product.price)}</div>
        <p class="muted">${product.quantity} नग उपलब्ध</p>
        <div class="actions">
          <button data-action="add" data-product-id="${escapeHtml(product.id)}"
            ${product.quantity < 1 ? "disabled" : ""}>${product.quantity < 1 ? "स्टॉक में नहीं" : "＋ कार्ट में जोड़ें"}</button>
          <button class="query" data-action="ask" data-product-id="${escapeHtml(product.id)}">पूछताछ</button>
        </div>
      </div>
    </article>`).join("") || "<p>कोई उत्पाद नहीं मिला।</p>";
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const row = cart.find(item => item.id === id);
  if (row) {
    if (row.qty >= product.quantity) {
      alert("उतना स्टॉक उपलब्ध नहीं है।");
      return;
    }
    row.qty += 1;
  } else {
    if (product.quantity < 1) {
      alert("यह उत्पाद अभी स्टॉक में नहीं है।");
      return;
    }
    cart.push({ id, qty: 1 });
  }
  renderCart();
  openCart();
}

function removeItem(id) {
  cart = cart.filter(item => item.id !== id);
  renderCart();
}

function total() {
  return cart.reduce((sum, item) => {
    const product = products.find(candidate => candidate.id === item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
}

function renderCart() {
  document.getElementById("cartCount").textContent = cart.reduce(
    (count, item) => count + item.qty,
    0
  );
  document.getElementById("cartTotal").textContent =
    `उत्पाद कुल: ${rupees(total())} (डिलीवरी चार्ज अलग हो सकता है)`;

  const cartItems = cart.map(item => {
    const product = products.find(candidate => candidate.id === item.id);
    if (!product) return "";

    return `
      <div class="cartline">
        <div>
          <img class="cart-product-image" src="${escapeHtml(getProductImage(product))}"
            alt="" loading="lazy">
          <b>${escapeHtml(product.name)}</b><br>
          <small>${rupees(product.price)} each</small>
        </div>
        <div class="cart-quantity">
          <input aria-label="${escapeHtml(product.name)} quantity" data-quantity-id="${escapeHtml(product.id)}"
            type="number" min="1" max="${product.quantity}" value="${item.qty}">
          <button data-remove-id="${escapeHtml(product.id)}">हटाएँ</button>
        </div>
      </div>`;
  }).join("");

  document.getElementById("cartItems").innerHTML = cartItems
    || '<p class="empty">कार्ट खाली है। पहले उत्पाद जोड़ें।</p>';
}

function openCart() {
  document.getElementById("cartPanel").classList.add("open");
}

function askProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  const message = `नमस्ते Om Beej Bhandar, मुझे ${product.name} के बारे में जानकारी चाहिए। कृपया वास्तविक कीमत और उपलब्धता बताएं।`;
  window.open(
    `https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
}

function openWhatsAppOrder(message, tab = null) {
  const url = `https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(message)}`;
  if (tab) {
    tab.location.href = url;
  } else {
    window.open(url, "_blank", "noopener");
  }
}

async function submitCheckout(event) {
  event.preventDefault();
  if (!cart.length) {
    alert("पहले कार्ट में उत्पाद जोड़ें।");
    return;
  }

  const orderProducts = cart.map(item => ({
    ...item,
    product: products.find(product => product.id === item.id)
  }));
  if (orderProducts.some(item => !item.product)) {
    alert("कार्ट का एक उत्पाद उपलब्ध नहीं है। पेज रीलोड करके दोबारा कोशिश करें।");
    return;
  }

  const name = document.getElementById("buyerName").value.trim();
  const phone = document.getElementById("buyerPhone").value.trim();
  const address = document.getElementById("buyerAddress").value.trim();
  const city = document.getElementById("buyerCity").value.trim();
  const pin = document.getElementById("buyerPin").value.trim();
  const area = document.getElementById("deliveryArea").value;
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const lines = orderProducts.map(({ product, qty }) =>
    `- ${product.name}: ${qty} x ${rupees(product.price)} = ${rupees(qty * product.price)}`
  ).join("\n");
  const orderTotal = total();
  const delivery = area === "local" ? "लोकल (कन्फर्म करें)" : "All India courier (कन्फर्म करें)";
  const message = `नमस्ते Om Beej Bhandar, मैं ऑर्डर देना चाहता/चाहती हूँ।
नाम: ${name}
मोबाइल: ${phone}
पता: ${address}, ${city}, PIN ${pin}
डिलीवरी: ${delivery}
पेमेंट पसंद: ${payment}

उत्पाद:
${lines}

उत्पाद कुल: ${rupees(orderTotal)}
कृपया स्टॉक, अंतिम कीमत, डिलीवरी चार्ज और ऑर्डर की पुष्टि करें।`;

  const whatsappTab = window.open("about:blank", "_blank");
  const orderStatus = document.getElementById("orderStatus");
  orderStatus.textContent = "दुकान को ऑर्डर email भेज रहे हैं...";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        address,
        city,
        pin,
        deliveryArea: area,
        payment,
        items: cart.map(item => ({ id: item.id, qty: item.qty }))
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "ऑर्डर email नहीं भेजा जा सका।");
    }
    const updatedStock = new Map(
      result.products.map(product => [product.id, product.quantity])
    );
    products = products.map(product => updatedStock.has(product.id)
      ? { ...product, quantity: updatedStock.get(product.id) }
      : product);
    cart = [];
    renderProducts();
    renderCart();
    orderStatus.textContent = result.message;
  } catch (error) {
    console.error("Order email notification failed:", error);
    orderStatus.textContent = `${error.message} WhatsApp पर ऑर्डर जारी रखें।`;
  }

  if (payment !== "UPI") {
    openWhatsAppOrder(message, whatsappTab);
    return;
  }

  if (MERCHANT_UPI_ID === "YOUR_UPI_ID@bank") {
    alert("UPI ID अभी सेट नहीं है। ऑर्डर WhatsApp पर खुलेगा।");
    openWhatsAppOrder(message, whatsappTab);
    return;
  }

  const upiUrl = new URL("upi://pay");
  upiUrl.search = new URLSearchParams({
    pa: MERCHANT_UPI_ID,
    pn: "Om Beej Bhandar",
    am: orderTotal.toFixed(2),
    cu: "INR",
    tn: "Om Beej Bhandar order"
  }).toString();

  alert("UPI ऐप खुलने पर भुगतान करें। भुगतान मिलने की पुष्टि दुकानदार को अपने बैंक/UPI ऐप में करनी होगी।");
  window.location.href = upiUrl.toString();
  window.setTimeout(
    () => openWhatsAppOrder(`${message}\nUPI पेमेंट का स्टेटस दुकानदार से कन्फर्म करें।`, whatsappTab),
    1200
  );
}

async function loadProducts() {
  const status = document.getElementById("productStatus");

  try {
    const response = await fetch("/api/products");
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "उत्पाद लोड नहीं हो सके।");
    }
    if (!Array.isArray(result)) {
      throw new Error("सर्वर से उत्पाद सूची मान्य नहीं मिली।");
    }

    products = result;
    status.hidden = products.length > 0;
    status.textContent = products.length
      ? ""
      : "MongoDB Atlas में अभी कोई उत्पाद उपलब्ध नहीं है।";
  } catch (error) {
    console.error("MongoDB Atlas उत्पाद लोड नहीं हुए:", error);
    products = [];
    status.hidden = false;
    status.textContent = "उत्पाद लोड नहीं हो सके। सर्वर/Atlas कनेक्शन जाँचें और पेज फिर से खोलें।";
  }

  renderProducts();
  renderCart();
}

document.getElementById("cartToggle").addEventListener("click", () => {
  document.getElementById("cartPanel").classList.toggle("open");
});
document.getElementById("closeCart").addEventListener("click", () => {
  document.getElementById("cartPanel").classList.remove("open");
});
document.getElementById("productGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "add") addToCart(button.dataset.productId);
  if (button.dataset.action === "ask") askProduct(button.dataset.productId);
});
document.getElementById("cartItems").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-id]");
  if (button) removeItem(button.dataset.removeId);
});
document.getElementById("cartItems").addEventListener("change", event => {
  const input = event.target.closest("[data-quantity-id]");
  if (!input) return;
  const product = products.find(item => item.id === input.dataset.quantityId);
  const row = cart.find(item => item.id === input.dataset.quantityId);
  if (!product || !row) return;
  const requested = Number.parseInt(input.value, 10);
  row.qty = Number.isFinite(requested)
    ? Math.max(1, Math.min(requested, product.quantity))
    : 1;
  renderCart();
});
document.getElementById("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  query = document.getElementById("searchInput").value.trim();
  document.getElementById("filterInput").value = query;
  renderProducts();
  document.getElementById("products").scrollIntoView();
});
document.getElementById("filterInput").addEventListener("input", event => {
  query = event.target.value;
  document.getElementById("searchInput").value = query;
  renderProducts();
});
document.getElementById("sort").addEventListener("change", renderProducts);
document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    category = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach(item => {
      item.classList.toggle("active", item === button);
    });
    renderProducts();
  });
});
document.getElementById("checkoutForm").addEventListener("submit", submitCheckout);

renderProducts();
renderCart();
loadProducts();
