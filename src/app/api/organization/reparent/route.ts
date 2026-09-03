import { NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeRequest } from '@/lib/auth-session';

// Helper to scan all positions
async function getAllPositions() {
  const command = new ScanCommand({ TableName: 'PA_OrgStructure' });
  const response = await docClient.send(command);
  return response.Items || [];
}

export async function PUT(request: Request) {
  const authorization = await authorizeRequest(request, 'edit');
  if (!authorization.ok) return authorization.response;

  try {
    const data = await request.json();
    const { matchingFilter, updates } = data;

    if (!matchingFilter || !updates) {
      return NextResponse.json({ error: "Missing required fields (matchingFilter, updates)" }, { status: 400 });
    }

    const { nodeType, nodeNameEn, department_en, division_en, station, section_en } = matchingFilter;

    if (!nodeType || !nodeNameEn) {
      return NextResponse.json({ error: "Missing nodeType or nodeNameEn in matchingFilter" }, { status: 400 });
    }

    const allPositions = await getAllPositions();
    let matchingPositions: any[] = [];

    // Identify positions that belong to the dragged node's sub-tree
    if (nodeType === 'department') {
      matchingPositions = allPositions.filter((item: any) => item.department_en === nodeNameEn);
    } else if (nodeType === 'division') {
      matchingPositions = allPositions.filter((item: any) => 
        item.division_en === nodeNameEn && 
        (department_en === undefined || item.department_en === department_en)
      );
    } else if (nodeType === 'station') {
      matchingPositions = allPositions.filter((item: any) => 
        item.station === nodeNameEn && 
        (division_en === undefined || item.division_en === division_en) &&
        (department_en === undefined || item.department_en === department_en)
      );
    } else if (nodeType === 'section') {
      matchingPositions = allPositions.filter((item: any) => 
        item.section_en === nodeNameEn && 
        (station === undefined || item.station === station) &&
        (division_en === undefined || item.division_en === division_en) &&
        (department_en === undefined || item.department_en === department_en)
      );
    } else if (nodeType === 'unit') {
      matchingPositions = allPositions.filter((item: any) => 
        item.unit_en === nodeNameEn && 
        (section_en === undefined || item.section_en === section_en) &&
        (station === undefined || item.station === station) &&
        (division_en === undefined || item.division_en === division_en) &&
        (department_en === undefined || item.department_en === department_en)
      );
    }

    if (matchingPositions.length === 0) {
      return NextResponse.json({ success: true, message: "No matching positions found to update hierarchy" }, { status: 200 });
    }

    // List of classification fields we want to update
    const fieldsToUpdate = [
      'department_en', 'department_th', 'department_code',
      'division_en', 'division_th', 'division_code',
      'station',
      'section_en', 'section_th', 'section_code',
      'unit_en', 'unit_th', 'unit_code'
    ];

    // Update each matching position with the new classification values
    const updatePromises = matchingPositions.map(async (pos: any) => {
      let updateExpression = 'SET';
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};
      let hasUpdates = false;
      let index = 0;

      for (const field of fieldsToUpdate) {
        if (updates[field] !== undefined) {
          const attributeKey = `#attr${index}`;
          const valueKey = `:val${index}`;
          expressionAttributeNames[attributeKey] = field;
          expressionAttributeValues[valueKey] = updates[field] === "" ? "-" : updates[field];
          
          updateExpression += ` ${attributeKey} = ${valueKey},`;
          hasUpdates = true;
          index++;
        }
      }

      if (!hasUpdates) return Promise.resolve();

      // Remove trailing comma
      updateExpression = updateExpression.slice(0, -1);

      const updateCommand = new UpdateCommand({
        TableName: 'PA_OrgStructure',
        Key: { id: pos.id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      });

      return docClient.send(updateCommand);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, updatedCount: matchingPositions.length }, { status: 200 });
  } catch (error: any) {
    console.error("Error reparenting organization nodes:", error);
    return NextResponse.json(
      { error: "Failed to reparent organization nodes.", details: error.message },
      { status: 500 }
    );
  }
}
