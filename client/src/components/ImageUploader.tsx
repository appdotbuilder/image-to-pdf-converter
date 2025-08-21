import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileImage, X, AlertCircle } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { ImageFormat, ImageUpload } from '../../../server/src/schema';

interface ImageUploaderProps {
  conversionId: number;
  onImageUploaded: (uploadedImages: ImageUpload[]) => void;
  onUploadProgress: (progress: number) => void;
  disabled?: boolean;
  demoMode?: boolean;
}

interface PendingUpload {
  file: File;
  id: string;
  preview: string;
}

const ACCEPTED_FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp', 'gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageUploader({ 
  conversionId, 
  onImageUploaded, 
  onUploadProgress, 
  disabled = false,
  demoMode = false 
}: ImageUploaderProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get file format from MIME type
  const getImageFormat = (file: File): ImageFormat | null => {
    const mimeToFormat: Record<string, ImageFormat> = {
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpeg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    return mimeToFormat[file.type] || null;
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'File must be an image';
    }

    const format = getImageFormat(file);
    if (!format || !ACCEPTED_FORMATS.includes(format)) {
      return `Unsupported format. Please use: ${ACCEPTED_FORMATS.join(', ').toUpperCase()}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newUploads: PendingUpload[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      const preview = URL.createObjectURL(file);
      newUploads.push({
        file,
        id: Math.random().toString(36).substring(7),
        preview
      });
    });

    if (errors.length > 0) {
      setUploadError(errors.join('\n'));
    } else {
      setUploadError(null);
    }

    setPendingUploads(prev => [...prev, ...newUploads]);
  }, []);

  // Remove pending upload
  const removePendingUpload = useCallback((id: string) => {
    setPendingUploads(prev => {
      const updated = prev.filter(upload => upload.id !== id);
      // Revoke object URL to prevent memory leaks
      const removed = prev.find(upload => upload.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  }, []);

  // Upload all pending files
  const uploadFiles = useCallback(async () => {
    if (pendingUploads.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    onUploadProgress(0);

    try {
      const totalFiles = pendingUploads.length;
      let completedFiles = 0;
      const uploadedImages: ImageUpload[] = [];

      for (const upload of pendingUploads) {
        const format = getImageFormat(upload.file);
        if (!format) continue;

        if (demoMode) {
          // Demo mode: simulate upload with progress
          await new Promise(resolve => setTimeout(resolve, 500)); // Simulate upload delay
          
          // Create mock image upload record
          const mockImage: ImageUpload = {
            id: Math.floor(Math.random() * 10000) + 1,
            original_name: upload.file.name,
            file_path: `/uploads/${conversionId}/${upload.file.name}`,
            file_size: upload.file.size,
            format: format,
            order_index: completedFiles,
            conversion_id: conversionId,
            uploaded_at: new Date()
          };
          
          uploadedImages.push(mockImage);
        } else {
          // Real backend upload
          const filePath = `/uploads/${conversionId}/${upload.file.name}`;

          const uploadedImage = await trpc.uploadImage.mutate({
            conversion_id: conversionId,
            original_name: upload.file.name,
            file_path: filePath,
            file_size: upload.file.size,
            format: format,
            order_index: completedFiles
          });
          
          uploadedImages.push(uploadedImage);
        }

        completedFiles++;
        onUploadProgress(Math.round((completedFiles / totalFiles) * 100));
      }

      // Clean up previews
      pendingUploads.forEach(upload => {
        URL.revokeObjectURL(upload.preview);
      });

      setPendingUploads([]);
      onImageUploaded(uploadedImages);
    } catch (err) {
      setUploadError('Failed to upload images. Please try again.');
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      onUploadProgress(0);
    }
  }, [pendingUploads, conversionId, onImageUploaded, onUploadProgress, demoMode]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    handleFileSelect(e.dataTransfer.files);
  }, [disabled, handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Images
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`
            upload-area border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${disabled 
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
              : 'border-blue-300 bg-blue-50 hover:bg-blue-100 cursor-pointer'
            }
          `}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <FileImage className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {disabled ? 'Upload Disabled' : 'Choose Images or Drag & Drop'}
          </h3>
          <p className="text-gray-600 mb-4">
            Support for JPEG, PNG, WEBP, and GIF formats (max 10MB each)
            {demoMode && <br />}
            {demoMode && <span className="text-blue-600 font-medium">Demo Mode: File upload simulation</span>}
          </p>
          {!disabled && (
            <Button variant="outline" className="bg-white">
              <Upload className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">
              {uploadError}
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Uploads */}
        {pendingUploads.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-700">
                Ready to Upload ({pendingUploads.length} files)
              </h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    pendingUploads.forEach(upload => {
                      URL.revokeObjectURL(upload.preview);
                    });
                    setPendingUploads([]);
                  }}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
                <Button
                  onClick={uploadFiles}
                  disabled={isUploading || disabled}
                  size="sm"
                >
                  {isUploading ? 'Uploading...' : 'Upload All'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pendingUploads.map(upload => (
                <div key={upload.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                    <img
                      src={upload.preview}
                      alt={upload.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePendingUpload(upload.id);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <p className="text-xs text-gray-600 mt-1 truncate" title={upload.file.name}>
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(upload.file.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}