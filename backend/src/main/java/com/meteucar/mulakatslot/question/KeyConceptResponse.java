package com.meteucar.mulakatslot.question;

import java.util.List;

/** Frontend'in KeyConcept tipiyle birebir eşleşir. */
public record KeyConceptResponse(String id, String label, List<String> aliases, List<String> anchors) {
}
