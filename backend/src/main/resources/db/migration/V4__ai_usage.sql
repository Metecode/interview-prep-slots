-- Yapay zekâ kotası: kullanıcı başına haftalık sayaç. Hafta, UTC'de
-- pazartesiden başlar (bkz. AiWeek). Eski haftaların satırları durur;
-- küçük satırlar, ileride istenirse bir temizlik işiyle silinir.
--
-- Artış tek ifadeyle, koşullu upsert ile yapılır (bkz. AiQuotaService):
-- satır kilidi eşzamanlı iki isteği sıraya sokar, WHERE koşulu son
-- sürüme göre yeniden değerlendirilir, limit aşılamaz.
CREATE TABLE ai_usage (
    user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    count INT NOT NULL CHECK (count >= 0),
    PRIMARY KEY (user_id, week_start)
);
