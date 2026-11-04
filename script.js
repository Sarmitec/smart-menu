// رقم واتساب الكافتيريا بصيغة دولية، أرقام فقط.
const CONFIG = { whatsappNumber: "963998495881", cafeLat: 35.545938, cafeLng: 35.769109, maxDistanceMeters: 500, maxAccuracyMeters: 150 };
const STORAGE_KEYS = { cart: "cafe-cart", theme: "cafe-theme", lastOrder: "cafe-last-order" };
const ORDER_COOLDOWN = 60000;
const MAX_ITEM_QUANTITY = 10;
const MAX_TOTAL_ITEMS = 30;
const FALLBACK_CATEGORY = "قسم آخر";
const CATEGORY_ACCENTS = {
    "hot-drinks": "#2563eb",
    "quick-sandwiches": "#1d4ed8",
    "snacks-sweets": "#1e40af",
    "cold-drinks": "#0369a1"
};
const memoryStorage = new Map();
const categories = new Map([["all", "الكل"]]);
let menuItems = [], selectedCategory = "all", cart = new Map(), toastTimer, cooldownTimer, lastFocusedElement;
const elements = {};

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {
    Object.assign(elements, {
        siteHeader: document.getElementById("siteHeader"), pageContent: document.getElementById("pageContent"), menuGrid: document.getElementById("menuGrid"),
        categoryFilters: document.getElementById("categoryFilters"), categorySelect: document.getElementById("categorySelect"), menuSearch: document.getElementById("menuSearch"),
        itemsCount: document.getElementById("itemsCount"), statusMessage: document.getElementById("statusMessage"), noResults: document.getElementById("noResults"),
        clearSearchButton: document.getElementById("clearSearchButton"), cartButton: document.getElementById("cartButton"), cartModal: document.getElementById("cartModal"),
        closeCartButton: document.getElementById("closeCartButton"), cartView: document.getElementById("cartView"),
        cartItems: document.getElementById("cartItems"), emptyCart: document.getElementById("emptyCart"), cartCount: document.getElementById("cartCount"), cartTotal: document.getElementById("cartTotal"),
        orderForm: document.getElementById("orderForm"), tableNumber: document.getElementById("tableNumber"), orderNotes: document.getElementById("orderNotes"),
        formMessage: document.getElementById("formMessage"), submitOrderButton: document.getElementById("submitOrderButton"), toast: document.getElementById("toast"),
        themeToggle: document.getElementById("themeToggle"),
        cartIcon: document.getElementById("cartIcon"), emptyCartIcon: document.getElementById("emptyCartIcon")
    });
    bindEvents();
    elements.cartIcon.append(createIcon("cart"));
    elements.emptyCartIcon.append(createIcon("cart"));
    loadSavedTheme();
    loadSavedCart();
    startCooldown();
    showSkeletons();
    loadMenu();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").then((registration) => {
        registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (worker) worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) showToast("تحديث متاح، أعد التحميل"); });
        });
    }).catch((error) => console.error("Service worker registration failed:", error));
}

function bindEvents() {
    elements.categoryFilters.addEventListener("click", (event) => { const button = event.target.closest("button[data-category]"); if (button) { selectedCategory = button.dataset.category; renderCategoryFilters(); renderMenu(); } });
    elements.categorySelect.addEventListener("change", () => { selectedCategory = elements.categorySelect.value; renderCategoryFilters(); renderMenu(); });
    elements.menuSearch.addEventListener("input", renderMenu);
    elements.clearSearchButton.addEventListener("click", () => { elements.menuSearch.value = ""; renderMenu(); elements.menuSearch.focus(); });
    elements.menuGrid.addEventListener("click", (event) => { const button = event.target.closest("button[data-add-id]"); if (button) addToCart(button.dataset.addId); });
    elements.cartButton.addEventListener("click", openCart);
    elements.closeCartButton.addEventListener("click", closeCart);
    elements.cartModal.addEventListener("click", (event) => { if (event.target === elements.cartModal) closeCart(); });
    document.addEventListener("keydown", handleKeydown);
    elements.cartItems.addEventListener("click", (event) => { const button = event.target.closest("button[data-cart-action]"); if (button) updateCartQuantity(button.dataset.id, button.dataset.cartAction, button); });
    elements.orderForm.addEventListener("submit", submitOrder);
    elements.themeToggle.addEventListener("click", toggleTheme);
}

