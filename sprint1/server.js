const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname));

//NEED DB TO CREATE CONNECTION
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Maria22!', // use your MySQL password if needed
  database: 'userDB'
});