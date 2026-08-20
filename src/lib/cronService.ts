import { docClient } from '@/lib/dynamodb';
import { invalidateEmployeesCache } from '@/lib/employeesCache';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export async function processAdjustments() {
  try {
    const scanCommand = new ScanCommand({
      TableName: 'fullstaff',
      FilterExpression: 'attribute_exists(pending_adjustment)'
    });

    const response = await docClient.send(scanCommand);
    const employees = response.Items || [];

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let processedCount = 0;

    for (const emp of employees) {
      const adj = emp.pending_adjustment;
      if (!adj || !adj.effectiveDate) continue;

      if (adj.effectiveDate <= today) {
        let deptCode = "";
        if (adj.department && adj.department.includes("(")) {
          const match = adj.department.match(/\(([^)]+)\)/);
          if (match) {
            deptCode = match[1].trim();
          }
        }

        const updateCommand = new UpdateCommand({
          TableName: 'fullstaff',
          Key: { staff_id: emp.staff_id || emp.emp_code },
          UpdateExpression: 'set department = :dept, dept_code = :deptCode, division = :div, section = :sec, unit = :unit, position = :pos, title = :pos REMOVE pending_adjustment',
          ExpressionAttributeValues: {
            ':dept': adj.department === "-" ? "" : adj.department,
            ':deptCode': deptCode || "-",
            ':div': adj.division === "-" ? "" : adj.division,
            ':sec': adj.section === "-" ? "" : adj.section,
            ':unit': adj.unit === "-" ? "" : adj.unit,
            ':pos': adj.position === "-" ? "" : adj.position,
          }
        });

        await docClient.send(updateCommand);
        processedCount++;
      }
    }

    return { success: true, processed: processedCount, totalPending: employees.length };
  } catch (error) {
    console.error('Error in processAdjustments:', error);
    return { success: false, error };
  }
}

export async function processProbationTransitions() {
  try {
    let allItems: any[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    // Scan all items from fullstaff
    do {
      const command: any = new ScanCommand({
        TableName: 'fullstaff',
        ExclusiveStartKey: lastEvaluatedKey,
      });
      
      const response: any = await docClient.send(command);
      if (response.Items) {
        allItems = allItems.concat(response.Items);
      }
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    let transitionedPass = 0;
    let transitionedFail = 0;

    for (const item of allItems) {
      const empType = item.emp_type || "";
      const status = item.status || "Active";
      const outcome = item.probation_outcome || "";
      const probEnd = item.probation_end_date || "";
      const lastWork = item.last_working_date || item.resign_date || "";

      let needsUpdate = false;
      let targetEmpType = item.emp_type;
      let targetStatus = item.status;

      // 1. Pass Probation transition:
      // When today reaches or exceeds the probation end date for a passed employee
      if (
        empType.toLowerCase() === "probation" &&
        outcome.toLowerCase() === "pass" &&
        probEnd &&
        probEnd !== "-" &&
        todayStr >= probEnd
      ) {
        targetEmpType = "Normal";
        needsUpdate = true;
        transitionedPass++;
      }

      // 2. Fail Probation transition:
      // When today reaches or exceeds the last working date for a failed employee
      if (
        status.toLowerCase() === "active" &&
        outcome.toLowerCase() === "fail" &&
        lastWork &&
        lastWork !== "-" &&
        todayStr >= lastWork
      ) {
        targetStatus = "Failed Probation";
        needsUpdate = true;
        transitionedFail++;
      }

      if (needsUpdate) {
        const staffId = item.staff_id;
        if (staffId) {
          await docClient.send(
            new UpdateCommand({
              TableName: "fullstaff",
              Key: { staff_id: staffId },
              UpdateExpression: "set emp_type = :t, #st = :s",
              ExpressionAttributeNames: {
                "#st": "status"
              },
              ExpressionAttributeValues: {
                ":t": targetEmpType || "-",
                ":s": targetStatus || "-"
              }
            })
          );
        }
      }
    }

    if (transitionedPass > 0 || transitionedFail > 0) {
      invalidateEmployeesCache();
    }

    return { success: true, transitionedPass, transitionedFail, totalChecked: allItems.length };
  } catch (error) {
    console.error('Error in processProbationTransitions:', error);
    return { success: false, error };
  }
}
