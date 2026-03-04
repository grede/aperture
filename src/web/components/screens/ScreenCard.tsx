'use client';

import Image from 'next/image';
import Link from 'next/link';
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
  const previewVariant =
    screen.variants.find((variant) => variant.device_type === screen.device_type) ||
    screen.variants[0];
  const imagePath = `/api/uploads/${previewVariant?.screenshot_path || screen.screenshot_path}`;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[9/16] bg-muted">
        <Image
          src={imagePath}
          alt={`Screenshot for screen ${screen.position + 1}`}
          fill
          className="object-contain"
          unoptimized
        />
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {screen.variants.map((variant) => (
              <Badge key={variant.id} variant="secondary">
                {DEVICE_TYPE_LABELS[variant.device_type]}
              </Badge>
            ))}
            {screen.localized_variants.length > 0 && (
              <Badge variant="outline">{screen.localized_variants.length} localized</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/apps/${screen.app_id}/screens/${screen.id}`}>
            <Button size="sm" variant="outline">
              Open
            </Button>
          </Link>
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
