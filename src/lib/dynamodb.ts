import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-southeast-7"; // Adjust to your actual region, e.g., ap-southeast-1

// Use static env credentials only when both are provided; otherwise leave
// `credentials` unset so the AWS SDK's default provider chain (EC2 instance role)
// supplies them. This lets the app run with NO long-lived keys on the box.
const staticCreds =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const ddbClient = new DynamoDBClient({
  region: REGION,
  ...(staticCreds ? { credentials: staticCreds } : {}),
});

const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: false, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: true, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false, // false, by default.
};

const translateConfig = { marshallOptions, unmarshallOptions };

// Create the DynamoDB Document client.
const docClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

export { docClient };
