'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DEVICE_TYPE_LABELS,
  SUPPORTED_LOCALES,
  TEMPLATE_FONT_OPTIONS,
  TEMPLATE_FONT_SIZE_LIMITS,
  TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS,
} from '@/lib/constants';
import type {
  AppWithScreens,
  CopiesByScreenAndLocale,
  DeviceType,
  FrameAssetFilesByDevice,
  FrameOffset,
  FrameOffsetsByDevice,
  FrameMode,
  FrameModesByDevice,
  FrameScalesByDevice,
  GenerationConfig,
  GenerationPreset,
  PreviewLayoutMetadata,
  ScreenGenerationConfig,
  TemplateFontFamily,
  TemplateBackground,
  Screen,
  TemplateRect,
  TemplateStyle,
} from '@/types';

const BACKGROUND_TEMPLATE_STYLE: TemplateStyle = 'modern';
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FRAME_SCALE_MIN = 0.6;
const FRAME_SCALE_MAX = 1;
const FRAME_SCALE_STEP = 0.05;
const FRAME_OFFSET_MIN = -1;
const FRAME_OFFSET_MAX = 1;
const FRAME_OFFSET_STEP = 0.05;
const SOLID_COLOR_PRESETS = [
  '#111827',
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#DC2626',
  '#84CC16',
  '#F8FAFC',
];
const GRADIENT_PRESETS = [
  { from: '#4A90E2', to: '#7B68EE', label: 'Indigo Sky' },
  { from: '#FF6B6B', to: '#FFD93D', label: 'Sunset Pop' },
  { from: '#0EA5E9', to: '#14B8A6', label: 'Blue Mint' },
  { from: '#EC4899', to: '#8B5CF6', label: 'Berry Neon' },
  { from: '#22C55E', to: '#3B82F6', label: 'Fresh Ocean' },
  { from: '#F97316', to: '#EF4444', label: 'Warm Glow' },
];
const FONT_PREVIEW_STACKS: Record<TemplateFontFamily, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  avenir: "Avenir Next, Avenir, 'Segoe UI', Helvetica, Arial, sans-serif",
  courier: "'Courier New', Courier, monospace",
  inter: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
  roboto: "Roboto, 'Segoe UI', Helvetica, Arial, sans-serif",
  open_sans: "'Open Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  poppins: "Poppins, 'Segoe UI', Helvetica, Arial, sans-serif",
  montserrat: "Montserrat, 'Segoe UI', Helvetica, Arial, sans-serif",
  lato: "Lato, 'Segoe UI', Helvetica, Arial, sans-serif",
  oswald: "Oswald, 'Arial Narrow', Arial, sans-serif",
  raleway: "Raleway, 'Segoe UI', Helvetica, Arial, sans-serif",
  nunito: "Nunito, 'Segoe UI', Helvetica, Arial, sans-serif",
  playfair_display: "Playfair Display, Georgia, 'Times New Roman', serif",
  merriweather: "Merriweather, Georgia, 'Times New Roman', serif",
  lora: "Lora, Georgia, 'Times New Roman', serif",
  source_sans_3: "Source Sans 3, 'Segoe UI', Helvetica, Arial, sans-serif",
  dm_sans: "DM Sans, 'Segoe UI', Helvetica, Arial, sans-serif",
  rubik: "Rubik, 'Segoe UI', Helvetica, Arial, sans-serif",
  manrope: "Manrope, 'Segoe UI', Helvetica, Arial, sans-serif",
  work_sans: "'Work Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  fira_sans: "'Fira Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  pt_sans: "'PT Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  karla: "Karla, 'Segoe UI', Helvetica, Arial, sans-serif",
  jost: "Jost, 'Segoe UI', Helvetica, Arial, sans-serif",
  barlow: "Barlow, 'Segoe UI', Helvetica, Arial, sans-serif",
  quicksand: "Quicksand, 'Segoe UI', Helvetica, Arial, sans-serif",
  bebas_neue: "'Bebas Neue', 'Arial Narrow', Arial, sans-serif",
  space_grotesk: "'Space Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif",
  ubuntu: "Ubuntu, 'Segoe UI', Helvetica, Arial, sans-serif",
  josefin_sans: "'Josefin Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  libre_baskerville: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
  libre_franklin: "'Libre Franklin', 'Segoe UI', Helvetica, Arial, sans-serif",
  mukta: "Mukta, 'Segoe UI', Helvetica, Arial, sans-serif",
  oxygen: "Oxygen, 'Segoe UI', Helvetica, Arial, sans-serif",
  exo_2: "'Exo 2', 'Segoe UI', Helvetica, Arial, sans-serif",
  inconsolata: "Inconsolata, 'Courier New', Courier, monospace",
  merriweather_sans: "'Merriweather Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  teko: "Teko, 'Arial Narrow', Arial, sans-serif",
  anton: "Anton, 'Arial Narrow', Arial, sans-serif",
  archivo: "Archivo, 'Segoe UI', Helvetica, Arial, sans-serif",
  assistant: "Assistant, 'Segoe UI', Helvetica, Arial, sans-serif",
  asap: "Asap, 'Segoe UI', Helvetica, Arial, sans-serif",
  barlow_condensed: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
  figtree: "Figtree, 'Segoe UI', Helvetica, Arial, sans-serif",
  public_sans: "'Public Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  red_hat_display: "'Red Hat Display', 'Segoe UI', Helvetica, Arial, sans-serif",
  red_hat_text: "'Red Hat Text', 'Segoe UI', Helvetica, Arial, sans-serif",
  sora: "Sora, 'Segoe UI', Helvetica, Arial, sans-serif",
  plus_jakarta_sans: "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  epilogue: "Epilogue, 'Segoe UI', Helvetica, Arial, sans-serif",
  lexend: "Lexend, 'Segoe UI', Helvetica, Arial, sans-serif",
  inter_tight: "'Inter Tight', 'Segoe UI', Helvetica, Arial, sans-serif",
  fraunces: "Fraunces, Georgia, 'Times New Roman', serif",
  cormorant_garamond: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  crimson_pro: "'Crimson Pro', Georgia, 'Times New Roman', serif",
  cabin: "Cabin, 'Segoe UI', Helvetica, Arial, sans-serif",
  titillium_web: "'Titillium Web', 'Segoe UI', Helvetica, Arial, sans-serif",
  hind: "Hind, 'Segoe UI', Helvetica, Arial, sans-serif",
  prompt: "Prompt, 'Segoe UI', Helvetica, Arial, sans-serif",
  arimo: "Arimo, 'Segoe UI', Helvetica, Arial, sans-serif",
  heebo: "Heebo, 'Segoe UI', Helvetica, Arial, sans-serif",
  kanit: "Kanit, 'Segoe UI', Helvetica, Arial, sans-serif",
  dosis: "Dosis, 'Segoe UI', Helvetica, Arial, sans-serif",
};

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

function resolveHexColor(value: string | null | undefined, fallback: string): string {
  return normalizeHexColor(value ?? '') || fallback;
}

function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.name || code;
}

function collectSavedLocales(copies: CopiesByScreenAndLocale): string[] {
  const localeSet = new Set<string>();
  Object.values(copies).forEach((byLocale) => {
    Object.keys(byLocale).forEach((locale) => localeSet.add(locale));
  });
  return Array.from(localeSet).sort((a, b) => localeLabel(a).localeCompare(localeLabel(b)));
}

type VariantLike = { device_type: DeviceType; screenshot_path: string };

function findVariantForDevice(screen: Screen, deviceType: DeviceType): VariantLike | null {
  return screen.variants.find((variant) => variant.device_type === deviceType) || null;
}

function findLocalizedVariantForDeviceAndLocale(
  screen: Screen,
  deviceType: DeviceType,
  locale: string
): VariantLike | null {
  return (
    screen.localized_variants.find(
      (variant) => variant.device_type === deviceType && variant.locale === locale
    ) || null
  );
}

function findPreferredVariantForDeviceAndLocale(
  screen: Screen,
  deviceType: DeviceType,
  locale: string
): VariantLike | null {
  return (
    findLocalizedVariantForDeviceAndLocale(screen, deviceType, locale) ||
    findVariantForDevice(screen, deviceType)
  );
}

