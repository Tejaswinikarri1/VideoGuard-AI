package com.videoguard.videos;

import com.videoguard.common.ApiException;
import com.videoguard.security.AuthUser;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;

/** Single place for ownership / explicit-grant checks. Unauthorized access reports 404 to avoid confirming existence. */
@Service
public class AccessService {
    private final VideoRepository videos;
    private final MongoTemplate t;

    public AccessService(VideoRepository videos, MongoTemplate t) { this.videos = videos; this.t = t; }

    public Video video(AuthUser u, String id) {
        Video v = videos.findByIdAndDeletedAtIsNull(id).orElseThrow(ApiException::notFound);
        if (!canAccess(u, v)) throw ApiException.notFound();
        return v;
    }

    public Video ownedVideo(AuthUser u, String id) {
        Video v = video(u, id);
        if (!v.ownerId.equals(u.id())) throw ApiException.forbidden();
        return v;
    }

    public boolean canAccess(AuthUser u, Video v) { return v.ownerId.equals(u.id()) || v.sharedWith.contains(u.id()); }

    public Criteria accessibleVideos(AuthUser u) {
        return new Criteria().andOperator(Criteria.where("deletedAt").is(null),
                new Criteria().orOperator(Criteria.where("ownerId").is(u.id()), Criteria.where("sharedWith").is(u.id())));
    }

    public List<String> accessibleVideoIds(AuthUser u) {
        return t.find(Query.query(accessibleVideos(u)), Video.class).stream().map(v -> v.id).toList();
    }
}
