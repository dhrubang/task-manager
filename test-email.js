require('dotenv').config();
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: 'ricky.dhrubang@gmail.com',
  subject: 'Test Email',
  text: 'This is a test email from Task Manager.'
}).then(() => console.log('Test email sent')).catch(err => console.error('Error:', err));