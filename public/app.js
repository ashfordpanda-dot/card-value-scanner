// ---------- Card photo scanning (client-side OCR) ----------

const KNOWN_SETS = [
  "Panini Prizm", "Panini Mosaic", "Panini Select", "Panini Obsidian",
  "Panini Donruss", "Panini Chronicles", "Panini Score", "Panini Revolution",
  "Topps Chrome", "Topps Merlin", "Topps Match Attax", "Match Attax",
  "Panini", "Topps",
];

const photoInput = document.getElementById("card-photo-input");
const scanPreview = document.getElementById("scan-preview");
const scanPreviewImg = document.getElementById("scan-preview-img");
const scanStatus = document.getElementById("scan-status");
const scanButtonText = document.getElementById("scan-button-text");
const scanDetected = document.getElementById("scan-detected");
const scanDetectedText = document.getElementById("scan-detected-text");

function guessYear(text) {
  const matches = text.match(/\b(19[5-9]\d|20[0-3]\d)\b/g);
  return matches ? matches[0] : null;
}

function guessSet(text) {
  const lowerText = text.toLowerCase();
  for (const set of KNOWN_SETS) {
    if (lowerText.includes(set.toLowerCase())) return set;
  }
  return null;
}

function guessCardNumber(text) {
  const match = text.match(/(?:#|No\.?\s*)(\d{1,4})/i);
  return match ? match[1] : null;
}

// Very rough guess: the longest line made of 2-3 capitalized words that
// isn't a known set name is probably the player's name. This will get
// things wrong sometimes — that's why the field stays editable.
function guessPlayerName(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const nameLike = lines.filter((line) => {
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 3) return false;
    if (KNOWN_SETS.some((s) => line.toLowerCase().includes(s.toLowerCase()))) return false;
    if (/\d/.test(line)) return false;
    return words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w));
  });
  if (nameLike.length === 0) return null;
  return nameLike.sort((a, b) => b.length - a.length)[0];
}

function applyGuesses(text) {
  const year = guessYear(text);
  const set = guessSet(text);
  const cardNumber = guessCardNumber(text);
  const player = guessPlayerName(text);

  if (year) document.getElementById("year").value = year;
  if (set) document.getElementById("set").value = set;
  if (cardNumber) document.getElementById("cardNumber").value = cardNumber;
  if (player) document.getElementById("player").value = player;

  const foundAny = year || set || cardNumber || player;
  scanStatus.hidden = false;
  scanStatus.textContent = foundAny
    ? "Filled in what we could read below — please double-check it before searching."
    : "Couldn't confidently read the card details. Check the raw text below, or just type the details in manually.";
}

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  if (!file) return;

  scanPreviewImg.src = URL.createObjectURL(file);
  scanPreview.hidden = false;
  scanStatus.hidden = false;
  scanStatus.textContent = "Reading the card…";
  scanDetected.hidden = true;
  scanButtonText.textContent = "Reading…";

  try {
    const result = await Tesseract.recognize(file, "eng");
    const text = result.data.text || "";

    scanDetectedText.textContent = text.trim() || "(no text detected)";
    scanDetected.hidden = false;

    applyGuesses(text);
  } catch (err) {
    scanStatus.textContent = "Couldn't read that photo. Try a clearer, well-lit shot, or fill in the details manually.";
  } finally {
    scanButtonText.textContent = "Take or choose another photo";
  }
});

// ---------- Manual search form ----------

const form = document.getElementById("search-form");
const submitBtn = document.getElementById("submit-btn");

const resultsSection = document.getElementById("results");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");

const estimateRange = document.getElementById("estimate-range");
const estimateCount = document.getElementById("estimate-count");
const ledgerBody = document.getElementById("ledger-body");

function hideAllStates() {
  resultsSection.hidden = true;
  emptyState.hidden = true;
  loadingState.hidden = true;
  errorState.hidden = true;
}

function formatMoney(value, currency) {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAllStates();
  loadingState.hidden = false;
  submitBtn.disabled = true;
  submitBtn.textContent = "Searching…";

  const formData = new FormData(form);
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (value && String(value).trim()) params.set(key, value);
  }

  try {
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong searching eBay.");
    }

    hideAllStates();

    if (!data.listings || data.listings.length === 0) {
      emptyState.hidden = false;
      return;
    }

    // Price summary line
    const est = data.estimate;
    const currency = data.listings[0]?.currency;
    estimateRange.textContent = est.count > 0
      ? `${formatMoney(est.low, currency)} – ${formatMoney(est.high, currency)}`
      : "—";
    estimateCount.textContent = est.count;

    // Ledger rows, cheapest first
    const sortedListings = [...data.listings].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    ledgerBody.innerHTML = "";
    sortedListings.forEach((item) => {
      const tr = document.createElement("tr");

      const titleTd = document.createElement("td");
      titleTd.className = "title-cell";
      const titleLink = document.createElement("a");
      titleLink.href = item.url;
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.textContent = item.title;
      titleTd.appendChild(titleLink);

      const conditionTd = document.createElement("td");
      conditionTd.textContent = item.condition || "—";

      const priceTd = document.createElement("td");
      priceTd.className = "price-cell";
      priceTd.textContent = formatMoney(item.price, item.currency);

      const linkTd = document.createElement("td");
      linkTd.className = "link-cell";
      const viewLink = document.createElement("a");
      viewLink.href = item.url;
      viewLink.target = "_blank";
      viewLink.rel = "noopener noreferrer";
      viewLink.textContent = "View";
      linkTd.appendChild(viewLink);

      tr.append(titleTd, conditionTd, priceTd, linkTd);
      ledgerBody.appendChild(tr);
    });

    resultsSection.hidden = false;
  } catch (err) {
    hideAllStates();
    errorMessage.textContent = err.message || "Something went wrong. Check the server is running and your eBay credentials are set.";
    errorState.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Search listings";
  }
});
