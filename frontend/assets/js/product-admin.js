const loginPanel = document.getElementById("loginPanel");
const managementPanel = document.getElementById("managementPanel");
const loginForm = document.getElementById("loginForm");
const productForm = document.getElementById("productForm");
const adminStatus = document.getElementById("adminStatus");
const loginStatus = document.getElementById("loginStatus");
const productsContainer = document.getElementById("adminProducts");
let products = [];
let editingId = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function setStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("admin-error", isError);
}

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.classList.toggle("admin-error", isError);
}

async function apiRequest(url, options = {}) {
  const headers = options.body instanceof FormData
    ? options.headers
    : { "Content-Type": "application/json", ...options.headers };
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "अनुरोध पूरा नहीं हुआ।");
  return result;
}

function renderProducts() {
  productsContainer.innerHTML = products.map(product => `
    <article class="admin-product">
      <div class="admin-product-details">
        <img class="admin-product-image"
          src="${escapeHtml(product.image || "/assets/images/product-placeholder.svg")}"
          alt="${escapeHtml(product.name)}">
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.category)} · ${escapeHtml(product.description)}</p>
          <strong>₹${Number(product.price).toLocaleString("en-IN")}</strong>
          <p>स्टॉक: ${Number(product.quantity)} नग</p>
        </div>
      </div>
      <button class="btn light" type="button" data-edit-id="${escapeHtml(product.id)}">अपडेट करें</button>
    </article>`).join("");
}

async function loadProducts() {
  setStatus("Atlas से उत्पाद लोड हो रहे हैं...");
  products = await apiRequest("/api/products");
  renderProducts();
  setStatus(products.length ? `${products.length} उत्पाद लोड हुए।` : "Atlas collection में अभी कोई उत्पाद नहीं है।");
}

function showManagement() {
  loginPanel.hidden = true;
  managementPanel.hidden = false;
}

function showLogin() {
  managementPanel.hidden = true;
  loginPanel.hidden = false;
  productForm.hidden = true;
  loginForm.reset();
}

function beginEdit(product) {
  editingId = product.id;
  document.getElementById("editTitle").textContent = `${product.name} अपडेट करें`;
  document.getElementById("saveProductButton").textContent = "बदलाव सेव करें";
  document.getElementById("productName").value = product.name;
  document.getElementById("productCategory").value = product.category;
  document.getElementById("productImage").value = "";
  document.getElementById("imagePreview").src =
    product.image || "/assets/images/product-placeholder.svg";
  document.getElementById("productDescription").value = product.description;
  document.getElementById("productPrice").value = product.price;
  document.getElementById("productQuantity").value = product.quantity;
  productForm.hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function beginCreate() {
  editingId = null;
  productForm.reset();
  document.getElementById("editTitle").textContent = "नया उत्पाद जोड़ें";
  document.getElementById("saveProductButton").textContent = "उत्पाद सेव करें";
  document.getElementById("imagePreview").src = "/assets/images/product-placeholder.svg";
  productForm.hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await apiRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: document.getElementById("adminPassword").value })
    });
  } catch (error) {
    setLoginStatus(error.message, true);
    button.disabled = false;
    return;
  }
  window.location.replace("/admin");
});

productsContainer.addEventListener("click", event => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  const product = products.find(item => item.id === button.dataset.editId);
  if (product) beginEdit(product);
});

productForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = productForm.querySelector("button[type=submit]");
  button.disabled = true;
  const formData = new FormData(productForm);
  try {
    const savedProduct = await apiRequest(
      editingId ? `/api/products/${encodeURIComponent(editingId)}` : "/api/products",
      {
        method: editingId ? "PUT" : "POST",
        body: formData
      }
    );
    if (editingId) {
      products = products.map(product => product.id === savedProduct.id ? savedProduct : product);
    } else {
      products.unshift(savedProduct);
    }
    renderProducts();
    productForm.hidden = true;
    productForm.reset();
    editingId = null;
    setStatus("उत्पाद सफलतापूर्वक सेव हुआ।");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("addProductButton").addEventListener("click", beginCreate);
document.getElementById("testEmailButton").addEventListener("click", async event => {
  const button = event.currentTarget;
  const emailStatus = document.getElementById("emailStatus");
  button.disabled = true;
  emailStatus.textContent = "टेस्ट ईमेल भेजा जा रहा है...";
  emailStatus.classList.remove("admin-error");
  try {
    const result = await apiRequest("/api/admin/email-test", {
      method: "POST",
      body: "{}"
    });
    emailStatus.textContent = result.message;
  } catch (error) {
    emailStatus.textContent = error.message;
    emailStatus.classList.add("admin-error");
  } finally {
    button.disabled = false;
  }
});
document.getElementById("productImage").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById("imagePreview").src = URL.createObjectURL(file);
});

document.getElementById("cancelEdit").addEventListener("click", () => {
  productForm.reset();
  productForm.hidden = true;
  editingId = null;
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await apiRequest("/api/admin/logout", { method: "POST", body: "{}" });
    products = [];
    productsContainer.replaceChildren();
    showLogin();
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
});

async function initializeAdminPage() {
  let authenticated;
  try {
    const session = await apiRequest("/api/admin/session");
    authenticated = session.authenticated;
  } catch (error) {
    setLoginStatus(error.message, true);
    return;
  }
  if (!authenticated) return;
  showManagement();
  try {
    await loadProducts();
  } catch (error) {
    setStatus(error.message, true);
  }
}

initializeAdminPage();
