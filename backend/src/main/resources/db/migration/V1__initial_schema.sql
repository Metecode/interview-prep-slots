-- Kullanıcı: senkron ve AI kotası için, hesapsız kullanım için değil.
-- id üretimi Hibernate'te (@UuidGenerator) tek kaynak; DB DEFAULT yok,
-- iki üretici olmasın diye.
CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    github_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Soru: keyConcepts, anchors, followUps gibi iç içe alanlara sorgu
-- atmayacağımız için JSONB'de kalıyor. category ve topic filtreleneceği
-- için ayrı kolon.
CREATE TABLE question (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    kind TEXT NOT NULL CHECK (kind IN ('definition', 'applied')),
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_category ON question (category);

-- İlerleme: kutu kullanıcının öz-değerlendirmesiyle güncellenir.
CREATE TABLE question_progress (
    user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES question (id) ON DELETE CASCADE,
    box SMALLINT NOT NULL CHECK (box BETWEEN 1 AND 5),
    last_seen_at TIMESTAMPTZ NOT NULL,
    attempts JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, question_id)
);

-- Ayrı bir user_id index'i yok: birincil anahtar (user_id, question_id)
-- zaten user_id'yi en solda tutan bir B-Tree index oluşturuyor;
-- leftmost prefix kuralı gereği yalnızca user_id ile yapılan sorgular da
-- bu index'i kullanır. Ayrı index sadece yazma maliyeti eklerdi.
