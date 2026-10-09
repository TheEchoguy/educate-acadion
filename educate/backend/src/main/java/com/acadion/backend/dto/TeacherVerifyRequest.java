package com.acadion.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherVerifyRequest {
    private String email;
    private String password;
    private String subject;
    private Integer semester;
}
