package com.postshiba;

public final class ApiError extends RuntimeException {
    public final String error;
    public final String field;
    public final String message;

    public ApiError(String error, String field, String message) {
        super(message != null && !message.isEmpty() ? message : error);
        this.error = error;
        this.field = field;
        this.message = message;
    }
}
