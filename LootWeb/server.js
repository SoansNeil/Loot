require("dotenv").config();

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const schedule = require('node-schedule');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(cookieParser());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Connection Failed:", err);
  } else {
    console.log("Connected to LootDB");
    connection.release();
  }
});

// ── Auth ─────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
  const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  if (!token) return res.status(401).send('Access Token Required');
  jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
    if (err) return res.status(403).send('Invalid Token');
    req.user = user;
    next();
  });
}

// ── Login ────────────────────────────────────────────────────

app.post('/updatedLogin', (req, res) => {
  const username = req.body.username;
  const hashPassword = crypto.createHash('sha256').update(req.body.password).digest('hex');

  const employeeSql = 'SELECT * FROM Employee WHERE eUsername = ?';
  db.query(employeeSql, [username], (err, employeeResult) => {
    if (err) return res.status(500).send("Server Error");

    if (employeeResult.length > 0) {
      const employee = employeeResult[0];
      if (employee.ePassword === hashPassword) {
        const token = jwt.sign({ id: employee.EmployeeID, username: employee.eUsername, role: 'employee' }, process.env.JWT_TOKEN, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
        return res.redirect('/employeeDashboard');
      }
    }

    const userSql = 'SELECT * FROM SUBSCRIBER_ACCOUNT WHERE Username = ?';
    db.query(userSql, [username], (err, userResult) => {
      if (err) return res.status(500).send("Server Error");

      if (userResult.length > 0) {
        const user = userResult[0];
        if (user.Password === hashPassword) {
          const token = jwt.sign({ id: user.SubscriberID, username: user.Username, role: 'user' }, process.env.JWT_TOKEN, { expiresIn: '1h' });
          res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
          return res.redirect('/userDashboard');
        }
      }
      return res.status(401).send("Invalid username or password");
    });
  });
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  const hashPassword = crypto.createHash('sha256').update(req.body.password).digest('hex');

  const sql = 'SELECT subscriberID FROM SUBSCRIBER_ACCOUNT WHERE username = ? AND password = ?';
  db.query(sql, [username, hashPassword], (err, results) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).send('Database error');
    }
    if (results.length === 0) return res.send('Invalid username or password');

    const subscriberID = results[0].subscriberID;
    res.redirect(`/Dashboard.html?subscriberID=${subscriberID}`);
  });
});

// ── Current User ─────────────────────────────────────────────

app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// ── Dashboard Routes ─────────────────────────────────────────

app.get('/employeeDashboard', authenticateToken, (req, res) => {
  if (req.user.role !== 'employee') return res.status(403).send('Access denied.');
  res.sendFile(__dirname + '/employeeDashboard.html');
});

app.get('/userDashboard', authenticateToken, (req, res) => {
  if (req.user.role !== 'user') return res.status(403).send('Access denied.');
  res.sendFile(__dirname + '/userDashboard.html');
});

// ── Users ────────────────────────────────────────────────────

app.post('/createUser-form', (req, res) => {
  const { firstName, lastName, username, birthday, email, phoneNumber } = req.body;
  const hashPassword = crypto.createHash('sha256').update(req.body.password).digest('hex');

  const sql = 'INSERT INTO SUBSCRIBER_ACCOUNT (FName, LName, Username, Password, Birthday, Email, PhoneNumber) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [firstName, lastName, username, hashPassword, birthday, email, phoneNumber], (err) => {
    if (err) {
      console.error('Error inserting user:', err);
      return res.status(500).send('Error inserting user');
    }
    res.send('Thank you for joining us!');
  });
});

app.post('/employeeCreation', (req, res) => {
  const { eFName, eLName, eUsername, eBirthday, employeeEmail, ePhone } = req.body;
  const hashPassword = crypto.createHash('sha256').update(req.body.ePassword).digest('hex');

  const sql = 'INSERT INTO Employee (eFName, eLName, eUsername, ePassword, eBirthday, employeeEmail, ePhone) VALUES(?,?,?,?,?,?,?)';
  db.query(sql, [eFName, eLName, eUsername, hashPassword, eBirthday, employeeEmail, ePhone], (err) => {
    if (err) {
      console.error('Error Creating Employee', err);
      return res.status(500).send('Error Creating Employee');
    }
    res.send('Employee successfully created');
  });
});

