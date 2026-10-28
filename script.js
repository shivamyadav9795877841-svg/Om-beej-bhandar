const STORE_PHONE = "919554846920";
/* LIVE UPI के लिए नीचे YOUR_UPI_ID@bank को अपनी सत्यापित merchant UPI ID से बदलें।
ग्राहक का भुगतान सत्यापित करने के लिए payment gateway/backend की जरूरत होगी। */
const MERCHANT_UPI_ID = "YOUR_UPI_ID@bank";
const products = [
{ id: 1, name: "धान बीज — डेमो", category: "बीज", emoji: "🌾", description: "वास्तविक किस्म और पैक-साइज़ अपडेट करें", price: 650 },
{ id: 2, name: "मक्का बीज — डेमो", category: "बीज", emoji: "🌽", description: "ब्रांड/वजन की पुष्टि करें", price: 350 },
{ id: 3, name: "DAP खाद — डेमो", category: "खाद", emoji: "🪴", description: "वास्तविक ब्रांड और वजन अपडेट करें", price: 1250 },
{ id: 4, name: "फसल सुरक्षा उत्पाद — डेमो", category: "कीटनाशक", emoji: "🧴", description: "लेबल और वैध उपयोग निर्देश पढ़ें", price: 280 },
{ id: 5, name: "जैविक खाद — डेमो", category: "जैविक", emoji: "🍀", description: "उपलब्धता की पुष्टि करें", price: 220 },
{ id: 6, name: "हैंड स्प्रेयर — डेमो", category: "उपकरण", emoji: "🚿", description: "क्षमता और वारंटी की पुष्टि करें", price: 850 },
{ id: 7, name: "गेहूँ बीज — डेमो", category: "बीज", emoji: "🌱", description: "क्षेत्र के अनुसार किस्म चुनें", price: 540 },
{ id: 8, name: "कृषि टूल किट — डेमो", category: "उपकरण", emoji: "🧰", description: "किट की सामग्री अपडेट करें", price: 399 }
];
let cart = []; let category = "सभी"; let query = "";
const rupees = n => "₹" + n.toLocaleString("en-IN");
function renderProducts() {
let list = products.filter(p => (category === "सभी" || p.category === category) && (`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(query.toLowerCase())));
const sort = document.getElementById("sort").value; if (sort === "low") list.sort((a, b) => a.price - b.price); if (sort === "high") list.sort((a, b) => b.price - a.price);
document.getElementById("count").textContent = list.length + " उत्पाद";
document.getElementById("productGrid").innerHTML = list.map(p => `<article class="product"><div class="productimg">${p.emoji}</div><div class="productbody"><h3>${p.name}</h3><p class="muted">${p.description}</p><div class="price">${rupees(p.price)}</div><div class="actions"><button onclick="addToCart(${p.id})">＋ कार्ट में जोड़ें</button><button class="query" onclick="askProduct(${p.id})">पूछताछ</button></div></div></article>`).join("") || "<p>कोई उत्पाद नहीं मिला।</p>";
}
function addToCart(id) { let row = cart.find(x => x.id === id); if (row) row.qty++; else cart.push({ id, qty: 1 }); renderCart(); openCart() }
function removeItem(id) { cart = cart.filter(x => x.id !== id); renderCart() }
function total() { return cart.reduce((s, x) => s + products.find(p => p.id === x.id).price * x.qty, 0) }
function renderCart() { document.getElementById("cartCount").textContent = cart.reduce((s, x) => s + x.qty, 0); document.getElementById("cartTotal").textContent = "उत्पाद कुल: " + rupees(total()) + " (डिलीवरी चार्ज अलग हो सकता है)"; document.getElementById("cartItems").innerHTML = cart.length ? cart.map(x => { let p = products.find(p => p.id === x.id); return `<div class="cartline"><div>${p.emoji} <b>${p.name}</b><br><small>${x.qty} × ${rupees(p.price)}</small></div><button onclick="removeItem(${p.id})">हटाएँ</button></div>` }).join("") : '<p class="empty">कार्ट खाली है। पहले उत्पाद जोड़ें।</p>' }
function openCart() { document.getElementById("cartPanel").classList.add("open") }
function askProduct(id) { let p = products.find(x => x.id === id); window.open("https://wa.me/" + STORE_PHONE + "?text=" + encodeURIComponent("नमस्ते Om Beej Bhandar, मुझे " + p.name + " के बारे में जानकारी चाहिए। कृपया वास्तविक कीमत और उपलब्धता बताएं।"), "_blank", "noopener") }
document.getElementById("cartToggle").addEventListener("click", () => document.getElementById("cartPanel").classList.toggle("open"));
document.getElementById("closeCart").addEventListener("click", () => document.getElementById("cartPanel").classList.remove("open"));
document.getElementById("searchForm").addEventListener("submit", e => { e.preventDefault(); query = document.getElementById("searchInput").value.trim(); document.getElementById("filterInput").value = query; renderProducts(); document.getElementById("products").scrollIntoView() });
document.getElementById("filterInput").addEventListener("input", e => { query = e.target.value; document.getElementById("searchInput").value = query; renderProducts() });
document.getElementById("sort").addEventListener("change", renderProducts);
document.querySelectorAll("[data-category]").forEach(el => el.addEventListener("click", () => { category = el.dataset.category; document.querySelectorAll("[data-category]").forEach(x => x.classList.toggle("active", x === el)); renderProducts() }));
document.getElementById("checkoutForm").addEventListener("submit", e => {
e.preventDefault(); if (!cart.length) { alert("पहले कार्ट में उत्पाद जोड़ें।"); return }
const name = document.getElementById("buyerName").value.trim(), phone = document.getElementById("buyerPhone").value.trim(), address = document.getElementById("buyerAddress").value.trim(), city = document.getElementById("buyerCity").value.trim(), pin = document.getElementById("buyerPin").value.trim(), area = document.getElementById("deliveryArea").value, payment = document.querySelector('input[name="payment"]:checked').value;
const lines = cart.map(x => { const p = products.find(p => p.id === x.id); return `- ${p.name}: ${x.qty} x ${rupees(p.price)} = ${rupees(x.qty * p.price)}` }).join("\n");
const orderTotal = total();
const msg = `नमस्ते Om Beej Bhandar, मैं ऑर्डर देना चाहता/चाहती हूँ।\nनाम: ${name}\nमोबाइल: ${phone}\nपता: ${address}, ${city}, PIN ${pin}\nडिलीवरी: ${area === "local" ? "लोकल (कन्फर्म करें)" : "All India courier (कन्फर्म करें)"}\nपेमेंट पसंद: ${payment}\n\nउत्पाद:\n${lines}\n\nउत्पाद कुल: ${rupees(orderTotal)}\nकृपया स्टॉक, अंतिम कीमत, डिलीवरी चार्ज और ऑर्डर की पुष्टि करें।`;
if (payment === "UPI") {
    if (MERCHANT_UPI_ID === "YOUR_UPI_ID@bank") {
        alert("UPI ID अभी सेट नहीं है। ऑर्डर WhatsApp पर खुलेगा। UPI पेमेंट चालू करने के लिए कोड में MERCHANT_UPI_ID को अपनी सही UPI ID से बदलें।");
        window.open("https://wa.me/" + STORE_PHONE + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    } else {
        const upiUrl = "upi://pay?pa=" + encodeURIComponent(MERCHANT_UPI_ID) + "&pn=" + encodeURIComponent("Om Beej Bhandar") + "&am=" + encodeURIComponent(orderTotal.toFixed(2)) + "&cu=INR&tn=" + encodeURIComponent("Om Beej Bhandar order");
        alert("UPI ऐप खुलने पर भुगतान करें। भुगतान मिलने की पुष्टि दुकानदार को अपने बैंक/UPI ऐप में करनी होगी।");
        window.location.href = upiUrl;
        setTimeout(() => window.open("https://wa.me/" + STORE_PHONE + "?text=" + encodeURIComponent(msg + "\nUPI पेमेंट का स्टेटस दुकानदार से कन्फर्म करें।"), "_blank", "noopener"), 1200);
    }
} else {
    window.open("https://wa.me/" + STORE_PHONE + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
}
});
renderProducts(); renderCart();