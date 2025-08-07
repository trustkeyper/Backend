// otp_form_backend/index.js

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// PostgreSQL setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// In-memory store for OTPs (for demo only)
const otps = new Map();

// Route: Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otps.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 }); // 5 mins

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is ${otp}. It is valid for 5 minutes.`
    });
    res.status(200).json({ success: true, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send OTP', error: err });
  }
});

// Route: Verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const record = otps.get(email);

  if (!record || record.otp !== otp || Date.now() > record.expires) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  otps.delete(email); // OTP is single-use
  res.status(200).json({ success: true, message: 'OTP verified' });
});

// Route: Submit Form
app.post('/submit-form', async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    unitSize,
    furnishingStatus,
    expectedRent
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO form_responses 
        (name, email, phone_number, address, unit_size, furnishing_status, expected_rent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, email, phone, address, unitSize, furnishingStatus, expectedRent]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Form Submitted',
      text: 'Thank you for submitting the form. We will contact you soon.'
    });

    const adminMessage = `
    New form submission received:

    Name: ${name}
    Email: ${email}
    Phone: ${phone}
    Address: ${address}
    Unit Size: ${unitSize}
    Furnishing Status: ${furnishingStatus}
    Expected Rent: ${expectedRent}
        `;

    console.log(adminMessage);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'rakshithazrati@gmail.com',
      subject: 'New TrustKeyper Form Submission',
      text: adminMessage
    });


    res.status(200).json({ success: true, message: 'Form submitted successfully' });
  } catch (err) {
    console.error('Error submitting form:', err);
    res.status(500).json({ success: false, message: 'Failed to submit form', error: err });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
