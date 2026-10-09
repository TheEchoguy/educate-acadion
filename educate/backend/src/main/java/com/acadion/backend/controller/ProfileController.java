package com.acadion.backend.controller;

import com.acadion.backend.dto.ProfileDTO;
import com.acadion.backend.dto.ProfileUpdateRequest;
import com.acadion.backend.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping("/me")
    public ResponseEntity<ProfileDTO> getMyProfile(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String usn
    ) {
        ProfileDTO profile = profileService.getProfile(email, usn);
        return ResponseEntity.ok(profile);
    }

    @PutMapping("/update")
    public ResponseEntity<ProfileDTO> updateProfile(
            @RequestBody ProfileUpdateRequest request
    ) {
        ProfileDTO updated = profileService.updateProfile(request.getEmail(), request);
        return ResponseEntity.ok(updated);
    }
}
