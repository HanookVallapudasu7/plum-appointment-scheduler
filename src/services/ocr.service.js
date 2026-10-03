const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const logger = require('../utils/logger');
const { sanitizeText, hasMeaningfulText } = require('../utils/text.utils');

// Locate local traineddata path for 100% offline, deterministic OCR
const LOCAL_TESSDATA_PATH = path.resolve(__dirname, '../data/tessdata');
const FALLBACK_TESSDATA_PATH = path.resolve(__dirname, '../../node_modules/@tesseract.js-data/eng/4.0.0_best_int');

function resolveTessdataPath() {
  if (fs.existsSync(path.join(LOCAL_TESSDATA_PATH, 'eng.traineddata.gz'))) {
    return LOCAL_TESSDATA_PATH;
  }
  if (fs.existsSync(path.join(FALLBACK_TESSDATA_PATH, 'eng.traineddata.gz'))) {
    return FALLBACK_TESSDATA_PATH;
  }
  return undefined; // Let Tesseract fall back if neither exists
}

class OcrService {
  // Preprocess image with Sharp: grayscale, contrast normalization, and slight sharpening to boost OCR accuracy
  async preprocessImage(imageBuffer) {
    try {
      const pipeline = sharp(imageBuffer);
      const metadata = await pipeline.metadata();

      if (!metadata.format) {
        const error = new Error('Corrupted or invalid image buffer.');
        error.code = 'INVALID_IMAGE';
        error.statusCode = 400;
        throw error;
      }

      let transformer = sharp(imageBuffer)
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true
        })
        .grayscale()
        .normalise()
        .sharpen();

      return await transformer.png().toBuffer();
    } catch (err) {
      if (err.code === 'INVALID_IMAGE') throw err;
      logger.warn({ err: err.message }, 'Sharp image preprocessing failed, proceeding with raw buffer');
      return imageBuffer;
    }
  }

  /**
   * Extract text from image buffer using Tesseract.js.
   *
   * @param {Buffer} imageBuffer - Raw image buffer from multer upload.
   * @returns {Promise<{ raw_text: string, confidence: number }>}
   */
  async extractTextFromImage(imageBuffer) {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      const error = new Error('Empty or invalid image buffer.');
      error.code = 'INVALID_IMAGE';
      error.statusCode = 400;
      throw error;
    }

    const preprocessedBuffer = await this.preprocessImage(imageBuffer);
    const langPath = resolveTessdataPath();

    let worker = null;
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        langPath: langPath || undefined,
        gzip: true,
        logger: () => {} // Suppress noisy stdout logs in production
      });

      const result = await worker.recognize(preprocessedBuffer);
      const rawText = sanitizeText(result.data.text || '');

      // Tesseract returns confidence in 0-100; scale to [0.0, 1.0]
      const rawConfidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
      const normalizedConfidence = Math.min(Math.max(Math.round((rawConfidence / 100) * 100) / 100, 0), 1);

      if (!hasMeaningfulText(rawText)) {
        logger.info({ rawText, confidence: normalizedConfidence }, 'OCR yielded no meaningful text');
        const error = new Error('Unable to extract usable text from the image.');
        error.code = 'OCR_FAILED';
        error.statusCode = 422;
        throw error;
      }

      logger.info({ textLength: rawText.length, confidence: normalizedConfidence }, 'OCR text extraction succeeded');

      return {
        raw_text: rawText,
        confidence: normalizedConfidence
      };
    } catch (err) {
      if (err.code === 'OCR_FAILED' || err.code === 'INVALID_IMAGE') {
        throw err;
      }

      logger.error({ err: err.message }, 'OCR recognition internal failure');
      const error = new Error('Unable to extract usable text from the image.');
      error.code = 'OCR_FAILED';
      error.statusCode = 422;
      throw error;
    } finally {
      if (worker) {
        await worker.terminate().catch(() => {});
      }
    }
  }
}

module.exports = new OcrService();
