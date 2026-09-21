package com.meteucar.mulakatslot.question;

/**
 * İçerik dosyalarından biri geçersiz ya da tutarsız olduğunda fırlatılır.
 * QuestionSeeder ApplicationReadyEvent'te çalıştığı için bu, uygulama
 * açılışını durdurur.
 */
public class QuestionContentException extends RuntimeException {

    public QuestionContentException(String message) {
        super(message);
    }
}
