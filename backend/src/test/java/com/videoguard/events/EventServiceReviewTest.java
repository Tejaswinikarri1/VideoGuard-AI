package com.videoguard.events;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.security.AuthUser;
import com.videoguard.videos.AccessService;
import com.videoguard.videos.Video;
import com.videoguard.videos.VideoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class EventServiceReviewTest {
    @Test
    void regularUserCanReviewEventOnSharedVideo() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        EventRepository events = mock(EventRepository.class);
        ReviewRepository reviews = mock(ReviewRepository.class);
        VideoRepository videos = mock(VideoRepository.class);
        AuthUser user = new AuthUser("user-1", "user@example.com", "User", Set.of("USER"));
        Event event = new Event();
        event.id = "event-1";
        event.videoId = "video-1";
        event.eventType = "PERSON_LOITERING";
        event.reviewStatus = "PENDING";
        Video video = new Video();
        video.id = event.videoId;
        video.ownerId = "owner-1";
        video.sharedWith.add(user.id());

        when(events.findById(event.id)).thenReturn(Optional.of(event));
        when(videos.findByIdAndDeletedAtIsNull(video.id)).thenReturn(Optional.of(video));
        when(mongo.find(any(Query.class), eq(Review.class))).thenReturn(List.of());

        EventService service = new EventService(mongo, events, reviews, new AccessService(videos, mongo), mock(AuditService.class));

        EventDto result = service.review(user, event.id, new EventService.ReviewRequest("CONFIRMED", "Reviewed evidence"));

        assertEquals("CONFIRMED", result.reviewStatus());
        verify(reviews).save(argThat(review -> "user-1".equals(review.reviewerId) && "CONFIRMED".equals(review.decision)));
        verify(events).save(event);
    }

    @Test
    void userCannotReviewEventOnVideoTheyCannotAccess() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        EventRepository events = mock(EventRepository.class);
        VideoRepository videos = mock(VideoRepository.class);
        AuthUser user = new AuthUser("user-1", "user@example.com", "User", Set.of("USER"));
        Event event = new Event();
        event.id = "event-1";
        event.videoId = "video-1";
        Video video = new Video();
        video.id = event.videoId;
        video.ownerId = "owner-1";

        when(events.findById(event.id)).thenReturn(Optional.of(event));
        when(videos.findByIdAndDeletedAtIsNull(video.id)).thenReturn(Optional.of(video));

        EventService service = new EventService(mongo, events, mock(ReviewRepository.class),
                new AccessService(videos, mongo), mock(AuditService.class));

        assertThrows(ApiException.class, () -> service.review(user, event.id, new EventService.ReviewRequest("REJECTED", null)));
    }

    @Test
    void restoresEventStatusWhenReviewHistoryCannotBeSaved() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        EventRepository events = mock(EventRepository.class);
        ReviewRepository reviews = mock(ReviewRepository.class);
        VideoRepository videos = mock(VideoRepository.class);
        AuthUser user = new AuthUser("user-1", "user@example.com", "User", Set.of("USER"));
        Event event = new Event();
        event.id = "event-1";
        event.videoId = "video-1";
        event.reviewStatus = "PENDING";
        Video video = new Video();
        video.id = event.videoId;
        video.ownerId = user.id();

        when(events.findById(event.id)).thenReturn(Optional.of(event));
        when(videos.findByIdAndDeletedAtIsNull(video.id)).thenReturn(Optional.of(video));
        when(reviews.save(any(Review.class))).thenThrow(new IllegalStateException("review store unavailable"));

        EventService service = new EventService(mongo, events, reviews, new AccessService(videos, mongo), mock(AuditService.class));

        assertThrows(IllegalStateException.class,
                () -> service.review(user, event.id, new EventService.ReviewRequest("CONFIRMED", null)));

        assertEquals("PENDING", event.reviewStatus);
        verify(events, times(2)).save(event);
    }
}
