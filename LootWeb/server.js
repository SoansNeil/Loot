const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname));


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Maria22', // use your MySQL password if needed
  database: 'LootDB'
});

const crypto = require('crypto'); // For hashing passwords and sensitive data

//Route to add new users to database
app.post('/createUser-form', (req, res) => {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const username = req.body.username;
  const birthday = req.body.birthday;
  const email = req.body.email;
  const phoneNumber = req.body.phoneNumber;
  const hashPassword = crypto
  .createHash('sha256')
  .update(req.body.password)
  .digest('hex');
  
  const sql = 'INSERT INTO SUBSCRIBER_ACCOUNT (FName, LName, Username, Password, Birthday, Email, PhoneNumber) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [firstName, lastName, username, hashPassword, birthday, email, phoneNumber], (err, result) => {
    if (err) {
      console.error('Error inserting user:', err);
      res.status(500).send('Error inserting user');
    }
    res.send('Thank you for joining us!');
  }
);});

//Route for adding external accounts to database
app.post('/externalAccount', (req, res) => {
  const bankName = req.body.bank;
  const accountType = req.body.accountType;
  //const hashAccountNumber = crypto
  //.createHash('sha256')
  //.update(req.body.accountNumber)
  //.digest('hex');
  //const routingNumber = req.body.routingNumber;
  //const accountNickname = req.body.accountNickname;
const sql = 'INSERT INTO EXTERNAL_ACCOUNT (bank, accountType) VALUES (?, ?)'; // Add more values as DB expands
  db.query(sql, [bank, accountType], (err, result) => {
    if (err) {
      console.error('Error connecting external account:', err);
      res.status(500).send('Error connecting external account');
    }
    res.send('External account connected successfully!');
  });
});

//display information from external account for dashboard html
app.post('/displayExAcc',(req,res)=>{
 
  const subscriberID=1;

  const sql='Select accountID, bank, accountType,currentBalance,currency, subscriberID From EXTERNAL_ACCOUNT Where subscriberID= ?';
 db.query(sql, [subscriberID], (err, result) => {
    if (err) {
      console.error('Error connecting external account:', err);
      res.status(500).send('BD Error');
    }
 
     if (!result.length) {
      return res.send('No accounts found');
    }
   //html formatting for dashboard
    let html = '<table border="1">';
    result.forEach(account => {
      html += `<div style="border:1px solid #ccc; padding:10px; margin:10px; width:300px;">
          <p><strong>AccountID:</strong> ${account.accountID}</p>
          <p><strong>Bank:</strong> ${account.bank}</p>
          <p><strong>Account Type:</strong> ${account.accountType}</p>
          <p><strong>Current Balance:</strong> ${account.currency} ${account.currentBalance}</p>
          <a href="Money-Transfer.html?accountID=${account.accountID}&currency=${account.currency}&balance=${account.currentBalance}">
            <button>Click here to transfer money from this account</button>
          </a>
        </div>
      `;
    
    });
    html += '</table>';

    res.send(html); // send HTML snippet
  });
  });

//Checks if account is accessible to the User 
app.post('/CheckAccID', (req, res) => {
  const subscriberID = req.body.SubscriberID;
  const accountID = req.body.AccountID;
  const balance=req.body.Balance;

  const toAccount = accountID;
  const sql='Select accountID, subscriberID From EXTERNAL_ACCOUNT Where subscriberID= ? AND accountID=?';
 db.query(sql, [subscriberID,accountID], (err, result) => {
    if (err) {
      console.error('Error checking Account ID:', err);
      res.status(500).send('BD Error');
    }
 
     if (!result.length) {
      return res.send('The AccountID you have entered does not match any accounts in your subscription. Please try again.');
     }
 res.redirect(`/MT-SelectAmount.html?toAccount=${toAccount}&balance=${balance}&toAccount=${toAccount}&toSubscriber=${toSubscriber}`);    });
  });

  //Store transfer Amount
  app.post('/StoreAmount', (req, res) => {
  const transferAmount = Number( req.body.Tamount);
  const balance = Number(req.body.balance);

  //make sure these are passed from url
   const accountID = req.body.accountID ;
  const toAccount = req.body.toAccount ;
  const toSubscriber = req.body.toSubscriber;
  
  if (transferAmount > balance) {
     return res.send(`The amount you want to transfer(${transferAmount}) exceeds the amount of money you have in your account balance(${balance}). Please adjust the amount and try again.`);
  } 
  else{ 
  // return res.send(`${transferAmount} and ${balance}`)
    res.redirect(`/MT-Date&Time.html?amount=${transferAmount}&accountID=${accountID}&toAccount=${toAccount}&toSubscriber=${toSubscriber}`);
  }

    });

    //schedule now and ahead features
    app.post('/StoreSchedule', (req, res) => {
  const amount = Number(req.body.amount);
  const fromAccount = req.body.fromAccount;
  const toAccount = req.body.toAccount;
  const toSubscriber = req.body.toSubscriber;
  const scheduleType = req.body.scheduleType;
  
  //future time and date
  const transferDate = req.body.transferDate;
  const transferTime = req.body.transferTime;

  if (scheduleType === 'later') {
    if (!transferDate || !transferTime) {
      return res.send('Please select both date and time for future transfer');
    }
    
    const sql = `INSERT INTO scheduled_transfers 
                 (amount, from_account, to_account, to_subscriber, schedule_type, transfer_date, transfer_time, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`;
    
    db.query(sql, [amount, fromAccount, toAccount, toSubscriber, scheduleType, transferDate, transferTime], (err, result) => {
      if (err) {
    return res.send('Error processing transfer. Amount: ' + amount + ', From: ' + fromAccount + ', To: ' + toAccount + '. Please try again.');      }
      
      return res.send(`Transfer of $${amount} scheduled for ${transferDate} at ${transferTime}`);
    });
    
  } else {
     // Show confirmation page first
    res.send(`
      <form action="/ConfirmTransfer" method="POST">
        <input type="hidden" name="amount" value="${amount}">
        <input type="hidden" name="fromAccount" value="${fromAccount}">
        <input type="hidden" name="toAccount" value="${toAccount}">
        <input type="hidden" name="toSubscriber" value="${toSubscriber}">
        
        <h3>Confirm Transfer</h3>
        <p>Amount: $${amount}</p>
        <p>From Account: ${fromAccount}</p>
        <p>To Account: ${toAccount}</p>
        
        <button type="submit">Finalize Transfer</button>
        <button type="button" onclick="history.back()">Cancel</button>
      </form>
    `);
  }
});

// Final confirmation route
app.post('/ConfirmTransfer', (req, res) => {
  const amount = Number(req.body.amount);
  const fromAccount = req.body.fromAccount;
  const toAccount = req.body.toAccount;
  const toSubscriber = req.body.toSubscriber;
  
  const sql = `INSERT INTO transactions (amount, from_account, to_account, to_subscriber, status) 
               VALUES (?, ?, ?, ?, 'completed')`;
  
  db.query(sql, [amount, fromAccount, toAccount, toSubscriber], (err, result) => {
    if (err) {
return res.send('Error processing transfer. Amount: ' + amount + ', From: ' + fromAccount + ', To: ' + toAccount + '. Please try again.');    }
    
    return res.send(`Transfer of $${amount} completed successfully`);
  });
});


//Server checks
app.use((req, res) => {
  res.status(404).send('Webpage not found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});