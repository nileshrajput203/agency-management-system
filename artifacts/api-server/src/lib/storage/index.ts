import fs from "fs";
import path from "path";
import { logger } from "../logger";

export interface StoredFile {
  key: string;
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface IStorageProvider {
  saveFile(buffer: Buffer, originalFilename: string, mimetype: string): Promise<StoredFile>;
  deleteFile(key: string): Promise<boolean>;
  getFileUrl(key: string): string;
}

export class LocalStorageProvider implements IStorageProvider {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, originalFilename: string, mimetype: string): Promise<StoredFile> {
    const ext = path.extname(originalFilename);
    const key = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.uploadsDir, key);

    await fs.promises.writeFile(filePath, buffer);

    return {
      key,
      url: this.getFileUrl(key),
      filename: key,
      size: buffer.length,
      mimetype,
    };
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadsDir, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err) {
      logger.error({ err, key }, "LocalStorageProvider: Failed to delete file");
      return false;
    }
  }

  getFileUrl(key: string): string {
    return `/api/uploads/${key}`;
  }
}

let storageProviderInstance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (!storageProviderInstance) {
    const providerType = process.env.STORAGE_PROVIDER || "local";
    if (providerType === "local") {
      storageProviderInstance = new LocalStorageProvider();
    } else {
      logger.warn({ providerType }, "Unknown STORAGE_PROVIDER specified. Falling back to LocalStorageProvider.");
      storageProviderInstance = new LocalStorageProvider();
    }
  }
  return storageProviderInstance;
}
