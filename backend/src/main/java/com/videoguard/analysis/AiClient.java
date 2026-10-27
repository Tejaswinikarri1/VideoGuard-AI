package com.videoguard.analysis;

import com.videoguard.config.AppProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/** Talks to the internal FastAPI service with a shared service token. The AI service never writes to MongoDB or reviews. */
@Component
public class AiClient {
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};
    private final RestClient rc;

    public AiClient(AppProperties p) {
        JdkClientHttpRequestFactory f = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).build());
        f.setReadTimeout(Duration.ofSeconds(30));
        this.rc = RestClient.builder().baseUrl(p.aiServiceUrl()).requestFactory(f).defaultHeader("X-Service-Token", p.aiServiceToken()).build();
    }

    public Map<String, Object> submit(String jobId, String videoKey, List<Map<String, Object>> zones) {
        return rc.post().uri("/v1/jobs").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("jobId", jobId, "videoKey", videoKey, "zones", zones)).retrieve().body(MAP);
    }
    public Map<String, Object> status(String jobId) { return rc.get().uri("/v1/jobs/{id}", jobId).retrieve().body(MAP); }
    public Map<String, Object> result(String jobId) { return rc.get().uri("/v1/jobs/{id}/result", jobId).retrieve().body(MAP); }
    public void cancel(String jobId) { rc.delete().uri("/v1/jobs/{id}", jobId).retrieve().toBodilessEntity(); }
    public Map<String, Object> health() { return rc.get().uri("/health").retrieve().body(MAP); }
    public Map<String, Object> models() { return rc.get().uri("/v1/models").retrieve().body(MAP); }
}
