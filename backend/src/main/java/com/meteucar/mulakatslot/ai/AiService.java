package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.ai.AiDtos.EvaluateResponse;
import com.meteucar.mulakatslot.ai.AiDtos.StatusResponse;
import com.meteucar.mulakatslot.auth.UnauthorizedException;
import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.question.QuestionRepository;
import java.time.Clock;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * Değerlendirme akışı: hız sınırı → soru → önbellek → kota → sağlayıcı →
 * doğrulama. Sağlayıcıyı bilmez; {@link AiEvaluator} yoksa özellik kapalı.
 *
 * <p>Kutuyu yapay zekâ belirlemez: burası yalnızca kavram kararı ve geri
 * bildirim üretir, ilerlemeye dokunmaz. Kutu yine öz-değerlendirmeyle
 * güncellenir.
 *
 * <p>Cevap metni hiçbir log satırına girmez; yalnızca soru id'si, kullanıcı
 * id'si ve sonuç türü loglanır.
 */
@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    /** Karakter sınırı; bundan uzun cevap mülakat cevabı değil, yük testidir. */
    static final int MAX_ANSWER_CHARS = 4000;

    private final Optional<AiEvaluator> evaluator;
    private final QuestionRepository questionRepository;
    private final AiQuotaService quotaService;
    private final AiRateLimiter rateLimiter;
    private final AiEvaluationCache cache;
    private final int weeklyLimit;
    private final Clock clock;

    public AiService(Optional<AiEvaluator> evaluator, QuestionRepository questionRepository,
            AiQuotaService quotaService, AiRateLimiter rateLimiter, AiEvaluationCache cache,
            AiProperties properties, Clock clock) {
        this.evaluator = evaluator;
        this.questionRepository = questionRepository;
        this.quotaService = quotaService;
        this.rateLimiter = rateLimiter;
        this.cache = cache;
        this.weeklyLimit = properties.weeklyLimit();
        this.clock = clock;

        String provider = properties.provider() == null ? "" : properties.provider().strip();
        if (evaluator.isPresent()) {
            log.info("Yapay zekâ değerlendirmesi açık (sağlayıcı={}, haftalık limit={})", provider, weeklyLimit);
        } else if (!provider.isEmpty()) {
            // Açılış durmaz: AI zorunlu yol değil. Ama sessiz de kalmasın.
            log.warn("AI_PROVIDER={} verilmiş ama sağlayıcı kurulamadı (anahtar yok ya da bilinmeyen "
                    + "sağlayıcı); yapay zekâ kapalı", provider);
        }
    }

    public StatusResponse status(UUID userId) {
        AiWeek week = AiWeek.containing(clock.instant());
        boolean enabled = evaluator.isPresent();
        int remaining = enabled ? remaining(quotaService.used(userId, week)) : 0;
        return new StatusResponse(enabled, remaining, week.resetsAt().toString());
    }

    public EvaluateResponse evaluate(UUID userId, String questionId, String answer) {
        AiEvaluator active = evaluator.orElseThrow(AiRequestException::disabled);
        requireValid(questionId, answer);

        if (!rateLimiter.tryAcquire(userId)) {
            throw AiRequestException.rateLimited();
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(AiRequestException::questionNotFound);
        Rubric rubric = Rubric.of(question);
        AiWeek week = AiWeek.containing(clock.instant());
        String cacheKey = AiEvaluationCache.keyOf(questionId, answer);

        // Önbellekteki sonuç da rubriğe göre yeniden doğrulanır: içerik
        // güncellenip bir kavram kalkmış olabilir.
        Optional<AiEvaluation> cached = cache.get(cacheKey);
        if (cached.isPresent()) {
            log.info("AI değerlendirmesi önbellekten (question={}, user={})", questionId, userId);
            AiEvaluation result = AiEvaluationValidator.validate(cached.get(), rubric.conceptIds());
            return response(result, remaining(quotaService.used(userId, week)), true);
        }

        int used = consume(userId, week);
        AiEvaluation result;
        try {
            result = AiEvaluationValidator.validate(active.evaluate(question, answer), rubric.conceptIds());
        } catch (AiResponseException e) {
            quotaService.refund(userId, week);
            log.warn("AI yanıtı okunamadı (question={}, user={}): {}", questionId, userId, e.getMessage());
            throw AiRequestException.badProviderResponse();
        } catch (AiUnavailableException e) {
            quotaService.refund(userId, week);
            log.warn("AI sağlayıcısı şu an cevap vermiyor (question={}, user={}): {}",
                    questionId, userId, e.getMessage());
            throw AiRequestException.unavailable();
        } catch (RuntimeException e) {
            // Beklenmeyen hata da kota yemesin.
            quotaService.refund(userId, week);
            log.error("AI değerlendirmesinde beklenmeyen hata (question={}, user={})", questionId, userId, e);
            throw AiRequestException.unavailable();
        }

        cache.put(cacheKey, result);
        log.info("AI değerlendirmesi tamamlandı (question={}, user={}, hits={}/{})",
                questionId, userId, result.hits().size(), rubric.concepts().size());
        return response(result, remaining(used), false);
    }

    private static void requireValid(String questionId, String answer) {
        if (questionId == null || questionId.isBlank()
                || answer == null || answer.isBlank()
                || answer.length() > MAX_ANSWER_CHARS) {
            throw AiRequestException.invalidRequest();
        }
    }

    /**
     * Token imzası geçerli olsa bile kullanıcı silinmiş olabilir; yabancı
     * anahtar hatasıyla 500 vermektense 401 dönmek doğru cevap.
     */
    private int consume(UUID userId, AiWeek week) {
        OptionalInt used;
        try {
            used = quotaService.tryConsume(userId, week, weeklyLimit);
        } catch (DataIntegrityViolationException e) {
            throw new UnauthorizedException("token geçerli ama kullanıcı yok: " + userId);
        }
        return used.orElseThrow(AiRequestException::quotaExceeded);
    }

    private int remaining(int used) {
        return Math.max(0, weeklyLimit - used);
    }

    private static EvaluateResponse response(AiEvaluation result, int remaining, boolean cached) {
        return new EvaluateResponse(
                result.hits(), result.missing(), result.feedback(), result.followUp(), remaining, cached);
    }
}
