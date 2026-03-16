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
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // use your MySQL password if needed
  database: process.env.DB_DATABASE
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
//Route to change user data
app.post('/retrieveUser', (req, res) => {
  const username = req.body.username;

  if (!username) return res.status(400).send('Missing Username');

  const sql = 'SELECT SubscriberID, FName, LName, Username, Birthday, Email, PhoneNumber FROM SUBSCRIBER_ACCOUNT WHERE Username = ?';
  db.query(sql,[username],(err,result) =>{
    if (err) return res.status(500).send('Server Error');
    if (result.length === 0) return res.status(404).send('User not found');
    const user = result[0];
    res.json(user);
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

  const sql = 'UPDATE SUBSCRIBER_ACCOUNT SET FName = ?, LName = ?, Username = ?, Email = ?, PhoneNumber = ? WHERE SubscriberID = ?';
  db.query(sql,[SubscriberID,FName,LName,Username,Email,PhoneNumber,Birthday], (err,result)=>{
    if(err) return res.stautus(500).send('Update Failed');
    if (result.affectedRows === 0) return res.status(404).send('User not found');
    res.send('Updated Successfully');
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
