//NEED FORM FROM HTML FILES TO TEST CONNECTIONS
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
  password: '', // use your MySQL password if needed
  database: 'LootDB'
});

// verify connection at startup
db.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1); // stop the server if unable to connect
  }
  console.log('Connected to LootDB');
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
  });
});


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
const sql = 'INSERT INTO EXTERNAL_ACCOUNT (Bank, AccountType) VALUES (?, ?)'; // Add more values as DB expands
  db.query(sql, [bankName, accountType], (err, result) => {
    if (err) {
      console.error('Error connecting external account:', err);
      res.status(500).send('Error connecting external account');
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


//Server checks
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


