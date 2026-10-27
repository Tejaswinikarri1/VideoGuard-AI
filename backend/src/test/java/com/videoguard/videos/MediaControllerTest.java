package com.videoguard.videos;

import com.videoguard.config.AppProperties;
import com.videoguard.events.EventRepository;
import com.videoguard.security.JwtService;
import com.videoguard.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class MediaControllerTest {
    @TempDir Path tempDir;

    private MockMvc mvc;
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        var props = new AppProperties("http://localhost:5173", "01234567890123456789012345678901", 15, 300,
                null, null, 500, 3600, null, null, 1, 120, 2, null, null, "ffmpeg", "ffprobe", 100);
        var jwt = new JwtService(props);
        token = jwt.issueMedia("user-1", "video:video-1");

        Path videoFile = tempDir.resolve("video.mp4");
        Files.write(videoFile, "0123456789".getBytes());
        var video = new Video();
        video.id = "video-1";
        video.storageKey = "video.mp4";
        video.mimeType = "video/mp4";
        var videos = mock(VideoRepository.class);
        when(videos.findByIdAndDeletedAtIsNull("video-1")).thenReturn(Optional.of(video));

        var storage = mock(StorageService.class);
        when(storage.video("video.mp4")).thenReturn(videoFile);
        mvc = standaloneSetup(new MediaController(jwt, mock(AccessService.class), storage, videos,
                mock(EventRepository.class), props)).build();
    }

    @Test
    void streamsByteRangeWithVideoContentType() throws Exception {
        mvc.perform(get("/api/v1/media/video/video-1").param("t", token).header("Range", "bytes=2-5"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string("Content-Range", "bytes 2-5/10"))
                .andExpect(content().contentType("video/mp4"))
                .andExpect(content().bytes("2345".getBytes()));
    }

    @Test
    void rejectsUnsatisfiableByteRange() throws Exception {
        mvc.perform(get("/api/v1/media/video/video-1").param("t", token).header("Range", "bytes=20-30"))
                .andExpect(status().isRequestedRangeNotSatisfiable())
                .andExpect(header().string("Content-Range", "bytes */10"));
    }
}
