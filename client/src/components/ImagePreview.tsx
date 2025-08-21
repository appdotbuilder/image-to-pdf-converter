import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  GripVertical, 
  Trash2, 
  FileImage, 
  ArrowUp, 
  ArrowDown,
  Info
} from 'lucide-react';
import type { ImageUpload } from '../../../server/src/schema';

interface ImagePreviewProps {
  images: ImageUpload[];
  onImageDelete: (imageId: number) => Promise<void>;
  onImageReorder: (imageOrders: Array<{ image_id: number; order_index: number }>) => Promise<void>;
  disabled?: boolean;
}

export function ImagePreview({ 
  images, 
  onImageDelete, 
  onImageReorder, 
  disabled = false 
}: ImagePreviewProps) {
  const [isReordering, setIsReordering] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sort images by order_index
  const sortedImages = [...images].sort((a, b) => a.order_index - b.order_index);

  // Handle image deletion
  const handleDelete = useCallback(async (imageId: number) => {
    if (disabled) return;
    
    try {
      await onImageDelete(imageId);
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  }, [onImageDelete, disabled]);

  // Move image up/down
  const moveImage = useCallback(async (currentIndex: number, direction: 'up' | 'down') => {
    if (disabled) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sortedImages.length) return;

    const reorderedImages = [...sortedImages];
    [reorderedImages[currentIndex], reorderedImages[newIndex]] = 
    [reorderedImages[newIndex], reorderedImages[currentIndex]];

    const imageOrders = reorderedImages.map((img, index) => ({
      image_id: img.id,
      order_index: index
    }));

    setIsReordering(true);
    try {
      await onImageReorder(imageOrders);
    } finally {
      setIsReordering(false);
    }
  }, [sortedImages, onImageReorder, disabled]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, [disabled]);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [disabled, draggedIndex]);

  // Handle drop
  const handleDrop = useCallback(async (e: React.DragEvent, dropIndex: number) => {
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    e.preventDefault();

    const reorderedImages = [...sortedImages];
    const [draggedImage] = reorderedImages.splice(draggedIndex, 1);
    reorderedImages.splice(dropIndex, 0, draggedImage);

    const imageOrders = reorderedImages.map((img, index) => ({
      image_id: img.id,
      order_index: index
    }));

    setIsReordering(true);
    try {
      await onImageReorder(imageOrders);
    } finally {
      setIsReordering(false);
      setDraggedIndex(null);
    }
  }, [sortedImages, draggedIndex, onImageReorder, disabled]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)}KB` : `${mb.toFixed(1)}MB`;
  };

  if (sortedImages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileImage className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No Images Uploaded</h3>
        <p>Upload some images to get started with your PDF conversion.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Images will appear in your PDF in the order shown below. 
          {!disabled && ' Use drag & drop or the arrow buttons to reorder them.'}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {sortedImages.map((image, index) => (
          <div
            key={image.id}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={`
              flex items-center gap-4 p-4 border rounded-lg bg-white transition-all
              ${!disabled && 'hover:shadow-md cursor-move'}
              ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
              ${disabled ? 'opacity-75' : ''}
            `}
          >
            {/* Drag Handle */}
            <div className={`flex-shrink-0 ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
              <GripVertical className="h-5 w-5" />
            </div>

            {/* Order Badge */}
            <div className="flex-shrink-0">
              <Badge variant="outline" className="w-8 h-8 flex items-center justify-center rounded-full">
                {index + 1}
              </Badge>
            </div>

            {/* Image Preview - Placeholder since we don't have actual image data */}
            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 border rounded-lg flex items-center justify-center">
              <FileImage className="h-8 w-8 text-gray-400" />
            </div>

            {/* Image Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate" title={image.original_name}>
                {image.original_name}
              </h4>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="uppercase">{image.format}</span>
                <span>{formatFileSize(image.file_size)}</span>
                <span>Uploaded {image.uploaded_at.toLocaleDateString()}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Move Up/Down Buttons */}
              {!disabled && (
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveImage(index, 'up')}
                    disabled={index === 0 || isReordering}
                    className="h-6 w-6 p-0"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveImage(index, 'down')}
                    disabled={index === sortedImages.length - 1 || isReordering}
                    className="h-6 w-6 p-0"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Delete Button */}
              {!disabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(image.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {sortedImages.length > 1 && !disabled && (
        <div className="text-center text-sm text-gray-600 mt-4">
          💡 Tip: Drag and drop images to reorder them, or use the arrow buttons
        </div>
      )}
    </div>
  );
}