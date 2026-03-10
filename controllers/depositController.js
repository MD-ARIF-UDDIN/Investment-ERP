const Deposit = require('../models/Deposit');
const Member = require('../models/Member');
const Log = require('../models/Log');

// @desc    Get all deposits
// @route   GET /api/deposits
// @access  Private
const getDeposits = async (req, res) => {
    try {
        const { depositFor, member, month, year } = req.query;
        let query = {};

        if (depositFor) {
            query.depositFor = depositFor;
        }

        if (member) {
            query.member = member;
        }

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const deposits = await Deposit.find(query)
            .sort({ date: -1 })
            .populate('member', 'name memberId phone')
            .populate('project', 'name status')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        res.json(deposits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new deposit
// @route   POST /api/deposits
// @access  Private/Admin
const createDeposit = async (req, res) => {
    const { depositFor, memberId, projectId, amount, type, date, note } = req.body;

    try {
        let member = null;
        let project = null;

        if (depositFor === 'Project') {
            const Project = require('../models/Project');
            project = await Project.findById(projectId);
            if (!project) return res.status(404).json({ message: 'প্রকল্প পাওয়া যায়নি' });
        } else {
            member = await Member.findById(memberId);
            if (!member) return res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
        }

        const depositData = {
            depositFor: depositFor || 'Member',
            amount,
            type,
            date,
            note,
            createdBy: req.user._id
        };

        if (depositFor === 'Project') {
            depositData.project = projectId;
        } else {
            depositData.member = memberId;
        }

        const deposit = await Deposit.create(depositData);

        // Update balances
        if (depositFor === 'Project') {
            // Re-calculate Project Profit dynamically based on income
            const Project = require('../models/Project'); // Lazy load
            const projectDeposits = await Deposit.find({ project: projectId, depositFor: 'Project' });

            // Total Received is sum of Income and Profit
            const totalReceived = projectDeposits.reduce((acc, d) => acc + d.amount, 0);

            project.currentProfit = totalReceived - project.totalInvestment;
            await project.save();
        } else {
            member.totalDeposit += Number(amount);
            await member.save();
        }

        await Log.create({
            action: 'CREATE_DEPOSIT',
            entityType: 'Deposit',
            entityId: deposit._id,
            user: req.user._id,
            details: {
                deposit,
                targetName: depositFor === 'Project' ? project.name : member.name
            }
        });

        res.status(201).json(deposit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update deposit
// @route   PUT /api/deposits/:id
// @access  Private/Admin
const updateDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) {
            return res.status(404).json({ message: 'জমা পাওয়া যায়নি' });
        }

        const depositFor = deposit.depositFor || 'Member';
        let member, project;

        if (depositFor === 'Project') {
            const Project = require('../models/Project');
            project = await Project.findById(deposit.project);
        } else {
            member = await Member.findById(deposit.member);
            // Revert old amount
            if (member) {
                member.totalDeposit -= deposit.amount;
            }
        }

        deposit.amount = req.body.amount || deposit.amount;
        deposit.type = req.body.type || deposit.type;
        deposit.date = req.body.date || deposit.date;
        deposit.note = req.body.note !== undefined ? req.body.note : deposit.note;
        deposit.updatedBy = req.user._id;

        const updatedDeposit = await deposit.save();

        if (depositFor === 'Project') {
            if (project) {
                // Recalculate Project Profit
                const projectDeposits = await Deposit.find({ project: deposit.project, depositFor: 'Project' });
                const totalReceived = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
                project.currentProfit = totalReceived - project.totalInvestment;
                await project.save();
            }
        } else if (member) {
            // Apply new amount
            member.totalDeposit += Number(deposit.amount);
            await member.save();
        }

        await Log.create({
            action: 'UPDATE_DEPOSIT',
            entityType: 'Deposit',
            entityId: updatedDeposit._id,
            user: req.user._id,
            details: { updatedDeposit }
        });

        res.json(updatedDeposit);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete deposit
// @route   DELETE /api/deposits/:id
// @access  Private/Admin
const deleteDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) {
            return res.status(404).json({ message: 'জমা পাওয়া যায়নি' });
        }

        const depositFor = deposit.depositFor || 'Member';

        if (depositFor === 'Project') {
            const Project = require('../models/Project');
            const project = await Project.findById(deposit.project);

            await deposit.deleteOne();

            if (project) {
                // Recalculate Project Profit after deleting
                const projectDeposits = await Deposit.find({ project: deposit.project, depositFor: 'Project' });
                const totalReceived = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
                project.currentProfit = totalReceived - project.totalInvestment;
                await project.save();
            }
        } else {
            const member = await Member.findById(deposit.member);
            if (member) {
                // Subtract amount from member
                member.totalDeposit -= deposit.amount;
                await member.save();
            }
            await deposit.deleteOne();
        }

        await Log.create({
            action: 'DELETE_DEPOSIT',
            entityType: 'Deposit',
            entityId: deposit._id,
            user: req.user._id,
            details: { amount: deposit.amount, target: depositFor }
        });

        res.json({ message: 'জমা মুছে ফেলা হয়েছে' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get deposits by member
// @route   GET /api/deposits/member/:memberId
// @access  Private
const getDepositsByMember = async (req, res) => {
    try {
        const deposits = await Deposit.find({ member: req.params.memberId })
            .sort({ date: -1 })
            .populate('member', 'name memberId');
        res.json(deposits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getDeposits, createDeposit, updateDeposit, deleteDeposit, getDepositsByMember };
