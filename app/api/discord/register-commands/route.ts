import { NextResponse } from 'next/server';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const configDocRef = doc(db, 'configs', 'discord');
    const configSnap = await getDoc(configDocRef);

    if (!configSnap.exists()) {
      return NextResponse.json({ error: 'Discord configuration not found. Please set it up in the dashboard.' }, { status: 400 });
    }

    const { appId, botToken } = configSnap.data();

    if (!appId || !botToken) {
      return NextResponse.json({ error: 'Incomplete Discord configuration.' }, { status: 400 });
    }

    const commands = [
      {
        name: 'value',
        description: "Calculate the total value of an account's inventory",
        options: [
          {
            name: 'account',
            description: 'The account name',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'inventory',
        description: 'List the fruits and quantities for an account',
        options: [
          {
            name: 'account',
            description: 'The account name',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'add',
        description: 'Update the fruit quantity for an account',
        options: [
          {
            name: 'account',
            description: 'The account name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'fruit',
            description: 'The fruit name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'quantity',
            description: 'The quantity to set',
            type: 4, // INTEGER
            required: true,
          },
        ],
      },
    ];

    const response = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: 'Failed to register commands', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, commands: data });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Firestore Error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    handleFirestoreError(error, OperationType.GET, 'configs/discord');
    return NextResponse.json({ error: 'Status 500' }, { status: 500 });
  }
}
