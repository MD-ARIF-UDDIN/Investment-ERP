const express = require('express');
const router = express.Router();
const { getDistributions, createDistribution } = require('../controllers/distributionController');
const { protect, admin } = require('../middleware/auth.js');

router.route('/')
    .get(protect, getDistributions)
    .post(protect, admin, createDistribution);

module.exports = router;
