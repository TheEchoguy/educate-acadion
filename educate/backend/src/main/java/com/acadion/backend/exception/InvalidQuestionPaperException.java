package com.acadion.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidQuestionPaperException extends RuntimeException {
    public InvalidQuestionPaperException(String message) {
        super(message);
    }
}
