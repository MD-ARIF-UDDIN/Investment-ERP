const Member = require('../models/Member');
const Log = require('../models/Log');

// @desc    Get all members
// @route   GET /api/members
// @access  Private
const getMembers = async (req, res) => {
    try {
        const members = await Member.find({})
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new member
// @route   POST /api/members
// @access  Private/Admin
const createMember = async (req, res) => {
    const { name, memberId, phone, address, nid } = req.body;
    let photo = '';
    let nidPhoto = '';

    if (req.files) {
        if (req.files.photo) photo = `/uploads/members/${req.files.photo[0].filename}`;
        if (req.files.nidPhoto) nidPhoto = `/uploads/members/${req.files.nidPhoto[0].filename}`;
    }

    try {
        const memberExists = await Member.findOne({ memberId });
        if (memberExists) {
            return res.status(400).json({ message: 'সদস্য আইডি ইতিমধ্যে বিদ্যমান' });
        }

        const member = await Member.create({
            name,
            memberId,
            phone,
            address,
            nid,
            photo,
            nidPhoto,
            createdBy: req.user._id
        });

        await Log.create({
            action: 'CREATE_MEMBER',
            entityType: 'Member',
            entityId: member._id,
            user: req.user._id,
            details: member
        });

        res.status(201).json(member);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private/Admin
const updateMember = async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (member) {
            member.name = req.body.name || member.name;
            member.phone = req.body.phone || member.phone;
            member.address = req.body.address || member.address;
            member.nid = req.body.nid || member.nid;
            member.status = req.body.status || member.status;

            if (req.files) {
                if (req.files.photo) member.photo = `/uploads/members/${req.files.photo[0].filename}`;
                if (req.files.nidPhoto) member.nidPhoto = `/uploads/members/${req.files.nidPhoto[0].filename}`;
            }
            member.updatedBy = req.user._id;

            const updatedMember = await member.save();

            await Log.create({
                action: 'UPDATE_MEMBER',
                entityType: 'Member',
                entityId: updatedMember._id,
                user: req.user._id,
                details: updatedMember
            });

            res.json(updatedMember);
        } else {
            res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private/Admin
const deleteMember = async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (member) {
            await Log.create({
                action: 'DELETE_MEMBER',
                entityType: 'Member',
                entityId: member._id,
                user: req.user._id,
                details: { memberName: member.name, memberId: member.memberId }
            });

            await member.deleteOne();
            res.json({ message: 'সদস্য মুছে ফেলা হয়েছে' });
        } else {
            res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMembers, createMember, updateMember, deleteMember };