app.post('/retrieveUser', (req, res) => {
  const username = req.body.username;
  if (!username) return res.status(400).send('Missing Username');

  const sql = 'SELECT SubscriberID, FName, LName, Username, Birthday, Email, PhoneNumber FROM SUBSCRIBER_ACCOUNT WHERE Username = ?';
  db.query(sql, [username], (err, result) => {
    if (err) return res.status(500).send('Server Error');
    if (result.length === 0) return res.status(404).send('User not found');
    res.send(result[0]);
  });
});

app.post('/updateUser', (req, res) => {
  const { SubscriberID, FName, LName, Username, Email, PhoneNumber, Birthday } = req.body;

  const sql = 'UPDATE SUBSCRIBER_ACCOUNT SET FName = ?, LName = ?, Username = ?, Email = ?, PhoneNumber = ?, Birthday = ? WHERE SubscriberID = ?';
  db.query(sql, [FName, LName, Username, Email, PhoneNumber, Birthday, SubscriberID], (err, result) => {
    if (err) return res.status(500).send('Update Failed');
    if (result.affectedRows === 0) return res.status(404).send('User not found');
    res.send('Updated Successfully');
  });
});

// ── External Accounts ────────────────────────────────────────

app.post('/externalAccount', (req, res) => {
  const { bankName, accountType, currentBalance, currency, syncStatus, subscriberId } = req.body;

  const sql = 'INSERT INTO EXTERNAL_ACCOUNT (Bank, AccountType, currentBalance, currency, syncStatus, subscriberId) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sql, [bankName, accountType, currentBalance, currency, syncStatus, subscriberId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error adding account");
    }
    res.send("OK");
  });
});

app.post('/displayExAcc', (req, res) => {
  const subscriberID = req.query.subscriberID;

  const sql = 'SELECT accountID, bank, accountType, currentBalance, currency, subscriberID FROM EXTERNAL_ACCOUNT WHERE subscriberID = ?';
  db.query(sql, [subscriberID], (err, result) => {
    if (err) {
      console.error('Error fetching external accounts:', err);
      return res.status(500).send('DB Error');
    }
    if (!result.length) return res.send('No accounts found');

    let html = '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
    result.forEach(account => {
      html += `
        <div style="border:1px solid #ccc; padding:10px; margin:10px; width:300px; border-radius:8px;">
          <p><strong>AccountID:</strong> ${account.accountID}</p>
          <p><strong>Bank:</strong> ${account.bank}</p>
          <p><strong>Account Type:</strong> ${account.accountType}</p>
          <p><strong>Current Balance:</strong> ${account.currency} ${account.currentBalance}</p>
          <a href="Money-Transfer.html?accountID=${account.accountID}&currency=${account.currency}&balance=${account.currentBalance}&subscriberID=${subscriberID}">
            <button>Transfer from this account</button>
          </a>
        </div>
      `;
    });
    html += '</div>';
    res.send(html);
  });
});

app.get('/getExternalAccountsJSON', (req, res) => {
  const subscriberID = req.query.subscriberID;

  const sql = 'SELECT accountID, bank, accountType, currentBalance, currency, syncStatus FROM EXTERNAL_ACCOUNT WHERE subscriberID = ?';
  db.query(sql, [subscriberID], (err, result) => {
    if (err) {
      console.error('Error fetching external accounts:', err);
      return res.status(500).json({ error: 'Database error', accounts: [] });
    }
    res.json(result);
  });
});

// ── Money Transfer ───────────────────────────────────────────

app.post('/CheckAccID', (req, res) => {
  const { subscriberID, AccountID, Balance, ToAccount } = req.body;

  const sql = 'SELECT accountID, subscriberID FROM EXTERNAL_ACCOUNT WHERE subscriberID = ? AND accountID = ?';
  db.query(sql, [subscriberID, ToAccount], (err, result) => {
    if (err) {
      console.error('Error checking Account ID:', err);
      return res.status(500).send('DB Error');
    }
    if (!result.length) return res.send('The AccountID you entered does not match any accounts in your subscription. Please try again.');

    res.redirect(`/MT-SelectAmount.html?accountID=${AccountID}&toAccount=${ToAccount}&balance=${Balance}&subscriberID=${subscriberID}`);
  });
});

