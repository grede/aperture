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
import { readUpload, saveGeneration } from '../lib/storage';
import { DEVICE_TYPE_TO_TEMPLATE } from '../lib/constants';

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
        text_style,
        frame_mode,
        frame_modes,
        frame_asset_files,
      } = config;

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

      // Filter screens by requested device types
      const relevantScreens = screens.filter((screen) => devices.includes(screen.device_type));

      if (relevantScreens.length === 0) {
        throw new Error('No screens match the selected device types');
      }

      // Calculate total tasks
      const totalTasks = relevantScreens.length * locales.length;
      let completedTasks = 0;

      // Process each screen for each locale
      for (const screen of relevantScreens) {
        for (const locale of locales) {
          try {
            // Check if copy exists for this screen + locale
            const copy = getCopy(screen.id, locale);
            if (!copy) {
              console.warn(`Skipping screen ${screen.id} for locale ${locale}: No copy found`);
              completedTasks++;
              const progress = Math.round((completedTasks / totalTasks) * 100);
              updateGenerationProgress(generationId, progress);
              continue;
            }

            // Load original screenshot
            const screenshotBuffer = await readUpload(app_id, screen.id);

            // Map device type to template device type
            const templateDeviceType = DEVICE_TYPE_TO_TEMPLATE[screen.device_type];
            const resolvedFrameMode = frame_modes?.[screen.device_type] ?? frame_mode ?? 'minimal';
            const resolvedFrameAssetFile =
              resolvedFrameMode === 'realistic'
                ? frame_asset_files?.[screen.device_type]
                : undefined;

            // Generate composited image
            const outputBuffer = await this.templateService.generateScreenshot(
              screenshotBuffer,
              template_style,
              template_background,
              text_style
                ? {
                    fontFamily: text_style.font_family,
                    fontSize: text_style.font_size,
                    fontColor: text_style.font_color,
                  }
                : undefined,
              templateDeviceType,
              copy.title,
              copy.subtitle || '',
              locale,
              resolvedFrameMode,
              resolvedFrameAssetFile
            );

            // Save generated image
            const outputPath = await saveGeneration(generationId, locale, screen.id, outputBuffer);

            // Record in database
            createGeneratedScreenshot(generationId, screen.id, locale, outputPath);

            // Update progress
            completedTasks++;
            const progress = Math.round((completedTasks / totalTasks) * 100);
            updateGenerationProgress(generationId, progress);
          } catch (error: any) {
            console.error(`Error processing screen ${screen.id} for locale ${locale}:`, error);
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
