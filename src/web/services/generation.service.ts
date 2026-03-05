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
import type { DeviceType, Screen, ScreenVariant } from '../types';

type ScreenDeviceVariantTask = {
  screen: Screen;
  deviceType: DeviceType;
  variant: ScreenVariant;
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
        template_style,
        template_background,
        include_text,
        text_style,
        frame_mode,
        frame_modes,
        frame_asset_files,
      } = config;
      const includeText = include_text !== false;
      const templateBackgroundImage =
        template_background?.mode === 'image'
          ? await readTemplateBackground(template_background.image_path)
          : undefined;

      // Fetch app for validation
      const app = getAppById(app_id);
      if (!app) {
        throw new Error(`App ${app_id} not found`);
      }

      // Fetch all screens for this app
      const screens = getScreensByAppId(app_id);

      if (screens.length === 0) {
        throw new Error('No screens found for this app');
      }

      const relevantScreenVariantTasks: ScreenDeviceVariantTask[] = [];
      for (const screen of screens) {
        for (const deviceType of devices) {
          const variant = screen.variants.find((candidate) => candidate.device_type === deviceType);
          if (variant) {
            relevantScreenVariantTasks.push({
              screen,
              deviceType,
              variant,
            });
          }
        }
      }

      if (relevantScreenVariantTasks.length === 0) {
        throw new Error('No screens match the selected device types');
      }

      // Calculate total tasks
      const totalTasks = relevantScreenVariantTasks.length * locales.length;
      let completedTasks = 0;

      // Process each screen/device variant for each locale
      for (const task of relevantScreenVariantTasks) {
        const { screen, deviceType, variant } = task;

        for (const locale of locales) {
          try {
            const copy = includeText ? getCopy(screen.id, locale) : null;
            if (includeText && !copy) {
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
            const resolvedFrameMode = frame_modes?.[deviceType] ?? frame_mode ?? 'minimal';
            const resolvedFrameAssetFile =
              resolvedFrameMode === 'realistic' ? frame_asset_files?.[deviceType] : undefined;

            // Generate composited image
            const outputBuffer = await this.templateService.generateScreenshot(
              screenshotBuffer,
              template_style,
              template_background,
              templateBackgroundImage,
              includeText,
              text_style
                ? {
                    fontFamily: text_style.font_family,
                    fontSize: text_style.font_size,
                    subtitleFontSize: text_style.subtitle_size,
                    fontColor: text_style.font_color,
                  }
                : undefined,
              templateDeviceType,
              includeText ? copy?.title || '' : '',
              includeText ? copy?.subtitle || '' : '',
              locale,
              resolvedFrameMode,
              resolvedFrameAssetFile
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
