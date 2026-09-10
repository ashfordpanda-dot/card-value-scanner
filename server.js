require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { searchListings, summarizePrices } = require("./ebayClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/search", async (req, res) => {
  try {
    const { player, year, set, cardNumber, parallel, grade, condition, maxPrice, categoryId } = req.query;

    if (!player || !player.trim()) {
      return res.status(400).json({ error: "player is required" });
    }

    const result = await searchListings({
      player,
      year,
      set,
      cardNumber,
      parallel,
      grade,
      condition,
      maxPrice,
      categoryId,
    });

    const estimate = summarizePrices(result.items);

    res.json({
      query: result.keywords,
      totalFound: result.total,
      estimate,
      listings: result.items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Unknown server error" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ebayEnv: process.env.EBAY_ENV || "sandbox" });
});

app.listen(PORT, () => {
  console.log(`Card value scanner running at http://localhost:${PORT}`);
});
