const express = require('express');
const router = express.Router();
const { getFinancialSummary, getProfitReport, getProjectwiseReport, getMonthlyReport } = require('../controllers/reportController');
const { protect, admin } = require('../middleware/auth');

router.route('/summary')
    .get(protect, getFinancialSummary);

router.route('/profit')
    .get(protect, getProfitReport);

router.route('/projects')
    .get(protect, getProjectwiseReport);

router.route('/monthly')
    .get(protect, getMonthlyReport);

module.exports = router;
