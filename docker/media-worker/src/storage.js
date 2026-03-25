/**
 * MinIO / S3-compatible storage client.
 * Reads MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET from env.
 */
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "http://minio:9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "paperclip-files";

let _client = null;

function getClient() {
  if (!_client) {
    _client = new S3Client({
      endpoint: MINIO_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return _client;
}

/**
 * Download an object from MinIO and return its contents as a Buffer.
 * @param {string} key - the storage key (object path in the bucket)
 * @returns {Promise<Buffer>}
 */
export async function getObject(key) {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key });
  const response = await client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a buffer to MinIO.
 * @param {string} key - the storage key
 * @param {Buffer} buffer - file contents
 * @param {string} contentType - MIME type
 */
export async function putObject(key, buffer, contentType) {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
}

export { MINIO_BUCKET };
