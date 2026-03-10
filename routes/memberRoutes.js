const express = require('express');
const router = express.Router();
const { getMembers, createMember, updateMember, deleteMember } = require('../controllers/memberController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(protect, getMembers)
    .post(protect, admin, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'nidPhoto', maxCount: 1 }]), createMember);

router.route('/:id')
    .put(protect, admin, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'nidPhoto', maxCount: 1 }]), updateMember)
    .delete(protect, admin, deleteMember);

module.exports = router;
