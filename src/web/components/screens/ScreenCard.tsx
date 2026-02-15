'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Screen } from '@/types';
import { DEVICE_TYPE_LABELS } from '@/lib/constants';

interface ScreenCardProps {
  screen: Screen;
  onDelete?: () => void;
}

export function ScreenCard({ screen, onDelete }: ScreenCardProps) {
  const imagePath = `/api/uploads/${screen.screenshot_path}`;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[9/16] bg-muted">
        <Image
          src={imagePath}
          alt={`Screen ${screen.id}`}
          fill
          className="object-contain"
          unoptimized
        />
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {DEVICE_TYPE_LABELS[screen.device_type]}
          </Badge>
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
