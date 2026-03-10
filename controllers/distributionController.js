const Distribution = require('../models/Distribution');
const Member = require('../models/Member');
const Deposit = require('../models/Deposit');
const Log = require('../models/Log');

// @desc    Get all distributions
// @route   GET /api/distributions
// @access  Private/Admin
const getDistributions = async (req, res) => {
    try {
        const distributions = await Distribution.find({})
            .sort({ date: -1 })
            .populate('shares.member', 'name memberId')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        res.json(distributions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new distribution
// @route   POST /api/distributions
// @access  Private/Admin
const createDistribution = async (req, res) => {
    const { totalAmount, method, note, manualShares } = req.body;

    try {
        const activeMembers = await Member.find({ status: 'Active' });
        if (activeMembers.length === 0) {
            return res.status(400).json({ message: 'সক্রিয় সদস্য পাওয়া যায়নি' });
        }

        let shares = [];
        let calculatedTotal = 0;

        if (method === 'Equal') {
            const amountPerMember = Number(totalAmount) / activeMembers.length;
            shares = activeMembers.map(m => ({
                member: m._id,
                amount: amountPerMember
            }));
            calculatedTotal = Number(totalAmount);
        } else if (method === 'ByDeposit') {
            const totalSocietyDeposit = activeMembers.reduce((sum, m) => sum + (m.totalDeposit || 0), 0);
            if (totalSocietyDeposit === 0) {
                return res.status(400).json({ message: 'সদস্যদের কোনো জমা নেই, অুপাত নির্ধারণ করা সম্ভব নয়' });
            }
            shares = activeMembers.map(m => ({
                member: m._id,
                amount: (Number(totalAmount) * (m.totalDeposit || 0)) / totalSocietyDeposit
            }));
            calculatedTotal = Number(totalAmount);
        } else if (method === 'Manual') {
            shares = manualShares.map(s => ({
                member: s.member,
                amount: Number(s.amount)
            }));
            calculatedTotal = shares.reduce((sum, s) => sum + s.amount, 0);
        }

        // Create the distribution record
        const distribution = await Distribution.create({
            totalAmount: calculatedTotal,
            method,
            shares,
            note,
            createdBy: req.user._id
        });

        // Update members
        for (const share of shares) {
            const member = await Member.findById(share.member);
            if (member) {
                member.totalProfitShare += share.amount;
                await member.save();
            }
        }

        await Log.create({
            action: 'DISTRIBUTE_PROFIT',
            entityType: 'Distribution',
            entityId: distribution._id,
            user: req.user._id,
            details: { totalAmount: calculatedTotal, method, memberCount: shares.length }
        });

        res.status(201).json(distribution);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getDistributions, createDistribution };