async function loadMenu() {
    try {
        const response = await fetch("menu-data.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || !Array.isArray(data.categories) || !Array.isArray(data.items)) throw new Error("Invalid menu shape");
        data.categories.filter(isValidCategory).forEach((category) => categories.set(category.id, category.name));
        menuItems = data.items.filter(isValidItem);
        if (!menuItems.length) throw new Error("No valid menu items");
        for (const id of cart.keys()) if (!menuItems.some((item) => item.id === id && item.available)) cart.delete(id);
        saveCart(); renderCategoryFilters(); renderCart(); renderMenu(); hideStatus();
    } catch (error) { console.error("Menu loading failed:", error); showLoadError(); }
}

function isValidCategory(category) { return category && typeof category.id === "string" && /^[a-z0-9-]+$/.test(category.id) && typeof category.name === "string" && category.name.trim().length > 0; }
function isValidItem(item) {
    return item && typeof item.id === "string" && /^[a-z0-9-]+$/.test(item.id) && typeof item.name === "string" && typeof item.description === "string" &&
        Number.isInteger(item.price) && item.price > 0 && typeof item.category === "string" && categories.has(item.category) && typeof item.available === "boolean";
}
function renderCategoryFilters() {
    elements.categoryFilters.replaceChildren();
    categories.forEach((name, id) => elements.categoryFilters.append(createFilterButton(id, name)));
    elements.categorySelect.replaceChildren(...[...categories].map(([id, name]) => { const option = document.createElement("option"); option.value = id; option.textContent = name || FALLBACK_CATEGORY; option.selected = id === selectedCategory; return option; }));
}
function createFilterButton(id, name) {
    const button = document.createElement("button"); button.className = `filter-button${id === selectedCategory ? " active" : ""}`; button.type = "button"; button.dataset.category = id;
    button.setAttribute("aria-pressed", String(id === selectedCategory)); button.textContent = name || FALLBACK_CATEGORY; return button;
}
function renderMenu() {
    const query = normalizeArabic(elements.menuSearch.value);
    const visibleItems = menuItems.filter((item) => (selectedCategory === "all" || item.category === selectedCategory) && (!query || normalizeArabic(`${item.name} ${item.description}`).includes(query)));
    elements.itemsCount.textContent = itemCountLabel(visibleItems.length); elements.menuGrid.replaceChildren(...visibleItems.map(createMenuCard));
    const empty = visibleItems.length === 0; elements.noResults.classList.toggle("hidden", !empty); elements.menuGrid.classList.toggle("hidden", empty);
}
function createMenuCard(item) {
    const card = document.createElement("article"); card.className = "menu-card"; card.style.setProperty("--card-accent", CATEGORY_ACCENTS[item.category] || "var(--brand)"); const top = document.createElement("div"); top.className = "card-top";
    const info = document.createElement("div"); info.className = "card-info";
    info.append(textElement("p", "eyebrow", categories.get(item.category) || FALLBACK_CATEGORY));
    const name = document.createElement("h3"); name.className = "item-name"; name.textContent = item.name;
    info.append(name, textElement("p", "description", item.description));
    top.append(info); const footer = document.createElement("div"); footer.className = "card-footer"; footer.append(textElement("strong", "price", formatCurrency(item.price)));
    const add = document.createElement("button"); add.className = "add-button"; add.type = "button"; add.dataset.addId = item.id; add.setAttribute("aria-label", item.available ? "أضف للطلب" : "غير متوفر"); add.textContent = item.available ? "+ أضف للطلب" : "غير متوفر"; add.disabled = !item.available;
    footer.append(add); card.append(top, footer); return card;
}
function addToCart(itemId) {
    const item = menuItems.find((entry) => entry.id === itemId && entry.available); if (!item) return;
    const quantity = cart.get(itemId) || 0; if (quantity >= MAX_ITEM_QUANTITY) return showToast("الحد الأقصى للصنف الواحد هو 10."); if (totalCartItems() >= MAX_TOTAL_ITEMS) return showToast("لا يمكن أن تتجاوز سلة الطلبات 30 صنفاً.");
    cart.set(itemId, quantity + 1); saveCart(); renderCart(); showToast("تمت الإضافة إلى الطلب");
}
function updateCartQuantity(itemId, action, sourceButton) {
    const current = cart.get(itemId) || 0; if (action === "increase") { if (current >= MAX_ITEM_QUANTITY) return showToast("الحد الأقصى للصنف الواحد هو 10."); if (totalCartItems() >= MAX_TOTAL_ITEMS) return showToast("لا يمكن أن تتجاوز سلة الطلبات 30 صنفاً."); cart.set(itemId, current + 1); }
    else if (current <= 1) cart.delete(itemId); else cart.set(itemId, current - 1);
    saveCart(); renderCart(); const target = cart.has(itemId) ? elements.cartItems.querySelector(`button[data-id="${itemId}"][data-cart-action="${action}"]`) : elements.cartItems.querySelector("button");
    (target || sourceButton || elements.closeCartButton).focus();
}
function renderCart() {
    const entries = [...cart.entries()].map(([id, quantity]) => ({ item: menuItems.find((entry) => entry.id === id && entry.available), quantity })).filter((entry) => entry.item);
    const total = entries.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0); elements.cartCount.textContent = String(entries.reduce((sum, entry) => sum + entry.quantity, 0)); elements.cartTotal.textContent = formatCurrency(total);
    elements.emptyCart.classList.toggle("hidden", entries.length > 0); elements.cartItems.classList.toggle("hidden", entries.length === 0); elements.cartItems.replaceChildren(...entries.map(createCartRow));
}
function createCartRow(entry) {
    const row = document.createElement("div"); row.className = "cart-row"; const title = document.createElement("div"); title.className = "cart-row-title";
    title.append(textElement("span", "", entry.item.name), textElement("small", "", formatCurrency(entry.item.price * entry.quantity)));
    const controls = document.createElement("div"); controls.className = "quantity-controls"; controls.append(quantityButton("−", "decrease", entry.item.id), textElement("span", "quantity", String(entry.quantity)), quantityButton("+", "increase", entry.item.id)); row.append(title, controls); return row;
}
function quantityButton(label, action, id) { const button = document.createElement("button"); button.className = "quantity-button"; button.type = "button"; button.dataset.cartAction = action; button.dataset.id = id; button.setAttribute("aria-label", action === "increase" ? "زيادة الكمية" : "إنقاص الكمية"); button.textContent = label; return button; }

