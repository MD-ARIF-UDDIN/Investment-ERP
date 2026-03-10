const Member = require('../models/Member');
const Expense = require('../models/Expense');
const Project = require('../models/Project');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit');

// @desc    Get complete financial summary
// @route   GET /api/reports/summary
// @access  Private/Admin
const getFinancialSummary = async (req, res) => {
    try {
        const members = await Member.find({});
        const expenses = await Expense.find({});
        const projects = await Project.find({});

        const totalWithdrawals = await Withdrawal.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const totalMemberDeposits = members.reduce((acc, mem) => acc + mem.totalDeposit, 0);
        const totalMemberWithdrawals = members.reduce((acc, mem) => acc + mem.totalWithdrawal, 0);
        const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
        const totalActiveInvestments = projects.reduce((acc, proj) => acc + (proj.status === 'Running' ? proj.totalInvestment : 0), 0);

        // Support legacy payments array and new unified Deposits
        const projectDeposits = await Deposit.find({ depositFor: 'Project' });

        // Extended Summary Data
        const projectRevenueBreakdown = projects.map(proj => {
            const legacyRevenue = proj.paymentsReceived?.reduce((pacc, p) => pacc + p.amount, 0) || 0;
            const depositRevenue = projectDeposits.filter(d => d.project?.toString() === proj._id.toString()).reduce((pacc, d) => pacc + d.amount, 0);

            return {
                name: proj.name,
                id: proj.projectId,
                revenue: legacyRevenue + depositRevenue,
                investment: proj.totalInvestment,
                profit: proj.currentProfit || 0
            };
        });

        const totalRevenue = projectRevenueBreakdown.reduce((acc, p) => acc + p.revenue, 0);

        const depositTypeDistribution = await Deposit.aggregate([
            {
                $match: { depositFor: 'Member' } // Member deposits only for this chart typically
            },
            {
                $group: {
                    _id: "$type",
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const totalProfitDistributed = members.reduce((acc, mem) => acc + (mem.totalProfitShare || 0), 0);
        const totalProjectProfit = projects.reduce((acc, proj) => acc + (proj.currentProfit || 0), 0);

        const projectStats = {
            running: projects.filter(p => p.status === 'Running').length,
            completed: projects.filter(p => p.status === 'Completed').length,
            total: projects.length
        };

        const memberStats = {
            active: members.filter(m => m.status === 'Active').length,
            inactive: members.filter(m => m.status === 'Inactive').length,
            total: members.length
        };

        const availableBalance = (totalMemberDeposits + totalRevenue) - (totalMemberWithdrawals + totalExpenses + totalActiveInvestments);

        // Monthly Trends (Last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const monthlyDeposits = await Deposit.aggregate([
            { $match: { date: { $gte: sixMonthsAgo }, depositFor: 'Member' } },
            {
                $group: {
                    _id: { month: { $month: "$date" }, year: { $year: "$date" } },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const monthlyExpenses = await Expense.aggregate([
            { $match: { date: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { month: { $month: "$date" }, year: { $year: "$date" } },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        res.json({
            totalMembers: members.length,
            totalMemberDeposits,
            totalMemberWithdrawals,
            totalExpenses,
            totalWithdrawals: totalWithdrawals[0]?.total || 0,
            totalActiveInvestments,
            totalRevenue,
            totalProfitDistributed,
            totalProjectProfit,
            projectStats,
            memberStats,
            availableBalance,
            projectRevenueBreakdown,
            depositTypeDistribution,
            trends: {
                deposits: monthlyDeposits,
                expenses: monthlyExpenses
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Profit Report with filters
// @route   GET /api/reports/profit
// @access  Private/Admin
const getProfitReport = async (req, res) => {
    try {
        const { month, year, startDate, endDate } = req.query;
        let start, end;

        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else if (month && year) {
            start = new Date(year, month - 1, 1);
            end = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (year) {
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59, 999);
        } else {
            // Default to current month
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        const projects = await Project.find({});
        const expenses = await Expense.find({
            date: { $gte: start, $lte: end }
        });
        const deposits = await Deposit.find({
            date: { $gte: start, $lte: end }
        });
        const activeMembers = await Member.find({ status: 'Active' });

        // Aggregate deposits by member for this range
        const memberRangeDeposits = {};
        deposits.forEach(d => {
            if (d.depositFor === 'Member' && d.member) {
                const memberId = d.member.toString();
                memberRangeDeposits[memberId] = (memberRangeDeposits[memberId] || 0) + d.amount;
            }
        });

        let totalRevenue = 0;
        const projectBreakdown = projects.map(proj => {
            // Legacy payments in date range
            const periodLegacy = proj.paymentsReceived?.filter(p => {
                const pDate = new Date(p.date);
                return pDate >= start && pDate <= end;
            }) || [];
            const legacyRevenue = periodLegacy.reduce((sum, p) => sum + p.amount, 0);

            // Unified Deposits in date range
            const periodDeposits = deposits.filter(d =>
                d.depositFor === 'Project' && d.project?.toString() === proj._id.toString()
            );
            const depositRevenue = periodDeposits.reduce((sum, d) => sum + d.amount, 0);

            const revenue = legacyRevenue + depositRevenue;
            totalRevenue += revenue;
            return {
                id: proj._id,
                name: proj.name,
                revenue
            };
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const netProfit = totalRevenue - totalExpenses;
        const sharePerMember = activeMembers.length > 0 ? netProfit / activeMembers.length : 0;

        res.json({
            period: { start, end },
            totalRevenue,
            totalExpenses,
            netProfit,
            sharePerMember,
            memberCount: activeMembers.length,
            memberRangeDeposits, // memberId -> amount
            projectBreakdown,
            expenseBreakdown: expenses.map(e => ({ title: e.title, amount: e.amount, date: e.date }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProjectwiseReport = async (req, res) => {
    try {
        const { startDate, endDate, month, year, type } = req.query;
        let start, end;

        if (type === 'month' && month && year) {
            start = new Date(year, month - 1, 1);
            end = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (type === 'year' && year) {
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59, 999);
        } else if (type === 'custom' && startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        const projects = await Project.find({}).sort({ createdAt: -1 });

        // Fetch all project deposits
        const projectDepositsQuery = { depositFor: 'Project' };
        if (start && end) {
            projectDepositsQuery.date = { $gte: start, $lte: end };
        }
        const periodProjectDeposits = await Deposit.find(projectDepositsQuery);
        const allProjectDeposits = await Deposit.find({ depositFor: 'Project' });

        const reportData = projects.map(proj => {
            let filteredRevenue = 0;
            const legacyTotalRevenue = proj.paymentsReceived?.reduce((acc, p) => acc + p.amount, 0) || 0;
            const depositTotalRevenue = allProjectDeposits.filter(d => d.project?.toString() === proj._id.toString()).reduce((acc, d) => acc + d.amount, 0);
            const totalRevenue = legacyTotalRevenue + depositTotalRevenue;

            if (start && end) {
                const legacyFiltered = proj.paymentsReceived
                    ?.filter(p => {
                        const pDate = new Date(p.date);
                        return pDate >= start && pDate <= end;
                    })
                    .reduce((acc, p) => acc + p.amount, 0) || 0;

                const depositFiltered = periodProjectDeposits
                    .filter(d => d.project?.toString() === proj._id.toString())
                    .reduce((acc, d) => acc + d.amount, 0);

                filteredRevenue = legacyFiltered + depositFiltered;
            } else {
                filteredRevenue = totalRevenue;
            }

            return {
                _id: proj._id,
                name: proj.name,
                totalInvestment: proj.totalInvestment,
                totalRevenue: totalRevenue,
                periodRevenue: filteredRevenue,
                totalProfit: totalRevenue - proj.totalInvestment,
                status: proj.status,
                startDate: proj.startDate,
                endDate: proj.endDate
            };
        });

        res.json(reportData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Monthly financial report — all months or a single month drill-down
// @route   GET /api/reports/monthly?mode=all | ?mode=single&month=X&year=Y
// @access  Private
const getMonthlyReport = async (req, res) => {
    try {
        const { mode, month, year } = req.query;

        let matchFilter = {};
        if (mode === 'single' && month && year) {
            const start = new Date(Number(year), Number(month) - 1, 1);
            const end   = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
            matchFilter = { date: { $gte: start, $lte: end } };
        }

        const groupStage = {
            $group: {
                _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                total: { $sum: '$amount' }
            }
        };

        // Member deposits
        const memberDepositPipeline = [
            { $match: { depositFor: 'Member', ...matchFilter } },
            groupStage,
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        // Project income (deposits for project)
        const projectIncomePipeline = [
            { $match: { depositFor: 'Project', ...matchFilter } },
            groupStage,
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        // All withdrawals (member withdrawals)
        const withdrawalPipeline = [
            { $match: { type: 'Member', ...matchFilter } },
            groupStage,
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        // Project investments (type: 'Project Investment')
        const projectInvestPipeline = [
            { $match: { type: 'Project Investment', ...matchFilter } },
            groupStage,
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        // Expenses
        const expensePipeline = [
            { $match: { ...matchFilter } },
            groupStage,
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        const [memberDeposits, projectIncome, memberWithdrawals, projectInvestments, expenses] = await Promise.all([
            Deposit.aggregate(memberDepositPipeline),
            Deposit.aggregate(projectIncomePipeline),
            Withdrawal.aggregate(withdrawalPipeline),
            Withdrawal.aggregate(projectInvestPipeline),
            Expense.aggregate(expensePipeline)
        ]);

        // If single month — also return day-level breakdown
        let dailyBreakdown = [];
        if (mode === 'single' && month && year) {
            const start = new Date(Number(year), Number(month) - 1, 1);
            const end   = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
            const dayGroup = {
                $group: {
                    _id: { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' } },
                    total: { $sum: '$amount' },
                    type: { $first: '$type' }
                }
            };
            const [dayDeposits, dayWithdrawals, dayExpenses] = await Promise.all([
                Deposit.aggregate([{ $match: { depositFor: 'Member', date: { $gte: start, $lte: end } } }, dayGroup, { $sort: { '_id.day': 1 } }]),
                Withdrawal.aggregate([{ $match: { type: 'Member', date: { $gte: start, $lte: end } } }, dayGroup, { $sort: { '_id.day': 1 } }]),
                Expense.aggregate([{ $match: { date: { $gte: start, $lte: end } } }, dayGroup, { $sort: { '_id.day': 1 } }])
            ]);
            dailyBreakdown = { dayDeposits, dayWithdrawals, dayExpenses };
        }

        // Merge all results into a unified month list
        const monthMap = {};
        const key = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

        const ensure = (y, m) => {
            const k = key(y, m);
            if (!monthMap[k]) monthMap[k] = { year: y, month: m, memberDeposit: 0, projectIncome: 0, memberWithdrawal: 0, projectInvestment: 0, expense: 0 };
            return monthMap[k];
        };

        memberDeposits.forEach(r => { ensure(r._id.year, r._id.month).memberDeposit = r.total; });
        projectIncome.forEach(r => { ensure(r._id.year, r._id.month).projectIncome = r.total; });
        memberWithdrawals.forEach(r => { ensure(r._id.year, r._id.month).memberWithdrawal = r.total; });
        projectInvestments.forEach(r => { ensure(r._id.year, r._id.month).projectInvestment = r.total; });
        expenses.forEach(r => { ensure(r._id.year, r._id.month).expense = r.total; });

        const rows = Object.keys(monthMap)
            .sort()
            .map(k => {
                const r = monthMap[k];
                const profit = r.projectIncome - r.projectInvestment;
                const totalOutflow = r.memberWithdrawal + r.expense;
                return { ...r, profit, totalOutflow, net: r.memberDeposit + profit - totalOutflow };
            });

        // Grand totals
        const totals = rows.reduce((acc, r) => ({
            memberDeposit: acc.memberDeposit + r.memberDeposit,
            projectIncome: acc.projectIncome + r.projectIncome,
            memberWithdrawal: acc.memberWithdrawal + r.memberWithdrawal,
            projectInvestment: acc.projectInvestment + r.projectInvestment,
            expense: acc.expense + r.expense,
            profit: acc.profit + r.profit,
            totalOutflow: acc.totalOutflow + r.totalOutflow,
            net: acc.net + r.net
        }), { memberDeposit: 0, projectIncome: 0, memberWithdrawal: 0, projectInvestment: 0, expense: 0, profit: 0, totalOutflow: 0, net: 0 });

        res.json({ rows, totals, dailyBreakdown });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getFinancialSummary, getProfitReport, getProjectwiseReport, getMonthlyReport };
