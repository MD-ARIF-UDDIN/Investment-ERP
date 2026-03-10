const Member = require('../models/Member');
const User = require('../models/User');
const Log = require('../models/Log');

// @desc    Get all members
// @route   GET /api/members
// @access  Private
const getMembers = async (req, res) => {
    try {
        const members = await Member.find({})
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .populate('userRef', 'name email');
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new member
// @route   POST /api/members
// @access  Private/Admin
const createMember = async (req, res) => {
    const { name, memberId, phone, email, dateOfBirth, gender, bloodGroup, occupation, address, nid, joinDate, nomineeName, nomineePhone, nomineeRelation, nomineeNid } = req.body;
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

        // Create the member
        const member = await Member.create({
            name,
            memberId,
            phone,
            email,
            dateOfBirth,
            gender,
            bloodGroup,
            occupation,
            address,
            nid,
            joinDate,
            nomineeName,
            nomineePhone,
            nomineeRelation,
            nomineeNid,
            photo,
            nidPhoto,
            createdBy: req.user._id
        });

        // Auto-create a system User account for this member
        // Email: memberId@member.local  |  Password: provided by admin (falls back to memberId)
        const email = `${memberId.toLowerCase()}@member.local`;
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            const newUser = await User.create({
                name,
                email,
                password: req.body.password || memberId,  // use provided password or memberId as fallback
                role: 'Member',
                memberId: member._id,        // links User → Member
                createdBy: req.user._id
            });

            // Link member → user
            member.userRef = newUser._id;
            await member.save();
        }

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
            member.email = req.body.email !== undefined ? req.body.email : member.email;
            member.dateOfBirth = req.body.dateOfBirth || member.dateOfBirth;
            member.gender = req.body.gender !== undefined ? req.body.gender : member.gender;
            member.bloodGroup = req.body.bloodGroup !== undefined ? req.body.bloodGroup : member.bloodGroup;
            member.occupation = req.body.occupation !== undefined ? req.body.occupation : member.occupation;
            member.address = req.body.address || member.address;
            member.nid = req.body.nid || member.nid;
            member.joinDate = req.body.joinDate || member.joinDate;
            member.nomineeName = req.body.nomineeName !== undefined ? req.body.nomineeName : member.nomineeName;
            member.nomineePhone = req.body.nomineePhone !== undefined ? req.body.nomineePhone : member.nomineePhone;
            member.nomineeRelation = req.body.nomineeRelation !== undefined ? req.body.nomineeRelation : member.nomineeRelation;
            member.nomineeNid = req.body.nomineeNid !== undefined ? req.body.nomineeNid : member.nomineeNid;
            member.status = req.body.status || member.status;

            if (req.files) {
                if (req.files.photo) member.photo = `/uploads/members/${req.files.photo[0].filename}`;
                if (req.files.nidPhoto) member.nidPhoto = `/uploads/members/${req.files.nidPhoto[0].filename}`;
            }
            member.updatedBy = req.user._id;

            const updatedMember = await member.save();

            // Keep the linked user's name in sync
            if (updatedMember.userRef && req.body.name) {
                await User.findByIdAndUpdate(updatedMember.userRef, {
                    name: req.body.name,
                    updatedBy: req.user._id
                });
            }

            await Log.create({
                action: 'UPDATE_MEMBER',
                entityType: 'Member',
                entityId: updatedMember._id,
                user: req.user._id,
                details: updatedMember
            });

            res.json(updatedMember);
        } else {
            res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
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
            // Also remove the linked system user
            if (member.userRef) {
                await User.findByIdAndDelete(member.userRef);
            }

            await Log.create({
                action: 'DELETE_MEMBER',
                entityType: 'Member',
                entityId: member._id,
                user: req.user._id,
                details: { memberName: member.name, memberId: member.memberId }
            });

            await member.deleteOne();
            res.json({ message: 'সদস্য মুছে ফেলা হয়েছে' });
        } else {
            res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMembers, createMember, updateMember, deleteMember };
