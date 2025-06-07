// Get transactions endpoint
app.get('/api/transactions', async (req, res) => {
  try {
    const Transaction = require('./models/Transaction');
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(50);
    res.json({ data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});