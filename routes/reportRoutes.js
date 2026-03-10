const express = require('express');
const router = express.Router();
const { getFinancialSummary, getProfitReport, getProjectwiseReport } = require('../controllers/reportController');
const { protect, admin } = require('../middleware/auth');

router.route('/summary')
    .get(protect, admin, getFinancialSummary);

router.route('/profit')
    .get(protect, admin, getProfitReport);

router.route('/projects')
    .get(protect, admin, getProjectwiseReport);

module.exports = router;
