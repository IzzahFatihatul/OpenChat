import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/config';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Simple S3-compatible upload for Cloudflare R2
async function uploadToR2(key: string, file: Buffer, contentType: string) {
  // This is a placeholder implementation
  // In production, you'd use AWS SDK v3 with R2 endpoint
  const endpoint = process.env.R2_ENDPOINT!;
  const bucket = process.env.R2_BUCKET!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

  // For now, return success - in production implement proper AWS SDK v3 upload
  const uploadUrl = `${endpoint}/${bucket}/${key}`;
  
  console.log('Would upload to R2:', { key, contentType, size: file.length });
  
  return {
    success: true,
    url: `${process.env.R2_PUBLIC_URL_BASE}${key}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      const adminAuth = getAuth();
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const key = formData.get('key') as string;

    if (!file || !key) {
      return NextResponse.json(
        { error: 'Missing file or key parameter' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed` },
        { status: 400 }
      );
    }

    // Verify key belongs to the authenticated user
    if (!key.startsWith(`user-uploads/${decodedToken.uid}/`) && 
        !key.startsWith(`chat-attachments/${decodedToken.uid}/`)) {
      return NextResponse.json(
        { error: 'Invalid file key for user' },
        { status: 403 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to R2
    const result = await uploadToR2(key, buffer, file.type);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      key,
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}