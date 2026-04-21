const Project = require('../models/Project');
const Member = require('../models/Member');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const Log = require('../models/Log');

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
    try {
        const projects = await Project.find({})
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .lean();

        // Fetch all project deposits and investment withdrawals
        const projectDeposits = await Deposit.find({ depositFor: 'Project' }).lean();
        const investmentWithdrawals = await Withdrawal.find({ type: 'Project Investment' }).lean();

        const projectsWithStatus = projects.map(p => {
            const relatedDeposits = projectDeposits.filter(d => d.project?.toString() === p._id.toString());
            const relatedInvestments = investmentWithdrawals.filter(w => w.project?.toString() === p._id.toString());

            // NEW: Dynamically calculate total investment from withdrawals
            const totalInvested = relatedInvestments.reduce((sum, inv) => sum + inv.amount, 0);
            
            // Format deposits to match legacy paymentsReceived structure
            const formattedDeposits = relatedDeposits.map(d => ({
                _id: d._id,
                amount: d.amount,
                date: d.date,
                note: d.note,
                type: d.type
            }));

            // NEW: Dynamically calculate total received from legacy + new deposits
            const legacyReceived = p.paymentsReceived?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
            const depositReceived = relatedDeposits.reduce((acc, d) => acc + d.amount, 0);
            const totalReceived = legacyReceived + depositReceived;

            // MODIFIED: Calculate Due Amount based on elapsed time
            const now = new Date();
            const start = new Date(p.startDate);
            const refDate = (p.status === 'Completed' || p.status === 'Cancelled') && p.endDate ? new Date(p.endDate) : now;
            
            // Calculate months passed (rounding down to nearest full month)
            // If they want daily precision, we could change this, but monthly is standard.
            let monthsPassed = (refDate.getFullYear() - start.getFullYear()) * 12 + (refDate.getMonth() - start.getMonth());
            
            // Boundary checks
            monthsPassed = Math.max(0, Math.min(monthsPassed, p.returnMonths || 1));

            const totalProfitExpected = (totalInvested * (p.returnPercentage || 0)) / 100;
            const monthlyRate = totalProfitExpected / (p.returnMonths || 1);

            const expectedToDate = monthsPassed * monthlyRate;

            const profitPaid = Math.max(0, totalReceived - totalInvested);
            const dueAmount = Math.max(0, Math.round(expectedToDate - profitPaid));

            // Format investment history
            const formattedInvestments = relatedInvestments.map(w => ({
                _id: w._id,
                amount: w.amount,
                date: w.date,
                note: w.reason
            }));

            return {
                ...p,
                totalInvestment: totalInvested > 0 ? totalInvested : p.totalInvestment, // Fallback to field if no withdrawals
                currentProfit: totalReceived - totalInvested, // Dynamic profit
                paymentsReceived: [...(p.paymentsReceived || []), ...formattedDeposits],
                investmentHistory: formattedInvestments,
                dueAmount
            };
        });

        res.json(projectsWithStatus);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new project
// @route   POST /api/projects
// @access  Private/Admin
const createProject = async (req, res) => {
    const { name, totalInvestment, startDate, endDate, description, location, projectType, expectedReturn, responsiblePerson, contactPhone, returnPercentage, returnMonths } = req.body;

    let image = '';
    if (req.file) {
        image = `/uploads/projects/${req.file.filename}`;
    }

    try {
        // Project starts with 0 investment — investment is tracked via Withdrawal records
        const project = await Project.create({
            name,
            totalInvestment: 0,
            startDate,
            endDate,
            description,
            location,
            projectType: projectType || 'Other',
            expectedReturn: expectedReturn ? Number(expectedReturn) : undefined,
            responsiblePerson,
            contactPhone,
            returnPercentage: returnPercentage ? Number(returnPercentage) : 0,
            returnMonths: returnMonths ? Number(returnMonths) : 1,
            image,
            createdBy: req.user._id
        });

        // If investment is provided, auto-create a Withdrawal of type 'Project Investment'
        if (totalInvestment && Number(totalInvestment) > 0) {
            await Withdrawal.create({
                project: project._id,
                amount: Number(totalInvestment),
                date: startDate || Date.now(),
                reason: `প্রকল্প বিনিয়োগ: ${name}`,
                type: 'Project Investment',
                createdBy: req.user._id
            });

            // Update project's totalInvestment
            project.totalInvestment = Number(totalInvestment);
            await project.save();
        }

        await Log.create({
            action: 'CREATE_PROJECT',
            entityType: 'Project',
            entityId: project._id,
            user: req.user._id,
            details: project
        });

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add project payment (org-level, not distributed to members)
// @route   POST /api/projects/:id/payments
// @access  Private/Admin
const addProjectPayment = async (req, res) => {
    // Deprecated: Projects now use the unified /api/deposits system.
    // Keeping this route temporarily for backward compatibility if the UI still calls it before we update it.
    const { amount, date, note } = req.body;
    const projectId = req.params.id;

    try {
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'প্রকল্প পাওয়া যায়নি' });
        }

        // Instead of managing arrays, create a unified deposit
        const deposit = await Deposit.create({
            depositFor: 'Project',
            project: projectId,
            amount: Number(amount),
            type: 'Income',
            date: date || Date.now(),
            note,
            createdBy: req.user._id
        });

        // We are NO LONGER pushing to project.paymentsReceived here to avoid double-counting
        // since getProjects now merges legacy paymentsReceived with unified Deposits

        // Recalculate profit using ALL project deposits + legacy
        const projectDeposits = await Deposit.find({ project: projectId, depositFor: 'Project' });
        const totalReceivedDeposits = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
        const totalLegacy = project.paymentsReceived.reduce((acc, curr) => acc + curr.amount, 0);

        project.currentProfit = (totalReceivedDeposits + totalLegacy) - project.totalInvestment;

        await project.save();

        await Log.create({
            action: 'ADD_PROJECT_PAYMENT_LEGACY_BRIDGE',
            entityType: 'Project',
            entityId: project._id,
            user: req.user._id,
            details: { projectId, amount, note, distributed: false }
        });

        res.status(201).json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private/Admin
const updateProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'প্রকল্প পাওয়া যায়নি' });
        }

        project.name = req.body.name || project.name;
        project.totalInvestment = req.body.totalInvestment !== undefined ? Number(req.body.totalInvestment) : project.totalInvestment;
        project.startDate = req.body.startDate || project.startDate;
        project.endDate = req.body.endDate || project.endDate;
        project.status = req.body.status || project.status;
        project.description = req.body.description !== undefined ? req.body.description : project.description;
        project.location = req.body.location !== undefined ? req.body.location : project.location;
        project.projectType = req.body.projectType || project.projectType;
        project.expectedReturn = req.body.expectedReturn !== undefined ? Number(req.body.expectedReturn) : project.expectedReturn;
        project.responsiblePerson = req.body.responsiblePerson !== undefined ? req.body.responsiblePerson : project.responsiblePerson;
        project.contactPhone = req.body.contactPhone !== undefined ? req.body.contactPhone : project.contactPhone;
        project.returnPercentage = req.body.returnPercentage !== undefined ? Number(req.body.returnPercentage) : project.returnPercentage;
        project.returnMonths = req.body.returnMonths !== undefined ? Number(req.body.returnMonths) : project.returnMonths;

        if (req.file) {
            project.image = `/uploads/projects/${req.file.filename}`;
        }

        // Recalculate currentProfit based on updated totalInvestment
        const projectDeposits = await Deposit.find({ project: project._id, depositFor: 'Project' });
        const totalReceivedDeposits = projectDeposits.reduce((acc, d) => acc + d.amount, 0);
        const totalLegacy = project.paymentsReceived?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
        project.currentProfit = (totalReceivedDeposits + totalLegacy) - project.totalInvestment;

        project.updatedBy = req.user._id;

        const updatedProject = await project.save();

        await Log.create({
            action: 'UPDATE_PROJECT',
            entityType: 'Project',
            entityId: updatedProject._id,
            user: req.user._id,
            details: { updatedProject }
        });

        res.json(updatedProject);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'প্রকল্প পাওয়া যায়নি' });
        }

        if (project.receivedPayments && project.receivedPayments.length > 0) {
            return res.status(400).json({ message: 'পেমেন্ট গ্রহণ করা প্রকল্প ডিলিট করা যাবে না' });
        }

        await Log.create({
            action: 'DELETE_PROJECT',
            entityType: 'Project',
            entityId: project._id,
            user: req.user._id,
            details: { projectName: project.name }
        });

        await project.deleteOne();
        res.json({ message: 'প্রকল্প মুছে ফেলা হয়েছে' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Distribute profit equally among active members
// @route   POST /api/projects/distribute-profit
// @access  Private/Admin
const distributeProfit = async (req, res) => {
    try {
        const projects = await Project.find({ status: { $ne: 'Cancelled' } });
        const activeMembers = await Member.find({ status: 'Active' });

        if (activeMembers.length === 0) {
            return res.status(400).json({ message: 'সক্রিয় সদস্য পাওয়া যায়নি' });
        }

        let totalToDistribute = 0;
        projects.forEach(project => {
            const undistributed = project.currentProfit - project.distributedProfit;
            if (undistributed > 0) {
                totalToDistribute += undistributed;
            }
        });

        if (totalToDistribute <= 0) {
            return res.status(400).json({ message: 'বণ্টন করার জন্য কোনো অতিরিক্ত লাভ নেই' });
        }

        const sharePerMember = totalToDistribute / activeMembers.length;

        // Update each member
        for (let member of activeMembers) {
            member.totalProfitShare += sharePerMember;
            await member.save();
        }

        // Update each project's distributedProfit
        for (let project of projects) {
            if (project.currentProfit > project.distributedProfit) {
                project.distributedProfit = project.currentProfit;
                await project.save();
            }
        }

        await Log.create({
            action: 'DISTRIBUTE_PROFIT',
            entityType: 'Project',
            user: req.user._id,
            details: { totalAmount: totalToDistribute, sharePerMember, memberCount: activeMembers.length }
        });

        res.json({
            message: 'সাফল্যজনকভাবে লভ্যাংশ বণ্টন করা হয়েছে',
            totalDistributed: totalToDistribute,
            sharePerMember
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getProjects, createProject, addProjectPayment, updateProject, deleteProject, distributeProfit };
