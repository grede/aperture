/**
 * Generation service - orchestrates screenshot generation workflow
 */

import { getTemplateService } from './template.service';
import {
  getGenerationById,
  updateGenerationStatus,
  updateGenerationProgress,
  getScreensByAppId,
  getCopy,
  createGeneratedScreenshot,
  getAppById,
} from '../lib/db';
import { readTemplateBackground, readUploadByPath, saveGeneration } from '../lib/storage';
import { DEVICE_TYPE_TO_TEMPLATE } from '../lib/constants';
import type {
  DeviceType,
  FrameAssetFilesByDevice,
  FrameModesByDevice,
  FrameOffsetsByDevice,
  FrameScalesByDevice,
  GenerationConfig,
  Screen,
  ScreenGenerationConfig,
  ScreenVariant,
  TemplateBackground,
  TemplateTextStyle,
} from '../types';

type ScreenDeviceVariantTask = {
  screen: Screen;
  deviceType: DeviceType;
  variant: ScreenVariant;
  locales: string[];
};

function resolveLocalizedOrBaseVariant(
  screen: Screen,
  deviceType: DeviceType,
  locale: string,
  baseVariant: ScreenVariant
): { screenshot_path: string } {
  const localizedVariant = screen.localized_variants.find(
    (candidate) => candidate.device_type === deviceType && candidate.locale === locale
  );

  return localizedVariant || baseVariant;
}

/**
 * Generation service for orchestrating screenshot generation
 */
export class GenerationService {
  private templateService = getTemplateService();

  private resolveScreenConfig(
    config: GenerationConfig,
    screenId: number
  ): ScreenGenerationConfig | undefined {
    const record = config.screen_configs;
    if (!record) {
      return undefined;
    }

    return record[screenId] ?? record[String(screenId) as unknown as number];
  }

  private async resolveBackgroundImage(
    background: TemplateBackground | undefined,
    cache: Map<string, Buffer>
  ): Promise<Buffer | undefined> {
    if (background?.mode !== 'image') {
      return undefined;
    }

    const cached = cache.get(background.image_path);
    if (cached) {
      return cached;
    }

    const buffer = await readTemplateBackground(background.image_path);
    cache.set(background.image_path, buffer);
    return buffer;
  }

