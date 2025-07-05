# Email Setup for OTP Functionality

To enable OTP functionality for password reset and email verification, you need to set up email credentials in your environment variables.

## Setup Steps:

1. **Create a Gmail App Password:**
   - Go to your Google Account settings
   - Navigate to Security > 2-Step Verification
   - Create an App Password for your application
   - Use this app password instead of your regular Gmail password

2. **Add Environment Variables:**
   Create or update your `.env` file in the backend directory:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

3. **Alternative Email Services:**
   If you prefer to use other email services, you can modify the transporter configuration in `routes/auth.js`:
   
   **For Outlook/Hotmail:**
   ```javascript
   const transporter = nodemailer.createTransporter({
     service: 'outlook',
     auth: {
       user: process.env.EMAIL_USER,
       pass: process.env.EMAIL_PASS
     }
   });
   ```

   **For Custom SMTP:**
   ```javascript
   const transporter = nodemailer.createTransporter({
     host: 'smtp.your-provider.com',
     port: 587,
     secure: false,
     auth: {
       user: process.env.EMAIL_USER,
       pass: process.env.EMAIL_PASS
     }
   });
   ```

## Features Enabled:

- **Password Reset:** Users can reset their password via OTP
- **Email Change Verification:** Users can change their email with OTP verification
- **Secure OTP:** 6-digit OTP with 10-minute expiration
- **Professional Email Templates:** Beautiful HTML email templates

## Testing:

1. Start your backend server
2. Try the "Forgot Password" flow from the login page
3. Check your email for the OTP
4. Test the profile email change functionality

## Security Notes:

- OTPs expire after 10 minutes
- OTPs are cleared after successful use
- Email addresses are validated before sending OTPs
- All password changes require current password verification 