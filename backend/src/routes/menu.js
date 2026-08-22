const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const router = express.Router();

// GET /api/menu — cardápio público, agrupado por categoria.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [products] = await db.query(
      'SELECT id, slug, name, description, category, price_cents, badge FROM products WHERE active = 1 ORDER BY category, sort_order'
    );
    res.json({
      products,
      delivery_fee_cents: env.store.deliveryFeeCents,
    });
  })
);

module.exports = router;
