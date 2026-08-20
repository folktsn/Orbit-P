import { NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { invalidateEmployeesCache } from '@/lib/employeesCache';

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const { id, adjustment } = data;

    if (!id || !adjustment || !adjustment.effectiveDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const command = new UpdateCommand({
      TableName: 'fullstaff',
      Key: {
        staff_id: id
      },
      UpdateExpression: 'set pending_adjustment = :adj',
      ExpressionAttributeValues: {
        ':adj': adjustment
      },
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    invalidateEmployeesCache();
    return NextResponse.json(response.Attributes);
  } catch (error: any) {
    console.error('Error scheduling adjustment:', error);
    return NextResponse.json({ error: 'Failed to schedule adjustment', details: error.message }, { status: 500 });
  }
}
