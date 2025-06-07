const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  orderId: String,
  phoneNumber: String,
  amount: Number,
  merchantRequestId: String,
  checkoutRequestId: String,
  resultCode: String,
  resultDesc: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);