function screenHasDeviceVariant(screen: Screen, deviceType: DeviceType): boolean {
  return findVariantForDevice(screen, deviceType) !== null;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function buildFramePreviewPath(deviceType: DeviceType, frameFile?: string): string {
  const params = new URLSearchParams({ device_type: deviceType });
  if (frameFile) {
    params.set('frame_file', frameFile);
  }
  return `/api/frame-assets/preview?${params.toString()}`;
}

function frameFileLabel(frameFile: string): string {
  return frameFile.replace(/\.png$/i, '');
}

function normalizeFrameScale(value?: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const clamped = Math.max(FRAME_SCALE_MIN, Math.min(FRAME_SCALE_MAX, value ?? 1));
  return Math.round(clamped / FRAME_SCALE_STEP) * FRAME_SCALE_STEP;
}

function normalizeFrameOffsetAxis(value?: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const clamped = Math.max(FRAME_OFFSET_MIN, Math.min(FRAME_OFFSET_MAX, value ?? 0));
  return Math.round(clamped / FRAME_OFFSET_STEP) * FRAME_OFFSET_STEP;
}

function normalizeFrameOffset(offset?: FrameOffset): Required<FrameOffset> {
  return {
    x: normalizeFrameOffsetAxis(offset?.x),
    y: normalizeFrameOffsetAxis(offset?.y),
  };
}

function rectToPercentageStyle(rect: TemplateRect, canvas: PreviewLayoutMetadata['canvas']) {
  return {
    left: `${(rect.left / canvas.width) * 100}%`,
    top: `${(rect.top / canvas.height) * 100}%`,
    width: `${(rect.width / canvas.width) * 100}%`,
    height: `${(rect.height / canvas.height) * 100}%`,
  };
}

function resolveFrameTransformFromRect(
  nextRect: TemplateRect,
  visualRegion: TemplateRect,
  baseFrameSize: { width: number; height: number }
) {
  const nextScale = normalizeFrameScale(nextRect.width / baseFrameSize.width);
  const availableX = Math.max(0, visualRegion.width - nextRect.width);
  const availableY = Math.max(0, visualRegion.height - nextRect.height);

  return {
    scale: nextScale,
    offset: {
      x: availableX === 0 ? 0 : ((nextRect.left - visualRegion.left) / availableX) * 2 - 1,
      y: availableY === 0 ? 0 : ((nextRect.top - visualRegion.top) / availableY) * 2 - 1,
    },
  };
}

type DragSession = {
  pointerId: number;
  deviceType: DeviceType;
  mode: 'move' | 'resize';
  corner?: 'nw' | 'ne' | 'sw' | 'se';
  startClientX: number;
  startClientY: number;
  startFrameRect: TemplateRect;
  visualRegion: TemplateRect;
  canvas: PreviewLayoutMetadata['canvas'];
  baseFrameSize: { width: number; height: number };
};

function FrameModePreview({
  deviceType,
  mode,
  frameFile,
}: {
  deviceType: DeviceType;
  mode: FrameMode;
  frameFile?: string;
}) {
  const isTablet = deviceType === 'iPad' || deviceType === 'Android-tablet';
  const width = isTablet ? 66 : 48;
  const height = isTablet ? 86 : 94;
  const radius = isTablet ? 12 : 14;
  const screenRadius = mode === 'none' ? 8 : 10;

  if (mode === 'none') {
    return (
      <div className="mb-2 flex h-24 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-lg bg-gradient-to-br from-sky-200 via-blue-100 to-cyan-100 shadow-sm"
          style={{ width: width - 4, height: height - 10 }}
        >
          <div className="absolute inset-x-2 top-3 h-1 rounded-full bg-white/70" />
          <div className="absolute inset-x-3 bottom-3 h-2 rounded-full bg-white/65" />
        </div>
      </div>
    );
  }

  if (mode === 'realistic') {
    const framePreviewPath = buildFramePreviewPath(deviceType, frameFile);
    return (
      <div className="mb-2 flex h-24 items-center justify-center">
        <img
          src={framePreviewPath}
          alt={`${deviceType} realistic frame preview`}
          className="max-h-[84px] w-auto object-contain"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div className="mb-2 flex h-24 items-center justify-center">
      <div
        className="relative flex items-center justify-center border border-foreground/40 bg-background"
        style={{ width, height, borderRadius: radius }}
      >
        <div
          className="relative overflow-hidden bg-gradient-to-br from-sky-300 via-blue-200 to-indigo-200"
          style={{
            width: width - 4,
            height: height - 4,
            borderRadius: screenRadius,
          }}
        >
          <div className="absolute inset-x-2 top-2 h-1 rounded-full bg-white/65" />
          <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-white/55" />
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [copies, setCopies] = useState<CopiesByScreenAndLocale>({});
  const [selectedDevices, setSelectedDevices] = useState<DeviceType[]>([]);
  const [selectedLocales, setSelectedLocales] = useState<string[]>([]);
  const [selectedScreenIds, setSelectedScreenIds] = useState<number[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<number | null>(null);
  const [previewLocale, setPreviewLocale] = useState('en');
  const [previewDevice, setPreviewDevice] = useState<DeviceType | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<TemplateBackground['mode']>('solid');
  const [solidColor, setSolidColor] = useState('#4A90E2');
  const [gradientFrom, setGradientFrom] = useState('#4A90E2');
  const [gradientTo, setGradientTo] = useState('#7B68EE');
  const [backgroundImagePath, setBackgroundImagePath] = useState<string | null>(null);
  const [backgroundImageUploading, setBackgroundImageUploading] = useState(false);
  const [backgroundImageError, setBackgroundImageError] = useState<string | null>(null);
  const [includeText, setIncludeText] = useState(true);
  const [fontFamily, setFontFamily] = useState<TemplateFontFamily>('system');
  const [fontSize, setFontSize] = useState(52);
  const [subtitleFontSize, setSubtitleFontSize] = useState(29);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [frameModesByDevice, setFrameModesByDevice] = useState<FrameModesByDevice>({});
  const [frameAssetFilesByDevice, setFrameAssetFilesByDevice] = useState<
    Partial<Record<DeviceType, string[]>>
  >({});
  const [selectedFrameAssetFilesByDevice, setSelectedFrameAssetFilesByDevice] =
    useState<FrameAssetFilesByDevice>({});
  const [frameScalesByDevice, setFrameScalesByDevice] = useState<FrameScalesByDevice>({});
  const [frameOffsetsByDevice, setFrameOffsetsByDevice] = useState<FrameOffsetsByDevice>({});
  const [screenConfigsById, setScreenConfigsById] = useState<
    Partial<Record<number, ScreenGenerationConfig>>
  >({});
  const [frameFilesLoadingByDevice, setFrameFilesLoadingByDevice] = useState<
    Partial<Record<DeviceType, boolean>>
  >({});
  const [generationPresets, setGenerationPresets] = useState<GenerationPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetStatusMessage, setPresetStatusMessage] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayoutMetadata | null>(null);
  const [previewFrameRectOverride, setPreviewFrameRectOverride] = useState<TemplateRect | null>(
    null
  );
  const [previewTransformMode, setPreviewTransformMode] = useState<'move' | 'resize' | null>(null);
  const [suggestingGradient, setSuggestingGradient] = useState(false);
  const [gradientSuggestionError, setGradientSuggestionError] = useState<string | null>(null);
  const previewRequestIdRef = useRef(0);
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const previewFrameRectOverrideRef = useRef<TemplateRect | null>(null);

  const availableDevices = useMemo(() => {
    if (!app) return [];
    return Array.from(
      new Set(
        app.screens.flatMap((screen) => screen.variants.map((variant) => variant.device_type))
      )
    ) as DeviceType[];
  }, [app]);
  const availableScreenIds = useMemo(() => {
    if (!app) return [];
    return app.screens.map((screen) => screen.id);
  }, [app]);
  const selectedScreens = useMemo(() => {
    if (!app) {
      return [];
    }
    const selectedScreenIdSet = new Set(selectedScreenIds);
    return app.screens.filter((screen) => selectedScreenIdSet.has(screen.id));
  }, [app, selectedScreenIds]);
  const formatScreenLabel = useCallback(
    (screenId: number) => {
      const screen = app?.screens.find((candidate) => candidate.id === screenId);
      return screen ? `Screen ${screen.position + 1}` : `Screen ${screenId}`;
    },
    [app]
  );
  const activeScreen = useMemo(() => {
    if (!app || activeScreenId === null) {
      return null;
    }

    return app.screens.find((screen) => screen.id === activeScreenId) || null;
  }, [activeScreenId, app]);
  const previewScreen = useMemo(() => {
    if (!activeScreen || !previewDevice) {
      return null;
    }

    return screenHasDeviceVariant(activeScreen, previewDevice) ? activeScreen : null;
  }, [activeScreen, previewDevice]);

  const availableLocales = useMemo(() => collectSavedLocales(copies), [copies]);
  const defaultLocaleSelection = useMemo(() => {
    if (availableLocales.includes('en')) {
      return ['en'];
    }

    return availableLocales[0] ? [availableLocales[0]] : [];
  }, [availableLocales]);
  const getAvailableLocalesForScreen = useCallback(
    (screenId: number | null) => {
      if (screenId === null) {
        return availableLocales;
      }

      return Object.keys(copies[screenId] || {}).sort((a, b) =>
        localeLabel(a).localeCompare(localeLabel(b))
      );
    },
    [availableLocales, copies]
  );
  const getDefaultLocalesForScreen = useCallback(
    (screenId: number | null) => {
      const screenLocales = getAvailableLocalesForScreen(screenId);
      if (screenLocales.includes('en')) {
        return ['en'];
      }

      return screenLocales[0] ? [screenLocales[0]] : defaultLocaleSelection;
    },
    [defaultLocaleSelection, getAvailableLocalesForScreen]
  );
  const activeScreenAvailableLocales = useMemo(
    () => getAvailableLocalesForScreen(activeScreenId),
    [activeScreenId, getAvailableLocalesForScreen]
  );

  const buildDefaultScreenConfig = useCallback(
    (screenId: number | null): ScreenGenerationConfig => {
      const defaultLocales = getDefaultLocalesForScreen(screenId);
      const defaultFrameModes: FrameModesByDevice = {};
      const defaultFrameAssetFiles: FrameAssetFilesByDevice = {};
      const defaultFrameScales: FrameScalesByDevice = {};
      const defaultFrameOffsets: FrameOffsetsByDevice = {};

      availableDevices.forEach((deviceType) => {
        defaultFrameModes[deviceType] = 'minimal';
        const defaultFrameAssetFile = frameAssetFilesByDevice[deviceType]?.[0];
        if (defaultFrameAssetFile) {
          defaultFrameAssetFiles[deviceType] = defaultFrameAssetFile;
        }
        defaultFrameScales[deviceType] = 1;
        defaultFrameOffsets[deviceType] = { x: 0, y: 0 };
      });

      return {
        locales: defaultLocales,
        template_background: { mode: 'solid', color: '#4A90E2' },
        include_text: true,
        text_style: {
          font_family: 'system',
          font_size: 52,
          subtitle_size: 29,
          font_color: '#FFFFFF',
        },
        frame_mode: 'minimal',
        frame_modes: defaultFrameModes,
        frame_asset_files: defaultFrameAssetFiles,
        frame_scales: defaultFrameScales,
        frame_offsets: defaultFrameOffsets,
      };
    },
    [availableDevices, frameAssetFilesByDevice, getDefaultLocalesForScreen]
  );

  const ensureScreenConfig = useCallback(
    (screenId: number | null, config?: ScreenGenerationConfig): ScreenGenerationConfig => {
      const defaults = buildDefaultScreenConfig(screenId);
      const availableLocalesForScreen = getAvailableLocalesForScreen(screenId);
      const configuredLocales = (config?.locales || []).filter((locale) =>
        availableLocalesForScreen.includes(locale)
      );

      return {
        ...defaults,
        ...config,
        locales: configuredLocales.length > 0 ? configuredLocales : defaults.locales,
        template_background: config?.template_background ?? defaults.template_background,
        include_text: config?.include_text ?? defaults.include_text,
        text_style: {
          ...defaults.text_style,
          ...config?.text_style,
        },
        frame_mode: config?.frame_mode ?? defaults.frame_mode,
        frame_modes: {
          ...defaults.frame_modes,
          ...config?.frame_modes,
        },
        frame_asset_files: {
          ...defaults.frame_asset_files,
          ...config?.frame_asset_files,
        },
        frame_scales: {
          ...defaults.frame_scales,
          ...config?.frame_scales,
        },
        frame_offsets: {
          ...defaults.frame_offsets,
          ...config?.frame_offsets,
        },
      };
    },
    [buildDefaultScreenConfig, getAvailableLocalesForScreen]
  );

  const getScreenConfig = useCallback(
    (screenId: number | null): ScreenGenerationConfig => {
      if (screenId === null) {
        return ensureScreenConfig(null);
      }

      return ensureScreenConfig(screenId, screenConfigsById[screenId]);
    },
    [ensureScreenConfig, screenConfigsById]
  );
  const previewLocaleOptions = useMemo(() => {
    if (!previewScreen) {
      return [];
    }

    const screenLocaleOptions = getAvailableLocalesForScreen(previewScreen.id);
    const configuredLocales = getScreenConfig(previewScreen.id).locales || [];
    const configuredAvailableLocales = screenLocaleOptions.filter((locale) =>
      configuredLocales.includes(locale)
    );

    return configuredAvailableLocales.length > 0 ? configuredAvailableLocales : screenLocaleOptions;
  }, [getAvailableLocalesForScreen, getScreenConfig, previewScreen]);
  const previewVariant = useMemo(() => {
    if (!previewScreen || !previewDevice) {
      return null;
    }
    return findPreferredVariantForDeviceAndLocale(previewScreen, previewDevice, previewLocale);
  }, [previewLocale, previewScreen, previewDevice]);
  const templateBackground = useMemo<TemplateBackground | undefined>(() => {
    if (backgroundMode === 'transparent') {
      return {
        mode: 'transparent',
      };
    }

    if (backgroundMode === 'solid') {
      return {
        mode: 'solid',
        color: resolveHexColor(solidColor, '#4A90E2'),
      };
    }

    if (backgroundMode === 'image') {
      if (!backgroundImagePath) {
        return undefined;
      }

      return {
        mode: 'image',
        image_path: backgroundImagePath,
      };
    }

    return {
      mode: 'gradient',
      from: resolveHexColor(gradientFrom, '#4A90E2'),
      to: resolveHexColor(gradientTo, '#7B68EE'),
      angle: 135,
    };
  }, [backgroundMode, solidColor, gradientFrom, gradientTo, backgroundImagePath]);

  const backgroundPreviewStyle = useMemo(() => {
    if (backgroundMode === 'transparent') {
      return {
        backgroundColor: '#FFFFFF',
        backgroundImage:
          'linear-gradient(45deg, #E5E7EB 25%, transparent 25%), linear-gradient(-45deg, #E5E7EB 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E5E7EB 75%), linear-gradient(-45deg, transparent 75%, #E5E7EB 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      };
    }
    if (backgroundMode === 'solid') {
      return { backgroundColor: resolveHexColor(solidColor, '#4A90E2') };
    }
    if (backgroundMode === 'image') {
      if (!backgroundImagePath) {
        return undefined;
      }
      return {
        backgroundImage: `url(/api/uploads/${backgroundImagePath})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {
      backgroundImage: `linear-gradient(135deg, ${resolveHexColor(
        gradientFrom,
        '#4A90E2'
      )} 0%, ${resolveHexColor(gradientTo, '#7B68EE')} 100%)`,
    };
  }, [backgroundMode, solidColor, gradientFrom, gradientTo, backgroundImagePath]);

  const templateTextStyle = useMemo(
    () => ({
      font_family: fontFamily,
      font_size: fontSize,
      subtitle_size: subtitleFontSize,
      font_color: resolveHexColor(fontColor, '#FFFFFF'),
    }),
    [fontFamily, fontSize, subtitleFontSize, fontColor]
  );
  const selectedFontLabel = useMemo(
    () => TEMPLATE_FONT_OPTIONS.find((font) => font.value === fontFamily)?.label || 'System UI',
    [fontFamily]
  );
  const currentGenerationConfig = useMemo<GenerationConfig>(() => {
    const selectedScreenConfigs = selectedScreenIds.reduce<
      Partial<Record<number, ScreenGenerationConfig>>
    >((acc, screenId) => {
      acc[screenId] = getScreenConfig(screenId);
      return acc;
    }, {});
    const fallbackScreenConfig = getScreenConfig(activeScreenId);
    const mergedLocales = Array.from(
      new Set(
        selectedScreenIds.flatMap(
          (screenId) => getScreenConfig(screenId).locales || defaultLocaleSelection
        )
      )
    );

    return {
      devices: selectedDevices,
      locales: mergedLocales,
      screen_ids: selectedScreenIds,
      template_style: BACKGROUND_TEMPLATE_STYLE,
      template_background: fallbackScreenConfig.template_background,
      include_text: fallbackScreenConfig.include_text,
      text_style:
        fallbackScreenConfig.include_text !== false ? fallbackScreenConfig.text_style : undefined,
      frame_mode: fallbackScreenConfig.frame_mode || 'minimal',
      frame_modes: fallbackScreenConfig.frame_modes,
      frame_asset_files: fallbackScreenConfig.frame_asset_files,
      frame_scales: fallbackScreenConfig.frame_scales,
      frame_offsets: fallbackScreenConfig.frame_offsets,
      screen_configs: selectedScreenConfigs,
    };
  }, [
    activeScreenId,
    defaultLocaleSelection,
    getScreenConfig,
    selectedDevices,
    selectedScreenIds,
    screenConfigsById,
  ]);
  const selectedPreset = useMemo(
    () => generationPresets.find((preset) => preset.id === Number(selectedPresetId)) || null,
    [generationPresets, selectedPresetId]
  );

  useEffect(() => {
    loadData();
  }, [appId]);

  useEffect(() => {
    if (!app) return;

    setSelectedDevices((prev) => {
      if (prev.length > 0) {
        return prev.filter((device) => availableDevices.includes(device));
      }
      return [...availableDevices];
    });

    setSelectedLocales((prev) => {
      if (availableLocales.length === 0) return [];
      if (prev.length > 0) {
        return prev.filter((locale) => availableLocales.includes(locale));
      }
      if (availableLocales.includes('en')) return ['en'];
      return [availableLocales[0]];
    });

    setSelectedScreenIds((prev) => {
      const availableScreenIdSet = new Set(availableScreenIds);
      if (prev.length > 0) {
        return prev.filter((screenId) => availableScreenIdSet.has(screenId));
      }
      return [...availableScreenIds];
    });

    setFrameModesByDevice((prev) => {
      const next: FrameModesByDevice = {};
      availableDevices.forEach((deviceType) => {
        next[deviceType] = prev[deviceType] || 'minimal';
      });
      return next;
    });
    setFrameScalesByDevice((prev) => {
      const next: FrameScalesByDevice = {};
      availableDevices.forEach((deviceType) => {
        next[deviceType] = normalizeFrameScale(prev[deviceType]);
      });
      return next;
    });
    setFrameOffsetsByDevice((prev) => {
      const next: FrameOffsetsByDevice = {};
      availableDevices.forEach((deviceType) => {
        next[deviceType] = normalizeFrameOffset(prev[deviceType]);
      });
      return next;
    });
  }, [app, availableDevices, availableLocales, availableScreenIds]);

  useEffect(() => {
    if (!app) {
      return;
    }

    setScreenConfigsById((prev) => {
      let changed = false;
      const next = { ...prev };

      availableScreenIds.forEach((screenId) => {
        const ensured = ensureScreenConfig(screenId, next[screenId]);
        if (JSON.stringify(ensured) !== JSON.stringify(next[screenId])) {
          next[screenId] = ensured;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [app, availableScreenIds, ensureScreenConfig]);

  useEffect(() => {
    if (selectedScreenIds.length === 0) {
      setActiveScreenId(null);
      return;
    }

    setActiveScreenId((current) =>
      current !== null && selectedScreenIds.includes(current) ? current : selectedScreenIds[0]
    );
  }, [selectedScreenIds]);

  useEffect(() => {
    if (activeScreenId === null) {
      return;
    }

    const activeConfig = getScreenConfig(activeScreenId);
    const activeBackground = activeConfig.template_background;

    setSelectedLocales(activeConfig.locales || getDefaultLocalesForScreen(activeScreenId));
    setBackgroundMode(activeBackground?.mode || 'solid');
    setSolidColor(
      resolveHexColor(
        activeBackground?.mode === 'solid' ? activeBackground.color : undefined,
        '#4A90E2'
      )
    );
    setGradientFrom(
      resolveHexColor(
        activeBackground?.mode === 'gradient' ? activeBackground.from : undefined,
        '#4A90E2'
      )
    );
    setGradientTo(
      resolveHexColor(
        activeBackground?.mode === 'gradient' ? activeBackground.to : undefined,
        '#7B68EE'
      )
    );
    setBackgroundImagePath(activeBackground?.mode === 'image' ? activeBackground.image_path : null);
    setBackgroundImageError(null);
    setIncludeText(activeConfig.include_text !== false);
    setFontFamily(activeConfig.text_style?.font_family || 'system');
    setFontSize(activeConfig.text_style?.font_size ?? 52);
    setSubtitleFontSize(activeConfig.text_style?.subtitle_size ?? 29);
    setFontColor(resolveHexColor(activeConfig.text_style?.font_color, '#FFFFFF'));
    setFrameModesByDevice(activeConfig.frame_modes || {});
    setSelectedFrameAssetFilesByDevice(activeConfig.frame_asset_files || {});
    setFrameScalesByDevice(activeConfig.frame_scales || {});
    setFrameOffsetsByDevice(activeConfig.frame_offsets || {});
    setPreviewFrameRectDraft(null);
  }, [activeScreenId, getDefaultLocalesForScreen, getScreenConfig]);

  useEffect(() => {
    if (selectedDevices.length === 0) {
      setPreviewDevice(null);
      return;
    }

    setPreviewDevice((current) =>
      current && selectedDevices.includes(current) ? current : selectedDevices[0]
    );
  }, [selectedDevices]);

  useEffect(() => {
    if (previewLocaleOptions.length === 0) {
      setPreviewLocale('en');
      return;
    }

    if (previewLocaleOptions.includes(previewLocale)) {
      return;
    }

    if (previewLocaleOptions.includes('en')) {
      setPreviewLocale('en');
      return;
    }

    setPreviewLocale(previewLocaleOptions[0]);
  }, [previewLocale, previewLocaleOptions]);

  useEffect(() => {
    if (selectedDevices.length === 0) {
      return;
    }

    let cancelled = false;

    const loadFrameFilesForDevice = async (deviceType: DeviceType) => {
      setFrameFilesLoadingByDevice((prev) => ({ ...prev, [deviceType]: true }));

      try {
        const response = await fetch(
          `/api/frame-assets/options?device_type=${encodeURIComponent(deviceType)}`,
          { cache: 'no-store' }
        );
        if (!response.ok) {
          throw new Error(`Failed to load frame options for ${deviceType}`);
        }

        const payload = await response.json();
        const frameFiles = Array.isArray(payload?.data?.files)
          ? (payload.data.files as string[])
          : [];

        if (cancelled) return;

        setFrameAssetFilesByDevice((prev) => ({ ...prev, [deviceType]: frameFiles }));
        setSelectedFrameAssetFilesByDevice((prev) => {
          const currentSelection = prev[deviceType];
          const nextSelection =
            currentSelection && frameFiles.includes(currentSelection)
              ? currentSelection
              : frameFiles[0];

          const next = { ...prev };
          if (nextSelection) {
            next[deviceType] = nextSelection;
          } else {
            delete next[deviceType];
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setFrameAssetFilesByDevice((prev) => ({ ...prev, [deviceType]: [] }));
      } finally {
        if (!cancelled) {
          setFrameFilesLoadingByDevice((prev) => ({ ...prev, [deviceType]: false }));
        }
      }
    };

    Promise.all(selectedDevices.map((deviceType) => loadFrameFilesForDevice(deviceType))).catch(
      () => {}
    );

    return () => {
      cancelled = true;
    };
  }, [selectedDevices]);

  useEffect(() => {
    const generatePreview = async () => {
      if (!app || !previewDevice) {
        setPreviewImage(null);
        setPreviewLayout(null);
        setPreviewFrameRectDraft(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      if (!previewScreen) {
        setPreviewImage(null);
        setPreviewLayout(null);
        setPreviewFrameRectDraft(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      if (!previewVariant) {
        setPreviewError('No screenshot found for the selected preview device.');
        setPreviewImage(null);
        setPreviewLayout(null);
        setPreviewFrameRectDraft(null);
        setPreviewLoading(false);
        return;
      }

      const previewCopy =
        copies[previewScreen.id]?.[previewLocale] ||
        copies[previewScreen.id]?.en ||
        copies[previewScreen.id]?.[previewLocaleOptions[0]];

      if (includeText && !previewCopy) {
        setPreviewError('Add at least one copy before generating preview.');
        setPreviewImage(null);
        setPreviewLayout(null);
        setPreviewFrameRectDraft(null);
        setPreviewLoading(false);
        return;
      }

      if (backgroundMode === 'image' && !templateBackground) {
        setPreviewError('Upload a background image to render preview.');
        setPreviewImage(null);
        setPreviewLayout(null);
        setPreviewFrameRectDraft(null);
        setPreviewLoading(false);
        return;
      }

      const requestId = ++previewRequestIdRef.current;
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const imageResponse = await fetch(`/api/uploads/${previewVariant.screenshot_path}`);
        if (!imageResponse.ok) {
          throw new Error('Failed to load source screenshot');
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const screenshotBase64 = bufferToBase64(imageBuffer);
        const previewFrameMode = frameModesByDevice[previewDevice] || 'minimal';
        const previewFrameAssetFile =
          previewFrameMode === 'realistic'
            ? selectedFrameAssetFilesByDevice[previewDevice]
            : undefined;
        const previewFrameScale =
          previewFrameMode === 'none'
            ? undefined
            : normalizeFrameScale(frameScalesByDevice[previewDevice]);
        const previewFrameOffset =
          previewFrameMode === 'none'
            ? undefined
            : normalizeFrameOffset(frameOffsetsByDevice[previewDevice]);

        const previewResponse = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot_base64: screenshotBase64,
            style: BACKGROUND_TEMPLATE_STYLE,
            template_background: templateBackground,
            include_text: includeText,
            text_style: includeText ? templateTextStyle : undefined,
            device_type: previewDevice,
            title: includeText ? previewCopy?.title || '' : '',
            subtitle: includeText ? previewCopy?.subtitle || '' : '',
            frame_mode: previewFrameMode,
            frame_asset_file: previewFrameAssetFile,
            frame_scale: previewFrameScale,
            frame_offset: previewFrameOffset,
          }),
        });

        if (!previewResponse.ok) {
          throw new Error('Failed to generate template preview');
        }

        const payload = await previewResponse.json();
        if (previewRequestIdRef.current !== requestId) {
          return;
        }
        setPreviewImage(`data:image/png;base64,${payload.data.image_base64}`);
        setPreviewLayout((payload.data.layout as PreviewLayoutMetadata | undefined) || null);
        setPreviewFrameRectDraft(null);
      } catch (previewGenerationError) {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }
        setPreviewError(
          previewGenerationError instanceof Error
            ? previewGenerationError.message
            : 'Failed to generate preview'
        );
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setPreviewLoading(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      generatePreview();
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    app,
    copies,
    previewDevice,
    previewLocale,
    previewLocaleOptions,
    previewScreen,
    previewVariant,
    backgroundMode,
    templateBackground,
    includeText,
    templateTextStyle,
    frameModesByDevice,
    selectedFrameAssetFilesByDevice,
    frameScalesByDevice,
    frameOffsetsByDevice,
  ]);

  const loadGenerationPresets = async () => {
    setPresetsLoading(true);
    setPresetError(null);

    try {
      const response = await fetch('/api/generation-presets');
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const payload = await response.json();
      setGenerationPresets(Array.isArray(payload?.data) ? payload.data : []);
    } catch (loadError) {
      setPresetError(loadError instanceof Error ? loadError.message : 'Failed to load templates');
    } finally {
      setPresetsLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [appResponse, copiesResponse] = await Promise.all([
        fetch(`/api/apps/${appId}`),
        fetch(`/api/apps/${appId}/copies`),
      ]);

      if (!appResponse.ok) {
        throw new Error('App not found');
      }
      if (!copiesResponse.ok) {
        throw new Error('Failed to load copies');
      }

      const appPayload = await appResponse.json();
      const copiesPayload = await copiesResponse.json();

      setApp(appPayload.data);
      setCopies(copiesPayload.data);
      await loadGenerationPresets();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load generation setup');
    } finally {
      setLoading(false);
    }
  };

  const applyGenerationPreset = (preset: GenerationPreset) => {
    const { config } = preset;
    const applicableDevices = config.devices.filter((device) => availableDevices.includes(device));
    const availableScreenIdSet = new Set(availableScreenIds);
    const configuredScreenIds = config.screen_ids;
    const filteredScreenIds =
      configuredScreenIds && configuredScreenIds.length > 0
        ? configuredScreenIds.filter((screenId) => availableScreenIdSet.has(screenId))
        : [...availableScreenIds];
    const applicableScreenIds =
      filteredScreenIds.length > 0 ? filteredScreenIds : [...availableScreenIds];
    const applicableGlobalLocales = config.locales.filter((locale) =>
      availableLocales.includes(locale)
    );
    const nextScreenConfigs: Partial<Record<number, ScreenGenerationConfig>> = {};

    applicableScreenIds.forEach((screenId) => {
      const rawScreenConfig = config.screen_configs?.[screenId] ??
        (config.screen_configs?.[String(screenId) as unknown as number] as
          | ScreenGenerationConfig
          | undefined) ?? {
          locales: applicableGlobalLocales,
          template_background: config.template_background,
          include_text: config.include_text,
          text_style: config.text_style,
          frame_mode: config.frame_mode,
          frame_modes: config.frame_modes,
          frame_asset_files: config.frame_asset_files,
          frame_scales: config.frame_scales,
          frame_offsets: config.frame_offsets,
        };

      nextScreenConfigs[screenId] = ensureScreenConfig(screenId, {
        ...rawScreenConfig,
        locales:
          rawScreenConfig.locales?.filter((locale) => availableLocales.includes(locale)) ||
          applicableGlobalLocales,
      });
    });

    setSelectedDevices(applicableDevices);
    setSelectedScreenIds(applicableScreenIds);
    setScreenConfigsById((prev) => ({ ...prev, ...nextScreenConfigs }));
    setActiveScreenId(applicableScreenIds[0] ?? null);
    setBackgroundImageError(null);

    const unavailableDeviceCount = config.devices.length - applicableDevices.length;
    const unavailableLocaleCount = config.locales.length - applicableGlobalLocales.length;
    const unavailableScreenCount = configuredScreenIds
      ? configuredScreenIds.length - filteredScreenIds.length
      : 0;

    const skippedDetails: string[] = [];
    if (unavailableDeviceCount > 0) {
      skippedDetails.push(`${unavailableDeviceCount} device(s) not present in this app`);
    }
    if (unavailableLocaleCount > 0) {
      skippedDetails.push(`${unavailableLocaleCount} locale(s) not available in copies`);
    }
    if (unavailableScreenCount > 0) {
      skippedDetails.push(`${unavailableScreenCount} screen(s) not present in this app`);
    }

    setPresetError(null);
    setPresetStatusMessage(
      skippedDetails.length > 0
        ? `Applied "${preset.name}" with adjustments: ${skippedDetails.join('; ')}.`
        : `Applied "${preset.name}".`
    );
  };

  const handlePresetSelection = (presetId: string) => {
    setSelectedPresetId(presetId);
    setPresetError(null);
    setPresetStatusMessage(null);
    if (!presetId) {
      setPresetName('');
      return;
    }

    const selectedPreset = generationPresets.find((preset) => preset.id === Number(presetId));
    if (!selectedPreset) {
      setPresetError('Selected template was not found.');
      return;
    }

    setPresetName(selectedPreset.name);
    applyGenerationPreset(selectedPreset);
  };

  const saveGenerationPreset = async () => {
    if (selectedDevices.length === 0) {
      setPresetError('Select at least one device before saving a template.');
      return;
    }
    const screenMissingLocales = selectedScreenIds.find(
      (screenId) => (getScreenConfig(screenId).locales || []).length === 0
    );
    if (screenMissingLocales) {
      setPresetError(`Select at least one locale for ${formatScreenLabel(screenMissingLocales)}.`);
      return;
    }
    const screenMissingBackgroundImage = selectedScreenIds.find((screenId) => {
      const screenBackground = getScreenConfig(screenId).template_background;
      return screenBackground?.mode === 'image' && !screenBackground.image_path;
    });
    if (screenMissingBackgroundImage) {
      setPresetError(
        `Upload a background image for ${formatScreenLabel(screenMissingBackgroundImage)}.`
      );
      return;
    }
    if (selectedScreenIds.length === 0) {
      setPresetError('Select at least one screen before saving a template.');
      return;
    }

    const loadedPreset = generationPresets.find((preset) => preset.id === Number(selectedPresetId));
    const trimmedPresetName = presetName.trim();
    const targetPresetName = trimmedPresetName || loadedPreset?.name || '';
    if (!targetPresetName) {
      setPresetError('Enter a template name.');
      return;
    }

    setPresetSaving(true);
    setPresetError(null);
    setPresetStatusMessage(null);

    try {
      const response = await fetch('/api/generation-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetPresetName,
          config: currentGenerationConfig,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save template');
      }

      const payload = await response.json();
      const savedPreset = payload?.data as GenerationPreset;
      if (!savedPreset || typeof savedPreset.id !== 'number') {
        throw new Error('Template save succeeded but invalid data was returned');
      }
      const wasUpdatingLoadedPreset = loadedPreset?.id === savedPreset.id;

      setGenerationPresets((prev) => {
        const deduped = prev.filter((preset) => preset.id !== savedPreset.id);
        return [savedPreset, ...deduped];
      });
      setSelectedPresetId(String(savedPreset.id));
      setPresetName(savedPreset.name);
      setPresetStatusMessage(
        wasUpdatingLoadedPreset ? `Updated "${savedPreset.name}".` : `Saved "${savedPreset.name}".`
      );
    } catch (saveError) {
      setPresetError(saveError instanceof Error ? saveError.message : 'Failed to save template');
    } finally {
      setPresetSaving(false);
    }
  };

  const toggleDevice = (deviceType: DeviceType) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceType)
        ? prev.filter((device) => device !== deviceType)
        : [...prev, deviceType]
    );
  };

  const toggleLocale = (localeCode: string) => {
    setSelectedLocales((prev) => {
      const next = prev.includes(localeCode)
        ? prev.filter((locale) => locale !== localeCode)
        : [...prev, localeCode];
      updateActiveScreenConfig((current) => ({
        ...current,
        locales: next,
      }));
      return next;
    });
  };

  const selectAllLocales = () => {
    setSelectedLocales([...activeScreenAvailableLocales]);
    updateActiveScreenConfig((current) => ({
      ...current,
      locales: [...activeScreenAvailableLocales],
    }));
  };

  const toggleScreen = (screenId: number) => {
    setSelectedScreenIds((prev) => {
      if (!prev.includes(screenId)) {
        return [...prev, screenId];
      }

      if (prev.length === 1) {
        return prev;
      }

      return prev.filter((id) => id !== screenId);
    });
  };

  const selectAllScreens = () => {
    setSelectedScreenIds([...availableScreenIds]);
  };

  const keepFirstScreenOnly = () => {
    if (availableScreenIds.length === 0) {
      return;
    }
    setSelectedScreenIds([availableScreenIds[0]]);
  };

  const updateActiveScreenConfig = (
    updater: (current: ScreenGenerationConfig) => ScreenGenerationConfig
  ) => {
    if (activeScreenId === null) {
      return;
    }

    setScreenConfigsById((prev) => ({
      ...prev,
      [activeScreenId]: updater(ensureScreenConfig(activeScreenId, prev[activeScreenId])),
    }));
  };

  const setDeviceFrameMode = (deviceType: DeviceType, frameMode: FrameMode) => {
    setFrameModesByDevice((prev) => ({ ...prev, [deviceType]: frameMode }));
    updateActiveScreenConfig((current) => ({
      ...current,
      frame_modes: {
        ...current.frame_modes,
        [deviceType]: frameMode,
      },
    }));
  };

  const setDeviceFrameAssetFile = (deviceType: DeviceType, frameAssetFile: string) => {
    setSelectedFrameAssetFilesByDevice((prev) => ({ ...prev, [deviceType]: frameAssetFile }));
    updateActiveScreenConfig((current) => ({
      ...current,
      frame_asset_files: {
        ...current.frame_asset_files,
        [deviceType]: frameAssetFile,
      },
    }));
  };

  const setDeviceFrameScale = (deviceType: DeviceType, frameScale: number) => {
    const normalizedFrameScale = normalizeFrameScale(frameScale);
    setFrameScalesByDevice((prev) => ({
      ...prev,
      [deviceType]: normalizedFrameScale,
    }));
    updateActiveScreenConfig((current) => ({
      ...current,
      frame_scales: {
        ...current.frame_scales,
        [deviceType]: normalizedFrameScale,
      },
    }));
  };

  const setDeviceFrameOffsets = (deviceType: DeviceType, offset: FrameOffset) => {
    const normalizedOffset = normalizeFrameOffset(offset);
    setFrameOffsetsByDevice((prev) => {
      const current = normalizeFrameOffset(prev[deviceType]);
      return {
        ...prev,
        [deviceType]: {
          ...current,
          x: normalizedOffset.x ?? current.x,
          y: normalizedOffset.y ?? current.y,
        },
      };
    });
    updateActiveScreenConfig((current) => ({
      ...current,
      frame_offsets: {
        ...current.frame_offsets,
        [deviceType]: normalizedOffset,
      },
    }));
  };

  const setPreviewFrameRectDraft = (nextRect: TemplateRect | null) => {
    previewFrameRectOverrideRef.current = nextRect;
    setPreviewFrameRectOverride(nextRect);
  };

  const resetPreviewDeviceFrameAdjustments = (deviceType: DeviceType) => {
    setDeviceFrameScale(deviceType, 1);
    setDeviceFrameOffsets(deviceType, { x: 0, y: 0 });
    setPreviewFrameRectDraft(null);
  };

  const updatePreviewFrameTransform = (nextRect: TemplateRect) => {
    setPreviewFrameRectDraft(nextRect);
  };

  const beginPreviewTransform = (
    event: React.PointerEvent<HTMLDivElement>,
    deviceType: DeviceType,
    mode: 'move' | 'resize',
    corner?: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    if (!previewLayout?.frameRect || !previewSurfaceRef.current) {
      return;
    }
    const currentScale = normalizeFrameScale(frameScalesByDevice[deviceType]);
    const startFrameRect = previewFrameRectOverride || previewLayout.frameRect;

    dragSessionRef.current = {
      pointerId: event.pointerId,
      deviceType,
      mode,
      corner,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrameRect,
      visualRegion: previewLayout.visualRegion,
      canvas: previewLayout.canvas,
      baseFrameSize: {
        width: startFrameRect.width / currentScale,
        height: startFrameRect.height / currentScale,
      },
    };
    setPreviewTransformMode(mode);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePreviewDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    const surface = previewSurfaceRef.current;
    if (!session || !surface || event.pointerId !== session.pointerId) {
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    if (surfaceRect.width <= 0 || surfaceRect.height <= 0) {
      return;
    }

    const deltaX =
      ((event.clientX - session.startClientX) / surfaceRect.width) * session.canvas.width;
    const deltaY =
      ((event.clientY - session.startClientY) / surfaceRect.height) * session.canvas.height;
    if (session.mode === 'move') {
      const maxLeft =
        session.visualRegion.left + session.visualRegion.width - session.startFrameRect.width;
      const maxTop =
        session.visualRegion.top + session.visualRegion.height - session.startFrameRect.height;
      const nextLeft = Math.min(
        Math.max(session.visualRegion.left, session.startFrameRect.left + deltaX),
        maxLeft
      );
      const nextTop = Math.min(
        Math.max(session.visualRegion.top, session.startFrameRect.top + deltaY),
        maxTop
      );

      updatePreviewFrameTransform({
        ...session.startFrameRect,
        left: Math.round(nextLeft),
        top: Math.round(nextTop),
      });
      return;
    }

    if (!session.corner) {
      return;
    }

    const start = session.startFrameRect;
    const visualRight = session.visualRegion.left + session.visualRegion.width;
    const visualBottom = session.visualRegion.top + session.visualRegion.height;
    const anchor =
      session.corner === 'nw'
        ? { x: start.left + start.width, y: start.top + start.height }
        : session.corner === 'ne'
          ? { x: start.left, y: start.top + start.height }
          : session.corner === 'sw'
            ? { x: start.left + start.width, y: start.top }
            : { x: start.left, y: start.top };
    const rawWidth =
      session.corner === 'nw' || session.corner === 'sw'
        ? anchor.x - (start.left + deltaX)
        : start.width + deltaX;
    const rawHeight =
      session.corner === 'nw' || session.corner === 'ne'
        ? anchor.y - (start.top + deltaY)
        : start.height + deltaY;
    const minScale = FRAME_SCALE_MIN;
    const maxScaleByRegion =
      session.corner === 'nw'
        ? Math.min(
            (anchor.x - session.visualRegion.left) / session.baseFrameSize.width,
            (anchor.y - session.visualRegion.top) / session.baseFrameSize.height
          )
        : session.corner === 'ne'
          ? Math.min(
              (visualRight - anchor.x) / session.baseFrameSize.width,
              (anchor.y - session.visualRegion.top) / session.baseFrameSize.height
            )
          : session.corner === 'sw'
            ? Math.min(
                (anchor.x - session.visualRegion.left) / session.baseFrameSize.width,
                (visualBottom - anchor.y) / session.baseFrameSize.height
              )
            : Math.min(
                (visualRight - anchor.x) / session.baseFrameSize.width,
                (visualBottom - anchor.y) / session.baseFrameSize.height
              );
    const nextScale = normalizeFrameScale(
      Math.min(
        Math.max(
          minScale,
          Math.min(rawWidth / session.baseFrameSize.width, rawHeight / session.baseFrameSize.height)
        ),
        Math.min(FRAME_SCALE_MAX, maxScaleByRegion)
      )
    );
    const nextWidth = Math.round(session.baseFrameSize.width * nextScale);
    const nextHeight = Math.round(session.baseFrameSize.height * nextScale);
    const nextRect =
      session.corner === 'nw'
        ? {
            left: Math.round(anchor.x - nextWidth),
            top: Math.round(anchor.y - nextHeight),
            width: nextWidth,
            height: nextHeight,
          }
        : session.corner === 'ne'
          ? {
              left: Math.round(anchor.x),
              top: Math.round(anchor.y - nextHeight),
              width: nextWidth,
              height: nextHeight,
            }
          : session.corner === 'sw'
            ? {
                left: Math.round(anchor.x - nextWidth),
                top: Math.round(anchor.y),
                width: nextWidth,
                height: nextHeight,
              }
            : {
                left: Math.round(anchor.x),
                top: Math.round(anchor.y),
                width: nextWidth,
                height: nextHeight,
              };

    updatePreviewFrameTransform(nextRect);
  };

  const finishPreviewDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nextRect = previewFrameRectOverrideRef.current || session.startFrameRect;
    const nextTransform = resolveFrameTransformFromRect(
      nextRect,
      session.visualRegion,
      session.baseFrameSize
    );
    setDeviceFrameScale(session.deviceType, nextTransform.scale);
    setDeviceFrameOffsets(session.deviceType, nextTransform.offset);
    dragSessionRef.current = null;
    setPreviewTransformMode(null);
  };

  const setTemplateBackgroundMode = (mode: TemplateBackground['mode']) => {
    setBackgroundMode(mode);
    setError(null);
    setBackgroundImageError(null);

    if (mode === 'image' && !backgroundImagePath) {
      return;
    }

    updateActiveScreenConfig((current) => ({
      ...current,
      template_background:
        mode === 'transparent'
          ? { mode: 'transparent' }
          : mode === 'solid'
            ? { mode: 'solid', color: solidColor }
            : mode === 'gradient'
              ? { mode: 'gradient', from: gradientFrom, to: gradientTo, angle: 135 }
              : backgroundImagePath
                ? { mode: 'image', image_path: backgroundImagePath }
                : current.template_background,
    }));
  };

  const selectSolidColor = (value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      setBackgroundMode('solid');
      setSolidColor(normalized);
      updateActiveScreenConfig((current) => ({
        ...current,
        template_background: {
          mode: 'solid',
          color: normalized,
        },
      }));
    }
  };

  const setGradientStop = (key: 'from' | 'to', value: string) => {
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      return;
    }
    setGradientSuggestionError(null);
    if (key === 'from') {
      setGradientFrom(normalized);
      updateActiveScreenConfig((current) => ({
        ...current,
        template_background: {
          mode: 'gradient',
          from: normalized,
          to: gradientTo,
          angle: 135,
        },
      }));
      return;
    }
    setGradientTo(normalized);
    updateActiveScreenConfig((current) => ({
      ...current,
      template_background: {
        mode: 'gradient',
        from: gradientFrom,
        to: normalized,
        angle: 135,
      },
    }));
  };

  const selectGradientPreset = (from: string, to: string) => {
    setBackgroundMode('gradient');
    setGradientSuggestionError(null);
    setGradientFrom(from.toUpperCase());
    setGradientTo(to.toUpperCase());
    updateActiveScreenConfig((current) => ({
      ...current,
      template_background: {
        mode: 'gradient',
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        angle: 135,
      },
    }));
  };

  const uploadBackgroundImage = async (file: File) => {
    setBackgroundImageUploading(true);
    setBackgroundImageError(null);

    try {
      const formData = new FormData();
      formData.set('file', file);

      const response = await fetch(`/api/apps/${appId}/template-background`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to upload background image');
      }

      const payload = await response.json();
      const imagePath = payload?.data?.image_path;
      if (typeof imagePath !== 'string' || imagePath.length === 0) {
        throw new Error('Upload succeeded but no image path was returned');
      }

      setBackgroundImagePath(imagePath);
      setTemplateBackgroundMode('image');
      updateActiveScreenConfig((current) => ({
        ...current,
        template_background: {
          mode: 'image',
          image_path: imagePath,
        },
      }));
    } catch (uploadError) {
      setBackgroundImageError(
        uploadError instanceof Error ? uploadError.message : 'Failed to upload background image'
      );
    } finally {
      setBackgroundImageUploading(false);
    }
  };

  const handleBackgroundImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadBackgroundImage(file);
    event.target.value = '';
  };

  const suggestGradientWithAi = async () => {
    if (!app || selectedDevices.length === 0 || !activeScreen) {
      setGradientSuggestionError('Select at least one device first.');
      return;
    }

    const suggestionDevice = selectedDevices[0];
    const suggestionLocale = selectedLocales[0] || previewLocale || 'en';
    const suggestionVariant = screenHasDeviceVariant(activeScreen, suggestionDevice)
      ? findPreferredVariantForDeviceAndLocale(activeScreen, suggestionDevice, suggestionLocale) ||
        activeScreen.variants[0]
      : null;

    if (!suggestionVariant) {
      setGradientSuggestionError('No screenshots found for this app.');
      return;
    }

    setSuggestingGradient(true);
    setGradientSuggestionError(null);

    try {
      const imageResponse = await fetch(`/api/uploads/${suggestionVariant.screenshot_path}`);
      if (!imageResponse.ok) {
        throw new Error('Failed to load source screenshot');
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const screenshotBase64 = bufferToBase64(imageBuffer);

      const response = await fetch('/api/templates/suggest-gradient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot_base64: screenshotBase64,
          app_name: app.name,
          app_description: app.description,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to suggest gradient colors');
      }

      const payload = await response.json();
      const fromColor = normalizeHexColor(payload?.data?.from || '');
      const toColor = normalizeHexColor(payload?.data?.to || '');

      if (!fromColor || !toColor) {
        throw new Error('AI returned invalid color values');
      }

      setBackgroundMode('gradient');
      setGradientFrom(fromColor);
      setGradientTo(toColor);
      updateActiveScreenConfig((current) => ({
        ...current,
        template_background: {
          mode: 'gradient',
          from: fromColor,
          to: toColor,
          angle: 135,
        },
      }));
    } catch (suggestionError) {
      setGradientSuggestionError(
        suggestionError instanceof Error
          ? suggestionError.message
          : 'Failed to suggest gradient colors'
      );
    } finally {
      setSuggestingGradient(false);
    }
  };

  const selectFontColor = (value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      setFontColor(normalized);
      updateActiveScreenConfig((current) => ({
        ...current,
        text_style: {
          ...current.text_style,
          font_color: normalized,
        },
      }));
    }
  };

  const updateFontSize = (value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const clamped = Math.max(
      TEMPLATE_FONT_SIZE_LIMITS.min,
      Math.min(TEMPLATE_FONT_SIZE_LIMITS.max, Math.round(value))
    );
    setFontSize(clamped);
    updateActiveScreenConfig((current) => ({
      ...current,
      text_style: {
        ...current.text_style,
        font_size: clamped,
      },
    }));
  };

  const updateSubtitleFontSize = (value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const clamped = Math.max(
      TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS.min,
      Math.min(TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS.max, Math.round(value))
    );
    setSubtitleFontSize(clamped);
    updateActiveScreenConfig((current) => ({
      ...current,
      text_style: {
        ...current.text_style,
        subtitle_size: clamped,
      },
    }));
  };

  const startGeneration = async () => {
    if (selectedScreenIds.length === 0) {
      setError('Select at least one screen before starting generation.');
      return;
    }
    const screenMissingLocales = selectedScreenIds.find(
      (screenId) => (getScreenConfig(screenId).locales || []).length === 0
    );
    if (screenMissingLocales) {
      setError(
        `Select at least one locale for ${formatScreenLabel(screenMissingLocales)} before generating.`
      );
      return;
    }
    const screenMissingBackgroundImage = selectedScreenIds.find((screenId) => {
      const screenBackground = getScreenConfig(screenId).template_background;
      return screenBackground?.mode === 'image' && !screenBackground.image_path;
    });
    if (screenMissingBackgroundImage) {
      setError(
        `Upload a background image for ${formatScreenLabel(screenMissingBackgroundImage)} before generating.`
      );
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/apps/${appId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentGenerationConfig),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to start generation');
      }

      const data = await response.json();
      router.push(`/apps/${appId}/generations/${data.data.generation_id}`);
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : 'Failed to start generation'
      );
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-6">
        <div className="space-y-4 max-w-3xl">
          <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="container mx-auto py-16 px-6 text-center">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold mb-2">App Not Found</h2>
        <p className="text-muted-foreground mb-6">The app you're looking for doesn't exist</p>
        <Link href="/">
          <Button>Back to Apps</Button>
        </Link>
      </div>
    );
  }

  const selectedScreenVariantCount = selectedScreens.reduce((total, screen) => {
    const variantCountForSelectedDevices = selectedDevices.filter((deviceType) =>
      screenHasDeviceVariant(screen, deviceType)
    ).length;
    return total + variantCountForSelectedDevices;
  }, 0);
  const estimatedOutputCount = selectedScreens.reduce((total, screen) => {
    const variantCountForSelectedDevices = selectedDevices.filter((deviceType) =>
      screenHasDeviceVariant(screen, deviceType)
    ).length;
    const screenLocaleCount = getScreenConfig(screen.id).locales?.length || 0;
    return total + variantCountForSelectedDevices * screenLocaleCount;
  }, 0);
  const hasMissingScreenLocales = selectedScreenIds.some(
    (screenId) => (getScreenConfig(screenId).locales || []).length === 0
  );
  const hasMissingScreenBackgroundImage = selectedScreenIds.some((screenId) => {
    const screenBackground = getScreenConfig(screenId).template_background;
    return screenBackground?.mode === 'image' && !screenBackground.image_path;
  });
  const effectivePreviewFrameRect = previewFrameRectOverride || previewLayout?.frameRect;
  const previewGuideRegion = previewLayout?.visualRegion;
  const previewGuideCenter =
    previewGuideRegion && effectivePreviewFrameRect
      ? {
          x: previewGuideRegion.left + previewGuideRegion.width / 2,
          y: previewGuideRegion.top + previewGuideRegion.height / 2,
          frameX: effectivePreviewFrameRect.left + effectivePreviewFrameRect.width / 2,
          frameY: effectivePreviewFrameRect.top + effectivePreviewFrameRect.height / 2,
        }
      : null;
  const previewCenterAlignedX =
    previewGuideCenter && previewLayout
      ? Math.abs(previewGuideCenter.x - previewGuideCenter.frameX) <=
        previewLayout.canvas.width * 0.01
      : false;
  const previewCenterAlignedY =
    previewGuideCenter && previewLayout
      ? Math.abs(previewGuideCenter.y - previewGuideCenter.frameY) <=
        previewLayout.canvas.height * 0.01
      : false;
  const previewAspectRatio = previewLayout
    ? `${previewLayout.canvas.width} / ${previewLayout.canvas.height}`
    : '9 / 16';

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate Screenshots</h1>
        <p className="text-muted-foreground">{app.name}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="generation-template-load">Load saved template</Label>
                <select
                  id="generation-template-load"
                  value={selectedPresetId}
                  onChange={(event) => handlePresetSelection(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select template</option>
                  {generationPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Templates are shared across all apps.
                </p>
                {presetsLoading && (
                  <p className="text-xs text-muted-foreground">Loading templates...</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="generation-template-name">Save current settings as template</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="generation-template-name"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="e.g. iPhone + EN + gradient"
                    maxLength={100}
                  />
                  <Button
                    type="button"
                    onClick={saveGenerationPreset}
                    disabled={presetSaving || backgroundImageUploading}
                    className="sm:w-auto"
                  >
                    {presetSaving
                      ? 'Saving...'
                      : selectedPreset &&
                          (presetName.trim().length === 0 ||
                            presetName.trim() === selectedPreset.name)
                        ? 'Update Template'
                        : 'Save Template'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reusing the same name updates the existing template.
                </p>
                {selectedPreset && (
                  <p className="text-xs text-muted-foreground">
                    Loaded: <span className="font-medium">{selectedPreset.name}</span>. Keep this
                    name to update it, or change the name to save as a new template.
                  </p>
                )}
              </div>
            </div>

            {presetStatusMessage && (
              <p className="text-sm text-emerald-700">{presetStatusMessage}</p>
            )}
            {presetError && (
              <p className="text-sm text-destructive" role="alert">
                {presetError}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1. Select Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {availableDevices.map((device) => (
                <Button
                  key={device}
                  variant={selectedDevices.includes(device) ? 'default' : 'outline'}
                  onClick={() => toggleDevice(device)}
                >
                  {DEVICE_TYPE_LABELS[device]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Select Screens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Included in export: {selectedScreenIds.length} of {app.screens.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Toggle each screen between Included and Excluded.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllScreens}
                  disabled={selectedScreenIds.length === app.screens.length}
                >
                  Include All (Default)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={keepFirstScreenOnly}
                  disabled={availableScreenIds.length <= 1 && selectedScreenIds.length <= 1}
                >
                  Keep First Only
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {app.screens.map((screen) => {
                const selected = selectedScreenIds.includes(screen.id);
                const canToggleOff = !(selected && selectedScreenIds.length === 1);
                const previewPath = screen.variants[0]?.screenshot_path || screen.screenshot_path;
                const deviceCount = new Set(screen.variants.map((variant) => variant.device_type))
                  .size;
                const screenCopyByLocale = copies[screen.id] || {};
                const screenTitle =
                  screenCopyByLocale.en?.title ||
                  screenCopyByLocale[previewLocale]?.title ||
                  Object.values(screenCopyByLocale)[0]?.title ||
                  'No title yet';

                return (
                  <button
                    key={screen.id}
                    type="button"
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-input hover:bg-accent/60'
                    }`}
                    onClick={() => toggleScreen(screen.id)}
                    disabled={!canToggleOff}
                    aria-pressed={selected}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded border bg-muted">
                        <Image
                          src={`/api/uploads/${previewPath}`}
                          alt={`Screen ${screen.position + 1} preview`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Screen {screen.position + 1}</p>
                        <p className="text-xs text-muted-foreground truncate">{screenTitle}</p>
                        <p
                          className={`text-xs ${
                            selected ? 'text-emerald-700' : 'text-muted-foreground'
                          }`}
                        >
                          {selected ? 'Included' : 'Excluded'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {deviceCount} device variant(s)
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              At least one screen must remain included.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configure Selected Screen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedScreens.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select at least one screen to configure per-screen export settings.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {selectedScreens.map((screen) => {
                    const screenCopyByLocale = copies[screen.id] || {};
                    const screenTitle =
                      screenCopyByLocale.en?.title ||
                      Object.values(screenCopyByLocale)[0]?.title ||
                      `Screen ${screen.position + 1}`;

                    return (
                      <Button
                        key={screen.id}
                        type="button"
                        variant={activeScreenId === screen.id ? 'default' : 'outline'}
                        onClick={() => setActiveScreenId(screen.id)}
                      >
                        {`Screen ${screen.position + 1}: ${screenTitle}`}
                      </Button>
                    );
                  })}
                </div>
                {activeScreen && (
                  <p className="text-xs text-muted-foreground">
                    Cards 3 through 7 below apply to{' '}
                    <span className="font-medium">{`Screen ${activeScreen.position + 1}`}</span>.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Choose Frame Per Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedDevices.map((deviceType) => (
              <div key={deviceType}>
                <Label className="mb-2 block">{DEVICE_TYPE_LABELS[deviceType]}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeviceFrameMode(deviceType, 'none')}
                    className={`rounded-lg border p-3 text-left transition-colors min-h-[172px] ${
                      (frameModesByDevice[deviceType] || 'minimal') === 'none'
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <FrameModePreview deviceType={deviceType} mode="none" />
                    <p className="font-medium text-sm">No Frame</p>
                    <p className="text-xs text-muted-foreground">
                      Screenshot only, no device bezel
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeviceFrameMode(deviceType, 'minimal')}
                    className={`rounded-lg border p-3 text-left transition-colors min-h-[172px] ${
                      (frameModesByDevice[deviceType] || 'minimal') === 'minimal'
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <FrameModePreview deviceType={deviceType} mode="minimal" />
                    <p className="font-medium text-sm">Minimal Frame</p>
                    <p className="text-xs text-muted-foreground">
                      Simple procedural device outline
                    </p>
                  </button>

                  {(frameAssetFilesByDevice[deviceType] || []).map((fileName) => {
                    const isSelected =
                      (frameModesByDevice[deviceType] || 'minimal') === 'realistic' &&
                      selectedFrameAssetFilesByDevice[deviceType] === fileName;

                    return (
                      <button
                        key={`${deviceType}-${fileName}`}
                        type="button"
                        onClick={() => {
                          setDeviceFrameMode(deviceType, 'realistic');
                          setDeviceFrameAssetFile(deviceType, fileName);
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors min-h-[172px] ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-input hover:bg-accent'
                        }`}
                      >
                        <FrameModePreview
                          deviceType={deviceType}
                          mode="realistic"
                          frameFile={fileName}
                        />
                        <p className="font-medium text-sm break-words">
                          {frameFileLabel(fileName)}
                        </p>
                        <p className="text-xs text-muted-foreground">Real device frame</p>
                      </button>
                    );
                  })}
                </div>
                {frameFilesLoadingByDevice[deviceType] && (
                  <p className="mt-2 text-xs text-muted-foreground">Loading frame options...</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Select Languages</CardTitle>
          </CardHeader>
          <CardContent>
            {activeScreenId !== null && activeScreenAvailableLocales.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved locales found for this screen. Add copy first in Manage Copies.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedLocales.length} of {activeScreenAvailableLocales.length} language(s)
                    selected for this screen
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={selectAllLocales}
                    disabled={selectedLocales.length === activeScreenAvailableLocales.length}
                  >
                    Select All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeScreenAvailableLocales.map((localeCode) => (
                    <Button
                      key={localeCode}
                      size="sm"
                      variant={selectedLocales.includes(localeCode) ? 'default' : 'outline'}
                      onClick={() => toggleLocale(localeCode)}
                    >
                      {localeLabel(localeCode)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Choose Template Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                type="button"
                variant={backgroundMode === 'transparent' ? 'default' : 'outline'}
                onClick={() => setTemplateBackgroundMode('transparent')}
              >
                No Background
              </Button>
              <Button
                type="button"
                variant={backgroundMode === 'solid' ? 'default' : 'outline'}
                onClick={() => setTemplateBackgroundMode('solid')}
              >
                Single Color
              </Button>
              <Button
                type="button"
                variant={backgroundMode === 'gradient' ? 'default' : 'outline'}
                onClick={() => setTemplateBackgroundMode('gradient')}
              >
                Gradient
              </Button>
              <Button
                type="button"
                variant={backgroundMode === 'image' ? 'default' : 'outline'}
                onClick={() => setTemplateBackgroundMode('image')}
              >
                Image
              </Button>
            </div>

            {backgroundPreviewStyle && (
              <div className="rounded-xl border p-3">
                <div className="h-28 rounded-lg border" style={backgroundPreviewStyle} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Live background preview applied to template output
                </p>
              </div>
            )}

            {backgroundMode === 'transparent' ? (
              <p className="text-sm text-muted-foreground">
                Exported PNGs keep alpha outside the composed screenshot. The frame and screenshot
                content remain opaque.
              </p>
            ) : backgroundMode === 'solid' ? (
              <div className="space-y-3">
                <Label htmlFor="template-solid-color">Pick color</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="template-solid-color"
                    type="color"
                    value={resolveHexColor(solidColor, '#4A90E2')}
                    onChange={(event) => selectSolidColor(event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                  />
                  <Input
                    value={resolveHexColor(solidColor, '#4A90E2')}
                    readOnly
                    className="max-w-[180px] font-mono"
                  />
                </div>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                  {SOLID_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => selectSolidColor(preset)}
                      className={`h-8 w-8 rounded border ${
                        resolveHexColor(solidColor, '#4A90E2') === preset.toUpperCase()
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-input'
                      }`}
                      style={{ backgroundColor: preset }}
                      aria-label={`Use color ${preset}`}
                    />
                  ))}
                </div>
              </div>
            ) : backgroundMode === 'gradient' ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-gradient-from">From</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-gradient-from"
                        type="color"
                        value={resolveHexColor(gradientFrom, '#4A90E2')}
                        onChange={(event) => setGradientStop('from', event.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                      />
                      <Input
                        value={resolveHexColor(gradientFrom, '#4A90E2')}
                        readOnly
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-gradient-to">To</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-gradient-to"
                        type="color"
                        value={resolveHexColor(gradientTo, '#7B68EE')}
                        onChange={(event) => setGradientStop('to', event.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                      />
                      <Input
                        value={resolveHexColor(gradientTo, '#7B68EE')}
                        readOnly
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={suggestGradientWithAi}
                    disabled={suggestingGradient || selectedDevices.length === 0}
                  >
                    {suggestingGradient ? 'Suggesting...' : 'Suggest with AI'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Uses the first selected device screenshot to match your app palette.
                  </p>
                </div>
                {gradientSuggestionError && (
                  <p className="text-sm text-destructive" role="alert">
                    {gradientSuggestionError}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected =
                      resolveHexColor(gradientFrom, '#4A90E2') === preset.from.toUpperCase() &&
                      resolveHexColor(gradientTo, '#7B68EE') === preset.to.toUpperCase();

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => selectGradientPreset(preset.from, preset.to)}
                        className={`overflow-hidden rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-input hover:bg-accent'
                        }`}
                      >
                        <div
                          className="h-10"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`,
                          }}
                        />
                        <p className="px-2 py-1 text-xs">{preset.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="template-background-image">Upload image</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="template-background-image"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleBackgroundImageSelection}
                    className="block w-full max-w-sm text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium"
                  />
                  {backgroundImageUploading && (
                    <p className="text-xs text-muted-foreground">Uploading image...</p>
                  )}
                </div>
                {backgroundImagePath && (
                  <p className="text-xs text-muted-foreground">
                    Uploaded: <code>{backgroundImagePath.split('/').pop()}</code>
                  </p>
                )}
                {backgroundImageError && (
                  <p className="text-sm text-destructive" role="alert">
                    {backgroundImageError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Text Overlay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-w-sm grid-cols-2 gap-2">
              <Button
                type="button"
                variant={includeText ? 'default' : 'outline'}
                onClick={() => {
                  setIncludeText(true);
                  updateActiveScreenConfig((current) => ({
                    ...current,
                    include_text: true,
                  }));
                }}
              >
                Include Text
              </Button>
              <Button
                type="button"
                variant={includeText ? 'outline' : 'default'}
                onClick={() => {
                  setIncludeText(false);
                  updateActiveScreenConfig((current) => ({
                    ...current,
                    include_text: false,
                  }));
                }}
              >
                No Text
              </Button>
            </div>

            {includeText ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-font-family">Font</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="template-font-family"
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-start text-left"
                        >
                          <p
                            className="truncate text-sm font-medium"
                            style={{ fontFamily: FONT_PREVIEW_STACKS[fontFamily] }}
                          >
                            {selectedFontLabel}
                          </p>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[340px] max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto p-1"
                        align="start"
                      >
                        <DropdownMenuRadioGroup
                          value={fontFamily}
                          onValueChange={(value) => {
                            setFontFamily(value as TemplateFontFamily);
                            updateActiveScreenConfig((current) => ({
                              ...current,
                              text_style: {
                                ...current.text_style,
                                font_family: value as TemplateFontFamily,
                              },
                            }));
                          }}
                        >
                          {TEMPLATE_FONT_OPTIONS.map((font) => (
                            <DropdownMenuRadioItem
                              key={font.value}
                              value={font.value}
                              className="cursor-pointer py-2"
                            >
                              <p
                                className="truncate text-sm font-medium"
                                style={{ fontFamily: FONT_PREVIEW_STACKS[font.value] }}
                              >
                                {font.label}
                              </p>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-xs text-muted-foreground">
                      Google font files are embedded via @fontsource for generated previews and
                      final screenshots.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-font-size">Title size</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-font-size"
                        type="range"
                        min={TEMPLATE_FONT_SIZE_LIMITS.min}
                        max={TEMPLATE_FONT_SIZE_LIMITS.max}
                        value={fontSize}
                        onChange={(event) => updateFontSize(Number(event.target.value))}
                        className="h-10 flex-1"
                      />
                      <Input
                        type="number"
                        min={TEMPLATE_FONT_SIZE_LIMITS.min}
                        max={TEMPLATE_FONT_SIZE_LIMITS.max}
                        value={fontSize}
                        onChange={(event) => updateFontSize(Number(event.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-subtitle-font-size">Subtitle size</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-subtitle-font-size"
                        type="range"
                        min={TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS.min}
                        max={TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS.max}
                        value={subtitleFontSize}
                        onChange={(event) => updateSubtitleFontSize(Number(event.target.value))}
                        className="h-10 flex-1"
                      />
                      <Input
                        type="number"
                        min={TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS.min}
                        max={TEMPLATE_SUBTITLE_FONT_SIZE_LIMITS.max}
                        value={subtitleFontSize}
                        onChange={(event) => updateSubtitleFontSize(Number(event.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-font-color">Font color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-font-color"
                        type="color"
                        value={resolveHexColor(fontColor, '#FFFFFF')}
                        onChange={(event) => selectFontColor(event.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                      />
                      <Input
                        value={resolveHexColor(fontColor, '#FFFFFF')}
                        readOnly
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-lg border p-4 text-center"
                  style={{
                    fontFamily: FONT_PREVIEW_STACKS[fontFamily],
                    color: resolveHexColor(fontColor, '#FFFFFF'),
                  }}
                >
                  <p className="font-bold leading-tight" style={{ fontSize: `${fontSize}px` }}>
                    Sample Title
                  </p>
                  <p className="mt-2 opacity-90" style={{ fontSize: `${subtitleFontSize}px` }}>
                    Sample subtitle preview
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Final exports and preview will be rendered without title/subtitle text.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto mb-4 grid max-w-3xl gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preview-device">Preview device</Label>
                  <select
                    id="preview-device"
                    value={previewDevice || ''}
                    onChange={(event) => setPreviewDevice(event.target.value as DeviceType)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={selectedDevices.length === 0}
                  >
                    {selectedDevices.map((deviceType) => (
                      <option key={deviceType} value={deviceType}>
                        {DEVICE_TYPE_LABELS[deviceType]}
                      </option>
                    ))}
                  </select>
                </div>

                {includeText ? (
                  <div className="space-y-2">
                    <Label htmlFor="preview-locale">Preview locale</Label>
                    {previewLocaleOptions.length > 0 ? (
                      <select
                        id="preview-locale"
                        value={previewLocale}
                        onChange={(event) => setPreviewLocale(event.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {previewLocaleOptions.map((localeCode) => (
                          <option key={localeCode} value={localeCode}>
                            {localeLabel(localeCode)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No copy available for the selected preview screen yet.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Preview locale selector is hidden because text overlay is disabled.
                  </p>
                )}

                {previewDevice && (frameModesByDevice[previewDevice] || 'minimal') !== 'none' ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Frame adjustments</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => resetPreviewDeviceFrameAdjustments(previewDevice)}
                      >
                        Reset
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Drag the device to reposition it, or drag any corner to resize it. Reset
                      clears all manual frame edits.
                    </p>
                  </div>
                ) : previewDevice ? (
                  <p className="text-sm text-muted-foreground">
                    Frame adjustments are unavailable while `No Frame` is selected for this device.
                  </p>
                ) : null}
              </div>

              <div>
                {previewImage && (
                  <div
                    ref={previewSurfaceRef}
                    className={`relative mx-auto w-full max-w-md overflow-hidden rounded-md border ${
                      backgroundMode === 'transparent' ? 'transparent-preview-surface' : 'bg-muted'
                    }`}
                    style={{ aspectRatio: previewAspectRatio }}
                  >
                    <Image
                      src={previewImage}
                      alt="Template preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    {previewLayout && previewGuideRegion && previewTransformMode && (
                      <>
                        <div
                          className="pointer-events-none absolute border border-dashed border-white/70"
                          style={rectToPercentageStyle(previewGuideRegion, previewLayout.canvas)}
                        />
                        <div
                          className={`pointer-events-none absolute w-px ${
                            previewCenterAlignedX ? 'bg-emerald-400' : 'bg-white/70'
                          }`}
                          style={{
                            left: `${((previewGuideRegion.left + previewGuideRegion.width / 2) / previewLayout.canvas.width) * 100}%`,
                            top: `${(previewGuideRegion.top / previewLayout.canvas.height) * 100}%`,
                            height: `${(previewGuideRegion.height / previewLayout.canvas.height) * 100}%`,
                          }}
                        />
                        <div
                          className={`pointer-events-none absolute h-px ${
                            previewCenterAlignedY ? 'bg-emerald-400' : 'bg-white/70'
                          }`}
                          style={{
                            left: `${(previewGuideRegion.left / previewLayout.canvas.width) * 100}%`,
                            top: `${((previewGuideRegion.top + previewGuideRegion.height / 2) / previewLayout.canvas.height) * 100}%`,
                            width: `${(previewGuideRegion.width / previewLayout.canvas.width) * 100}%`,
                          }}
                        />
                      </>
                    )}
                    {previewLayout && effectivePreviewFrameRect && previewDevice && (
                      <div
                        role="presentation"
                        className={`absolute border-2 ${
                          previewTransformMode === 'move'
                            ? 'cursor-grabbing border-emerald-400'
                            : 'cursor-grab border-white/80'
                        } rounded-[18px] bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.2)]`}
                        style={rectToPercentageStyle(
                          effectivePreviewFrameRect,
                          previewLayout.canvas
                        )}
                        onPointerDown={(event) =>
                          beginPreviewTransform(event, previewDevice, 'move')
                        }
                        onPointerMove={handlePreviewDragMove}
                        onPointerUp={finishPreviewDrag}
                        onPointerCancel={finishPreviewDrag}
                      >
                        <div className="pointer-events-none absolute inset-0 rounded-[16px] border border-black/15" />
                        {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                          const positionClass =
                            corner === 'nw'
                              ? '-left-2 -top-2 cursor-nwse-resize'
                              : corner === 'ne'
                                ? '-right-2 -top-2 cursor-nesw-resize'
                                : corner === 'sw'
                                  ? '-left-2 -bottom-2 cursor-nesw-resize'
                                  : '-right-2 -bottom-2 cursor-nwse-resize';

                          return (
                            <div
                              key={corner}
                              role="presentation"
                              className={`absolute h-4 w-4 rounded-full border-2 border-background bg-emerald-400 shadow ${positionClass}`}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                beginPreviewTransform(event, previewDevice, 'resize', corner);
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                    {previewLoading && (
                      <div className="absolute inset-x-2 top-2 rounded bg-background/85 px-2 py-1 text-center text-xs text-muted-foreground backdrop-blur-sm">
                        Updating preview...
                      </div>
                    )}
                  </div>
                )}
                {!previewImage && previewLoading && (
                  <p className="text-sm text-muted-foreground">Rendering preview...</p>
                )}
                {previewError && <p className="mt-3 text-sm text-destructive">{previewError}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedScreenVariantCount} selected screen-device variant(s) across{' '}
                {selectedScreenIds.length} screen(s) = {estimatedOutputCount} output image(s)
              </div>
              <Button
                size="lg"
                onClick={startGeneration}
                disabled={
                  generating ||
                  selectedDevices.length === 0 ||
                  selectedScreenIds.length === 0 ||
                  backgroundImageUploading ||
                  hasMissingScreenLocales ||
                  hasMissingScreenBackgroundImage
                }
                className="w-full max-w-md"
              >
                {generating ? 'Starting Generation...' : 'Generate Screenshots'}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
