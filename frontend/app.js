// M-Pesa Integration - Frontend JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Configuration
  const apiBaseUrl = 'https://your-server-url.com/api'; // Replace with your actual backend URL
  
  // Elements
  const mpesaForm = document.getElementById('mpesa-payment-form');
  const phoneInput = document.getElementById('mpesa-phone');
  const amountInput = document.getElementById('mpesa-amount');
  const referenceInput = document.getElementById('mpesa-reference');
  const submitButton = document.getElementById('mpesa-payment-button');
  const responseDiv = document.getElementById('mpesa-response');
  
  // Event listeners
  if (mpesaForm) {
    mpesaForm.addEventListener('submit', handleMpesaPayment);
  } else if (submitButton) {
    submitButton.addEventListener('click', handleMpesaPayment);
  }
  
  // Handle M-Pesa payment
  async function handleMpesaPayment(event) {
    if (event) event.preventDefault();
    
    if (!phoneInput || !amountInput) {
      console.error('Required form elements not found');
      showResponse('Error: Form elements not found', true);
      return;
    }
    
    const phoneNumber = phoneInput.value.trim();
    const amount = amountInput.value.trim();
    const reference = referenceInput ? referenceInput.value.trim() : '';
    
    // Validate inputs
    if (!phoneNumber) {
      showResponse('Please enter a phone number', true);
      return;
    }
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      showResponse('Please enter a valid amount', true);
      return;
    }
    
    // Disable button and show loading
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
    }
    
    try {
      // Format phone number (ensure it starts with 254)
      let formattedPhone = phoneNumber;
      if (phoneNumber.startsWith('0')) {
        formattedPhone = '254' + phoneNumber.substring(1);
      } else if (!phoneNumber.startsWith('254')) {
        formattedPhone = '254' + phoneNumber;
      }
      
      // Send STK push request
      const response = await fetch(`${apiBaseUrl}/stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          amount: parseFloat(amount),
          reference: reference || 'Payment'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process payment');
      }
      
      // Show success message
      showResponse(`
        <div class="alert alert-success">
          <h4>STK Push Sent Successfully!</h4>
          <p>Please check your phone for the M-Pesa prompt.</p>
          <p>Checkout Request ID: ${data.data?.CheckoutRequestID || 'N/A'}</p>
        </div>
      `);
      
      // Reset form
      if (mpesaForm) mpesaForm.reset();
      
    } catch (error) {
      console.error('Payment error:', error);
      showResponse(`Error: ${error.message || 'Failed to process payment'}`, true);
    } finally {
      // Re-enable button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Pay with M-Pesa';
      }
    }
  }
  
  // Show response message
  function showResponse(message, isError = false) {
    if (!responseDiv) return;
    
    responseDiv.innerHTML = isError 
      ? `<div class="alert alert-danger">${message}</div>`
      : message;
    
    responseDiv.scrollIntoView({ behavior: 'smooth' });
  }
  
  // Initialize transaction history (if applicable)
  initTransactionHistory();
  
  // Initialize transaction history
  async function initTransactionHistory() {
    const transactionHistoryDiv = document.getElementById('transaction-history');
    if (!transactionHistoryDiv) return;
    
    try {
      const response = await fetch(`${apiBaseUrl}/transactions`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch transactions');
      }
      
      if (data.data && data.data.length > 0) {
        const transactions = data.data;
        let html = '<h3>Transaction History</h3><table class="table">';
        html += '<thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Phone</th><th>Status</th><th>Date</th></tr></thead>';
        html += '<tbody>';
        
        transactions.forEach(tx => {
          html += `<tr>
            <td>${tx.id}</td>
            <td>${tx.type}</td>
            <td>${tx.amount}</td>
            <td>${tx.phoneNumber}</td>
            <td>${tx.status}</td>
            <td>${new Date(tx.timestamp).toLocaleString()}</td>
          </tr>`;
        });
        
        html += '</tbody></table>';
        transactionHistoryDiv.innerHTML = html;
      } else {
        transactionHistoryDiv.innerHTML = '<p>No transactions found.</p>';
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      transactionHistoryDiv.innerHTML = `<p class="text-danger">Error loading transactions: ${error.message}</p>`;
    }
  }
});
