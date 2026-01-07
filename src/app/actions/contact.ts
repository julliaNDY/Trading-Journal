'use server';

import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  subject: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactResult {
  success: boolean;
  error?: string;
}

/**
 * Send a contact message
 * 
 * For now, this logs the message to console and stores it.
 * In production, you could:
 * - Send an email via Resend, SendGrid, etc.
 * - Store in database for admin dashboard
 * - Forward to Discord webhook
 * - Create a support ticket
 */
export async function sendContactMessage(data: ContactFormData): Promise<ContactResult> {
  try {
    // Validate input
    const validated = contactSchema.parse(data);

    // Log the contact message (for now)
    console.log('=== Contact Form Submission ===');
    console.log('Name:', validated.name);
    console.log('Email:', validated.email);
    console.log('Subject:', validated.subject || 'No subject');
    console.log('Message:', validated.message);
    console.log('Timestamp:', new Date().toISOString());
    console.log('===============================');

    // TODO: Implement actual email sending
    // Options:
    // 1. Use Resend (recommended for Next.js)
    // 2. Use Supabase Edge Functions with email provider
    // 3. Store in ContactMessage table and notify admin

    // For MVP, we could store in database
    // await prisma.contactMessage.create({
    //   data: {
    //     name: validated.name,
    //     email: validated.email,
    //     subject: validated.subject,
    //     message: validated.message,
    //   },
    // });

    // Simulate a slight delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    return { success: true };
  } catch (error) {
    console.error('Contact form error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => e.message).join(', ') 
      };
    }
    
    return { 
      success: false, 
      error: 'An error occurred while sending your message' 
    };
  }
}

