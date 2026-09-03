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
    const { type, nameEn, layout_x, layout_y } = data;

    if (!type || layout_x === undefined || layout_y === undefined) {
      return NextResponse.json({ error: "Missing required fields (type, layout_x, layout_y)" }, { status: 400 });
    }

    const allPositions = await getAllPositions();
    let matchingPositions: any[] = [];

    // Filter positions based on node type and English name
    if (type === 'root') {
      matchingPositions = allPositions.filter((item: any) => {
        const posEn = item.position_en?.toLowerCase() || '';
        const posTh = item.position_th?.toLowerCase() || '';
        return posEn.includes('ceo') || posEn.includes('chief') || posTh.includes('ประธานเจ้าหน้าที่บริหาร');
      });
    } else if (type === 'department') {
      matchingPositions = allPositions.filter((item: any) => item.department_en === nameEn);
    } else if (type === 'division') {
      matchingPositions = allPositions.filter((item: any) => item.division_en === nameEn);
    } else if (type === 'section') {
      matchingPositions = allPositions.filter((item: any) => item.section_en === nameEn);
    } else if (type === 'unit') {
      matchingPositions = allPositions.filter((item: any) => item.unit_en === nameEn);
    } else if (type === 'station') {
      matchingPositions = allPositions.filter((item: any) => item.station === nameEn);
    }

    if (matchingPositions.length === 0) {
      return NextResponse.json({ success: true, message: "No matching positions found to update" }, { status: 200 });
    }

    // Update each matching position with the new coordinates
    const updatePromises = matchingPositions.map(async (pos: any) => {
      const updateCommand = new UpdateCommand({
        TableName: 'PA_OrgStructure',
        Key: { id: pos.id },
        UpdateExpression: 'SET layout_x = :x, layout_y = :y',
        ExpressionAttributeValues: {
          ':x': String(layout_x),
          ':y': String(layout_y),
        },
      });
      return docClient.send(updateCommand);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, updatedCount: matchingPositions.length }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating organization layout coordinates:", error);
    return NextResponse.json(
      { error: "Failed to update organization layout coordinates.", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeRequest(request, 'edit');
  if (!authorization.ok) return authorization.response;

  try {
    let idsToReset: string[] | null = null;
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      if (body && Array.isArray(body.ids)) {
        idsToReset = body.ids;
      }
    } catch (e) {
      // No JSON body or invalid, default to global reset
    }

    const allPositions = await getAllPositions();
    let positionsToUpdate = allPositions;
    
    if (idsToReset) {
      positionsToUpdate = allPositions.filter((pos: any) => idsToReset.includes(pos.id));
    }

    if (positionsToUpdate.length === 0) {
      return NextResponse.json({ success: true, resetCount: 0, message: "No positions to reset" }, { status: 200 });
    }
    
    // Remove layout_x and layout_y fields from matching positions
    const updatePromises = positionsToUpdate.map(async (pos: any) => {
      const updateCommand = new UpdateCommand({
        TableName: 'PA_OrgStructure',
        Key: { id: pos.id },
        UpdateExpression: 'REMOVE layout_x, layout_y',
      });
      return docClient.send(updateCommand);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, resetCount: positionsToUpdate.length }, { status: 200 });
  } catch (error: any) {
    console.error("Error resetting layout coordinates:", error);
    return NextResponse.json(
      { error: "Failed to reset layout coordinates.", details: error.message },
      { status: 500 }
    );
  }
}
