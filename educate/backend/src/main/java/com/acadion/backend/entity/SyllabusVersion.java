package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "syllabus_versions")
@CompoundIndexes({
        @CompoundIndex(name = "classroom_version_unique_idx", def = "{'classroomId': 1, 'versionNumber': 1}", unique = true)
})
public class SyllabusVersion {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private Integer versionNumber;

    private String versionTitle;

    private String changeSummary;

    private String publishedBy;

    private LocalDateTime publishedAt;

    private Integer topicCount;

    @Builder.Default
    private List<SyllabusItemSnapshot> topics = new ArrayList<>();
}
