'use server';

import { z } from 'zod';
import { logger } from '@/lib/logger';

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

    // Log the contact message
    logger.info(`Contact form submission from ${validated.email}`, {
      name: validated.name,
      subject: validated.subject || 'No subject',
      messageLength: validated.message.length,
    });

    // Note: Email sending planned for v2. Currently logs to server for review.
    // Options for future: Resend, Supabase Edge Functions, or database storage.

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
    logger.error('Contact form error:', error);
    
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

