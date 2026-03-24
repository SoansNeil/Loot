# CMPSC 390 – Lab 1: Login Flow (Express + MySQL)
This project demonstrates a basic login flow:
Frontend form sends username and password to an Express backend, which checks a MySQL database.
## Requirements
- Node.js installed
- MySQL installed and running
- A MySQL database with a `subscribers` table
## 1 Install
Run:
npm install
## 2 Configure environment variables
Copy:
.env.example → .env
Then open `.env` and fill in your MySQL credentials.
## 3 Database setup
Create database:
CREATE DATABASE cmpsc390;
Create users table:
CREATE TABLE users (
id INT AUTO_INCREMENT PRIMARY KEY,
first_name VARCHAR(50) NOT NULL,
username VARCHAR(50) NOT NULL UNIQUE,
password VARCHAR(64) NOT NULL
);
