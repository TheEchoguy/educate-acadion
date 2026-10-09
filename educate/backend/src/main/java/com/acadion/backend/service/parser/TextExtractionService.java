package com.acadion.backend.service.parser;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.pdmodel.PDDocument;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;

import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
public class TextExtractionService {

    private final OcrService ocrService;

    public String extractText(
            MultipartFile file
    ) throws IOException {

        String fileName =
                file.getOriginalFilename();

        if (fileName == null) {
            return "";
        }

        fileName = fileName.toLowerCase();

        // ===================================
        // PDF FILE
        // ===================================

        if (fileName.endsWith(".pdf")) {

            try (PDDocument document =
                         Loader.loadPDF(
                                 file.getInputStream().readAllBytes()
                         )) {

                PDFTextStripper stripper =
                        new PDFTextStripper();

                String text =
                        stripper.getText(document);

                // If scanned PDF → OCR fallback
                if (text == null || text.isBlank()) {

                    log.info("PDF has no text layer, falling back to OCR");

                    return ocrService
                            .extractTextFromPdf(file);
                }

                return text;

            } catch (Exception e) {

                log.error("Failed to extract text from PDF: {}", e.getMessage());
                throw new IOException("Failed to extract text from PDF: " + e.getMessage(), e);
            }
        }

        // ===================================
        // DOCX FILE
        // ===================================

        if (fileName.endsWith(".docx")) {

            try (XWPFDocument document =
                         new XWPFDocument(
                                 file.getInputStream()
                         );
                 XWPFWordExtractor extractor =
                         new XWPFWordExtractor(
                                 document
                         )) {

                return extractor.getText();

            } catch (Exception e) {

                log.error("Failed to extract text from DOCX: {}", e.getMessage());
                throw new IOException("Failed to extract text from DOCX: " + e.getMessage(), e);
            }
        }

        // ===================================
        // DOC FILE (Legacy Word)
        // ===================================

        if (fileName.endsWith(".doc")) {

            try (HWPFDocument document =
                         new HWPFDocument(
                                 file.getInputStream()
                         );
                 WordExtractor extractor =
                         new WordExtractor(
                                 document
                         )) {

                return extractor.getText();

            } catch (Exception e) {

                log.error("Failed to extract text from DOC: {}", e.getMessage());
                throw new IOException("Failed to extract text from DOC: " + e.getMessage(), e);
            }
        }

        // ===================================
        // IMAGE FILE
        // ===================================

        if (file.getContentType() != null
                && file.getContentType()
                .startsWith("image")) {

            return ocrService
                    .extractTextFromImage(file);
        }

        log.warn("Unsupported file type: {}", fileName);
        return "";
    }
}