app.post('/StoreAmount', (req, res) => {
  const transferAmount = Number(req.body.Tamount);
  const balance = Number(req.body.balance);
  const { accountID, toAccount, subscriberID } = req.body;

  if (transferAmount > balance) {
    return res.send(`The amount you want to transfer ($${transferAmount}) exceeds your account balance ($${balance}). Please adjust and try again.`);
  }

  res.redirect(`/MT-Date&Time.html?amount=${transferAmount}&accountID=${accountID}&toAccount=${toAccount}&subscriberID=${subscriberID}`);
});

app.post('/StoreSchedule', (req, res) => {
  const amount = Number(req.body.amount);
  const { fromAccount, toAccount, scheduleType, subscriberID } = req.body;
  let transferDate = req.body.transferDate;
  const transferTime = req.body.transferTime;

  if (scheduleType === 'later') {
    if (!transferDate || !transferTime) {
      return res.send('Please select both date and time for future transfer');
    }

    // Normalize date format
    if (transferDate.includes('T')) transferDate = transferDate.split('T')[0];
    if (transferDate.includes(' ')) transferDate = transferDate.split(' ')[0];

    const sql = `INSERT INTO scheduled_transfers (amount, from_account, to_account, schedule_type, transfer_date, transfer_time, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`;
    db.query(sql, [amount, fromAccount, toAccount, scheduleType, transferDate, transferTime], (err) => {
      if (err) {
        console.error('Error scheduling transfer:', err);
        return res.send('Error processing transfer. Please try again.');
      }
      return res.send(`
        Transfer of $${amount} scheduled for ${transferDate} at ${transferTime}
        <a href="/Dashboard.html?subscriberID=${subscriberID}"><button>Return to Dashboard</button></a>
      `);
    });

  } else {
    // ✅ Show confirmation page with subscriberID passed through
    res.send(`
      <form action="/ConfirmTransfer" method="POST">
        <input type="hidden" name="amount" value="${amount}">
        <input type="hidden" name="fromAccount" value="${fromAccount}">
        <input type="hidden" name="toAccount" value="${toAccount}">
        <input type="hidden" name="subscriberID" value="${subscriberID}">
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
  const { fromAccount, toAccount, subscriberID } = req.body;

  // Fixed: get connection from pool for transaction
  db.getConnection((err, connection) => {
    if (err) return res.send('Error getting database connection. Please try again.');

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.send('Error starting transaction. Please try again.');
      }

      const deductSql = 'UPDATE EXTERNAL_ACCOUNT SET currentBalance = currentBalance - ? WHERE accountID = ?';
      connection.query(deductSql, [amount, fromAccount], (err, deductResult) => {
        if (err || deductResult.affectedRows === 0) {
          return connection.rollback(() => {
            connection.release();
            res.send('Error deducting from account. Please try again.');
          });
        }

        const addSql = 'UPDATE EXTERNAL_ACCOUNT SET currentBalance = currentBalance + ? WHERE accountID = ?';
        connection.query(addSql, [amount, toAccount], (err, addResult) => {
          if (err || addResult.affectedRows === 0) {
            return connection.rollback(() => {
              connection.release();
              res.send('Error adding to account. Please try again.');
            });
          }

          const transactionSql = `INSERT INTO scheduled_transfers (amount, from_account, to_account, status) VALUES (?, ?, ?, 'completed')`;
          connection.query(transactionSql, [amount, fromAccount, toAccount], (err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.send('Error recording transaction. Please try again.');
              });
            }

            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.send('Error committing transfer. Please try again.');
                });
              }

              connection.release();
              // subscriberID now correctly passed back
              return res.send(`
                Transfer of $${amount} completed successfully!
                <a href="/Dashboard.html?subscriberID=${subscriberID}"><button>Return to Dashboard</button></a>
              `);
            });
          });
        });
      });
    });
  });
});

// ── Scheduled Transfers ──────────────────────────────────────

schedule.scheduleJob('* * * * *', function () {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const currentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const findSql = `SELECT * FROM scheduled_transfers WHERE status = 'pending' AND transfer_date <= ? AND transfer_time <= ?`;

  db.query(findSql, [currentDate, currentTime], (err, transfers) => {
    if (err) {
      console.error('Scheduled transfer query error:', err);
      return;
    }
    if (!transfers || transfers.length === 0) return;

    transfers.forEach(transfer => {
      // ✅ Fixed: use connection from pool for scheduled transactions
      db.getConnection((err, connection) => {
        if (err) return;

        connection.beginTransaction(err => {
          if (err) {
            console.error('Scheduled transfer begin transaction error:', err);
            connection.release();
            return;
          }

          connection.query(
            'UPDATE EXTERNAL_ACCOUNT SET currentBalance = currentBalance - ? WHERE accountID = ? AND currentBalance >= ?',
            [transfer.amount, transfer.from_account, transfer.amount],
            (err, result) => {
              if (err || result.affectedRows === 0) {
                console.error(`Scheduled transfer ${transfer.id} deduct failed — insufficient funds or account not found`);
                return connection.rollback(() => {
                  connection.query('UPDATE scheduled_transfers SET status = "failed" WHERE id = ?', [transfer.id], () => connection.release());
                });
              }

              connection.query(
                'UPDATE EXTERNAL_ACCOUNT SET currentBalance = currentBalance + ? WHERE accountID = ?',
                [transfer.amount, transfer.to_account],
                err => {
                  if (err) {
                    console.error(`Scheduled transfer ${transfer.id} credit failed:`, err);
                    return connection.rollback(() => {
                      connection.query('UPDATE scheduled_transfers SET status = "failed" WHERE id = ?', [transfer.id], () => connection.release());
                    });
                  }

                  connection.query(
                    'UPDATE scheduled_transfers SET status = "completed" WHERE id = ?',
                    [transfer.id],
                    err => {
                      if (err) {
                        console.error(`Scheduled transfer ${transfer.id} status update failed:`, err);
                        return connection.rollback(() => connection.release());
                      }

                      connection.commit(err => {
                        if (err) {
                          console.error(`Scheduled transfer ${transfer.id} commit failed:`, err);
                          return connection.rollback(() => connection.release());
                        }
                        connection.release();
                        console.log('Scheduled transfer completed:', transfer.id);
                      });
                    }
                  );
                }
              );
            }
          );
        });
      });
    });
  });
});

app.get('/debug-transfers', (req, res) => {
  const sql = 'SELECT * FROM scheduled_transfers ORDER BY id DESC LIMIT 10';
  db.query(sql, (err, transfers) => {
    if (err) return res.send('Database error: ' + err);

    const now = new Date();
    const currentDate = now.toLocaleDateString('en-CA');
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    let html = '<h2>Scheduled Transfers Debug</h2><table border="1">';
    html += '<tr><th>ID</th><th>Amount</th><th>From</th><th>To</th><th>Date</th><th>Time</th><th>Status</th></tr>';
    transfers.forEach(t => {
      html += `<tr><td>${t.id}</td><td>$${t.amount}</td><td>${t.from_account}</td><td>${t.to_account}</td><td>${t.transfer_date}</td><td>${t.transfer_time}</td><td>${t.status}</td></tr>`;
    });
    html += `</table><p><strong>Server time:</strong> ${currentDate} ${currentTime}</p>`;
    res.send(html);
  });
});

// ── Family ───────────────────────────────────────────────────

app.post('/displayFamAcc', (req, res) => {
  const subscriberID = req.query.subscriberID;

  const getUserFamSql = 'SELECT FamAccount FROM SUBSCRIBER_ACCOUNT WHERE subscriberID = ?';
  db.query(getUserFamSql, [subscriberID], (err, userResult) => {
    if (err) {
      console.error('Error fetching user FamAccount:', err);
      return res.status(500).send('Database Error');
    }
    if (!userResult.length) return res.send('No user found');

    const famAccount = userResult[0].FamAccount;

    const getFamilyMemberSql = 'SELECT FName, LName, Username, subscriberID, FamAccount FROM SUBSCRIBER_ACCOUNT WHERE FamAccount = ?';
    db.query(getFamilyMemberSql, [famAccount], (err, familyResults) => {
      if (err) {
        console.error('Error fetching family accounts:', err);
        return res.status(500).send('DB Error');
      }
      if (!familyResults.length) return res.send('No family members found');

      let html = '<h2>Family Dashboard</h2><div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">';
      familyResults.forEach(member => {
        html += `
          <div style="border: 1px solid #ccc; padding: 10px; width: 300px; border-radius: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p><strong>First Name:</strong> ${member.FName}</p>
            <p><strong>Last Name:</strong> ${member.LName}</p>
            <p><strong>Username:</strong> ${member.Username}</p>
            <p><strong>Family Account:</strong> ${member.FamAccount}</p>
          </div>
        `;
      });
      html += '</div>';
      res.send(html);
    });
  });
});

app.post('/add-family-member', (req, res) => {
  const { FName, LName, Username } = req.body;
  const subscriberID = req.query.subscriberID;

  const getUserFamSql = 'SELECT FamAccount FROM SUBSCRIBER_ACCOUNT WHERE subscriberID = ?';
  db.query(getUserFamSql, [subscriberID], (err, userResult) => {
    if (err) return res.status(500).json({ success: false, message: 'Database Error' });
    if (!userResult.length) return res.status(400).json({ success: false, message: 'No user found' });

    const familyAccountId = userResult[0].FamAccount;

    const checkUserSql = 'SELECT * FROM SUBSCRIBER_ACCOUNT WHERE FName = ? AND LName = ? AND Username = ?';
    db.query(checkUserSql, [FName, LName, Username], (err, existing) => {
      if (err) return res.status(500).json({ success: false, message: 'Database Error' });
      if (!existing.length) return res.json({ success: false, message: 'User not found. First name, last name, and username do not match an existing account.' });

      const updateSql = 'UPDATE SUBSCRIBER_ACCOUNT SET FamAccount = ? WHERE FName = ? AND LName = ? AND Username = ?';
      db.query(updateSql, [familyAccountId, FName, LName, Username], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database Error' });

        res.json({ success: true, message: `${FName} ${LName} (${Username}) has been linked to your family plan!`, famAccount: familyAccountId });
      });
    });
  });
});

app.post('/add-goal', (req, res) => {
  const { GName, Description, Goal, subscriberID } = req.body;
  const currentAmount = 0;
  const status = "In Progress";

  if (!GName || !Goal) {
    return res.status(400).json({ success: false, message: 'Goal name and amount are required' });
  }

  const getFamAccountSql = 'SELECT FamAccount FROM SUBSCRIBER_ACCOUNT WHERE SubscriberID = ?';
  db.query(getFamAccountSql, [subscriberID], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error retrieving user information' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

    const famAccount = results[0].FamAccount;

    const insertGoalSql = 'INSERT INTO Family_Goal (GName, Description, Goal, CurrAmt, FamAccount, Status) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(insertGoalSql, [GName, Description, Goal, currentAmount, famAccount, status], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Error adding goal: ' + err.message });

      res.json({ success: true, message: 'Goal successfully added!', goalId: result.insertId, status });
    });
  });
});

app.get('/get-family-goals', (req, res) => {
  const subscriberID = req.query.subscriberID;

  const getFamSql = 'SELECT FamAccount FROM SUBSCRIBER_ACCOUNT WHERE SubscriberID = ?';
  db.query(getFamSql, [subscriberID], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

    const famAccount = results[0].FamAccount;

    const goalsQuery = 'SELECT * FROM Family_Goal WHERE FamAccount = ? ORDER BY GoalID DESC';
    db.query(goalsQuery, [famAccount], (err, goalResults) => {
      if (err) return res.status(500).json({ success: false, message: 'Error fetching goals' });

      res.json({ success: true, goals: goalResults });
    });
  });
});

app.post('/contribute-to-goal', (req, res) => {
  const { goalId, subscriberID, accountID, amount } = req.body;

  const checkGoalSql = 'SELECT * FROM Family_Goal WHERE GoalID = ?';
  db.query(checkGoalSql, [goalId], (err, goalResult) => {
    if (err) return res.json({ success: false, message: 'Database error: ' + err.message });
    if (!goalResult || goalResult.length === 0) return res.json({ success: false, message: 'Goal not found' });

    const checkAccountSql = 'SELECT * FROM EXTERNAL_ACCOUNT WHERE accountID = ? AND subscriberID = ?';
    db.query(checkAccountSql, [accountID, subscriberID], (err, accountResult) => {
      if (err) return res.json({ success: false, message: 'Account error: ' + err.message });
      if (!accountResult || accountResult.length === 0) return res.json({ success: false, message: 'Account not found' });
      if (accountResult[0].currentBalance < amount) return res.json({ success: false, message: 'Insufficient balance' });

      const updateGoalSql = `
        UPDATE Family_Goal
        SET CurrAmt = CurrAmt + ?,
            Status  = CASE WHEN CurrAmt + ? >= Goal THEN 'Completed' ELSE Status END
        WHERE GoalID = ?`;
      db.query(updateGoalSql, [amount, amount, goalId], (err, updateResult) => {
        if (err) return res.json({ success: false, message: 'Update failed: ' + err.message });
        if (updateResult.affectedRows === 0) return res.json({ success: false, message: 'Goal not updated' });

        const deductSql = 'UPDATE EXTERNAL_ACCOUNT SET currentBalance = currentBalance - ? WHERE accountID = ?';
        db.query(deductSql, [amount, accountID], (err) => {
          if (err) return res.json({ success: false, message: 'Failed to update account: ' + err.message });

          res.json({ success: true, message: 'Contribution successful!' });
        });
      });
    });
  });
});

// ── Spending / Charts ────────────────────────────────────────

app.get('/api/category-totals/:accountId', (req, res) => {
  const { accountId } = req.params;
  const { month, year } = req.query;

  const sql = `
    SELECT Category, SUM(Amount) AS Total
    FROM CARD_TRANSACTION
    WHERE AccountID = ? AND TransactionType = 'Debit'
      AND MONTH(TransactionDate) = ? AND YEAR(TransactionDate) = ?
    GROUP BY Category ORDER BY Total DESC
  `;

  db.query(sql, [accountId, month, year], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching category totals' });
    res.json(results);
  });
});

app.get('/api/category-transactions/:accountId/:category', (req, res) => {
  const { accountId, category } = req.params;
  const { month, year } = req.query;

  const sql = `
    SELECT TransactionDate, MerchantName, Description, Amount
    FROM CARD_TRANSACTION
    WHERE AccountID = ? AND Category = ? AND TransactionType = 'Debit'
      AND MONTH(TransactionDate) = ? AND YEAR(TransactionDate) = ?
    ORDER BY TransactionDate DESC
  `;

  db.query(sql, [accountId, category, month, year], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching category transactions' });
    res.json(results);
  });
});

// ── Budget ───────────────────────────────────────────────────

app.post('/create-budget', (req, res) => {
  const { amount, ExpenseType, category, DateRecorded, subscriberId, accountId } = req.body;

  const sql = 'INSERT INTO Budgeting (amount, ExpenseType, category, dateRecorded, subscriberId, accountId) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sql, [amount, ExpenseType, category, DateRecorded, subscriberId, accountId], (err) => {
    if (err) {
      console.error('Error making new budget:', err);
      return res.status(500).send('Error creating new budget');
    }
    res.json({ success: true, amount, ExpenseType, category, DateRecorded, subscriberId, accountId });
  });
});

// ── Alerts ───────────────────────────────────────────────────

app.post('/api/alerts/save', (req, res) => {
  const { subscriberID, threshold } = req.body;

  if (!subscriberID || threshold === undefined || threshold === null || threshold === '') {
    return res.status(400).json({ error: 'subscriberID and threshold are required' });
  }

  const sql = `
    INSERT INTO USER_ALERT_SETTINGS (SubscriberID, AlertThreshold, AlertsEnabled)
    VALUES (?, ?, TRUE)
    ON DUPLICATE KEY UPDATE AlertThreshold = VALUES(AlertThreshold), AlertsEnabled = TRUE
  `;

  db.query(sql, [subscriberID, threshold], (err) => {
    if (err) return res.status(500).json({ error: 'Error saving alert settings' });
    res.json({ success: true, message: 'Alert settings saved' });
  });
});

app.get('/api/alerts/:subscriberID', (req, res) => {
  const subscriberID = req.params.subscriberID;

  const sql = `
    SELECT ct.TransactionID, ct.Amount, ct.MerchantName, ct.Description,
           ct.TransactionDate, ct.Category, ct.TransactionType, ct.Status
    FROM CARD_TRANSACTION ct
    JOIN EXTERNAL_ACCOUNT ea ON ct.AccountID = ea.AccountID
    WHERE ea.SubscriberID = ? AND ct.Status = 'Pending'
    ORDER BY ct.TransactionDate DESC
  `;

  db.query(sql, [subscriberID], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching alerts' });
    res.json(results);
  });
});

app.post('/api/alerts/accept', (req, res) => {
  const { transactionID } = req.body;
  if (!transactionID) return res.status(400).json({ error: 'transactionID is required' });

  db.query('UPDATE CARD_TRANSACTION SET Status = "Approved" WHERE TransactionID = ?', [transactionID], (err) => {
    if (err) return res.status(500).json({ error: 'Error approving transaction' });
    res.json({ success: true, message: 'Transaction approved' });
  });
});

app.post('/api/alerts/decline', (req, res) => {
  const { transactionID } = req.body;
  if (!transactionID) return res.status(400).json({ error: 'transactionID is required' });

  db.query('UPDATE CARD_TRANSACTION SET Status = "Declined" WHERE TransactionID = ?', [transactionID], (err) => {
    if (err) return res.status(500).json({ error: 'Error declining transaction' });
    res.json({ success: true, message: 'Transaction declined' });
  });
});

app.post('/api/transactions/simulate', (req, res) => {
  const { accountID, amount } = req.body;
  if (!accountID || !amount) return res.status(400).json({ error: 'accountID and amount are required' });

  db.query('SELECT SubscriberID FROM EXTERNAL_ACCOUNT WHERE AccountID = ?', [accountID], (err, accountResults) => {
    if (err) return res.status(500).json({ error: 'Error finding account' });
    if (accountResults.length === 0) return res.status(404).json({ error: 'Account not found' });

    const subscriberID = accountResults[0].SubscriberID;

    db.query('SELECT AlertThreshold, AlertsEnabled FROM USER_ALERT_SETTINGS WHERE SubscriberID = ?', [subscriberID], (err, settingsResults) => {
      if (err) return res.status(500).json({ error: 'Error fetching alert settings' });

      let status = 'Approved';
      if (settingsResults.length > 0) {
        const settings = settingsResults[0];
        if (settings.AlertsEnabled && settings.AlertThreshold !== null && Number(amount) > Number(settings.AlertThreshold)) {
          status = 'Pending';
        }
      }

      const insertSql = `INSERT INTO CARD_TRANSACTION (AccountID, Amount, TransactionDate, MerchantName, Description, Category, TransactionType, Status) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`;
      db.query(insertSql, [accountID, amount, 'Demo Merchant', 'Simulated transaction', 'Personal', 'Debit', status], (err) => {
        if (err) return res.status(500).json({ error: 'Error simulating transaction' });

        res.json({
          success: true,
          message: status === 'Pending' ? 'Simulated transaction created and alert triggered' : 'Simulated transaction created below threshold',
          status
        });
      });
    });
  });
});

// ── Forms ────────────────────────────────────────────────────

app.post('/submitForm', (req, res) => {
  const { customerUsername, customerName, customerEmail, employeeID, subject, priority, description } = req.body;

  const sql = 'INSERT INTO SERVICE_FORMS (customerUsername, customerName, customerEmail, employeeID, subject, priority, description) VALUES (?,?,?,?,?,?,?)';
  db.query(sql, [customerUsername, customerName, customerEmail, employeeID, subject, priority, description], (err) => {
    if (err) return res.status(500).send('Error submitting form');
    res.send('Form successfully submitted');
  });
});

app.get('/getForms', (_req, res) => {
  db.query('SELECT formID, customerUsername, customerName, employeeID, subject, priority, createdAt FROM SERVICE_FORMS ORDER BY createdAt DESC', (err, result) => {
    if (err) return res.status(500).json({ error: 'Error retrieving forms' });
    res.json(result);
  });
});

app.post('/retrieveForm', (req, res) => {
  const formID = req.body.formID;

  db.query('SELECT * FROM SERVICE_FORMS WHERE formID = ?', [formID], (err, result) => {
    if (err) return res.status(500).send('Error retrieving form');
    if (result.length === 0) return res.status(404).send('Form not found');
    res.send(result[0]);
  });
});

app.post('/reviewForm', (req, res) => {
  const { formID, customerName, customerEmail, employeeID, subject, priority, description, Comments } = req.body;

  const sql = 'INSERT INTO CLOSED_FORMS (formID, customerName, customerEmail, EmployeeID, subject, priority, description, commments) VALUES(?,?,?,?,?,?,?,?)';
  db.query(sql, [formID, customerName, customerEmail, employeeID, subject, priority, description, Comments], (err) => {
    if (err) return res.status(500).send('Error submitting review');

    db.query('DELETE FROM SERVICE_FORMS WHERE formID = ?', [formID], (err) => {
      if (err) return res.status(500).send('Review submitted but error deleting original form');
      res.send('Review submitted successfully');
    });
  });
});

// ── 404 & Listen ─────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).send('Webpage not found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});