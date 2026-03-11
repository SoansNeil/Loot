require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname));
app.use(cookieParser());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // use your MySQL password if needed
  database: process.env.DB_DATABASE
});
const crypto = require('crypto'); // For hashing passwords and sensitive data
//login route using tokens that checks user vs employee
app.post('/login',(req,res) =>{
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
        res.status(401).send("Invalid username or password");
      });
    });
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
function authenticateToken(req, res, next) {
  const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  if (!token) return res.status(401).send('Access Token Required');
  jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
    if (err) return res.status(403).send('Invalid Token');
    req.user = user;
    next();
  });
}
