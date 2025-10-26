import nodemailer from "nodemailer";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";

// Function to generate a 6-digit random OTP key and calculate expiration time
export const generateOTP = () => {
  // Generate a 6-digit random OTP key
  const otpKey = Math.floor(100000 + Math.random() * 900000);

  // Calculate OTP expiration time (5 minutes from now)
  const otpExpirationTime = new Date();
  otpExpirationTime.setMinutes(otpExpirationTime.getMinutes() + 10);

  return {
    otpKey,
    otpExpirationTime,
  };
};

export const sendOTPByEmail = async (email, otp) => {
  console.log(otp);
  // Implement logic to send OTP to the user's email
  const transporter = nodemailer.createTransport({
    host: "mail.aps.dz",
    port: 25,
    auth: {
      user: process.env.ADMIN_MAIL,
      pass: process.env.ADMIN_MAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // Ignore certificate validation
    },
  });

  const mailOptions = {
    from: process.env.ADMIN_MAIL,
    to: email,
    subject: "OTP for Two-Factor Authentication",
    text: `Your OTP for Two-Factor Authentication is: ${otp}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.response);
    return { message: "Email sent successfully", info };
  } catch (error) {
    console.error("Failed to send email:", error.message);
    // Don't throw, just return failure result (non-blocking)
    return { message: "Failed to send email", error };
  }
};

export const sendEmail = async (message) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "mail.aps.dz",
      port: 25,
      auth: {
        user: process.env.ADMIN_MAIL,
        pass: process.env.ADMIN_MAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, // Ignore certificate validation
      },
    });

    const mailOptions = {
      from: process.env.ADMIN_MAIL,
      to: process.env.RECEPTION_MAIL,
      subject: `🚨 Alerte de compte bloqué - ${process.env.PROJECT_NAME}`,
      html: `
        <h2>Alerte de compte bloqué</h2>
        <p><strong>Temps:</strong> ${new Date().toISOString()}</p>
        <h3>${message}</h3>
      `,
    };

    // Send email asynchronously
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return { message: "Email sent successfully", info };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ErrorHandler(400, "Error sending email: " + error.message);
  }
};
