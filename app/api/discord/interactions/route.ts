import { NextRequest, NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { BLOX_FRUITS } from '@/lib/blox-fruits';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('X-Signature-Ed25519');
    const timestamp = req.headers.get('X-Signature-Timestamp');

    if (!signature || !timestamp) {
      return new NextResponse('Bad request signature', { status: 401 });
    }

    const configDocRef = doc(db, 'configs', 'discord');
    const configSnap = await getDoc(configDocRef);

    if (!configSnap.exists()) {
      return new NextResponse('Config not found', { status: 500 });
    }

    const { publicKey } = configSnap.data();

    if (!publicKey) {
      return new NextResponse('Public key not configured', { status: 500 });
    }

    const rawBody = await req.text();
    const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

    if (!isValidRequest) {
      return new NextResponse('Bad request signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);

    if (body.type === 1) { // PING
      return NextResponse.json({ type: 1 });
    }

    if (body.type === 2) { // APPLICATION_COMMAND
      const { name, options } = body.data;

      const getOptionValue = (name: string) => {
        const option = options?.find((o: any) => o.name === name);
        return option ? option.value : null;
      };

      const accountName = getOptionValue('account');

      if (!accountName) {
         return NextResponse.json({
            type: 4,
            data: { content: `Error: Account name is required.` }
         });
      }
      
      const sanitizedAccount = accountName.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (name === 'value') {
        const fruitsRef = collection(db, 'accounts', sanitizedAccount, 'fruits');
        const fruitsSnap = await getDocs(fruitsRef);
        
        let totalValue = 0;
        let fruitLines: string[] = [];
        
        fruitsSnap.forEach(docSnap => {
           const data = docSnap.data();
           const dbFruit = BLOX_FRUITS.find(f => f.name.toLowerCase() === data.fruitName.toLowerCase());
           const cost = dbFruit ? dbFruit.value : 0;
           const val = cost * data.quantity;
           totalValue += val;
        });
        
        return NextResponse.json({
          type: 4,
          data: {
            content: `The total inventory value for account **${accountName}** is: **$${totalValue.toLocaleString()}**`
          }
        });
      }

      if (name === 'inventory') {
        const fruitsRef = collection(db, 'accounts', sanitizedAccount, 'fruits');
        const fruitsSnap = await getDocs(fruitsRef);
        
        if (fruitsSnap.empty) {
            return NextResponse.json({
              type: 4,
              data: { content: `Account **${accountName}** has no fruits in inventory.` }
            });
        }
        
        let report = `Inventory for **${accountName}**:\n\`\`\`\n`;
        fruitsSnap.forEach(docSnap => {
           const data = docSnap.data();
           if (data.quantity > 0) {
               report += `${data.fruitName}: ${data.quantity}\n`;
           }
        });
        report += `\`\`\``;
        
        return NextResponse.json({
          type: 4,
          data: { content: report }
        });
      }

      if (name === 'add') {
        const fruitName = getOptionValue('fruit');
        const quantity = getOptionValue('quantity');

        if (!fruitName || typeof quantity !== 'number') {
            return NextResponse.json({
              type: 4,
              data: { content: 'Missing fruit or quantity arguments.' }
            });
        }
        
        const sanitizedFruit = fruitName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        const fruitRef = doc(db, 'accounts', sanitizedAccount, 'fruits', sanitizedFruit);
        await setDoc(fruitRef, {
            fruitName: fruitName,
            quantity: quantity,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return NextResponse.json({
          type: 4,
          data: {
            content: `Successfully updated **${accountName}**: Set ${fruitName} quantity to ${quantity}.`
          }
        });
      }
    }

    return new NextResponse('Unknown interaction type', { status: 400 });

  } catch (error) {
    console.error('Discord Interaction Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
