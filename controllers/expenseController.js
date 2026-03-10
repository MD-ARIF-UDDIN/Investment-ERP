const Expense = require('../models/Expense');
const Log = require('../models/Log');

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({})
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private/Admin
const createExpense = async (req, res) => {
    const { title, amount, category, date, note } = req.body;
    const receipt = req.file ? `/uploads/expenses/${req.file.filename}` : '';

    try {
        const expense = await Expense.create({
            title,
            amount,
            category,
            date,
            note,
            receipt,
            createdBy: req.user._id
        });

        await Log.create({
            action: 'CREATE_EXPENSE',
            entityType: 'Expense',
            entityId: expense._id,
            user: req.user._id,
            details: expense
        });

        res.status(201).json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private/Admin
const updateExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: 'খরচ পাওয়া যায়নি' });
        }

        expense.title = req.body.title || expense.title;
        expense.amount = req.body.amount || expense.amount;
        expense.category = req.body.category || expense.category;
        expense.date = req.body.date || expense.date;
        expense.note = req.body.note || expense.note;
        if (req.file) {
            expense.receipt = `/uploads/expenses/${req.file.filename}`;
        }
        expense.updatedBy = req.user._id;

        const updatedExpense = await expense.save();

        await Log.create({
            action: 'UPDATE_EXPENSE',
            entityType: 'Expense',
            entityId: updatedExpense._id,
            user: req.user._id,
            details: { updatedExpense }
        });

        res.json(updatedExpense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private/Admin
const deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: 'খরচ পাওয়া যায়নি' });
        }

        await Log.create({
            action: 'DELETE_EXPENSE',
            entityType: 'Expense',
            entityId: expense._id,
            user: req.user._id,
            details: { amount: expense.amount, title: expense.title }
        });

        await expense.deleteOne();
        res.json({ message: 'খরচ মুছে ফেলা হয়েছে' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
