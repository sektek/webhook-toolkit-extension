import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestRecord } from './request-record';

/**
 * Creates a RequestRecord from an Express Request object
 * @param req The Express Request object
 * @param ip The IP address of the client
 * @returns A RequestRecord object containing the request data
 */
export function createRequestRecord(req: Request, ip: string): RequestRecord {
  // Generate a unique ID for this request
  const id = uuidv4();
  
  // Get the current timestamp
  const timestamp = new Date();
  
  // Validate and normalize the HTTP method
  const method = req.method as 'POST' | 'PUT';
  if (method !== 'POST' && method !== 'PUT') {
    throw new Error(`Unsupported HTTP method: ${req.method}`);
  }
  
  // Extract the request path
  const path = req.path || req.url || '/';
  
  // Extract headers, converting all keys to lowercase for consistency
  const headers: Record<string, string> = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      // For multi-value headers, join with commas
      headers[key.toLowerCase()] = value.join(', ');
    } else if (value !== undefined) {
      headers[key.toLowerCase()] = String(value);
    }
  });
  
  // Extract content-type from headers
  const contentType = headers['content-type'];
  
  // Extract and serialize the request body
  let body: string;
  let bodySize: number;
  
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body.toString('utf8');
    } else if (typeof req.body === 'object') {
      // For objects (parsed JSON), stringify them
      body = JSON.stringify(req.body);
    } else {
      // For other types, convert to string
      body = String(req.body);
    }
  } else {
    body = '';
  }
  
  // Calculate body size in bytes
  bodySize = Buffer.byteLength(body, 'utf8');
  
  return {
    id,
    timestamp,
    ip,
    method,
    path,
    headers,
    body,
    contentType,
    bodySize,
  };
}