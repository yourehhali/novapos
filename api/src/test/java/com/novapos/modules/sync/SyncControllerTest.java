package com.novapos.modules.sync;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SyncControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldAcceptThenDeduplicateEvents() throws Exception {
        var loginResponse = mockMvc.perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {
                          "login": "cashier@novapos.ma",
                          "password": "Pass123!"
                        }
                        """)
            )
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode json = objectMapper.readTree(loginResponse);
        var accessToken = json.get("accessToken").asText();

        var payload = """
            {
              "branchId": "branch-oujda",
              "deviceId": "device-oujda-01",
              "events": [
                {
                  "eventUuid": "evt-001",
                  "tenantId": "tenant-atlas-bites",
                  "branchId": "branch-oujda",
                  "deviceId": "device-oujda-01",
                  "deviceSequence": 1,
                  "timestamp": "2026-07-25T16:20:00Z",
                  "eventType": "OrderCreated",
                  "aggregateType": "ORDER",
                  "aggregateId": "order-001",
                  "aggregateVersion": 1,
                  "schemaVersion": 1,
                  "status": "PENDING",
                  "payload": {
                    "total": 36
                  }
                }
              ]
            }
            """;

        mockMvc.perform(
                post("/api/sync/events")
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload)
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.acceptedEventUuids[0]").value("evt-001"));

        mockMvc.perform(
                post("/api/sync/events")
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload)
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicateEventUuids[0]").value("evt-001"));
    }
}
