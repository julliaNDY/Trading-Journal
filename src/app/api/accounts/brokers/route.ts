import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get unique brokers for the user
    const accounts = await prisma.account.findMany({
      where: {
        userId: user.id,
        broker: {
          not: null,
        },
        name: {
          not: {
            startsWith: '[HIDDEN]',
          },
        },
      },
      select: {
        broker: true,
      },
      distinct: ['broker'],
      orderBy: {
        broker: 'asc',
      },
    });

    const brokers = accounts
      .map((a) => a.broker)
      .filter((b): b is string => b !== null);

    return NextResponse.json({ brokers });
  } catch (error) {
    console.error('Error fetching brokers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
