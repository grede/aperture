import { NextRequest } from 'next/server';
import { listRealisticFrameAssetFiles } from '../../../../../templates/realistic-frame-assets.js';
import { errorResponse, successResponse } from '@/lib/api-helpers';

type SupportedDeviceType = 'iPhone' | 'iPad' | 'Android-phone' | 'Android-tablet';
type TemplateDeviceType = 'iPhone' | 'iPad' | 'Android';

const DEVICE_TO_TEMPLATE: Record<SupportedDeviceType, TemplateDeviceType> = {
  iPhone: 'iPhone',
  iPad: 'iPad',
  'Android-phone': 'Android',
  'Android-tablet': 'Android',
};

function isSupportedDeviceType(value: string): value is SupportedDeviceType {
  return value in DEVICE_TO_TEMPLATE;
}

export async function GET(request: NextRequest) {
  const deviceTypeParam = request.nextUrl.searchParams.get('device_type');
  if (!deviceTypeParam || !isSupportedDeviceType(deviceTypeParam)) {
    return errorResponse('Invalid device_type', 400);
  }

  const files = await listRealisticFrameAssetFiles({
    deviceType: DEVICE_TO_TEMPLATE[deviceTypeParam],
  });

  return successResponse({
    device_type: deviceTypeParam,
    files,
  });
}
