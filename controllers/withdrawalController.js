const Withdrawal = require('../models/Withdrawal');
const Member = require('../models/Member');
const Project = require('../models/Project');
const Deposit = require('../models/Deposit');
const Log = require('../models/Log');

// @desc    Get all withdrawals
// @route   GET /api/withdrawals
// @access  Private
const getWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({})
            .populate('member', 'name memberId')
            .populate('project', 'name')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .sort({ date: -1 });
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new withdrawal
// @route   POST /api/withdrawals
// @access  Private/Admin
const createWithdrawal = async (req, res) => {
    const { memberId, projectId, amount, date, reason, type } = req.body;

    try {
        if (type === 'Project Investment') {
            // Handle project investment withdrawal
            const project = await Project.findById(projectId);
            if (!project) return res.status(404).json({ message: 'প্রকল্প পাওয়া যায়নি' });

            const withdrawal = await Withdrawal.create({
                member: memberId,
                project: projectId,
                amount,
                date,
                reason: reason || `প্রকল্প: ${project.name} - বিনিয়োগ`,
                type: 'Project Investment',
                createdBy: req.user._id
            });

            // Update project's totalInvestment
            project.totalInvestment = (project.totalInvestment || 0) + Number(amount);
            // Recalculate profit
            const projectDeposits = await Deposit.find({ project: projectId, depositFor: 'Project' });
            const totalReceived = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
            const legacyReceived = project.paymentsReceived?.reduce((acc, p) => acc + p.amount, 0) || 0;
            project.currentProfit = (totalReceived + legacyReceived) - project.totalInvestment;
            await project.save();

            await Log.create({
                action: 'CREATE_PROJECT_INVESTMENT',
                entityType: 'Withdrawal',
                entityId: withdrawal._id,
                user: req.user._id,
                details: { withdrawal, projectName: project.name }
            });

            return res.status(201).json(withdrawal);
        }

        // Regular member withdrawal
        const member = await Member.findById(memberId);
        if (!member) {
            return res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
        }

        // Limit check for profit withdrawals
        if (type === 'Profit') {
            const availableProfit = (member.totalProfitShare || 0) - (member.withdrawnProfit || 0);
            if (Number(amount) > availableProfit) {
                return res.status(400).json({ message: `পর্যাপ্ত লভ্যাংশ নেই। সর্বোচ্চ উত্তোলনযোগ্য: ${availableProfit}৳` });
            }
        }

        const withdrawal = await Withdrawal.create({
            member: memberId,
            amount,
            date,
            reason,
            type: type || 'Normal',
            createdBy: req.user._id
        });

        // Update member totals
        member.totalWithdrawal += Number(amount);
        if (type === 'Profit') {
            member.withdrawnProfit += Number(amount);
        }
        await member.save();

        await Log.create({
            action: 'CREATE_WITHDRAWAL',
            entityType: 'Withdrawal',
            entityId: withdrawal._id,
            user: req.user._id,
            details: { withdrawal, memberName: member.name }
        });

        res.status(201).json(withdrawal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update withdrawal
// @route   PUT /api/withdrawals/:id
// @access  Private/Admin
const updateWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'উত্তোলন পাওয়া যায়নি' });
        }

        const isProjectInvestment = withdrawal.type === 'Project Investment';

        if (isProjectInvestment) {
            // For project investments: update project.totalInvestment
            const project = await Project.findById(withdrawal.project);
            const oldAmount = withdrawal.amount;

            withdrawal.amount = req.body.amount || withdrawal.amount;
            withdrawal.reason = req.body.reason !== undefined ? req.body.reason : withdrawal.reason;
            withdrawal.date = req.body.date || withdrawal.date;
            withdrawal.updatedBy = req.user._id;

            const updatedWithdrawal = await withdrawal.save();

            if (project) {
                project.totalInvestment = (project.totalInvestment - oldAmount) + Number(withdrawal.amount);
                const projectDeposits = await Deposit.find({ project: project._id, depositFor: 'Project' });
                const totalReceived = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
                const legacyReceived = project.paymentsReceived?.reduce((acc, p) => acc + p.amount, 0) || 0;
                project.currentProfit = (totalReceived + legacyReceived) - project.totalInvestment;
                await project.save();
            }

            await Log.create({
                action: 'UPDATE_PROJECT_INVESTMENT',
                entityType: 'Withdrawal',
                entityId: updatedWithdrawal._id,
                user: req.user._id,
                details: { updatedWithdrawal }
            });

            return res.json(updatedWithdrawal);
        }

        // Regular member withdrawal
        const member = await Member.findById(withdrawal.member);

        // Revert old amount
        member.totalWithdrawal -= withdrawal.amount;
        if (withdrawal.type === 'Profit') {
            member.withdrawnProfit -= withdrawal.amount;
        }

        const newAmount = req.body.amount || withdrawal.amount;
        const newType = req.body.type || withdrawal.type;

        // Limit check for profit withdrawals if type is Profit
        if (newType === 'Profit') {
            const availableProfit = (member.totalProfitShare || 0) - (member.withdrawnProfit || 0);
            if (Number(newAmount) > availableProfit) {
                // Re-apply old amount before returning error to keep state consistent if app were to continue
                member.totalWithdrawal += withdrawal.amount;
                if (withdrawal.type === 'Profit') {
                    member.withdrawnProfit += withdrawal.amount;
                }
                return res.status(400).json({ message: `পর্যাপ্ত লভ্যাংশ নেই। সর্বোচ্চ উত্তোলনযোগ্য: ${availableProfit}৳` });
            }
        }

        withdrawal.amount = newAmount;
        withdrawal.type = newType;
        withdrawal.reason = req.body.reason || withdrawal.reason;
        withdrawal.date = req.body.date || withdrawal.date;
        withdrawal.updatedBy = req.user._id;

        // Apply new amount
        member.totalWithdrawal += Number(withdrawal.amount);
        if (withdrawal.type === 'Profit') {
            member.withdrawnProfit += Number(withdrawal.amount);
        }

        const updatedWithdrawal = await withdrawal.save();
        await member.save();

        await Log.create({
            action: 'UPDATE_WITHDRAWAL',
            entityType: 'Withdrawal',
            entityId: updatedWithdrawal._id,
            user: req.user._id,
            details: { updatedWithdrawal }
        });

        res.json(updatedWithdrawal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete withdrawal
// @route   DELETE /api/withdrawals/:id
// @access  Private/Admin
const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'উত্তোলন পওয়া যায়নি' });
        }

        if (withdrawal.type === 'Project Investment') {
            // Reverse the investment from the project
            const project = await Project.findById(withdrawal.project);
            if (project) {
                project.totalInvestment = Math.max(0, (project.totalInvestment || 0) - withdrawal.amount);
                const projectDeposits = await Deposit.find({ project: project._id, depositFor: 'Project' });
                const totalReceived = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
                const legacyReceived = project.paymentsReceived?.reduce((acc, p) => acc + p.amount, 0) || 0;
                project.currentProfit = (totalReceived + legacyReceived) - project.totalInvestment;
                await project.save();
            }

            await Log.create({
                action: 'DELETE_PROJECT_INVESTMENT',
                entityType: 'Withdrawal',
                entityId: withdrawal._id,
                user: req.user._id,
                details: { amount: withdrawal.amount, projectId: withdrawal.project }
            });

            await withdrawal.deleteOne();
            return res.json({ message: 'প্রকল্প বিনিয়োগ মুছে ফেলা হয়েছে' });
        }

        // Regular member withdrawal
        const member = await Member.findById(withdrawal.member);

        // Subtract amount from member totals
        member.totalWithdrawal -= withdrawal.amount;
        if (withdrawal.type === 'Profit') {
            member.withdrawnProfit -= withdrawal.amount;
        }
        await member.save();

        await Log.create({
            action: 'DELETE_WITHDRAWAL',
            entityType: 'Withdrawal',
            entityId: withdrawal._id,
            user: req.user._id,
            details: { amount: withdrawal.amount, memberId: withdrawal.member, type: withdrawal.type }
        });

        await withdrawal.deleteOne();
        res.json({ message: 'উত্তোলন মুছে ফেলা হয়েছে' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get member's investment in a project
// @route   GET /api/withdrawals/member/:memberId/project/:projectId
// @access  Private
const getMemberProjectInvestment = async (req, res) => {
    try {
        const { memberId, projectId } = req.params;
        const investments = await Withdrawal.find({
            member: memberId,
            project: projectId,
            type: 'Project Investment'
        });
        const totalAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
        res.json({ totalAmount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getWithdrawals, createWithdrawal, updateWithdrawal, deleteWithdrawal, getMemberProjectInvestment };
