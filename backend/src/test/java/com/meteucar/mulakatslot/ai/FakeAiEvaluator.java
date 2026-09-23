package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.question.Question;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiFunction;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * Sağlayıcı arayüzünün sahte uygulaması. Entegrasyon testleri bununla
 * çalışır; gerçek API'ye hiç gidilmez. Davranış test içinden değiştirilir.
 */
public class FakeAiEvaluator implements AiEvaluator {

    private final AtomicReference<BiFunction<Question, String, AiEvaluation>> behavior = new AtomicReference<>();
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicReference<Question> lastQuestion = new AtomicReference<>();

    public FakeAiEvaluator() {
        reset();
    }

    @Override
    public AiEvaluation evaluate(Question question, String answer) {
        calls.incrementAndGet();
        lastQuestion.set(question);
        return behavior.get().apply(question, answer);
    }

    /** Varsayılan: ilk kavram karşılandı, geri kalanı eksik. */
    public void reset() {
        calls.set(0);
        lastQuestion.set(null);
        answerWith(new AiEvaluation(List.of("concept-a"), List.of("concept-b", "concept-c"),
                "Kavram A doğru.", "Kavram B'yi açıklar mısın?"));
    }

    public void answerWith(AiEvaluation evaluation) {
        behavior.set((question, answer) -> evaluation);
    }

    public void failWith(RuntimeException exception) {
        behavior.set((question, answer) -> {
            throw exception;
        });
    }

    public int calls() {
        return calls.get();
    }

    public Question lastQuestion() {
        return lastQuestion.get();
    }

    /**
     * Uç testleri ve kota yarışı testi aynı import setini kullanır; Spring
     * context'i (ve Postgres konteynerini) paylaşsınlar.
     */
    @TestConfiguration(proxyBeanMethods = false)
    public static class Config {

        @Bean
        FakeAiEvaluator fakeAiEvaluator() {
            return new FakeAiEvaluator();
        }
    }
}
