const express = require('express');
const router = express.Router();
const { getProjects, createProject, addProjectPayment, updateProject, deleteProject, distributeProfit } = require('../controllers/projectController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(protect, getProjects)
    .post(protect, admin, upload.single('projectImage'), createProject);

router.route('/:id')
    .put(protect, admin, upload.single('projectImage'), updateProject)
    .delete(protect, admin, deleteProject);

router.route('/:id/payments')
    .post(protect, admin, addProjectPayment);

router.route('/distribute-profit')
    .post(protect, admin, distributeProfit);

module.exports = router;
