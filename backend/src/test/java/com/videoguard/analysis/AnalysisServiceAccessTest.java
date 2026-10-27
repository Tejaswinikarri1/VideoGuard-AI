package com.videoguard.analysis;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.security.AuthUser;
import com.videoguard.users.UserRepository;
import com.videoguard.videos.AccessService;
import com.videoguard.videos.Video;
import com.videoguard.videos.VideoRepository;
import com.videoguard.zones.ZoneRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AnalysisServiceAccessTest {
    private static final String VIDEO_ID = "video-1";
    private static final String USER_ID = "user-1";

    @Test
    void regularUserCanAnalyzeVideoSharedWithThem() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        AnalysisRepository analyses = mock(AnalysisRepository.class);
        VideoRepository videos = mock(VideoRepository.class);
        ZoneRepository zones = mock(ZoneRepository.class);
        UserRepository users = mock(UserRepository.class);
        AuthUser user = new AuthUser(USER_ID, "user@example.com", "User", Set.of("USER"));
        Video video = new Video();
        video.id = VIDEO_ID;
        video.ownerId = "owner-1";
        video.sharedWith.add(USER_ID);
        video.metadataStatus = "COMPLETED";

        when(videos.findByIdAndDeletedAtIsNull(VIDEO_ID)).thenReturn(Optional.of(video));
        when(analyses.findByRequestedByAndIdempotencyKey(USER_ID, "request-1")).thenReturn(Optional.empty());
        when(mongo.exists(any(Query.class), eq(AnalysisJob.class))).thenReturn(false);
        when(zones.findByVideoIdOrderByCreatedAtAsc(VIDEO_ID)).thenReturn(List.of());
        when(analyses.save(any(AnalysisJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mongo.findById(VIDEO_ID, Video.class)).thenReturn(video);
        when(users.findById(USER_ID)).thenReturn(Optional.empty());

        AnalysisService service = new AnalysisService(analyses, mongo, new AccessService(videos, mongo), zones,
                mock(AuditService.class), users);

        AnalysisDto result = service.create(user, VIDEO_ID, "request-1");

        assertEquals(VIDEO_ID, result.videoId());
        assertEquals("QUEUED", result.status());
        verify(analyses).save(any(AnalysisJob.class));
    }

    @Test
    void regularUserCannotAnalyzeVideoNotSharedWithThem() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        VideoRepository videos = mock(VideoRepository.class);
        AuthUser user = new AuthUser(USER_ID, "user@example.com", "User", Set.of("USER"));
        Video video = new Video();
        video.id = VIDEO_ID;
        video.ownerId = "owner-1";
        when(videos.findByIdAndDeletedAtIsNull(VIDEO_ID)).thenReturn(Optional.of(video));

        AnalysisService service = new AnalysisService(mock(AnalysisRepository.class), mongo,
                new AccessService(videos, mongo), mock(ZoneRepository.class),
                mock(AuditService.class), mock(UserRepository.class));

        assertThrows(ApiException.class, () -> service.create(user, VIDEO_ID, "request-1"));
    }
}
