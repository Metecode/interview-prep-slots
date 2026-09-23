package com.meteucar.mulakatslot.ai;

import java.util.List;

/**
 * /api/ai uçlarının istek ve yanıt gövdeleri. Frontend'deki
 * src/ai/aiClient.ts şemalarıyla birebir.
 */
public final class AiDtos {

    private AiDtos() {
    }

    /**
     * Rubrik bilerek yok: soru sunucunun kendi veritabanından yüklenir.
     */
    public record EvaluateRequest(String questionId, String answer) {
    }

    /**
     * @param remaining bu haftadan kalan hak; istemci üst çubuğu buradan tazeler
     * @param cached    sonuç önbellekten mi geldi (kota düşmedi)
     */
    public record EvaluateResponse(
            List<String> hits,
            List<String> missing,
            String feedback,
            String followUp,
            int remaining,
            boolean cached) {
    }

    /** weekResetsAt ISO-8601 UTC; Zod .datetime() bunu bekliyor. */
    public record StatusResponse(boolean enabled, int remaining, String weekResetsAt) {
    }

    public record ErrorResponse(String code) {
    }
}
