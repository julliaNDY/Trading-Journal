'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} from '@/lib/auth';

const registerSchema = z.object({
  email: z.string().email(),
  discordUsername: z.string().optional(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const rawData = {
    email: formData.get('email') as string,
    discordUsername: formData.get('discordUsername') as string || undefined,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validatedData = registerSchema.safeParse(rawData);

  if (!validatedData.success) {
    return { error: validatedData.error.errors[0].message };
  }

  const { email, discordUsername, password } = validatedData.data;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: 'Email already exists' };
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        discordUsername: discordUsername || null,
      },
    });

    // Create session
    await createSession(user.id, user.email);
  } catch (error) {
    console.error('Register error:', error);
    return { error: 'Une erreur est survenue lors de l\'inscription' };
  }

  redirect('/dashboard');
}

export async function login(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const validatedData = loginSchema.safeParse(rawData);

  if (!validatedData.success) {
    return { error: validatedData.error.errors[0].message };
  }

  const { email, password } = validatedData.data;

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: 'Invalid email or password' };
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return { error: 'Your account has been blocked. Please contact an administrator.' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    // Create session
    await createSession(user.id, user.email);
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'Une erreur est survenue lors de la connexion' };
  }

  redirect('/dashboard');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
