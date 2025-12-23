import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Create transporter based on environment
function createTransporter() {
  // Check if SMTP settings are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: log email to console in development
  console.warn('SMTP not configured. Emails will be logged to console.');
  return null;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    // Log email to console for development
    console.log('='.repeat(50));
    console.log('EMAIL (SMTP not configured)');
    console.log('='.repeat(50));
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('Body:', options.html.replace(/<[^>]*>/g, ''));
    console.log('='.repeat(50));
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Trading Journal <noreply@tradingjournal.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
