package com.acadion.backend.service.parser;

import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.Tesseract;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Service
public class OcrService {

    private final Tesseract tesseract;
    private boolean ocrAvailable = false;

    public OcrService(
            @Value("${tessdata.path:}")
            String configuredPath
    ) {
        this.tesseract = new Tesseract();

        try {
            String resolvedPath = resolveTessdataPath(configuredPath);
            if (resolvedPath != null) {
                tesseract.setDatapath(resolvedPath);
                tesseract.setLanguage("eng");
                ocrAvailable = true;
                log.info("Tesseract OCR initialized successfully with datapath: {}", resolvedPath);
            } else {
                log.warn("Tesseract tessdata directory could not be resolved. OCR will be disabled.");
            }
        } catch (Throwable t) {
            log.error("Failed to initialize Tesseract: {}", t.getMessage());
            ocrAvailable = false;
        }
    }

    private String resolveTessdataPath(String configured) {
        // List of candidate paths
        String[] candidates = {
                configured,
                "tessdata",
                "backend/tessdata",
                "./tessdata",
                System.getenv("TESSDATA_PREFIX"),
                "C:/Program Files/Tesseract-OCR/tessdata",
                "C:/Program Files (x86)/Tesseract-OCR/tessdata"
        };

        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            File dir = new File(candidate);
            File trainedData = new File(dir, "eng.traineddata");
            if (trainedData.exists() && trainedData.isFile()) {
                return dir.getAbsolutePath();
            }
        }
        return null;
    }

    // =========================================
    // OCR FOR IMAGE FILE
    // =========================================

    public String extractTextFromImage(MultipartFile file) {
        if (!ocrAvailable) {
            log.warn("OCR is not available; skipping image OCR extraction.");
            return "";
        }

        File tempFile = null;
        try {
            tempFile = File.createTempFile("ocr-image", ".png");
            file.transferTo(tempFile);

            String text = tesseract.doOCR(tempFile);
            return text != null ? text : "";
        } catch (Throwable t) {
            log.error("OCR failed for image: {}", t.getMessage());
            return "";
        } finally {
            if (tempFile != null && tempFile.exists()) {
                try {
                    tempFile.delete();
                } catch (Exception ignored) {
                }
            }
        }
    }

    // =========================================
    // OCR FOR SCANNED PDF
    // =========================================

    public String extractTextFromPdf(MultipartFile file) {
        if (!ocrAvailable) {
            log.warn("OCR is not available; skipping scanned PDF OCR extraction.");
            return "";
        }

        StringBuilder extractedText = new StringBuilder();

        try (PDDocument document = Loader.loadPDF(file.getInputStream().readAllBytes())) {
            PDFRenderer renderer = new PDFRenderer(document);

            for (int page = 0; page < document.getNumberOfPages(); page++) {
                File tempImage = null;
                try {
                    BufferedImage image = renderer.renderImageWithDPI(page, 300);
                    tempImage = File.createTempFile("pdf-page", ".png");
                    ImageIO.write(image, "png", tempImage);

                    String pageText = tesseract.doOCR(tempImage);
                    if (pageText != null) {
                        extractedText.append(pageText).append("\n");
                    }
                } catch (Throwable t) {
                    log.warn("OCR failed for PDF page {}: {}", page, t.getMessage());
                } finally {
                    if (tempImage != null && tempImage.exists()) {
                        try {
                            tempImage.delete();
                        } catch (Exception ignored) {
                        }
                    }
                }
            }
        } catch (Throwable t) {
            log.error("Failed to process PDF for OCR: {}", t.getMessage());
        }

        return extractedText.toString();
    }
}