async function submitOrder(event) {
    event.preventDefault(); hideFormMessage(); const remaining = getCooldown();
    if (remaining > 0) return showFormMessage(`يرجى الانتظار ${Math.ceil(remaining / 1000)} ثانية. هذا الفاصل فلتر مريح وليس حماية صارمة.`, "error");
    if (!cart.size) return showFormMessage("أضف عنصراً واحداً على الأقل إلى سلة الطلبات.", "error");
    const table = normalizeDigits(cleanInput(elements.tableNumber.value)), notes = cleanInput(elements.orderNotes.value);
    if (!/^(?:[1-9]|[1-9][0-9])$/.test(table)) return showFormMessage("رقم الطاولة يجب أن يكون بين 1 و99.", "error");
    if (notes.length > 50) return showFormMessage("الملاحظات يجب ألا تتجاوز 50 حرفاً.", "error");
    const order = buildOrder(table, notes); if (!order) return showFormMessage("تعذر تجهيز الطلب، حاول مرة أخرى.", "error");
    if (!/^\d{8,15}$/.test(CONFIG.whatsappNumber) || CONFIG.whatsappNumber.includes("X")) { console.error("Developer setup required: CONFIG.whatsappNumber must contain 8-15 digits."); return showFormMessage("تعذر تجهيز الطلب، حاول مرة أخرى.", "error"); }
    const originalButtonText = elements.submitOrderButton.textContent;
    elements.submitOrderButton.disabled = true;
    elements.submitOrderButton.textContent = "جارٍ التحقق من موقعك...";
    try {
        const position = await getPosition();
        if (position.coords.accuracy > CONFIG.maxAccuracyMeters) return showFormMessage("دقة الموقع ضعيفة. اقترب من نافذة أو مكان مفتوح وأعد المحاولة.", "error");
        const distance = haversineDistance(position.coords.latitude, position.coords.longitude, CONFIG.cafeLat, CONFIG.cafeLng);
        if (distance > CONFIG.maxDistanceMeters) return showFormMessage("عذراً، إرسال الطلب متاح فقط لمن هم داخل نطاق 500 متر من الكافتيريا.", "error");
        safeSet(STORAGE_KEYS.lastOrder, String(Date.now()));
        safeRemove(STORAGE_KEYS.cart);
        cart.clear();
        renderCart();
        window.location.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(order.message)}`;
    } catch (error) {
        showFormMessage(getGeolocationErrorMessage(error), "error");
    } finally {
        elements.submitOrderButton.disabled = false;
        elements.submitOrderButton.textContent = originalButtonText;
    }
}
function haversineDistance(latitude, longitude, targetLatitude, targetLongitude) {
    const earthRadiusMeters = 6371000;
    const latitudeDelta = (targetLatitude - latitude) * Math.PI / 180;
    const longitudeDelta = (targetLongitude - longitude) * Math.PI / 180;
    const latitudeRadians = latitude * Math.PI / 180;
    const targetLatitudeRadians = targetLatitude * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeRadians) * Math.cos(targetLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
function getPosition() {
    if (!("geolocation" in navigator)) return Promise.reject({ code: "UNSUPPORTED" });
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
}
function getGeolocationErrorMessage(error) {
    if (error.code === "UNSUPPORTED") return "متصفحك لا يدعم تحديد الموقع، لا يمكن إرسال الطلب.";
    if (error.code === GeolocationPositionError.PERMISSION_DENIED) return "يجب السماح بالوصول إلى موقعك لإرسال الطلب. فعّل الموقع من إعدادات المتصفح ثم أعد المحاولة.";
    if (error.code === GeolocationPositionError.POSITION_UNAVAILABLE) return "تعذّر تحديد موقعك. تأكد من تشغيل GPS وأعد المحاولة.";
    if (error.code === GeolocationPositionError.TIMEOUT) return "استغرق تحديد الموقع وقتاً طويلاً. أعد المحاولة.";
    return "تعذّر تحديد موقعك. تأكد من تشغيل GPS وأعد المحاولة.";
}
function buildOrder(table, notes) {
    const lines = []; let total = 0; if (totalCartItems() > MAX_TOTAL_ITEMS) return null;
    for (const [id, quantity] of cart) { const item = menuItems.find((entry) => entry.id === id && entry.available); if (!item || quantity < 1 || quantity > MAX_ITEM_QUANTITY) return null; total += item.price * quantity; lines.push(`• ${item.name} × ${quantity} = ${formatCurrency(item.price * quantity)}`); }
    const number = `LA-${Math.floor(100000 + Math.random() * 900000)}`;
    return { number, message: ["مرحباً، أريد طلباً من كافتيريا جامعة اللاذقية 🎓", "", `رقم الطلب: ${number}`, `رقم الطاولة: ${table}`, "", "تفاصيل الطلب:", ...lines, "", `المجموع الإجمالي: ${formatCurrency(total)}`, `ملاحظات: ${notes || "لا توجد"}`, "", "الدفع عند الاستلام"].join("\n") };
}
function startCooldown() {
    clearInterval(cooldownTimer);
    const update = () => {
        const remaining = getCooldown();
        elements.submitOrderButton.textContent = remaining ? `انتظر ${Math.ceil(remaining / 1000)} ث` : "إرسال الطلب عبر واتساب";
        elements.submitOrderButton.disabled = Boolean(remaining);
        if (!remaining) clearInterval(cooldownTimer);
    };
    update();
    if (getCooldown()) cooldownTimer = setInterval(update, 1000);
}
function loadSavedCart() { try { const saved = JSON.parse(safeGet(STORAGE_KEYS.cart) || "[]"); if (Array.isArray(saved)) saved.filter((entry) => entry && /^[a-z0-9-]+$/.test(entry.id) && Number.isInteger(entry.quantity) && entry.quantity >= 1 && entry.quantity <= MAX_ITEM_QUANTITY).forEach((entry) => cart.set(entry.id, entry.quantity)); } catch (error) { console.error("Saved cart validation failed:", error); safeRemove(STORAGE_KEYS.cart); } renderCart(); }
function saveCart() { safeSet(STORAGE_KEYS.cart, JSON.stringify([...cart].map(([id, quantity]) => ({ id, quantity })))); }
function openCart() { lastFocusedElement = document.activeElement; elements.cartModal.classList.remove("hidden"); elements.cartModal.setAttribute("aria-hidden", "false"); elements.cartButton.setAttribute("aria-expanded", "true"); setPageInert(true); elements.closeCartButton.focus(); }
function closeCart() { elements.cartModal.classList.add("hidden"); elements.cartModal.setAttribute("aria-hidden", "true"); elements.cartButton.setAttribute("aria-expanded", "false"); setPageInert(false); (lastFocusedElement || elements.cartButton).focus(); }
function handleKeydown(event) { if (event.key === "Escape" && !elements.cartModal.classList.contains("hidden")) closeCart(); if (event.key !== "Tab" || elements.cartModal.classList.contains("hidden")) return; const focusable = [...elements.cartModal.querySelectorAll("button, input, select, textarea, a")].filter((element) => !element.disabled); const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
function setPageInert(value) { [elements.siteHeader, elements.pageContent, elements.cartButton].forEach((element) => { element.inert = value; element.setAttribute("aria-hidden", String(value)); }); }
function toggleTheme() { const dark = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.theme = dark ? "dark" : "light"; safeSet(STORAGE_KEYS.theme, dark ? "dark" : "light"); updateThemeButton(); updateThemeColor(dark); }
function loadSavedTheme() { updateThemeButton(); }
function updateThemeButton() { const dark = document.documentElement.classList.contains("dark"); elements.themeToggle.setAttribute("aria-pressed", String(dark)); elements.themeToggle.setAttribute("aria-label", dark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"); elements.themeToggle.replaceChildren(createIcon(dark ? "sun" : "moon")); }
function showSkeletons() { elements.menuGrid.classList.remove("hidden"); elements.noResults.classList.add("hidden"); elements.menuGrid.replaceChildren(...Array.from({ length: 6 }, () => textElement("div", "skeleton-card", ""))); }
function showLoadError() { elements.menuGrid.replaceChildren(); elements.noResults.classList.add("hidden"); elements.statusMessage.replaceChildren(textElement("p", "", "تعذر تحميل القائمة، حاول مرة أخرى")); const retry = document.createElement("button"); retry.className = "primary-button"; retry.type = "button"; retry.textContent = "إعادة المحاولة"; retry.addEventListener("click", () => { showSkeletons(); elements.statusMessage.className = "status-message hidden"; loadMenu(); }); elements.statusMessage.append(retry); elements.statusMessage.className = "status-message error-box"; }
function hideStatus() { elements.statusMessage.className = "status-message hidden"; elements.statusMessage.replaceChildren(); }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2500); }
function showFormMessage(message, type) { elements.formMessage.textContent = message; elements.formMessage.className = `form-message ${type}`; }
function hideFormMessage() { elements.formMessage.className = "form-message hidden"; elements.formMessage.textContent = ""; }
function textElement(tag, className, text) { const element = document.createElement(tag); element.className = className; element.textContent = text; return element; }
function formatCurrency(value) { return `${new Intl.NumberFormat("ar-SY").format(value)} ل.س`; }
function totalCartItems() { return [...cart.entries()].reduce((sum, [id, quantity]) => sum + (menuItems.some((item) => item.id === id && item.available) ? quantity : 0), 0); }
function cleanInput(value) { return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim(); }
function normalizeArabic(value) { return cleanInput(value).toLocaleLowerCase("ar").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي"); }
function normalizeDigits(value) { return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))); }
function itemCountLabel(count) { if (!count) return "لا أصناف"; if (count === 1) return "صنف واحد"; if (count === 2) return "صنفان"; if (count <= 10) return `${count} أصناف`; return `${count} صنفاً`; }
function getCooldown() { const elapsed = Date.now() - Number(safeGet(STORAGE_KEYS.lastOrder) || 0); return elapsed < ORDER_COOLDOWN ? ORDER_COOLDOWN - elapsed : 0; }
function safeGet(key) { try { return localStorage.getItem(key); } catch { return memoryStorage.get(key) || null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { memoryStorage.set(key, value); } }
function safeRemove(key) { try { localStorage.removeItem(key); } catch { memoryStorage.delete(key); } }
function updateThemeColor(dark) { const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", dark ? "#0f172a" : "#2563eb"); }
function createIcon(type) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "20"); svg.setAttribute("height", "20");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (type === "cart") { path.setAttribute("d", "M3 4h2l2 11h10l3-8H6M9 19h.01M17 19h.01"); }
    if (type === "sun") { path.setAttribute("d", "M12 3v2m0 14v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M3 12h2m14 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"); }
    if (type === "moon") { path.setAttribute("d", "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5z"); }
    if (type === "check") { path.setAttribute("d", "m5 12 4 4L19 6"); }
    svg.append(path); return svg;
}
