require("dotenv").config();

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');


const app = express();
const port = process.env.PORT||3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(cookieParser());


const db = mysql.createConnection({
 host: process.env.DB_HOST,
user: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
});


db.connect((err) => {
  if (err) {
    console.error("Connection Failed:", err);
  }
  else {
    console.log("Connected to LootDB");
  }
});

const crypto = require('crypto'); // For hashing passwords and sensitive data
//login route using tokens that checks user vs employee
app.post('/updatedLogin',(req,res) =>{
  const username = req.body.username;
  const hashPassword = crypto
    .createHash('sha256')
    .update(req.body.password)
    .digest('hex')

    const employeeSql = 'SELECT * FROM Employee WHERE eUsername = ?';
    db.query(employeeSql, [username], (err,employeeResult)=>{
      if (err) return res.status(500).send("Server Error");

      if(employeeResult.length > 0){
        const employee = employeeResult[0];
        if (employee.ePassword === hashPassword){
          const token = jwt.sign({id: employee.EmployeeID, username: employee.eUsername, role: 'employee'}, process.env.JWT_TOKEN, {expiresIn: '1h'});
          res.cookie('token', token, {httpOnly: true, secure: false});
          return res.redirect('/employeeDashboard');
        }
      }
      const userSql = 'SELECT * FROM SUBSCRIBER_ACCOUNT WHERE Username = ?';
      db.query(userSql, [username], (err, userResult)=>{
        if(err) return res.status(500).send("Server Error");

        if(userResult.length > 0){
          const user = userResult[0];
          if(user.Password === hashPassword){
            const token = jwt.sign({id: user.SubscriberID, username: user.Username, role: 'user'}, process.env.JWT_TOKEN, {expiresIn: '1h'});
            res.cookie('token',token,{httpOnly: true, secure: false});
            return res.redirect('/userDashboard');
          }
        }
        return res.status(401).send("Invalid username or password");
      });
    });
});
app.get('/employeeDashboard', authenticateToken, (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).send('Access denied.');
  }
  res.sendFile(__dirname + '/employeeDashboard.html');
});
app.get('/userDashboard', authenticateToken, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).send('Access denied.');
  }
  res.sendFile(__dirname + '/userDashboard.html'); // Create this file if needed
});
//create new employees
app.post('/employeeCreation', (req,res) =>{
  const eFName = req.body.eFName;
  const eLName = req.body.eLName;
  const eUsername = req.body.eUsername;
  const eBirthday = req.body.eBirthday;
  const employeeEmail = req.body.employeeEmail;
  const ePhone = req.body.ePhone;
  const hashPassword = crypto
  .createHash('sha256')
  .update(req.body.ePassword)
  .digest('hex')

  const sql = 'INSERT INTO Employee (eFName, eLName, eUsername, ePassword, eBirthday, employeeEmail, ePhone) VALUES(?,?,?,?,?,?,?)';
  db.query(sql, [eFName, eLName, eUsername, hashPassword, eBirthday, employeeEmail, ePhone], (err,result) => {
    if (err){
      console.error('Error Creating Employee', err);
      res.status(500).send('Error Creating Employee');
    }
    res.send('Employee successfully created');
  });
});
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
    res.redirect(`/MT-Dashboard.html?subscriberID=${subscriberID}`);
  });
});

//Route for adding external accounts to database
app.post('/externalAccount', (req, res) => {
  const bankName = req.body.bankName;
  const accountType = req.body.accountType;
  const currentBalance = req.body.currentBalance;
  const currency = req.body.currency;
  const syncStatus = req.body.syncStatus;
  const subscriberId = req.body.subscriberId;

  //const hashAccountNumber = crypto
  //.createHash('sha256')
  //.update(req.body.accountNumber)
  //.digest('hex');
  //const routingNumber = req.body.routingNumber;
  //const accountNickname = req.body.accountNickname;
const sql = 'INSERT INTO EXTERNAL_ACCOUNT (Bank, AccountType, currentBalance, currency, syncStatus, subscriberId) VALUES (?, ?, ?, ?, ?, ?)'; // Add more values as DB expands
  db.query(sql, [bankName, accountType, currentBalance, currency, syncStatus,subscriberId], (err, result) => {
    if (err) {
      console.error('Error connecting external account:', err);
      res.status(500).send('Error connecting external account');
      res.json({
      success: true,
      bankName,
      accountType,
      currentBalance,
      currency,
      syncStatus,
      subscriberId
    });
    }
    res.send('External account connected successfully!');
  });
});

