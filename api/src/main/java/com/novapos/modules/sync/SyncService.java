package com.novapos.modules.sync;

import com.novapos.modules.sync.dto.SyncBatchRequest;
import com.novapos.modules.sync.dto.SyncBatchResponse;
import com.novapos.modules.sync.dto.SyncStatusResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class SyncService {

    private final Set<String> acceptedEventUuids = new HashSet<>();
    private final Map<String, Long> lastSequencesByDevice = new HashMap<>();
    private final Map<String, SyncCounters> countersByDevice = new HashMap<>();

    public SyncBatchResponse ingest(SyncBatchRequest request) {
        var accepted = new ArrayList<String>();
        var duplicates = new ArrayList<String>();
        var conflicts = new ArrayList<String>();

        for (var event : request.events()) {
            var counter = countersByDevice.computeIfAbsent(request.deviceId(), ignored -> new SyncCounters());
            var sequenceKey = request.deviceId() + ":" + event.deviceSequence();
            var lastSequence = lastSequencesByDevice.getOrDefault(request.deviceId(), 0L);

            if (acceptedEventUuids.contains(event.eventUuid()) || lastSequencesByDevice.containsKey(sequenceKey)) {
                duplicates.add(event.eventUuid());
                counter.duplicates++;
                continue;
            }

            if (event.aggregateVersion() <= 0) {
                conflicts.add(event.eventUuid());
                counter.conflicts++;
                continue;
            }

            acceptedEventUuids.add(event.eventUuid());
            lastSequencesByDevice.put(sequenceKey, event.deviceSequence());
            lastSequencesByDevice.put(request.deviceId(), Math.max(lastSequence, event.deviceSequence()));
            accepted.add(event.eventUuid());
            counter.accepted++;
        }

        return new SyncBatchResponse(
            accepted,
            duplicates,
            conflicts,
            "cursor-%s-%s".formatted(request.deviceId(), Instant.now().toEpochMilli())
        );
    }

    public SyncStatusResponse status(String branchId, String deviceId) {
        var counter = countersByDevice.computeIfAbsent(deviceId, ignored -> new SyncCounters());

        return new SyncStatusResponse(
            branchId,
            deviceId,
            counter.accepted,
            counter.duplicates,
            counter.conflicts,
            "cursor-%s".formatted(deviceId)
        );
    }

    private static final class SyncCounters {
        private int accepted;
        private int duplicates;
        private int conflicts;
    }
}
