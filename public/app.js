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
