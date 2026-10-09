package com.acadion.backend.security;

import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;

import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;

import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;

import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.Customizer;
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {

        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http

                .csrf(csrf ->
                        csrf.disable()
                )

                .cors(Customizer.withDefaults())


                .authorizeHttpRequests(auth -> auth

                        // VERY IMPORTANT
                        .requestMatchers(
                                HttpMethod.OPTIONS,
                                "/**"
                        ).permitAll()

                        .requestMatchers(
                                "/error",
                                "/api/auth/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/classrooms/**"
                        ).authenticated()

                        .requestMatchers(
                                "/api/admin/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/papers/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/responses/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/analytics/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/predictions/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/students/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/evaluation/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/profile/**"
                        ).permitAll()

                        .anyRequest()
                        .authenticated()
                )

                .sessionManagement(session ->

                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                .httpBasic(httpBasic ->
                        httpBasic.disable()
                )

                .formLogin(form ->
                        form.disable()
                )

                .addFilterBefore(
                        jwtFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }
}