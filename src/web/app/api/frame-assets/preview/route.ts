import { NextRequest } from 'next/server';
import { resolveRealisticFrameAsset } from '../../../../../templates/realistic-frame-assets.js';

type SupportedDeviceType = 'iPhone' | 'iPad' | 'Android-phone' | 'Android-tablet';
type TemplateDeviceType = 'iPhone' | 'iPad' | 'Android';

const PREVIEW_ASSET_CONFIG: Record<
  SupportedDeviceType,
  { templateDeviceType: TemplateDeviceType; targetScreenAspect: number }
> = {
  iPhone: { templateDeviceType: 'iPhone', targetScreenAspect: 430 / 932 },
  iPad: { templateDeviceType: 'iPad', targetScreenAspect: 3 / 4 },
  'Android-phone': { templateDeviceType: 'Android', targetScreenAspect: 9 / 19.5 },
  'Android-tablet': { templateDeviceType: 'Android', targetScreenAspect: 3 / 4 },
};

function isSupportedDeviceType(value: string): value is SupportedDeviceType {
  return value in PREVIEW_ASSET_CONFIG;
}

export async function GET(request: NextRequest) {
  const deviceTypeParam = request.nextUrl.searchParams.get('device_type');
  if (!deviceTypeParam || !isSupportedDeviceType(deviceTypeParam)) {
    return new Response('Invalid device_type', { status: 400 });
  }

  const config = PREVIEW_ASSET_CONFIG[deviceTypeParam];
  const frameAsset = await resolveRealisticFrameAsset({
    deviceType: config.templateDeviceType,
    targetScreenAspect: config.targetScreenAspect,
  });

  if (!frameAsset) {
    return new Response('No realistic frame asset found', { status: 404 });
  }

  return new Response(new Uint8Array(frameAsset.overlay), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
