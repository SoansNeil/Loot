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
  password: 'neilsoans', // use your MySQL password if needed
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
const sql = 'INSERT INTO EXTERNAL_ACCOUNT (bankName, accountType) VALUES (?, ?)'; // Add more values as DB expands
  db.query(sql, [bankName, accountType], (err, result) => {
    if (err) {
      console.error('Error connecting external account:', err);
      res.status(500).send('Error connecting external account');
    }
    res.send('External account connected successfully!');
  });
});
//Create Route for employee login and employee dashboard (can be separate routes)
//Server checks
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
