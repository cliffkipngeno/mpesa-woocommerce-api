const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Validate environment variables
const requiredEnvVars = [
  'MONGO_URI',
  'MPESA_SHORT_CODE',
  'MPESA_PASSKEY',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_ENVIRONMENT',
  'CALLBACK_URL'
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing environment variable ${envVar}`);
    process.exit(1);
  }
}

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { retryWrites: true, w: 'majority' })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Get Safaricom access token
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const url = process.env.MPESA_ENVIRONMENT === 'production'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const response = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    return response.data.access_token;
  } catch (error) {
    console.error('Access token error:', error.response?.data || error.message);
    throw new Error('Failed to get access token');
  }
}

// STK Push endpoint
app.post('/api/stk-push', async (req, res) => {
  const { orderId, phoneNumber, amount } = req.body;
  if (!orderId || !phoneNumber || !amount) {
    console.log('Missing fields:', { orderId, phoneNumber, amount });
    return res.status(400).json({ rescode: '1', resmsg: 'Missing required fields' });
  }
  try {
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    const url = process.env.MPESA_ENVIRONMENT === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    const payload = {
      BusinessShortCode: process.env.MPESA_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber.replace('+', ''),
      PartyB: process.env.MPESA_SHORT_CODE,
      PhoneNumber: phoneNumber.replace('+', ''),
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: orderId,
      TransactionDesc: `Payment for order ${orderId}`
    };
    console.log('STK Push payload:', payload);
    const Transaction = require('./models/Transaction');
    await Transaction.create({ orderId, phoneNumber, amount, status: 'Pending' });
    const response = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Safaricom response:', response.data);
    if (response.data.ResponseCode === '0') {
      await Transaction.updateOne(
        { orderId },
        { merchantRequestId: response.data.MerchantRequestID, checkoutRequestId: response.data.CheckoutRequestID }
      );
      res.json({ rescode: '0', resmsg: 'Request accepted, check phone for PIN prompt', CheckoutRequestID: response.data.CheckoutRequestID });
    } else {
      res.status(400).json({ rescode: '1', resmsg: 'Payment request failed' });
    }
  } catch (error) {
    console.error('STK Push error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({ rescode: '1', resmsg: 'Failed to initiate STK Push' });
  }
});

// Callback endpoint
app.post('/api/callback', async (req, res) => {
  const data = req.body;
  console.log('Callback received:', JSON.stringify(data, null, 2));
  try {
    const Transaction = require('./models/Transaction');
    const transaction = await Transaction.findOne({ checkoutRequestId: data.Body?.stkCallback?.CheckoutRequestID });
    if (transaction) {
      await Transaction.updateOne(
        { checkoutRequestId: data.Body?.stkCallback?.CheckoutRequestID },
        {
          resultCode: data.Body?.stkCallback?.ResultCode,
          resultDesc: data.Body?.stkCallback?.ResultDesc,
          status: data.Body?.stkCallback?.ResultCode === '0' ? 'Success' : 'Failed'
        }
      );
    } else {
      console.log('Transaction not found for callback:', data.Body?.stkCallback?.CheckoutRequestID);
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Callback error:', error.message);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error' });
  }
});

// Transactions endpoint
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;