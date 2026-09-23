package com.meteucar.mulakatslot.ai;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Tablo: ai.google.dev/gemini-api/docs/thinking, "Levels Supported". */
class GeminiThinkingTest {

    @Test
    void modelsThatSupportMinimalGetMinimal() {
        assertThat(GeminiThinking.lowestLevel("gemini-3.5-flash")).isEqualTo("minimal");
        assertThat(GeminiThinking.lowestLevel("gemini-3.5-flash-lite")).isEqualTo("minimal");
        assertThat(GeminiThinking.lowestLevel(" Gemini-3.6-Flash ")).isEqualTo("minimal");
    }

    /** 3.8 ve 3.7 Flash "minimal"i desteklemiyor; göndermek isteği reddettirir. */
    @Test
    void modelsWithoutMinimalGetLow() {
        assertThat(GeminiThinking.lowestLevel("gemini-3.8-flash")).isEqualTo("low");
        assertThat(GeminiThinking.lowestLevel("gemini-3.7-flash")).isEqualTo("low");
    }

    @Test
    void unknownModelsGetTheSafeCommonLevel() {
        assertThat(GeminiThinking.lowestLevel("gemini-9-flash")).isEqualTo("low");
        assertThat(GeminiThinking.lowestLevel(null)).isEqualTo("low");
    }
}
