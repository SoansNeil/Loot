//NEED FORM FROM HTML FILES TO TEST CONNECTIONS
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname));
app.use(session({
  secret: 'loot-secret-key',
  resave: false,
  saveUninitialized: false
}));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'neilsoans', // use your MySQL password if needed
  database: 'LootDB'
});
const crypto = require('crypto'); // For hashing passwords and sensitive data
//employeeLogin
app.post('/employeeLogin', (req,res) =>{
  console.log("Employee login POST hit:", req.body);
  const username = req.body.eUsername;
  const hashPassword = crypto
    .createHash('sha256')
    .update(req.body.ePassword.trim())
    .digest('hex')

  const sql = 'SELECT * FROM Employee WHERE eUsername = ?';
  db.query(sql, [username], (err,result) =>{
    if (err) return res.status(500).send("Server Error");
    if (result.length === 0){
      return res.status(401).send("Employee Not Found");
    }
    const employee = result[0];
    if(employee.ePassword !== hashPassword) 
      return res.status(401).send("Incorrect Password");

    req.session.user = {
      id: employee.EmployeeID,
      role: "employee"
    };
    res.send("Success");
  });
});
app.get('/employeeDashboard', (req, res) => {
  if (!req.session.user) {
    return res.send("Please login first.");
  }

  if (req.session.user.role !== "employee") {
    return res.send("Access denied. Employees only.");
  }

  res.sendFile(__dirname + '/employeeDashboard.html');
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
//Server checks
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
//functions
function authorize(allowedRoles){
  return (req,res,next) => {
    if(!req.session.user) return res.status(401).send("Please Log In");
    if(!allowedRoles.includes(req.session.user.role)){
      return res.status(401).send("Access Denied");
    }
    next();
  };
}
