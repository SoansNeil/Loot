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

//verify login
app.post('/login',(req,res)=>{
const username=req.body.username;
const password=req.body.password;

const hashPassword = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

    const sql = 'SELECT subscriberID FROM SUBSCRIBER_ACCOUNT WHERE username = ? AND password = ?';
  
  db.query(sql, [username, hashPassword], (err, results) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).send('Database error');
    }
    
    if (results.length === 0) {
      return res.send('Invalid username or password');
    }
    const subscriberID = results[0].subscriberID;
    res.redirect(`/Dashboard.html?subscriberID=${subscriberID}`);
  });
})


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
 
  const subscriberID=req.query.subscriberID;

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
          <a href="Money-Transfer.html?accountID=${account.accountID}&currency=${account.currency}&balance=${account.currentBalance}&subscriberID=${subscriberID}">
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
  const subscriberID = req.body.subscriberID;
  const accountID = req.body.AccountID;
  const balance=req.body.Balance;

  const toAccount=req.body.ToAccount;

  const sql='Select accountID, subscriberID From EXTERNAL_ACCOUNT Where subscriberID= ? AND accountID=?';
 db.query(sql, [subscriberID,toAccount], (err, result) => {
    if (err) {
      console.error('Error checking Account ID:', err);
      res.status(500).send('BD Error');
    }
 
     if (!result.length) {
      return res.send('The AccountID you have entered does not match any accounts in your subscription. Please try again.');
     }    
    // Pass the account ID in the URL along with other parameters
    res.redirect(`/MT-SelectAmount.html?accountID=${accountID}&toAccount=${toAccount}&balance=${balance}&subscriberID=${subscriberID}`);
  });
});

  //Store transfer Amount
  app.post('/StoreAmount', (req, res) => {
  const transferAmount = Number( req.body.Tamount);
  const balance = Number(req.body.balance);

  //make sure these are passed from url
   const accountID = req.body.accountID ;
  const toAccount = req.body.toAccount ;
  const subscriberID = req.body.subscriberID; 
  
  if (transferAmount > balance) {
     return res.send(`The amount you want to transfer(${transferAmount}) exceeds the amount of money you have in your account balance(${balance}). Please adjust the amount and try again.`);
  } 
  else{ 
  // return res.send(`${transferAmount} and ${balance}`)
    res.redirect(`/MT-Date&Time.html?amount=${transferAmount}&accountID=${accountID}&toAccount=${toAccount}&subscriberID=${subscriberID}`);
  }

    });

    //schedule now and ahead features
   app.post('/StoreSchedule', (req, res) => {
  const amount = Number(req.body.amount);
  const fromAccount = req.body.fromAccount;
  const toAccount = req.body.toAccount;
  const scheduleType = req.body.scheduleType;
  
  //future time and date
  let transferDate = req.body.transferDate;
  const transferTime = req.body.transferTime;

  if (scheduleType === 'later') {
    if (!transferDate || !transferTime) {
      return res.send('Please select both date and time for future transfer');
    }
    
    // make sure date is in the right format
    if (transferDate.includes('T')) {
      transferDate = transferDate.split('T')[0];
    }
    if (transferDate.includes(' ')) {
      transferDate = transferDate.split(' ')[0];
    }
    
    const sql = `INSERT INTO scheduled_transfers 
                 (amount, from_account, to_account, schedule_type, transfer_date, transfer_time, status) 
                 VALUES (?, ?, ?, ?, ?, ?, 'pending')`;
    
    db.query(sql, [amount, fromAccount, toAccount, scheduleType, transferDate, transferTime], (err, result) => {
      if (err) {
        console.error('Error scheduling transfer:', err);
        return res.send('Error processing transfer. Please try again.');      
      }
      
      return res.send(`Transfer of $${amount} scheduled for ${transferDate} at ${transferTime} <a href="/Dashboard.html?subscriberID=${req.body.subscriberID}">
        <button>Return to Dashboard</button>
         </a>`);
    });
    
  } else {
    // Show confirmation page first
    res.send(`
      <form action="/ConfirmTransfer" method="POST">
        <input type="hidden" name="amount" value="${amount}">
        <input type="hidden" name="fromAccount" value="${fromAccount}">
        <input type="hidden" name="toAccount" value="${toAccount}">
        <input type="hidden" name="subscriberID" value="${req.body.subscriberID}">
        
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
    

app.post('/ConfirmTransfer', (req, res) => {
  const amount = Number(req.body.amount);
  const fromAccount = req.body.fromAccount;
  const toAccount = req.body.toAccount;

  db.beginTransaction((err) => {
    if (err) {
      return res.send('Error processing transfer. Please try again.');
    }
    
    const deductSql = 'UPDATE external_account SET CurrentBalance = CurrentBalance - ? WHERE AccountID = ?';
    db.query(deductSql, [amount, fromAccount], (err, deductResult) => {
      if (err) {
        return db.rollback(() => {
          res.send('Error processing transfer. Amount: ' + amount + ', From: ' + fromAccount + ', To: ' + toAccount + '. Please try again.');
        });
      }

      const addSql = 'UPDATE external_account SET CurrentBalance = CurrentBalance + ? WHERE AccountID = ?';
      db.query(addSql, [amount, toAccount], (err, addResult) => {
        if (err) {
          return db.rollback(() => {
            res.send('Error processing transfer. Amount: ' + amount + ', From: ' + fromAccount + ', To: ' + toAccount + '. Please try again.');
          });
        }

        const transactionSql = `INSERT INTO scheduled_transfers (amount, from_account, to_account, status) 
                               VALUES (?, ?, ?, 'completed')`;
        
        db.query(transactionSql, [amount, fromAccount, toAccount], (err, transactionResult) => {
          if (err) {
            return db.rollback(() => {
              res.send('Error processing transfer. Amount: ' + amount + ', From: ' + fromAccount + ', To: ' + toAccount + '. Please try again.');
            });
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.send('Error processing transfer. Amount: ' + amount + ', From: ' + fromAccount + ', To: ' + toAccount + '. Please try again.');
              });
            }
            
            return res.send(`Transfer of $${amount} completed successfully!<a href="/Dashboard.html?subscriberID=${req.body.subscriberID}">
        <button>Return to Dashboard</button>
         </a>`);
          });
        });
      });
    });
  });
});
const schedule = require('node-schedule');

// Check for due transfers continuously 
schedule.scheduleJob('* * * * *', function() {
  const now = new Date();
  
  // Get current date in YYYY-MM-DD format
  const currentDate = now.toLocaleDateString('en-CA');
  
  // Get current time in HH:MM format
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                     now.getMinutes().toString().padStart(2, '0');
  
  const findSql = `SELECT * FROM scheduled_transfers 
                   WHERE status = 'pending' 
                   AND transfer_date = ? 
                   AND transfer_time <= ?`;
  
  db.query(findSql, [currentDate, currentTime], (err, transfers) => {
    if (err) {
      console.log('Scheduler error:', err);
      return;
    }
    
    if (!transfers || transfers.length === 0) {
      return;
    }
    
    transfers.forEach(transfer => {
      
      db.beginTransaction(err => {
        if (err) {
          console.log('Transaction error:', err);
          return;
        }
        
        // subtract amount from account in DB
        db.query('UPDATE external_account SET CurrentBalance = CurrentBalance - ? WHERE AccountID = ? AND CurrentBalance >= ?', 
                [transfer.amount, transfer.from_account, transfer.amount], (err, result) => {
          if (err || result.affectedRows === 0) {
            db.query('UPDATE scheduled_transfers SET status = "failed" WHERE id = ?', [transfer.id]);
            return db.rollback();
          }
          
          // Add amount toAccount in DB
          db.query('UPDATE external_account SET CurrentBalance = CurrentBalance + ? WHERE AccountID = ?', 
                  [transfer.amount, transfer.to_account], err => {
            if (err) {
              db.query('UPDATE scheduled_transfers SET status = "failed" WHERE id = ?', [transfer.id]);
              return db.rollback();
            }

        db.query('UPDATE scheduled_transfers SET status = "completed" WHERE id = ?', 
        [transfer.id], err => {
              if (err) {
                console.log('Status update failed:', err);
                return db.rollback();
              }
              db.commit();
              console.log('Transfer completed:', transfer.id);
            });
          });
        });
      });
    });
  });
});

// see transfers and why they keep failing ):< 
app.get('/debug-transfers', (req, res) => {
  const sql = 'SELECT * FROM scheduled_transfers ORDER BY id DESC LIMIT 10';
  db.query(sql, (err, transfers) => {
    if (err) {
      return res.send('Database error: ' + err);
    }
    
    let html = '<h2>Scheduled Transfers Debug</h2>';
    html += '<tr><th>ID</th><th>Amount</th><th>From</th><th>To</th><th>Date</th><th>Time</th><th>Status</th></tr>';
    
    transfers.forEach(t => {
      html += `<tr>
        <td>${t.id}</td>
        <td>$${t.amount}</td>
        <td>${t.from_account}</td>
        <td>${t.to_account}</td>
        <td>${t.transfer_date}</td>
        <td>${t.transfer_time}</td>
        <td>${t.status}</td>
      </tr>`;
    });
    html += '</table>';
    
    // Also show current server time ):<
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-CA');
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    html += `<p><strong>Current server time:</strong> ${currentDate} ${currentTime}</p>`;
    html += '<p><strong>Note:</strong> Transfers execute when current time matches or exceeds scheduled time</p>';
    
    res.send(html);
  });
});


//Server checks
app.use((req, res) => {
  res.status(404).send('Webpage not found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});