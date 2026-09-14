import { useSyncExternalStore } from "react";

import { embeddingClient } from "./client";
import type { EmbeddingStatus } from "./client";

/**
 * embeddingClient'ın yükleme durumunu React state'i gibi okur.
 * Worker olayları (progress/ready/error) yeniden render tetikler.
 */
export function useEmbeddingStatus(): EmbeddingStatus {
  return useSyncExternalStore(embeddingClient.subscribe, embeddingClient.getSnapshot);
}