//route to get category totals for specific month and year for given account id to fill category list and donut chart on frontend
app.get('/api/category-totals/:accountId', (req, res) => { //define route with accountId as parameter and month and year as query parameters to get category totals for specific month and year
  const accountId = req.params.accountId;
  const month = req.query.month;
  const year = req.query.year;

  //query to get total amount spent in each category for given account, month, and year. Groups by category and orders by total amount spent in descending order to show highest spending categories first
  const sql = `
    SELECT Category, SUM(Amount) AS Total
    FROM CARD_TRANSACTION
    WHERE AccountID = ?
      AND TransactionType = 'Debit'
      AND MONTH(TransactionDate) = ?
      AND YEAR(TransactionDate) = ?
    GROUP BY Category
    ORDER BY Total DESC
  `;

  db.query(sql, [accountId, month, year], (err, results) => { //execute query with accountId, month, and year as parameters to get category totals for specific month and year
    if (err) {
      console.error('Error fetching category totals:', err);
      return res.status(500).json({ error: 'Error fetching category totals' });
    }

    res.json(results); //return category totals as json to be used in frontend to fill donut chart and category list
  });
}); //end of route to get category totals for specific month and year for given account id for donut chart and category list

// route to get transactions data per category
app.get('/api/category-transactions/:accountId/:category', (req, res) => { //define route with accountId and category as parameters and month and year as query parameters to get transactions for specific category, month, and year
  const accountId = req.params.accountId;
  const category = req.params.category;
  const month = req.query.month;
  const year = req.query.year;

  //query to get transactions for given account, category, month, and year. Filters by accountId, category, transaction type (debit), month, and year. Orders by transaction date in descending order to show most recent transactions first
  const sql = `
    SELECT TransactionDate, MerchantName, Description, Amount
    FROM CARD_TRANSACTION
    WHERE AccountID = ?
      AND Category = ?
      AND TransactionType = 'Debit'
      AND MONTH(TransactionDate) = ?
      AND YEAR(TransactionDate) = ?
    ORDER BY TransactionDate DESC
  `;

  db.query(sql, [accountId, category, month, year], (err, results) => { //execute query with accountId, category, month, and year as parameters to get transactions for specific category, month, and year
    if (err) {
      console.error('Error fetching category transactions:', err);
      return res.status(500).json({ error: 'Error fetching category transactions' }); //send error response to frotnend
    }

    res.json(results); //if no error, send results as json back to frontend
  });
}); //end of route to get transactions data per category for transaction list
//schedule button from dashboard redirect 


