package com.meteucar.mulakatslot.ai;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;

/**
 * Kota haftası: UTC'de pazartesi 00:00'da başlar. Saat dilimi sabit,
 * sunucunun yerel ayarına bağlı değil — aynı an her makinede aynı haftaya
 * düşsün.
 *
 * @param start haftanın ilk günü; ai_usage.week_start
 */
record AiWeek(LocalDate start) {

    static AiWeek containing(Instant now) {
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        return new AiWeek(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
    }

    /** Kotanın sıfırlandığı an: bir sonraki pazartesi 00:00 UTC. */
    Instant resetsAt() {
        return start.plusWeeks(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }
}
