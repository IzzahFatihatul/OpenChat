import type { ChatAttachment } from '@/lib/firebase/firestore-service';

// Cloudflare R2 configuration
interface R2Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  publicUrlBase: string;
}

// Get R2 config from environment variables
const getR2Config = (): R2Config => {
  const config = {
    bucket: process.env.R2_BUCKET!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    endpoint: process.env.R2_ENDPOINT!,
    publicUrlBase: process.env.R2_PUBLIC_URL_BASE!,
  };

  const requiredFields: (keyof R2Config)[] = [
    'bucket',
    'accessKeyId',
    'secretAccessKey',
    'endpoint',
    'publicUrlBase',
  ];

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required R2 configuration: ${field.toUpperCase()}`);
    }
  }

  return config;
};

// Simple S3-compatible client for Cloudflare R2
class R2Client {
  private config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
  }

  // Generate a signed upload URL for client-side upload
  async generateUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600
  ): Promise<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
  }> {
    // Note: In a real implementation, you'd generate a proper signed URL
    // For now, we'll return the direct endpoint URL and handle this server-side
    
    const publicUrl = `${this.config.publicUrlBase}${key}`;
    
    // This should be implemented as a Firebase Function for security
    // The function would generate proper signed URLs using AWS SDK v3
    const uploadUrl = `/api/r2/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;

    return {
      uploadUrl,
      publicUrl,
      key,
    };
  }

  // Generate a public URL for a stored file
  getPublicUrl(key: string): string {
    return `${this.config.publicUrlBase}${key}`;
  }

  // Generate a file key for upload
  generateFileKey(userId: string, filename: string, chatId?: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    if (chatId) {
      return `chat-attachments/${userId}/${chatId}/${timestamp}-${randomString}-${safeName}`;
    }
    
    return `user-uploads/${userId}/${timestamp}-${randomString}-${safeName}`;
  }
}

// File upload service that integrates with Firebase and R2
export class FileUploadService {
  private r2Client: R2Client;

  constructor() {
    const config = getR2Config();
    this.r2Client = new R2Client(config);
  }

  // Generate upload URL and metadata for a file
  async prepareFileUpload(params: {
    userId: string;
    filename: string;
    contentType: string;
    size: number;
    chatId?: string;
  }): Promise<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    attachment: Omit<ChatAttachment, 'id'>;
  }> {
    // Generate file key
    const key = this.r2Client.generateFileKey(
      params.userId,
      params.filename,
      params.chatId
    );

    // Generate upload URL
    const { uploadUrl, publicUrl } = await this.r2Client.generateUploadUrl(
      key,
      params.contentType
    );

    // Prepare attachment metadata
    const attachment: Omit<ChatAttachment, 'id'> = {
      chatId: params.chatId || '',
      userId: params.userId,
      key,
      filename: params.filename,
      contentType: params.contentType,
      size: params.size,
      url: publicUrl,
      createdAt: Date.now(),
    };

    return {
      uploadUrl,
      publicUrl,
      key,
      attachment,
    };
  }

  // Get public URL for a file
  getPublicUrl(key: string): string {
    return this.r2Client.getPublicUrl(key);
  }

  // Upload file directly (would be used in Firebase Functions)
  async uploadFile(
    key: string,
    file: Buffer | ArrayBuffer,
    contentType: string
  ): Promise<string> {
    // This would be implemented in Firebase Functions using AWS SDK v3
    // For client-side, we use the signed upload URL approach
    throw new Error('Direct upload should be handled by Firebase Functions');
  }

  // Delete file (would be used in Firebase Functions)
  async deleteFile(key: string): Promise<void> {
    // This would be implemented in Firebase Functions using AWS SDK v3
    // For now, we'll handle this via API endpoint
    throw new Error('File deletion should be handled by Firebase Functions');
  }

  // Validate file before upload
  validateFile(file: File, options: {
    maxSize?: number;
    allowedTypes?: string[];
  } = {}): { valid: boolean; error?: string } {
    const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
    const allowedTypes = options.allowedTypes || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
    ];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    return { valid: true };
  }

  // Helper to extract file info from File object
  getFileInfo(file: File): {
    filename: string;
    contentType: string;
    size: number;
  } {
    return {
      filename: file.name,
      contentType: file.type,
      size: file.size,
    };
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();

// React hook for file uploads
export function useFileUpload() {
  const uploadFile = async (
    file: File,
    userId: string,
    chatId?: string
  ): Promise<{
    attachment: ChatAttachment;
    uploadUrl: string;
  }> => {
    // Validate file
    const validation = fileUploadService.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Get file info
    const { filename, contentType, size } = fileUploadService.getFileInfo(file);

    // Prepare upload
    const { uploadUrl, attachment } = await fileUploadService.prepareFileUpload({
      userId,
      filename,
      contentType,
      size,
      chatId,
    });

    return {
      attachment: { ...attachment, id: '' }, // ID will be set after Firestore creation
      uploadUrl,
    };
  };

  return {
    uploadFile,
    validateFile: fileUploadService.validateFile.bind(fileUploadService),
    getPublicUrl: fileUploadService.getPublicUrl.bind(fileUploadService),
  };
}