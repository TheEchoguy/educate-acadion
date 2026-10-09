package com.acadion.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey secretKey;

    @Value("${app.jwt.expiration}")
    private long jwtExpiration;

    public JwtUtil(
            @Value("${app.jwt.secret}")
            String secret
    ) {

        this.secretKey =
                Keys.hmacShaKeyFor(
                        secret.getBytes()
                );
    }

    public String generateToken(

            String email,

            String role,

            String name,

            String usn
    ) {

        return Jwts.builder()

                .setSubject(email)

                .claim("role", role)

                .claim("name", name)

                .claim("usn", usn)

                .setIssuedAt(new Date())

                .setExpiration(
                        new Date(
                                System.currentTimeMillis()
                                        + jwtExpiration
                        )
                )

                .signWith(
                        secretKey,
                        SignatureAlgorithm.HS256
                )

                .compact();
    }

    public Claims extractClaims(
            String token
    ) {

        return Jwts.parserBuilder()

                .setSigningKey(secretKey)

                .build()

                .parseClaimsJws(token)

                .getBody();
    }

    public String extractEmail(
            String token
    ) {

        return extractClaims(token)
                .getSubject();
    }
}