//display information from external account for dashboard html
app.post('/displayExAcc',(req,res)=>{
 
  const subscriberID=req.query.subscriberID;

  const sql='Select accountID, bank, accountType,currentBalance,currency, subscriberID From EXTERNAL_ACCOUNT Where subscriberID= ?';
 db.query(sql, [subscriberID], (err, result) => {
    if (err) {
      console.error('Error connecting external account:', err);
      res.status(500).send('DB Error');
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

//display family accounts on Fam dashboard 
app.post('/displayFamAcc', (req, res) => {
  const subscriberID = req.query.subscriberID;

  const getUserFamSql = 'SELECT FamAccount FROM subscriber_account WHERE subscriberID = ?';
  db.query(getUserFamSql, [subscriberID], (err, userResult) => {
    if (err) {
      console.error('Error fetching user FamAccount:', err);
      return res.status(500).send('Database Error');
    }

    if (!userResult.length) {
      return res.send('No user found');
    }

    const famAccount = userResult[0].FamAccount;

    const getFamilyMemberSql = 'SELECT FName, LName, Username, subscriberID, FamAccount FROM subscriber_account WHERE FamAccount = ?';
    db.query(getFamilyMemberSql, [famAccount], (err, familyResults) => {
      if (err) {
        console.error('Error fetching family accounts:', err);
        return res.status(500).send('DB Error');
      }

      if (!familyResults.length) {
        return res.send('No family members found');
      }
   //html formatting for dashboard
     let html = '<div style="font-family: Arial, sans-serif;">';
     html='<h2> Family Dashboard</h2>'
html += '<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">';  

familyResults.forEach(member => {
    html += `<div style="border: 1px solid #ccc; padding: 10px; width: 300px; border-radius: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <p><strong>First Name:</strong> ${member.FName}</p>
        <p><strong>Last Name:</strong> ${member.LName}</p>
        <p><strong>Username:</strong> ${member.Username}</p>
        <p><strong>Family Account:</strong> ${member.FamAccount}</p>
    </div>`;
});

html += '</div>';
html += '</div>';

res.send(html);
    });
  });
});

//check user in db
app.get('/check-user', async (req, res) => {
    const { FName, LName, Username } = req.query;
    
    try {
        const result = await db.query(
            'SELECT * FROM subscriber_account WHERE FName = ? AND LName = ? AND Username = ?', 
            [FName, LName, Username]
        );
        
        res.json({ exists: result.length > 0 });
    } catch (error) {
        res.status(500).json({ exists: false, error: error.message });
    }
});

//add family member - checks ALL THREE fields match
app.post('/add-family-member', async (req, res) => {
    const { FName, LName, Username } = req.body;
    const subscriberID = req.query.subscriberID;
    
    try {
       
        const getUserFamSql = 'SELECT FamAccount FROM subscriber_account WHERE subscriberID = ?';
        
        db.query(getUserFamSql, [subscriberID], (err, userResult) => {
            if (err) {
                console.error('Error fetching user FamAccount:', err);
                return res.status(500).json({ success: false, message: 'Database Error' });
            }
            
            if (!userResult.length) {
                return res.status(400).json({ success: false, message: 'No user found' });
            }
            
            const familyAccountId = userResult[0].FamAccount;
            
            // CHECK that ALL THREE fields match (FName, LName, AND Username)
            const checkUserSql = 'SELECT * FROM subscriber_account WHERE FName = ? AND LName = ? AND Username = ?';
            db.query(checkUserSql, [FName, LName, Username], (err, existing) => {
                if (err) {
                    console.error('Error checking user:', err);
                    return res.status(500).json({ success: false, message: 'Database Error' });
                }
                
                if (!existing.length) {
                    return res.json({ 
                        success: false, 
                        message: 'User not found. First name, last name, and username do not match an existing account.' 
                    });
                }
                
                
                const updateSql = 'UPDATE subscriber_account SET FamAccount = ? WHERE FName = ? AND LName = ? AND Username = ?';
                db.query(updateSql, [familyAccountId, FName, LName, Username], (err, result) => {
                    if (err) {
                        console.error('Error updating family member:', err);
                        return res.status(500).json({ success: false, message: 'Database Error' });
                    }
                    
                    res.json({ 
                        success: true, 
                        message: `${FName} ${LName} (${Username}) has been linked to your family plan!`,
                        famAccount: familyAccountId 
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error adding family member:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// Add family goal to DB
app.post('/add-goal', (req, res) => {
  const goalName = req.body.GName;
  const goalDescription = req.body.Description;
  const goalAmount = req.body.Goal;
  const currentAmount = 0;
  const status = "in progress"; // Automatically set status
  
  const subscriberId = req.body.subscriberID;
  
  
  if (!goalName || !goalAmount) {
    return res.status(400).json({ 
      success: false, 
      message: 'Goal name and amount are required' 
    });
  }
  
  // get the FamAccount based on SubscriberID
  const getFamAccountSql = 'SELECT FamAccount FROM lootdb.Subscriber_ACCOUNT WHERE SubscriberID = ?';
  
  db.query(getFamAccountSql, [subscriberId], (err, results) => {
    if (err) {
      console.error('Error fetching FamAccount:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error retrieving user information' 
      });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const famAccount = results[0].FamAccount;
    

    const insertGoalSql = 'INSERT INTO lootdb.Family_Goal (GName, Description, Goal, CurrAmt, FamAccount, Status) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.query(insertGoalSql, [goalName, goalDescription, goalAmount, currentAmount, famAccount, status], (err, result) => {
      if (err) {
        console.error('Error inserting goal:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error adding goal to plan: ' + err.message 
        });
      }
     
      res.json({ 
        success: true, 
        message: 'Goal successfully added to your plan!',
        goalId: result.insertId,
        status: status
      });
    });
  });
});


//get family goals from DB
app.get('/get-family-goals', (req, res) => {
    const subscriberID = req.query.subscriberID; 
    
    // get famAccount from subscriberID
    const getFamSql = 'SELECT FamAccount FROM lootdb.Subscriber_ACCOUNT WHERE SubscriberID = ?';
    
    db.query(getFamSql, [subscriberID], (err, results) => {
        if (err) {
            console.error('Error fetching FamAccount:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const famAccount = results[0].FamAccount;
        
        //get goals for this family account
        const goalsQuery = 'SELECT * FROM lootdb.Family_Goal WHERE FamAccount = ? ORDER BY GoalID DESC';
        
        db.query(goalsQuery, [famAccount], (err, goalResults) => {
            if (err) {
                console.error('Error fetching goals:', err);
                return res.status(500).json({ success: false, message: 'Error fetching goals' });
            }
            
            res.json({ success: true, goals: goalResults });
        });
    });
});

app.get('/getExternalAccountsJSON', (req, res) => {
    const subscriberID = req.query.subscriberID;
    
    console.log('Fetching accounts for subscriber:', subscriberID);
    
    const sql = 'SELECT accountID, bank, accountType, currentBalance, currency FROM EXTERNAL_ACCOUNT WHERE subscriberID = ?';
    
    db.query(sql, [subscriberID], (err, result) => {
        if (err) {
            console.error('Error fetching external accounts:', err);
            return res.status(500).json({ error: 'Database error', accounts: [] });
        }
        
        console.log('Found accounts:', result.length);
        res.json(result);
    });
});

// contribute to goal
app.post('/contribute-to-goal', (req, res) => {
    const { goalId, subscriberID, accountID, amount } = req.body;
    
    console.log('=== CONTRIBUTION DEBUG ===');
    console.log('goalId:', goalId, 'Type:', typeof goalId);
    console.log('subscriberID:', subscriberID);
    console.log('accountID:', accountID);
    console.log('amount:', amount);
    
    // First, check if the goal exists and see the table structure
    const checkGoalSql = 'SELECT * FROM FAMILY_GOAL WHERE GoalID = ?';
    
    db.query(checkGoalSql, [goalId], (err, goalResult) => {
        if (err) {
            console.error('Error checking goal:', err);
            return res.json({ success: false, message: 'Database error: ' + err.message });
        }
        
        console.log('Goal query result:', goalResult);
        
        if (!goalResult || goalResult.length === 0) {
            return res.json({ success: false, message: 'Goal not found with ID: ' + goalId });
        }
        
        console.log('Current goal amount:', goalResult[0].CurrAmt);
        console.log('Goal target:', goalResult[0].Goal);
        
        // Now check the external account
        const checkAccountSql = 'SELECT * FROM EXTERNAL_ACCOUNT WHERE accountID = ? AND subscriberID = ?';
        
        db.query(checkAccountSql, [accountID, subscriberID], (err, accountResult) => {
            if (err) {
                console.error('Error checking account:', err);
                return res.json({ success: false, message: 'Account error: ' + err.message });
            }
            
            console.log('Account query result:', accountResult);
            
            if (!accountResult || accountResult.length === 0) {
                return res.json({ success: false, message: 'Account not found for subscriber' });
            }
            
            if (accountResult[0].currentBalance < amount) {
                return res.json({ success: false, message: 'Insufficient balance' });
            }
            
            // Try to update the goal
            const updateGoalSql = 'UPDATE FAMILY_GOAL SET CurrAmt = CurrAmt + ? WHERE GoalID = ?';
            console.log('Update SQL:', updateGoalSql);
            console.log('Update values:', [amount, goalId]);
            
            db.query(updateGoalSql, [amount, goalId], (err, updateResult) => {
                if (err) {
                    console.error('ERROR UPDATING GOAL:', err);
                    console.error('Error code:', err.code);
                    console.error('Error message:', err.message);
                    console.error('SQL state:', err.sqlState);
                    return res.json({ success: false, message: 'Update failed: ' + err.message });
                }
                
                console.log('Update result:', updateResult);
                
                if (updateResult.affectedRows === 0) {
                    return res.json({ success: false, message: 'No rows updated - goal might not exist' });
                }
                
                // Deduct from account
                const deductSql = 'UPDATE EXTERNAL_ACCOUNT SET currentBalance = currentBalance - ? WHERE accountID = ?';
                
                db.query(deductSql, [amount, accountID], (err, deductResult) => {
                    if (err) {
                        console.error('Error deducting:', err);
                        return res.json({ success: false, message: 'Failed to update account: ' + err.message });
                    }
                    
                    console.log('Contribution successful!');
                    res.json({ success: true, message: 'Contribution successful!' });
                });
            });
        });
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
          res.send('deduct err: ',err);
        });
      }

      const addSql = 'UPDATE external_account SET CurrentBalance = CurrentBalance + ? WHERE AccountID = ?';
      db.query(addSql, [amount, toAccount], (err, addResult) => {
        if (err) {
          return db.rollback(() => {
            res.send('Add err: ',err);
          });
        }

        const transactionSql = `INSERT INTO scheduled_transfers (amount, from_account, to_account, status) 
                               VALUES (?, ?, ?, 'completed')`;
        
        db.query(transactionSql, [amount, fromAccount, toAccount], (err, transactionResult) => {
          if (err) {
            return db.rollback(() => {
              res.send('Insert err: ', err);
            });
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.send('Error committing try again.');
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


//Route to insert customer service form into database
app.post('/submitForm', (req,res)=>{
  const customerName = req.body.customerName;
  const customerEmail = req.body.customerEmail;
  const employeeID = req.body.employeeID;
  const subject = req.body.subject;
  const priority = req.body.priority;
  const description = req.body.description;

  const sql = 'INSERT INTO SERVICE_FORMS (customerName, customerEmail, employeeID, subject, priority, description) VALUES (?,?,?,?,?,?)';
  db.query(sql, [customerName, customerEmail, employeeID, subject, priority, description], (err, result) =>{
    if(err){
      console.error('Error submitting form:',err);
      res.status(500).send('Error submitting form');
    }
    res.send('Form successfully submitted');
  });
});
//route to retrieve form
app.post('/retrieveForm',(req,res)=>{
  const formID = req.body.formID;
  const sql = 'SELECT * FROM SERVICE_FORMS WHERE formID = ?';
  db.query(sql, [formID], (err,result) =>{
    if (err){
      console.error('Error retrieving form:', err);
      res.status(500).send('Error retrieving form');
    }
    if (result.length === 0) return res.status(404).send('User not found');
    const form = result[0];
    res.send(form);
  })
})
//route to submit review form
app.post('/reviewForm', (req,res)=>{
  const formID = req.body.formID;
  const customerName = req.body.customerName;
  const customerEmail = req.body.customerEmail;
  const employeeID = req.body.employeeID;
  const subject = req.body.subject;
  const priority = req.body.priority;
  const description = req.body.description;
  const comments = req.body.Comments;

  const sql = 'INSERT INTO CLOSED_FORMS (formID,customerName,customerEmail,EmployeeID,subject,priority,description,commments) VALUES(?,?,?,?,?,?,?,?)';
  db.query(sql, [formID,customerName,customerEmail,employeeID,subject,priority,description,comments],(err,result)=>{
      if(err){
        console.error('Error submitting review:', err);
        res.status(500).send('Error submitting review');
      }
      const deleteSql = 'DELETE FROM SERVICE_FORMS WHERE formID = ?';
      db.query(deleteSql, [formID], (err, deleteResult) => {
        if(err){
          console.error('Error deleting original form:', err);
          return res.status(500).send('Review submitted but error deleting original form');
        }
      res.send('Review submitted successfully');
      });
  });
});
//Route to change user data
app.post('/retrieveUser', (req, res) => {
  const username = req.body.username;

  if (!username) return res.status(400).send('Missing Username');

  const sql = 'SELECT SubscriberID, FName, LName, Username, Birthday, Email, PhoneNumber FROM SUBSCRIBER_ACCOUNT WHERE Username = ?';
  db.query(sql,[username],(err,result) =>{
    if (err) return res.status(500).send('Server Error');
    if (result.length === 0) return res.status(404).send('User not found');
    const user = result[0];
    res.send(user);
  })
});
app.post('/updateUser', (req,res)=>{
  const SubscriberID = req.body.SubscriberID;
  const FName = req.body.FName;
  const LName = req.body.LName;
  const Username = req.body.Username;
  const Email = req.body.Email;
  const PhoneNumber = req.body.PhoneNumber;
  const Birthday = req.body.Birthday;

  const sql = 'UPDATE SUBSCRIBER_ACCOUNT SET FName = ?, LName = ?, Username = ?, Email = ?, PhoneNumber = ?, Birthday = ? WHERE SubscriberID = ?';
  db.query(sql,[FName,LName,Username,Email,PhoneNumber,Birthday, SubscriberID], (err,result)=>{
    if(err) return res.status(500).send('Update Failed');
    if (result.affectedRows === 0) return res.status(404).send('User not found');
    res.send('Updated Successfully');
  });
});

app.post('/create-budget', (req, res) => {
  const amount = req.body.amount;
  const ExpenseType = req.body.ExpenseType;
  const category = req.body.category;
  const DateRecorded = req.body.DateRecorded;
  const subscriberId = req.body.subscriberId;
  const accountId = req.body.accountId;
  
const sql = 'INSERT INTO Budgeting (amount, ExpenseType, category, dateRecorded, subscriberId, accountId) VALUES (?, ?, ?, ?, ?, ?)'; // Add more values as DB expands
  db.query(sql, [amount, ExpenseType, category, DateRecorded, subscriberId, accountId], (err, result) => {
    if (err) {
      console.error('Error making new budget:', err);
      res.status(500).send('Error creating new budget');
    }
    res.json({
      success: true,
      amount,
      ExpenseType,
      category,
      DateRecorded,
      subscriberId,
      accountId
    });

  });
});

app.post('/add-goal', (req, res) => {
    const { GName, Description, Goal, CurrAmt, status } = req.body;
    
    // Validate input
    if (!GName || !Goal || !CurrAmt || !status) {
        return res.status(400).send('All required fields must be filled');
    }
    
    // Insert query (AmtLeft auto-calculated by database)
    const query = `INSERT INTO Family_Goal (GName, Description, Goal, CurrAmt, status) 
                   VALUES (?, ?, ?, ?, ?)`;
    
    db.query(query, [GName, Description || '', Goal, CurrAmt, status], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).send('Database error: ' + err.message);
        }
        
        // Get the inserted record with calculated AmtLeft
        const selectQuery = `SELECT * FROM Family_Goal WHERE GoalID = ?`;
        db.query(selectQuery, [result.insertId], (err, rows) => {
            if (err) {
                console.error('Error fetching inserted record:', err);
                return res.send(`
                    <h2>Goal Added Successfully!</h2>
                    <p>Goal ID: ${result.insertId}</p>
                    <a href="/">Add Another Goal</a><br>
                    <a href="/view-goals">View All Goals</a>
                `);
            }
            
            const goal = rows[0];
            // Send success page
            res.send(`Goal Created!`);
           });
    });
});
// Save or update alert settings
app.post('/api/alerts/save', (req, res) => {
  const { subscriberID, threshold } = req.body;

  if (!subscriberID || threshold === undefined || threshold === null || threshold === '') {
    return res.status(400).json({ error: 'subscriberID and threshold are required' });
  }

  const sql = `
    INSERT INTO USER_ALERT_SETTINGS (SubscriberID, AlertThreshold, AlertsEnabled)
    VALUES (?, ?, TRUE)
    ON DUPLICATE KEY UPDATE
      AlertThreshold = VALUES(AlertThreshold),
      AlertsEnabled = TRUE
  `;

  db.query(sql, [subscriberID, threshold], (err, result) => {
    if (err) {
      console.error('Error saving alert settings:', err);
      return res.status(500).json({ error: 'Error saving alert settings' });
    }

    res.json({ success: true, message: 'Alert settings saved' });
  });
});

// Get pending alerts for a subscriber
app.get('/api/alerts/:subscriberID', (req, res) => {
  const subscriberID = req.params.subscriberID;

  const sql = `
    SELECT 
      ct.TransactionID,
      ct.Amount,
      ct.MerchantName,
      ct.Description,
      ct.TransactionDate,
      ct.Category,
      ct.TransactionType,
      ct.Status
    FROM CARD_TRANSACTION ct
    JOIN EXTERNAL_ACCOUNT ea ON ct.AccountID = ea.AccountID
    WHERE ea.SubscriberID = ?
      AND ct.Status = 'Pending'
    ORDER BY ct.TransactionDate DESC
  `;

  db.query(sql, [subscriberID], (err, results) => {
    if (err) {
      console.error('Error fetching alerts:', err);
      return res.status(500).json({ error: 'Error fetching alerts' });
    }

    res.json(results);
  });
});

// accept transaction and update status to approved
app.post('/api/alerts/accept', (req, res) => {
  const { transactionID } = req.body;

  if (!transactionID) {
    return res.status(400).json({ error: 'transactionID is required' });
  }

  const sql = `
    UPDATE CARD_TRANSACTION
    SET Status = 'Approved'
    WHERE TransactionID = ?
  `;

  db.query(sql, [transactionID], (err, result) => {
    if (err) {
      console.error('Error approving transaction:', err);
      return res.status(500).json({ error: 'Error approving transaction' });
    }

    res.json({ success: true, message: 'Transaction approved' });
  });
});

// decline transaction
app.post('/api/alerts/decline', (req, res) => {
  const { transactionID } = req.body;

  if (!transactionID) {
    return res.status(400).json({ error: 'transactionID is required' });
  }

  const sql = `
    UPDATE CARD_TRANSACTION
    SET Status = 'Declined'
    WHERE TransactionID = ?
  `;

  db.query(sql, [transactionID], (err, result) => {
    if (err) {
      console.error('Error declining transaction:', err);
      return res.status(500).json({ error: 'Error declining transaction' });
    }

    res.json({ success: true, message: 'Transaction declined' });
  });
});

// simulate transaction for demo purposes
app.post('/api/transactions/simulate', (req, res) => {
  const { accountID, amount } = req.body;

  if (!accountID || !amount) {
    return res.status(400).json({ error: 'accountID and amount are required' });
  }

  const getSubscriberSql = `
    SELECT SubscriberID
    FROM EXTERNAL_ACCOUNT
    WHERE AccountID = ?
  `;

  db.query(getSubscriberSql, [accountID], (err, accountResults) => {
    if (err) {
      console.error('Error finding account:', err);
      return res.status(500).json({ error: 'Error finding account' });
    }

    if (accountResults.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const subscriberID = accountResults[0].SubscriberID;

    const settingsSql = `
      SELECT AlertThreshold, AlertsEnabled
      FROM USER_ALERT_SETTINGS
      WHERE SubscriberID = ?
    `;

    db.query(settingsSql, [subscriberID], (err, settingsResults) => {
      if (err) {
        console.error('Error fetching alert settings:', err);
        return res.status(500).json({ error: 'Error fetching alert settings' });
      }

      let status = 'Approved';

      if (settingsResults.length > 0) {
        const settings = settingsResults[0];

        if (
          settings.AlertsEnabled &&
          settings.AlertThreshold !== null &&
          Number(amount) > Number(settings.AlertThreshold)
        ) {
          status = 'Pending';
        }
      }

      const insertSql = `
        INSERT INTO CARD_TRANSACTION
        (AccountID, Amount, TransactionDate, MerchantName, Description, Category, TransactionType, Status)
        VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [
          accountID,
          amount,
          'Demo Merchant',
          'Simulated transaction',
          'Personal',
          'Debit',
          status
        ],
        (err, result) => {
          if (err) {
            console.error('Error simulating transaction:', err);
            return res.status(500).json({ error: 'Error simulating transaction' });
          }

          res.json({
            success: true,
            message:
              status === 'Pending'
                ? 'Simulated transaction created and alert triggered'
                : 'Simulated transaction created below threshold',
            status
          });
        }
      );
    });
  });
});

//Server checks
app.use((req, res) => {
  res.status(404).send('Webpage not found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Add this route to create a test employee with proper hash
app.get('/setup-test-user', (req, res) => {
  const testPassword = 'test123';
  const hashPassword = crypto
    .createHash('sha256')
    .update(testPassword)
    .digest('hex');
  
  console.log('Creating test user with hash:', hashPassword);
  //Delete later
  // First, check if test user exists
  const checkSql = 'SELECT * FROM Employee WHERE eUsername = ?';
  db.query(checkSql, ['testuser123'], (err, results) => {
    if (err) {
      console.error('Error checking user:', err);
      return res.send('Error checking database: ' + err.message);
    }
    
    console.log('Check results:', results);
    
    if (results && results.length > 0) {
      // Update existing user
      const updateSql = 'UPDATE Employee SET ePassword = ? WHERE eUsername = ?';
      db.query(updateSql, [hashPassword, 'testuser123'], (err, updateResult) => {
        if (err) {
          console.error('Error updating:', err);
          res.send('Error updating: ' + err.message);
        } else {
          res.send(`
            <h2>Test User Updated!</h2>
            <p><strong>Username:</strong> testuser123</p>
            <p><strong>Password:</strong> test123</p>
            <p><strong>Password Hash:</strong> ${hashPassword}</p>
            <p><strong>Role:</strong> employee</p>
            <br>
            <a href="/login.html">Click here to login</a>
          `);
        }
      });
    } else {
      // Create new user - FIXED: Correct SQL syntax
      const insertSql = `INSERT INTO Employee (eFName, eLName, eUsername, ePassword, eBirthday, employeeEmail, ePhone) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const values = ['Test', 'User', 'testuser123', hashPassword, '1990-01-01', 'test@test.com', '1234567890'];
      
      console.log('Attempting to insert with values:', values);
      
      db.query(insertSql, values, (err, result) => {
        if (err) {
          console.error('Error creating user:', err);
          res.send(`
            <h2>Error Creating Test User</h2>
            <p>Error: ${err.message}</p>
            <p>Please check that:</p>
            <ul>
              <li>The Employee table exists</li>
              <li>All column names are correct: eFName, eLName, eUsername, ePassword, eBirthday, employeeEmail, ePhone</li>
              <li>Data types match the table schema</li>
            </ul>
          `);
        } else {
          console.log('User created successfully, ID:', result.insertId);
          res.send(`
            <h2>Test User Created Successfully!</h2>
            <p><strong>Username:</strong> testuser123</p>
            <p><strong>Password:</strong> test123</p>
            <p><strong>Password Hash:</strong> ${hashPassword}</p>
            <p><strong>Role:</strong> employee</p>
            <p><strong>Employee ID:</strong> ${result.insertId}</p>
            <br>
            <a href="/login.html">Click here to login</a>
          `);
        }
      });
    }
  });
});
//functions
function authenticateToken(req, res, next) {
  const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  if (!token) return res.status(401).send('Access Token Required');
  jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
    if (err) return res.status(403).send('Invalid Token');
    req.user = user;
    next();
  });
}