  /**
   * Execute a generation job
   * @param generationId - Generation ID to execute
   */
  async executeGeneration(generationId: number): Promise<void> {
    try {
      // Fetch generation from database
      const generation = getGenerationById(generationId);
      if (!generation) {
        throw new Error(`Generation ${generationId} not found`);
      }

      // Update status to processing
      updateGenerationStatus(generationId, 'processing', 0);

      const { app_id, config } = generation;
      const {
        devices,
        locales,
        screen_ids,
        template_style,
        template_background,
        include_text,
        text_style,
        frame_mode,
        frame_modes,
        frame_asset_files,
        frame_scales,
        frame_offsets,
      } = config;
      const defaultIncludeText = include_text !== false;
      const backgroundImageCache = new Map<string, Buffer>();

      // Fetch app for validation
      const app = getAppById(app_id);
      if (!app) {
        throw new Error(`App ${app_id} not found`);
      }

      // Fetch all screens for this app
      const screens = getScreensByAppId(app_id);
      const selectedScreenIdSet =
        Array.isArray(screen_ids) && screen_ids.length > 0 ? new Set(screen_ids) : null;
      const scopedScreens = selectedScreenIdSet
        ? screens.filter((screen) => selectedScreenIdSet.has(screen.id))
        : screens;

      if (scopedScreens.length === 0) {
        throw new Error('No screens found for this app');
      }

      const relevantScreenVariantTasks: ScreenDeviceVariantTask[] = [];
      for (const screen of scopedScreens) {
        const screenConfig = this.resolveScreenConfig(config, screen.id);
        const screenLocales =
          screenConfig?.locales && screenConfig.locales.length > 0 ? screenConfig.locales : locales;

        for (const deviceType of devices) {
          const variant = screen.variants.find((candidate) => candidate.device_type === deviceType);
          if (variant) {
            relevantScreenVariantTasks.push({
              screen,
              deviceType,
              variant,
              locales: screenLocales,
            });
          }
        }
      }

      if (relevantScreenVariantTasks.length === 0) {
        throw new Error('No screens match the selected device types');
      }

      // Calculate total tasks
      const totalTasks = relevantScreenVariantTasks.reduce(
        (sum, task) => sum + task.locales.length,
        0
      );
      let completedTasks = 0;

      // Process each screen/device variant for each locale
      for (const task of relevantScreenVariantTasks) {
        const { screen, deviceType, variant, locales: taskLocales } = task;
        const screenConfig = this.resolveScreenConfig(config, screen.id);
        const resolvedBackground = screenConfig?.template_background ?? template_background;
        const resolvedIncludeText = screenConfig?.include_text ?? defaultIncludeText;
        const resolvedTextStyle = screenConfig?.text_style ?? text_style;
        const resolvedFrameModeMap: FrameModesByDevice | undefined =
          screenConfig?.frame_modes ?? frame_modes;
        const resolvedFrameAssetFiles: FrameAssetFilesByDevice | undefined =
          screenConfig?.frame_asset_files ?? frame_asset_files;
        const resolvedFrameScales: FrameScalesByDevice | undefined =
          screenConfig?.frame_scales ?? frame_scales;
        const resolvedFrameOffsets: FrameOffsetsByDevice | undefined =
          screenConfig?.frame_offsets ?? frame_offsets;
        const resolvedFrameModeDefault = screenConfig?.frame_mode ?? frame_mode;
        const resolvedBackgroundImage = await this.resolveBackgroundImage(
          resolvedBackground,
          backgroundImageCache
        );

        for (const locale of taskLocales) {
          try {
            const copy = resolvedIncludeText ? getCopy(screen.id, locale) : null;
            if (resolvedIncludeText && !copy) {
              console.warn(`Skipping screen ${screen.id} for locale ${locale}: No copy found`);
              completedTasks++;
              const progress = Math.round((completedTasks / totalTasks) * 100);
              updateGenerationProgress(generationId, progress);
              continue;
            }

            // Load original screenshot
            const sourceVariant = resolveLocalizedOrBaseVariant(
              screen,
              deviceType,
              locale,
              variant
            );
            const screenshotBuffer = await readUploadByPath(sourceVariant.screenshot_path);

            // Map device type to template device type
            const templateDeviceType = DEVICE_TYPE_TO_TEMPLATE[deviceType];
            const resolvedFrameMode =
              resolvedFrameModeMap?.[deviceType] ?? resolvedFrameModeDefault ?? 'minimal';
            const resolvedFrameAssetFile =
              resolvedFrameMode === 'realistic' ? resolvedFrameAssetFiles?.[deviceType] : undefined;
            const resolvedFrameScale =
              resolvedFrameMode === 'none' ? undefined : resolvedFrameScales?.[deviceType];
            const resolvedFrameOffset =
              resolvedFrameMode === 'none' ? undefined : resolvedFrameOffsets?.[deviceType];

            // Generate composited image
            const outputBuffer = await this.templateService.generateScreenshot(
              screenshotBuffer,
              template_style,
              resolvedBackground,
              resolvedBackgroundImage,
              resolvedIncludeText,
              resolvedTextStyle
                ? {
                    fontFamily: resolvedTextStyle.font_family,
                    fontSize: resolvedTextStyle.font_size,
                    subtitleFontSize: resolvedTextStyle.subtitle_size,
                    fontColor: resolvedTextStyle.font_color,
                  }
                : undefined,
              templateDeviceType,
              resolvedIncludeText ? copy?.title || '' : '',
              resolvedIncludeText ? copy?.subtitle || '' : '',
              locale,
              resolvedFrameMode,
              resolvedFrameAssetFile,
              resolvedFrameScale,
              resolvedFrameOffset
            );

            // Save generated image
            const outputPath = await saveGeneration(
              generationId,
              locale,
              screen.id,
              outputBuffer,
              deviceType
            );

            // Record in database
            createGeneratedScreenshot(generationId, screen.id, locale, outputPath, deviceType);

            // Update progress
            completedTasks++;
            const progress = Math.round((completedTasks / totalTasks) * 100);
            updateGenerationProgress(generationId, progress);
          } catch (error: any) {
            console.error(
              `Error processing screen ${screen.id} (${deviceType}) for locale ${locale}:`,
              error
            );
            // Continue with next task even if one fails
            completedTasks++;
            const progress = Math.round((completedTasks / totalTasks) * 100);
            updateGenerationProgress(generationId, progress);
          }
        }
      }

      // Mark as completed
      updateGenerationStatus(generationId, 'completed', 100);
    } catch (error: any) {
      console.error(`Generation ${generationId} failed:`, error);
      updateGenerationStatus(generationId, 'failed', 0, error.message);
      throw error;
    }
  }

  /**
   * Start a generation job (async, non-blocking)
   * @param generationId - Generation ID
   */
  startGeneration(generationId: number): void {
    // Run generation asynchronously without blocking
    this.executeGeneration(generationId).catch((error) => {
      console.error(`Async generation ${generationId} error:`, error);
    });
  }
}

/**
 * Singleton instance
 */
let generationServiceInstance: GenerationService | null = null;

/**
 * Get generation service instance
 */
export function getGenerationService(): GenerationService {
  if (!generationServiceInstance) {
    generationServiceInstance = new GenerationService();
  }
  return generationServiceInstance;
}
