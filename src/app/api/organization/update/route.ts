import { NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { UpdateCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { authorizeRequest } from '@/lib/auth-session';

export async function PUT(request: Request) {
  const authorization = await authorizeRequest(request, 'edit');
  if (!authorization.ok) return authorization.response;

  try {
    const data = await request.json();
    
    // The primary key for PA_OrgStructure is id
    const itemId = data.id;
    
    if (!itemId) {
      return NextResponse.json({ error: "Missing position ID" }, { status: 400 });
    }

    // List of fields that we can update.
    const updateFields: Record<string, string> = {
      position_en: data.position_en,
      position_th: data.position_th,
      department_en: data.department_en,
      department_th: data.department_th,
      department_code: data.department_code,
      division_en: data.division_en,
      division_th: data.division_th,
      division_code: data.division_code,
      section_en: data.section_en,
      section_th: data.section_th,
      section_code: data.section_code,
      unit_en: data.unit_en,
      unit_th: data.unit_th,
      unit_code: data.unit_code,
      station: data.station
    };

    let updateExpression = "set";
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    let index = 0;
    for (const [key, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        // Fallback to "-" if empty to maintain data consistency
        const finalValue = value.trim() === "" ? "-" : value;
        
        const attributeKey = `#attr${index}`;
        const valueKey = `:val${index}`;
        
        expressionAttributeNames[attributeKey] = key;
        expressionAttributeValues[valueKey] = finalValue;
        
        updateExpression += ` ${attributeKey} = ${valueKey},`;
        index++;
      }
    }

    if (index === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Remove trailing comma
    updateExpression = updateExpression.slice(0, -1);

    const command = new UpdateCommand({
      TableName: "PA_OrgStructure",
      Key: {
        id: itemId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    });

    const response = await docClient.send(command);

    return NextResponse.json({ success: true, updatedItem: response.Attributes }, { status: 200 });

  } catch (error: any) {
    console.error("Error updating organization position:", error);
    return NextResponse.json(
      { error: "Failed to update organization position.", details: error.message }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, 'edit');
  if (!authorization.ok) return authorization.response;

  try {
    const data = await request.json();
    const id = crypto.randomUUID();
    
    const item = {
      id,
      position_en: data.position_en || "-",
      position_th: data.position_th || "-",
      department_en: data.department_en || "-",
      department_th: data.department_th || "-",
      department_code: data.department_code || "-",
      division_en: data.division_en || "-",
      division_th: data.division_th || "-",
      division_code: data.division_code || "-",
      section_en: data.section_en || "-",
      section_th: data.section_th || "-",
      section_code: data.section_code || "-",
      unit_en: data.unit_en || "-",
      unit_th: data.unit_th || "-",
      unit_code: data.unit_code || "-",
      station: data.station || "-"
    };

    const command = new PutCommand({
      TableName: "PA_OrgStructure",
      Item: item
    });

    await docClient.send(command);

    return NextResponse.json({ success: true, newItem: item }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating organization position:", error);
    return NextResponse.json(
      { error: "Failed to create organization position.", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeRequest(request, 'edit');
  if (!authorization.ok) return authorization.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing position ID" }, { status: 400 });
    }

    const command = new DeleteCommand({
      TableName: "PA_OrgStructure",
      Key: { id }
    });

    await docClient.send(command);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting organization position:", error);
    return NextResponse.json(
      { error: "Failed to delete organization position.", details: error.message },
      { status: 500 }
    );
  }
}
