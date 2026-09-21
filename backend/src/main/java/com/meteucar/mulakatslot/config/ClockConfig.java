package com.meteucar.mulakatslot.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Zaman bir bağımlılık: refresh token'ın tolerans penceresi ve temizlik işi
 * "şimdi"nin ne olduğuna göre karar veriyor. Saati bean olarak vermek,
 * testlerin gerçek zamanı beklemeden ileri sarmasını sağlıyor.
 */
@Configuration
public class ClockConfig {

    @Bean
    Clock clock() {
        return Clock.systemDefaultZone();
    }
}
