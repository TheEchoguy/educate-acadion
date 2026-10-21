/**
 * In-Memory Asset Registry & Lifecycle Manager (Phase 2.4).
 * Stores local File/Blob instances and their object URLs safely in browser memory.
 * Ensures object URLs remain valid while referenced in the working model or history,
 * and releases them cleanly when no longer referenced anywhere.
 */

import type { ImageAssetDTO, PresentationEditorModel } from '../types/editor';

interface RegisteredLocalAsset {
  asset_id: string;
  blob: Blob;
  url: string;
  original_filename: string;
  content_type: string;
  width_px: number;
  height_px: number;
  created_at: number;
}

class AssetRegistry {
  private localAssets = new Map<string, RegisteredLocalAsset>();

  /**
   * Registers a client-uploaded image file in the registry with an object URL.
   */
  public registerLocalAsset(
    file: File | Blob,
    filename: string,
    width_px: number,
    height_px: number,
    contentType?: string
  ): ImageAssetDTO {
    const assetId = `local_asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const url = URL.createObjectURL(file);
    const resolvedType = contentType || file.type || 'image/png';

    const entry: RegisteredLocalAsset = {
      asset_id: assetId,
      blob: file,
      url,
      original_filename: filename,
      content_type: resolvedType,
      width_px,
      height_px,
      created_at: Date.now(),
    };

    this.localAssets.set(assetId, entry);

    return {
      asset_id: assetId,
      url,
      content_type: resolvedType,
      original_filename: filename,
      width_px,
      height_px,
      is_local: true,
    };
  }

  /**
   * Retrieves a local asset entry by its asset_id.
   */
  public getLocalAsset(assetId: string): RegisteredLocalAsset | undefined {
    return this.localAssets.get(assetId);
  }

  /**
   * Collects all asset IDs currently referenced across the working model and history stacks,
   * revoking and freeing any unreferenced local object URLs to prevent memory leaks.
   */
  public gcUnusedAssets(
    activeModel: PresentationEditorModel | null,
    historyModels: PresentationEditorModel[] = []
  ): number {
    const referencedIds = new Set<string>();

    const collectFromModel = (model: PresentationEditorModel | null) => {
      if (!model) return;
      for (const slide of model.slides) {
        for (const obj of slide.objects) {
          if (obj.image_asset?.asset_id) {
            referencedIds.add(obj.image_asset.asset_id);
          }
        }
      }
    };

    collectFromModel(activeModel);
    for (const hist of historyModels) {
      collectFromModel(hist);
    }

    let freedCount = 0;
    for (const [assetId, entry] of this.localAssets.entries()) {
      if (!referencedIds.has(assetId)) {
        try {
          URL.revokeObjectURL(entry.url);
        } catch {
          // ignore revocation errors
        }
        this.localAssets.delete(assetId);
        freedCount++;
      }
    }

    return freedCount;
  }

  /**
   * Converts a Blob to a base64 Data URL string safely in browser or Node environments.
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    // Node environment fallback
    const arrayBuffer = await blob.arrayBuffer();
    const nodeBuffer = (globalThis as unknown as { Buffer?: { from: (b: ArrayBuffer) => { toString: (e: string) => string } } }).Buffer;
    if (nodeBuffer) {
      const buffer = nodeBuffer.from(arrayBuffer);
      const mime = blob.type || 'image/png';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
    return '';
  }

  /**
   * Gathers base64 payloads for local assets actively referenced in the provided model.
   * Does NOT include unreferenced assets from undo/redo history.
   */
  public async getReferencedLocalAssetPayloads(
    model: PresentationEditorModel
  ): Promise<Array<{ asset_id: string; mime_type: string; data_base64: string; file_name?: string }>> {
    const referencedLocalIds = new Set<string>();

    for (const slide of model.slides) {
      for (const obj of slide.objects) {
        if (obj.image_asset && (obj.image_asset.is_local || this.localAssets.has(obj.image_asset.asset_id))) {
          referencedLocalIds.add(obj.image_asset.asset_id);
        }
      }
    }

    const payloads: Array<{ asset_id: string; mime_type: string; data_base64: string; file_name?: string }> = [];

    for (const assetId of referencedLocalIds) {
      const entry = this.localAssets.get(assetId);
      if (entry) {
        const base64Str = await this.blobToBase64(entry.blob);
        payloads.push({
          asset_id: entry.asset_id,
          mime_type: entry.content_type,
          data_base64: base64Str,
          file_name: entry.original_filename,
        });
      }
    }

    return payloads;
  }

  /**
   * Explicitly releases all registered local object URLs (e.g. when exiting editor).
   */
  public clearAll(): void {
    for (const [, entry] of this.localAssets.entries()) {
      try {
        URL.revokeObjectURL(entry.url);
      } catch {
        // ignore
      }
    }
    this.localAssets.clear();
  }
}

export const assetRegistry = new AssetRegistry();
