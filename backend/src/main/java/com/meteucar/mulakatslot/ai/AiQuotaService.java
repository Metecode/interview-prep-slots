package com.meteucar.mulakatslot.ai;

import java.util.OptionalInt;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Haftalık kota. JPA değil düz SQL: artış tek bir koşullu upsert ifadesi
 * ve sonucu RETURNING ile okunuyor; entity üzerinden oku-değiştir-yaz iki
 * eşzamanlı isteği limitin üstüne çıkarabilirdi.
 *
 * <p>Her çağrı kendi başına commit olur (transaction yok). Bilerek: kota
 * sağlayıcı çağrısından ÖNCE düşer ve çağrı 20 saniye sürebilir; o süre
 * boyunca satır kilidi tutulmasın.
 */
@Service
public class AiQuotaService {

    /*
      Eşzamanlı iki istek aynı satıra geldiğinde ikincisi birincinin satır
      kilidini bekler; PostgreSQL ON CONFLICT DO UPDATE'in WHERE koşulunu
      satırın SON sürümüne göre yeniden değerlendirir. Koşul tutmazsa satır
      güncellenmez ve RETURNING hiçbir şey döndürmez: limit aşılamaz.
      Satır hiç yokken iki INSERT yarışırsa biri çakışmaya düşüp aynı yoldan
      UPDATE dalına geçer.
     */
    private static final String CONSUME_SQL = """
            INSERT INTO ai_usage (user_id, week_start, count)
            VALUES (:userId, :weekStart, 1)
            ON CONFLICT (user_id, week_start)
            DO UPDATE SET count = ai_usage.count + 1
            WHERE ai_usage.count < :limit
            RETURNING count
            """;

    /** count > 0: iade hiçbir zaman sayacı eksiye düşürmesin. */
    private static final String REFUND_SQL = """
            UPDATE ai_usage SET count = count - 1
            WHERE user_id = :userId AND week_start = :weekStart AND count > 0
            """;

    private static final String USED_SQL = """
            SELECT count FROM ai_usage WHERE user_id = :userId AND week_start = :weekStart
            """;

    private final JdbcClient jdbcClient;

    public AiQuotaService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Bir hak düşer. Hak kalmadıysa boş döner.
     *
     * @return artıştan sonraki kullanım sayısı
     */
    public OptionalInt tryConsume(UUID userId, AiWeek week, int limit) {
        // Limit 0 iken INSERT dalı koşulsuz 1 yazardı; hiç denemeden reddet.
        if (limit <= 0) {
            return OptionalInt.empty();
        }
        return jdbcClient.sql(CONSUME_SQL)
                .param("userId", userId)
                .param("weekStart", week.start())
                .param("limit", limit)
                .query(Integer.class)
                .optional()
                .map(OptionalInt::of)
                .orElse(OptionalInt.empty());
    }

    /**
     * Başarısız çağrı kota yemesin. Artışın yapıldığı HAFTAYA iade edilir:
     * pazar gece yarısını geçen bir çağrı yeni haftanın sayacını düşürmesin.
     */
    public void refund(UUID userId, AiWeek week) {
        jdbcClient.sql(REFUND_SQL)
                .param("userId", userId)
                .param("weekStart", week.start())
                .update();
    }

    public int used(UUID userId, AiWeek week) {
        return jdbcClient.sql(USED_SQL)
                .param("userId", userId)
                .param("weekStart", week.start())
                .query(Integer.class)
                .optional()
                .orElse(0);
    }
}
